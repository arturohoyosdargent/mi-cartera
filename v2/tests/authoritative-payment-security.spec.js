'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createCollectorPaymentService}=require('../../functions/v2-collector-payment');
const {businessDate}=require('../../functions/v2-collector-callable');
const BASE='orgs/v2-mi-cartera-pilot/',UID='actor-admin',ctx={uid:UID},clone=value=>structuredClone(value);
const request=(extra={})=>({creditId:'credit-a',paymentId:'payment-a',operationId:'operation-a',amount:20,expectedVersion:1,...extra});
const moraRequest=(extra={})=>request({moraAmount:3.25,moraPaymentId:'payment-mora-a',...extra});
function fixture({role='admin',active=true,routeIds=['route-a'],member={},credit={},seed={},timestamp='2026-10-14T04:59:00.000Z',date=businessDate}={}){
 const original={id:'credit-a',clientId:'client-a',routeId:'route-a',workerId:'worker-a',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:7,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-12',amount:60,paid:0,balance:60},{number:2,date:'2026-10-20',amount:60,paid:0,balance:60}],...credit};
 let docs=new Map(Object.entries({[BASE+'members/'+UID]:{active,role,routeIds,...member},[BASE+'credits/credit-a']:original,...seed})),serial=Promise.resolve(),failCommit=false,writes=0,failWrite=0,clock=timestamp;
 const runAtomic=fn=>{const task=serial.then(async()=>{const draft=new Map([...docs].map(([key,value])=>[key,clone(value)]));let writing=false,count=0;
  const put=(key,value,create)=>{writing=true;count++;writes++;if(failWrite===count)throw Error('STAGED_WRITE_FAILED');if(create&&draft.has(key))throw Error('DOCUMENT_ALREADY_EXISTS');draft.set(key,clone(value));};
  const result=await fn({get:async key=>{assert.equal(writing,false,'Firestore reads must precede all writes');return draft.has(key)?clone(draft.get(key)):null;},set:async(key,value)=>put(key,value,false),create:async(key,value)=>put(key,value,true)});
  if(failCommit)throw Error('ATOMIC_COMMIT_FAILED');docs=draft;return result;});serial=task.catch(()=>{});return task;};
 return {service:createCollectorPaymentService({runAtomic,now:()=>clock,businessDate:date}),original:clone(original),all:()=>clone([...docs]),read:key=>clone(docs.get(BASE+key)),write:(key,value)=>docs.set(BASE+key,clone(value)),remove:key=>docs.delete(BASE+key),setClock:value=>{clock=value;},writes:()=>writes,failCommit:()=>{failCommit=true;},failWrite:count=>{failWrite=count;}};
}
async function rejectedWithoutChanges(h,input,code='failed-precondition',actor=ctx){const before=h.all();await assert.rejects(h.service.execute(actor,input),error=>error.code===code);assert.deepEqual(h.all(),before);}

// Removing the paired authoritative write, role guard or snapshot derivation must fail these cases.
test('admin and supervisor record canonical paired cuota and mora without changing scheduled debt for mora',async()=>{
 for(const role of ['admin','supervisor']){
  const h=fixture({role,routeIds:[]}),out=await h.service.execute(ctx,moraRequest()),r=out.result;
  assert.equal(out.status,'APPLIED');assert.deepEqual(Object.keys(r).sort(),['audit','credit','entry','moraEntry','moraPayment','payment']);
  assert.equal(r.credit.principalPaid,16.67);assert.equal(r.credit.interestPaid,3.33);assert.equal(r.credit.penaltyPaid,7);assert.equal(r.credit.version,2);assert.equal(r.credit.schedule[0].balance,40);assert.equal(r.credit.schedule[1].balance,60);
  assert.deepEqual([r.payment.amount,r.payment.capitalAmount,r.payment.interestAmount,r.payment.penaltyAmount],[20,16.67,3.33,0]);assert.equal(r.payment.agreedMoraAmount,3.25);assert.equal(r.payment.moraPaymentId,'payment-mora-a');
  assert.deepEqual([r.moraPayment.id,r.moraPayment.amount,r.moraPayment.concept,r.moraPayment.normalPaymentId,r.moraPayment.operationId],['payment-mora-a',3.25,'MORA','payment-a','operation-a-mora']);
  assert.deepEqual([r.moraPayment.capitalAmount,r.moraPayment.interestAmount,r.moraPayment.penaltyAmount],[0,0,3.25]);
  for(const payment of [r.payment,r.moraPayment]){assert.equal(payment.creditId,'credit-a');assert.equal(payment.clientId,'client-a');assert.equal(payment.userId,UID);assert.equal(payment.routeId,'route-a');assert.equal(payment.workerId,'worker-a');assert.equal(payment.date,'2026-10-13');assert.equal(payment.balanceAfterPayment,100);assert.equal(payment.version,1);assert.equal(payment.workerAttribution.source,'CREDIT_ASSIGNMENT_AT_PAYMENT');assert.equal(payment.workerAttribution.capturedAt,'2026-10-14T04:59:00.000Z');}
  assert.deepEqual([r.entry.id,r.entry.ref,r.entry.amount],['entry-payment-a','payment-a',20]);assert.deepEqual([r.moraEntry.id,r.moraEntry.ref,r.moraEntry.amount,r.moraEntry.concept],['entry-payment-mora-a','payment-mora-a',3.25,'COBRO_MORA']);
  assert.equal(r.audit.detail.moraAmount,3.25);assert.equal(r.audit.detail.moraPaymentId,'payment-mora-a');assert.equal(r.audit.detail.totalReceived,23.25);assert.equal(out.operation.writeCount,6);assert.equal(h.writes(),7);
  assert.deepEqual(h.read('payments/payment-mora-a'),r.moraPayment);assert.deepEqual(h.read('entries/entry-payment-mora-a'),r.moraEntry);
 }
});
test('mora accepts a final scheduled payment because overdue eligibility is checked before allocation',async()=>{
 const h=fixture(),out=await h.service.execute(ctx,moraRequest({amount:120}));assert.equal(out.result.credit.status,'PAGADO');assert.equal(out.result.credit.schedule[0].balance,0);assert.equal(out.result.credit.schedule[1].balance,0);assert.equal(out.result.credit.principalPaid,100);assert.equal(out.result.credit.interestPaid,20);assert.equal(out.result.credit.penaltyPaid,7);assert.equal(out.result.moraPayment.balanceAfterPayment,0);
});
test('a collector retains normal collection but manualMora flags cannot grant paired mora',async()=>{
 const normal=fixture({role:'cobrador'});assert.equal((await normal.service.execute(ctx,request())).status,'APPLIED');
 for(const member of [{},{manualMora:true},{permissions:{manualMora:true}}])await rejectedWithoutChanges(fixture({role:'cobrador',member}),moraRequest(),'permission-denied');
});
test('unauthenticated, inactive and unsupported server roles cannot apply paired payments',async()=>{
 await rejectedWithoutChanges(fixture(),moraRequest(),'unauthenticated',{});
 for(const options of [{active:false},{role:'consulta'},{role:'ADMIN'},{role:'unknown'}])await rejectedWithoutChanges(fixture(options),moraRequest(),'permission-denied');
});
test('current server route and worker assignment governs every new collector operation',async()=>{
 for(const options of [{routeIds:['foreign']},{seed:{[BASE+'routes/route-a']:{id:'route-a',recordType:'ROUTE',active:false}}},{seed:{[BASE+'routes/worker-a']:{id:'worker-a',recordType:'WORKER',active:true,routeId:'foreign'}}}])await rejectedWithoutChanges(fixture({role:'cobrador',...options}),request(),'permission-denied');
});
test('forged client identity, schedule, allocation, server date and result snapshots are rejected',async()=>{
 for(const forged of [{role:'admin'},{routeId:'foreign'},{workerId:'foreign'},{userId:'foreign'},{date:'2020-01-01'},{schedule:[]},{credit:{principalPaid:0}},{capitalAmount:1},{payment:{}},{result:{}},{orgId:'foreign'}])await rejectedWithoutChanges(fixture(),moraRequest(forged),'invalid-argument');
});
test('normal and mora amounts require finite nonnegative two-decimal numeric requests',async()=>{
 for(const amount of [0,-1,NaN,Infinity,-Infinity,'20',null,20.001])await rejectedWithoutChanges(fixture(),moraRequest({amount}),'invalid-argument');
 for(const moraAmount of [-1,NaN,Infinity,-Infinity,'3.25',null,0.001])await rejectedWithoutChanges(fixture(),moraRequest({moraAmount}),'invalid-argument');
 for(const extra of [{moraPaymentId:'payment-a'},{moraPaymentId:'bad/id'},{moraPaymentId:''},{moraPaymentId:null},{moraPaymentId:undefined}])await rejectedWithoutChanges(fixture(),moraRequest(extra),'invalid-argument');
 for(const extra of [{moraPaymentId:'orphan'},{moraAmount:0,moraPaymentId:'orphan'}])await rejectedWithoutChanges(fixture(),request(extra),'invalid-argument');
});
test('an explicit zero mora has the legacy normal receipt and no extra financial records',async()=>{
 const h=fixture(),out=await h.service.execute(ctx,request({moraAmount:0}));assert.equal(out.status,'APPLIED');assert.equal(out.operation.writeCount,4);assert.deepEqual(Object.keys(out.result).sort(),['audit','credit','entry','payment']);assert.equal(out.result.payment.agreedMoraAmount,undefined);assert.equal(h.writes(),5);
 const before=h.all(),retry=await h.service.execute(ctx,request());assert.equal(retry.status,'ALREADY_APPLIED');assert.deepEqual(h.all(),before);
});
test('overpayment and stale versions reject the complete pair without adding mora to scheduled balance',async()=>{
 for(const extra of [{amount:120.01},{amount:123.25},{expectedVersion:2}])await rejectedWithoutChanges(fixture(),moraRequest(extra));
});
test('mora requires an actually overdue pending installment, excluding today, future and settled arrears',async()=>{
 for(const schedule of [[{date:'2026-10-13',amount:60,paid:0,balance:60},{date:'2026-10-20',amount:60,paid:0,balance:60}],[{date:'2026-10-14',amount:120,paid:0,balance:120}],[{date:'2026-10-12',amount:60,paid:60,balance:0},{date:'2026-10-20',amount:60,paid:0,balance:60}]]){
  const paid=schedule[0].paid,h=fixture({credit:{schedule,principalPaid:paid?50:0,interestPaid:paid?10:0}});await rejectedWithoutChanges(h,moraRequest());
 }
});
test('America/Lima midnight switches overdue eligibility at 05:00 UTC',async()=>{
 const credit={schedule:[{date:'2026-10-13',amount:120,paid:0,balance:120}]};
 await rejectedWithoutChanges(fixture({credit,timestamp:'2026-10-14T04:59:59.000Z'}),moraRequest());
 const h=fixture({credit,timestamp:'2026-10-14T05:00:00.000Z'}),out=await h.service.execute(ctx,moraRequest());assert.equal(out.result.payment.date,'2026-10-14');assert.equal(out.result.moraPayment.date,'2026-10-14');
});
test('malformed persisted installment values and impossible dates reject normal and paired collection',async()=>{
 for(const installment of [{amount:0},{amount:-1},{amount:NaN},{amount:60.001},{paid:-1},{paid:61},{balance:-1},{balance:61},{paid:10,balance:60},{balance:NaN},{date:'2026-02-30'},{date:'2026-13-01'},{date:'2026-2-12'},{date:''},{date:null}]){
  for(const input of [request(),moraRequest()]){const h=fixture({credit:{schedule:[{number:1,date:'2026-10-12',amount:60,paid:0,balance:60,...installment},{number:2,date:'2026-10-20',amount:60,paid:0,balance:60}]}});await rejectedWithoutChanges(h,input);}
 }
});
test('credit accounting must reconcile with the persisted schedule before recomputing allocation',async()=>{
 for(const credit of [{capital:-1},{capital:NaN},{capital:100.001},{total:undefined},{total:121},{principalPaid:101},{principalPaid:1},{interestPaid:1},{interestPaid:21},{penaltyPaid:-1},{schedule:[]},{schedule:[{date:'2026-10-12',amount:10,paid:0,balance:10}]}])for(const input of [request(),moraRequest()])await rejectedWithoutChanges(fixture({credit}),input);
});
test('deleted credit and terminal or nonreplayable states never create financial records',async()=>{
 for(const credit of [{deletedAt:'2026-10-12T00:00:00Z'},{tombstone:true},{status:'PAGADO'},{status:'RENOVADO'},{status:'ANULADO'},{status:'CERRADO_ADMIN'},{noReplay:true},{administrativeClosure:{noReplay:true}},{renewedTo:'other-credit'}])for(const input of [request(),moraRequest()])await rejectedWithoutChanges(fixture({credit}),input);
});
test('invalid server clocks and invalid or throwing business date conversion fail closed without writes',async()=>{
 for(const options of [{timestamp:'not-a-time',date:()=> '2026-10-13'},{timestamp:undefined,date:()=> '2026-10-13'},{date:()=> '2026-02-30'},{date:()=>null},{date:()=>{throw Error('CLOCK_FAILED');}}])await rejectedWithoutChanges(fixture({...options,timestamp:options.timestamp===undefined&&Object.hasOwn(options,'timestamp')?'':options.timestamp||'2026-10-14T04:59:00.000Z'}),moraRequest());
});
test('same operation double click applies paired records once and retries return the identical canonical receipt',async()=>{
 const h=fixture(),results=await Promise.all([h.service.execute(ctx,moraRequest()),h.service.execute(ctx,moraRequest())]);assert.deepEqual(results.map(x=>x.status),['APPLIED','ALREADY_APPLIED']);assert.deepEqual(results[1].result,results[0].result);assert.equal(h.writes(),7);
 const before=h.all(),retry=await h.service.execute(ctx,moraRequest());assert.equal(retry.status,'ALREADY_APPLIED');assert.deepEqual(retry.result,results[0].result);assert.deepEqual(h.all(),before);assert.equal(h.writes(),7);
});
test('the five-field legacy request fingerprint still acknowledges already accepted receipts',async()=>{
 const h=fixture(),accepted=await h.service.execute(ctx,request()),legacyKey=createHash('sha256').update(JSON.stringify({orgId:'v2-mi-cartera-pilot',uid:UID,...request()})).digest('hex');
 assert.equal(accepted.operation.requestKey,legacyKey);h.write('operations/operation-a',{...accepted.operation,requestKey:legacyKey});const before=h.all(),retry=await h.service.execute(ctx,request());assert.equal(retry.status,'ALREADY_APPLIED');assert.deepEqual(retry.result,accepted.result);assert.deepEqual(h.all(),before);
});
test('all intent changes, including mora amount or destination, collide with an accepted operation',async()=>{
 const h=fixture();await h.service.execute(ctx,moraRequest());
 for(const extra of [{amount:21},{moraAmount:3.26},{moraPaymentId:'other-mora'},{paymentId:'other-normal'},{expectedVersion:2}])await rejectedWithoutChanges(h,moraRequest(extra),'already-exists');
 await rejectedWithoutChanges(h,request(),'already-exists');h.write('members/other-actor',{role:'admin',active:true});await rejectedWithoutChanges(h,moraRequest(),'already-exists',{uid:'other-actor'});
});
test('an active exact retry survives reassignment while inactive membership and noReplay still block it',async()=>{
 const h=fixture(),accepted=await h.service.execute(ctx,moraRequest());h.write('credits/credit-a',{...h.read('credits/credit-a'),routeId:'foreign',workerId:'foreign',version:3});h.write('members/'+UID,{role:'cobrador',active:true,routeIds:[]});
 const before=h.all(),retry=await h.service.execute(ctx,moraRequest());assert.equal(retry.status,'ALREADY_APPLIED');assert.deepEqual(retry.result,accepted.result);assert.deepEqual(h.all(),before);assert.equal(h.writes(),7);
 h.write('members/'+UID,{role:'admin',active:false});await rejectedWithoutChanges(h,moraRequest(),'permission-denied');h.write('members/'+UID,{role:'admin',active:true});h.write('operations/operation-a',{...h.read('operations/operation-a'),noReplay:true});await rejectedWithoutChanges(h,moraRequest());
});
test('new operations cannot reuse either payment id, either entry id or the audit id',async()=>{
 for(const destination of ['payments/payment-a','payments/payment-mora-a','entries/entry-payment-a','entries/entry-payment-mora-a','audit/audit-operation-a'])await rejectedWithoutChanges(fixture({seed:{[BASE+destination]:{id:destination.split('/')[1],amount:99}}}),moraRequest(),'already-exists');
 const h=fixture();await h.service.execute(ctx,moraRequest());await rejectedWithoutChanges(h,moraRequest({operationId:'new-operation',expectedVersion:2}),'already-exists');await rejectedWithoutChanges(h,moraRequest({operationId:'new-operation',paymentId:'new-normal',expectedVersion:2}),'already-exists');
});
test('competing new operations cannot both consume the same credit version',async()=>{
 const h=fixture(),results=await Promise.allSettled([h.service.execute(ctx,moraRequest()),h.service.execute(ctx,moraRequest({operationId:'other-operation',paymentId:'other-normal',moraPaymentId:'other-mora'}))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='failed-precondition').length,1);assert.equal(h.read('credits/credit-a').version,2);assert.equal(h.writes(),7);
});
test('staged write and commit failures publish no credit, cuota, mora, cash, audit or operation changes',async()=>{
 for(const failure of ['commit',1,4,7]){const h=fixture(),before=h.all();if(failure==='commit')h.failCommit();else h.failWrite(failure);await assert.rejects(h.service.execute(ctx,moraRequest()),/ATOMIC_COMMIT_FAILED|STAGED_WRITE_FAILED/);assert.deepEqual(h.all(),before);}
});
test('credits sharing installment dates never borrow overdue eligibility or allocate to each other',async()=>{
 const other={id:'credit-b',clientId:'client-b',routeId:'route-b',workerId:'worker-b',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{date:'2026-10-12',amount:60,paid:0,balance:60},{date:'2026-10-20',amount:60,paid:0,balance:60}]},h=fixture({seed:{[BASE+'credits/credit-b']:other}});
 const out=await h.service.execute(ctx,moraRequest());assert.deepEqual(h.read('credits/credit-b'),other);assert.equal(out.result.moraPayment.creditId,'credit-a');
 const b=await h.service.execute(ctx,moraRequest({creditId:'credit-b',paymentId:'payment-b',moraPaymentId:'mora-b',operationId:'operation-b'}));assert.equal(b.result.payment.clientId,'client-b');assert.equal(b.result.moraPayment.routeId,'route-b');assert.equal(b.result.moraPayment.workerId,'worker-b');assert.equal(h.read('credits/credit-a').version,2);
 const future=fixture({credit:{schedule:[{date:'2026-10-20',amount:120,paid:0,balance:120}]},seed:{[BASE+'credits/credit-b']:other}});await rejectedWithoutChanges(future,moraRequest());
});

test('subcent and unsafe-cent amounts cannot enter either side of an authoritative collection',async()=>{
 for(const amount of [1e-10,20.0000000001,90071992547409.92]){
  await rejectedWithoutChanges(fixture(),request({amount}),'invalid-argument');
  await rejectedWithoutChanges(fixture(),moraRequest({moraAmount:amount}),'invalid-argument');
 }
});
test('individually representable cuota and mora cannot overflow safe cent totals',async()=>{
 await rejectedWithoutChanges(fixture(),moraRequest({moraAmount:90071992547409.9}),'invalid-argument');
});
test('unsafe persisted credit and schedule amounts fail closed before financial allocation',async()=>{
 const unsafe=90071992547409.92;
 for(const credit of [{capital:unsafe},{total:unsafe},{penaltyPaid:unsafe},{schedule:[{date:'2026-10-12',amount:unsafe,paid:0,balance:unsafe}]}])await rejectedWithoutChanges(fixture({credit}),request());
});
test('an accepted operation without the authoritative source cannot acknowledge a retry',async()=>{
 for(const source of [undefined,'V2_BROWSER','V2_INTEREST_RENEWAL_ENDPOINT']){
  const h=fixture(),accepted=await h.service.execute(ctx,request());h.write('operations/operation-a',{...accepted.operation,source});await rejectedWithoutChanges(h,request());
 }
});
test('a forged accepted operation without real payment, cash and audit records cannot become a receipt',async()=>{
 for(const input of [request(),moraRequest()]){
  const accepted=await fixture().service.execute(ctx,input),h=fixture({seed:{[BASE+'operations/operation-a']:accepted.operation}});await rejectedWithoutChanges(h,input);
 }
});
test('every missing persisted component invalidates a retry without creating replacement records',async()=>{
 for(const key of ['payments/payment-a','entries/entry-payment-a','audit/audit-operation-a','payments/payment-mora-a','entries/entry-payment-mora-a']){
  const h=fixture();await h.service.execute(ctx,moraRequest());h.remove(key);await rejectedWithoutChanges(h,moraRequest());
 }
});
test('changing any payment, cash or audit snapshot in operation.result cannot forge an accepted retry',async()=>{
 for(const [field,change] of [['payment',{amount:21}],['entry',{amount:21}],['audit',{actorId:'foreign'}],['moraPayment',{penaltyAmount:9}],['moraEntry',{amount:9}]]){
  const h=fixture(),accepted=await h.service.execute(ctx,moraRequest());accepted.operation.result[field]={...accepted.operation.result[field],...change};h.write('operations/operation-a',accepted.operation);await rejectedWithoutChanges(h,moraRequest());
 }
});
test('persisted ledger tampering cannot be hidden behind an unmodified accepted operation result',async()=>{
 for(const [key,change] of [['payments/payment-a',{creditId:'foreign'}],['entries/entry-payment-a',{ref:'foreign'}],['audit/audit-operation-a',{operationId:'foreign'}],['payments/payment-mora-a',{amount:4}],['entries/entry-payment-mora-a',{amount:4}]]){
  const h=fixture();await h.service.execute(ctx,moraRequest());h.write(key,{...h.read(key),...change});await rejectedWithoutChanges(h,moraRequest());
 }
});
test('a verified historical receipt retries after newer payments, reassignment and clock failure',async()=>{
 const h=fixture(),accepted=await h.service.execute(ctx,moraRequest());await h.service.execute(ctx,request({paymentId:'next-payment',operationId:'next-operation',expectedVersion:2}));
 h.write('credits/credit-a',{...h.read('credits/credit-a'),workerId:'new-worker',routeId:'new-route',version:4});h.write('members/'+UID,{active:true,role:'cobrador',routeIds:[]});h.setClock('unavailable');
 const before=h.all(),writes=h.writes(),retry=await h.service.execute(ctx,moraRequest());assert.equal(retry.status,'ALREADY_APPLIED');assert.deepEqual(retry.result,accepted.result);assert.equal(retry.result.credit.version,2);assert.equal(h.read('credits/credit-a').version,4);assert.deepEqual(h.all(),before);assert.equal(h.writes(),writes);
});
