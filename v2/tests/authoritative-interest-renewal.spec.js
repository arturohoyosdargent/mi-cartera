'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=path.join(__dirname,'../../functions/v2-interest-renewal.js');
const factory=fs.existsSync(modulePath)?require(modulePath).createInterestRenewalService:null;
const clone=x=>structuredClone(x),base='orgs/v2-mi-cartera-pilot/';
function setup({role='admin',active=true,credit={},fail=false}={}){
 a.equal(typeof factory,'function','the existing interest-only renewal needs an authoritative backend');
 const original={id:'old-credit',clientId:'same-client',routeId:'route-a',workerId:'worker-a',beneficiaryReference:'Reference',capital:100,total:120,rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-01',amount:60,paid:0,balance:60},{number:2,date:'2026-10-08',amount:60,paid:0,balance:60}],...credit};
 let docs=new Map([[base+'members/fixture-user',{active,role,routeIds:['route-a']}],[base+'credits/old-credit',original]]),tail=Promise.resolve(),writes=0,clock='2026-11-20T18:00:00.000Z';
 const service=factory({now:()=>clock,runAtomic:fn=>{const task=tail.then(async()=>{const draft=new Map([...docs].map(([k,v])=>[k,clone(v)]));let started=false;const out=await fn({get:async k=>{a.equal(started,false,'reads must precede writes');return draft.has(k)?clone(draft.get(k)):null},set:async(k,v)=>{started=true;writes++;draft.set(k,clone(v))},create:async(k,v)=>{started=true;writes++;if(draft.has(k))throw Error('COLLISION');draft.set(k,clone(v))}});if(fail)throw Error('ATOMIC_FAILURE');docs=draft;return out});tail=task.catch(()=>{});return task;}});
 return {service,original,all:()=>clone([...docs]),read:k=>clone(docs.get(base+k)),set:(k,v)=>docs.set(base+k,clone(v)),remove:k=>docs.delete(base+k),setClock:value=>{clock=value;},writes:()=>writes};
}
const input=(extra={})=>({creditId:'old-credit',newCreditId:'new-credit',paymentId:'interest-payment',entryId:'interest-entry',operationId:'interest-operation',expectedVersion:1,date:'2026-11-20',rate:20,term:4,freq:'weekly',firstPaymentDate:'2026-11-27',restDay:'',...extra});
const actor={uid:'fixture-user'};
for(const role of ['admin','supervisor'])test(role+' interest renewal atomically records canonical credit chain, payment, cash and audit',async()=>{
 const h=setup({role}),out=await h.service.execute(actor,input()),d=out.result;
 a.equal(out.status,'APPLIED');a.equal(d.oldCredit.status,'RENOVADO');a.equal(d.oldCredit.renewedTo,d.newCredit.id);a.equal(d.newCredit.renewedFrom,h.original.id);
 a.deepEqual(d.oldCredit.schedule,h.original.schedule);a.equal(d.oldCredit.principalPaid,0);a.equal(d.oldCredit.interestPaid,20);
 a.equal(d.newCredit.capital,100);a.equal(d.newCredit.total,120);a.equal(d.newCredit.netDisbursement,0);a.equal(d.newCredit.previousBalance,120);
 a.equal(d.newCredit.workerId,'worker-a');a.equal(d.newCredit.beneficiaryReference,'Reference');a.equal(d.newCredit.schedule.reduce((n,q)=>n+q.amount,0),120);
 a.equal(d.payment.interestAmount,20);a.equal(d.payment.capitalAmount,0);a.equal(d.payment.userId,actor.uid);a.equal(d.payment.operationId,'interest-operation');
 a.equal(d.entry.amount,20);a.equal(d.entry.ref,d.payment.id);a.equal(d.entry.concept,'COBRO_INTERES');a.equal(d.audit.actorId,actor.uid);a.equal(out.operation.writeCount,5);
 a.equal(h.read('payments/interest-payment').amount,20);a.equal(h.all().length,7);
});
test('monthly renewal and weekly extra use the unchanged schedule engine',async()=>{
 const monthly=setup(),m=await monthly.service.execute(actor,input({date:'2026-01-31',freq:'monthly',firstPaymentDate:'2026-02-28',term:2}));
 a.deepEqual(m.result.newCredit.schedule.map(q=>q.date),['2026-02-28','2026-03-28']);
 const weekly=setup(),w=await weekly.service.execute(actor,input({extraPayments:[{date:'2026-12-25',amount:40}]}));
 a.equal(w.result.newCredit.schedule.length,5);a.equal(w.result.newCredit.schedule.filter(q=>q.extra).length,1);a.equal(w.result.newCredit.total,120);
});
test('interest renewal rejects collector, inactive and anonymous callers without mutations',async()=>{
 for(const options of [{role:'cobrador'},{role:'consulta'},{active:false}]){const h=setup(options),before=h.all();await a.rejects(h.service.execute(actor,input()),e=>e.code==='permission-denied');a.deepEqual(h.all(),before)}
 const h=setup(),before=h.all();await a.rejects(h.service.execute({},input()),e=>e.code==='unauthenticated');a.deepEqual(h.all(),before);
});
test('malformed renewal terms, forged fields and invalid chronology cannot write',async()=>{
 for(const more of [{rate:-1},{rate:Infinity},{term:0},{term:1.5},{freq:'arbitrary'},{date:'2026-02-30'},{firstPaymentDate:'2026-11-19'},{freq:'monthly',firstPaymentDate:'2026-11-20'},{restDay:9},{newCreditId:'old-credit'},{userId:'forged'},{interestAmount:1},{extraPayments:[{date:'2026-11-19',amount:10}]},{extraPayments:[{date:'2026-12-25',amount:0.000001}]}]){
  const h=setup(),before=h.all();await a.rejects(h.service.execute(actor,input(more)));a.deepEqual(h.all(),before);
 }
});
test('accepted retry is immutable while stale versions, changed payload and duplicate destinations fail',async()=>{
 const h=setup(),accepted=await h.service.execute(actor,input()),before=h.all(),writes=h.writes();
 a.deepEqual((await h.service.execute(actor,input())).result,accepted.result);a.deepEqual(h.all(),before);a.equal(h.writes(),writes);
 await a.rejects(h.service.execute(actor,input({rate:21})),e=>e.code==='already-exists');
 const stale=setup();await a.rejects(stale.service.execute(actor,input({expectedVersion:2})),e=>e.code==='failed-precondition');
 const collision=setup();collision.set('payments/interest-payment',{id:'interest-payment',amount:5});const prior=collision.all();await a.rejects(collision.service.execute(actor,input()),e=>e.code==='already-exists');a.deepEqual(collision.all(),prior);
});
test('simultaneous renewals and failed commits cannot duplicate the chain or leave partial records',async()=>{
 const h=setup(),r=await Promise.allSettled([h.service.execute(actor,input()),h.service.execute(actor,input({newCreditId:'another-credit',paymentId:'another-payment',entryId:'another-entry',operationId:'another-operation'}))]);
 a.equal(r.filter(x=>x.status==='fulfilled').length,1);a.equal(h.all().filter(([key])=>key.includes('/payments/')).length,1);
 const failed=setup({fail:true}),before=failed.all();await a.rejects(failed.service.execute(actor,input()),/ATOMIC_FAILURE/);a.deepEqual(failed.all(),before);
});

async function deniedWithoutWrites(h,request=input()){
 const before=h.all(),writes=h.writes();await a.rejects(h.service.execute(actor,request),error=>error.code==='failed-precondition');a.deepEqual(h.all(),before);a.equal(h.writes(),writes);
}
test('principal cannot exceed scheduled debt when renewing interest',async()=>{
 const h=setup({credit:{interestPaid:110,schedule:[{number:1,date:'2026-10-01',amount:120,paid:110,balance:10}]}});await deniedWithoutWrites(h);
});
test('the original schedule total and paid allocation must reconcile with server credit balances',async()=>{
 for(const credit of [{schedule:[{number:1,date:'2026-10-01',amount:130,paid:10,balance:120}]},{principalPaid:5,interestPaid:5,schedule:[{number:1,date:'2026-10-01',amount:110,paid:0,balance:110}]}])await deniedWithoutWrites(setup({credit}));
});
test('interest added to the old credit cannot overflow safe cent arithmetic',async()=>{
 const h=setup({credit:{total:50000000000100,rate:50000000000000,interestPaid:50000000000000,schedule:[{number:1,date:'2026-10-01',amount:50000000000100,paid:50000000000000,balance:100}]}});await deniedWithoutWrites(h);
});
test('invalid generated ISO dates cannot escape the unchanged schedule engine into a renewed credit',async()=>{
 const h=setup(),before=h.all(),writes=h.writes();await a.rejects(h.service.execute(actor,input({date:'9999-12-30',firstPaymentDate:'9999-12-31',freq:'monthly',term:2})),error=>error.code==='invalid-argument');a.deepEqual(h.all(),before);a.equal(h.writes(),writes);
});
test('malformed persisted schedule rows reject with a domain error and no writes',async()=>{
 for(const row of [null,{date:'2026-02-30',amount:120,paid:0,balance:120},{date:'2026-10-01',amount:120,paid:NaN,balance:120},{date:'2026-10-01',amount:120,paid:0,balance:NaN}])await deniedWithoutWrites(setup({credit:{schedule:[row]}}));
});
test('an authentic receipt still retries after credit versions, assignments and server clock advance',async()=>{
 const h=setup(),accepted=await h.service.execute(actor,input());h.set('credits/old-credit',{...h.read('credits/old-credit'),routeId:'new-route',workerId:'new-worker',version:4});h.set('credits/new-credit',{...h.read('credits/new-credit'),principalPaid:10,interestPaid:2,version:3});h.setClock('not-a-clock');
 const before=h.all(),writes=h.writes(),retry=await h.service.execute(actor,input());a.equal(retry.status,'ALREADY_APPLIED');a.deepEqual(retry.result,accepted.result);a.deepEqual(h.all(),before);a.equal(h.writes(),writes);
});
test('normal cuota ledger semantics cannot masquerade as an accepted interest renewal',async()=>{
 const h=setup(),accepted=await h.service.execute(actor,input()),op=accepted.operation;
 Object.assign(op.result.payment,{concept:'CUOTA',capitalAmount:20,interestAmount:0});Object.assign(op.result.entry,{concept:'COBRO_CUOTA'});Object.assign(op.result.audit,{action:'PAYMENT_RECORDED'});
 for(const [collection,row] of [['payments',op.result.payment],['entries',op.result.entry],['audit',op.result.audit]])h.set(collection+'/'+row.id,row);h.set('operations/interest-operation',op);await deniedWithoutWrites(h);
});
test('retry requires canonical payment, cash and audit financial fields even if the forged ledger matches',async()=>{
 for(const mutate of [
  r=>{r.payment.creditId='foreign';},r=>{r.payment.clientId='foreign';},r=>{r.payment.penaltyAmount=1;},r=>{r.payment.capitalAmount=1;},r=>{r.payment.interestAmount=19;},r=>{r.payment.amount=19;r.payment.interestAmount=19;r.entry.amount=19;r.audit.detail.interest=19;},
  r=>{r.entry.ref='foreign';},r=>{r.entry.type='EGRESO';},r=>{r.entry.userId='foreign';},r=>{r.audit.entityId='foreign';},r=>{r.audit.actorId='foreign';},r=>{r.audit.detail.from='foreign';}
 ]){
  const h=setup(),accepted=await h.service.execute(actor,input()),op=accepted.operation;mutate(op.result);for(const [collection,row] of [['payments',op.result.payment],['entries',op.result.entry],['audit',op.result.audit]])h.set(collection+'/'+row.id,row);h.set('operations/interest-operation',op);await deniedWithoutWrites(h);
 }
});
test('retry validates the original and renewed credit links, capital, terms and deterministic schedule',async()=>{
 for(const mutate of [
  r=>{r.oldCredit.status='ACTIVO';},r=>{r.oldCredit.renewedTo='foreign';},r=>{r.oldCredit.renewedAt='2026-01-01';},r=>{r.newCredit.renewedFrom='foreign';},r=>{r.newCredit.clientId='foreign';},r=>{r.newCredit.capital=101;},r=>{r.newCredit.total=121;},r=>{r.newCredit.principalPaid=1;},r=>{r.newCredit.netDisbursement=1;},r=>{r.newCredit.rate=21;},r=>{r.newCredit.term=5;},r=>{r.newCredit.schedule[0].amount=31;},r=>{r.newCredit.schedule[0].date='2026-11-28';},r=>{r.newCredit.workerId='foreign';},r=>{r.oldCredit.interestPaid=19;}
 ]){
  const h=setup(),accepted=await h.service.execute(actor,input()),op=accepted.operation;mutate(op.result);h.set('operations/interest-operation',op);await deniedWithoutWrites(h);
 }
});
test('retry rejects an operation whose own id does not match its destination document',async()=>{
 const h=setup(),accepted=await h.service.execute(actor,input());h.set('operations/interest-operation',{...accepted.operation,id:'foreign'});await deniedWithoutWrites(h);
});
test('retry still requires active manager membership and respects operation noReplay',async()=>{
 for(const change of ['inactive','role','closed']){
  const h=setup();await h.service.execute(actor,input());if(change==='closed')h.set('operations/interest-operation',{...h.read('operations/interest-operation'),noReplay:true});else h.set('members/fixture-user',{active:change!=='inactive',role:change==='role'?'cobrador':'admin'});
  const before=h.all(),writes=h.writes();await a.rejects(h.service.execute(actor,input()),error=>error.code===(change==='closed'?'failed-precondition':'permission-denied'));a.deepEqual(h.all(),before);a.equal(h.writes(),writes);
 }
});
test('missing or modified persisted ledger components cannot acknowledge an accepted renewal',async()=>{
 for(const key of ['payments/interest-payment','entries/interest-entry','audit/audit-interest-operation']){
  for(const remove of [false,true]){const h=setup();await h.service.execute(actor,input());if(remove)h.remove(key);else h.set(key,{...h.read(key),tombstone:true});await deniedWithoutWrites(h);}
 }
});
test('cent-exact extra amounts such as 0.29 retain a deterministic accepted schedule',async()=>{
 const h=setup(),out=await h.service.execute(actor,input({extraPayments:[{date:'2026-12-25',amount:0.29}]}));a.equal(out.result.newCredit.schedule.at(-1).amount,0.29);a.deepEqual((await h.service.execute(actor,input({extraPayments:[{date:'2026-12-25',amount:0.29}]}))).result,out.result);
});
