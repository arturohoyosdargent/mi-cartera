const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectorPaymentService}=require('../../functions/v2-collector-payment');
const ORG='v2-mi-cartera-pilot',BASE='orgs/'+ORG+'/',UID='fixture-collector';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture({role='cobrador',routeIds=['fixture-route'],active=true,credit={},seed={}}={}){
 const original={id:'fixture-credit',clientId:'fixture-client',routeId:'fixture-route',workerId:'fixture-worker',capital:100,total:120,rate:20,term:2,freq:'weekly',principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-13',amount:60,paid:0,balance:60},{number:2,date:'2026-10-20',amount:60,paid:0,balance:60}],...credit};
 let docs=new Map(Object.entries({[BASE+'members/'+UID]:{active,role,routeIds},[BASE+'credits/fixture-credit']:original,...seed})),serial=Promise.resolve(),failCommit=false,writeCalls=0;
 const adapter={runAtomic:fn=>{const task=serial.then(async()=>{const candidate=new Map([...docs].map(([k,v])=>[k,clone(v)]));let writes=false;const tx={get:async key=>{assert.equal(writes,false,'Firestore must read before any write');return candidate.has(key)?clone(candidate.get(key)):null},set:async(key,data)=>{writes=true;writeCalls++;candidate.set(key,clone(data))},create:async(key,data)=>{writes=true;writeCalls++;if(candidate.has(key))throw Error('DOCUMENT_ALREADY_EXISTS');candidate.set(key,clone(data))}};const result=await fn(tx);if(failCommit)throw Object.assign(Error('ATOMIC_COMMIT_FAILED'),{code:'unavailable'});docs=candidate;return result});serial=task.catch(()=>{});return task}};
 const service=createCollectorPaymentService({...adapter,orgId:ORG,now:()=> '2026-10-14T04:59:00.000Z',businessDate:()=> '2026-10-13'});
 return {service,original,read:key=>clone(docs.get(BASE+key)),all:()=>clone([...docs]),write:(key,data)=>docs.set(BASE+key,clone(data)),writeCalls:()=>writeCalls,failCommit:()=>{failCommit=true}};
}
const request=(more={})=>({creditId:'fixture-credit',paymentId:'fixture-payment',operationId:'fixture-operation',amount:20,expectedVersion:1,...more}),ctx={uid:UID};
test('authorized collector payment recalculates all records and takes server identity/date/worker snapshot',async()=>{
 const h=fixture(),out=await h.service.execute(ctx,request());
 assert.equal(out.status,'APPLIED');assert.equal(out.operation.id,'fixture-operation');
 const p=h.read('payments/fixture-payment'),c=h.read('credits/fixture-credit'),e=h.read('entries/entry-fixture-payment'),a=h.read('audit/audit-fixture-operation');
 assert.equal(c.principalPaid,16.67);assert.equal(c.interestPaid,3.33);assert.equal(c.schedule[0].balance,40);assert.equal(c.schedule[1].balance,60);assert.equal(c.version,2);assert.equal(c.workerId,'fixture-worker');assert.equal(c.status,'ACTIVO');
 assert.equal(p.amount,20);assert.equal(p.capitalAmount,16.67);assert.equal(p.interestAmount,3.33);assert.equal(p.date,'2026-10-13');assert.equal(p.userId,UID);assert.equal(p.workerId,'fixture-worker');assert.equal(p.workerAttribution.source,'CREDIT_ASSIGNMENT_AT_PAYMENT');assert.equal(p.installmentFrom,1);assert.equal(p.installmentTo,1);assert.equal(p.balanceAfterPayment,100);
 assert.equal(e.amount,20);assert.equal(e.ref,p.id);assert.equal(e.type,'INGRESO');assert.equal(a.actorId,UID);assert.equal(a.operationId,'fixture-operation');assert.equal(out.result.payment.id,p.id);assert.equal(out.operation.writeCount,4);
});
test('manager and supervisor use the same authoritative payment path',async()=>{for(const role of ['admin','supervisor']){const h=fixture({role,routeIds:[]}),out=await h.service.execute(ctx,request());assert.equal(out.status,'APPLIED');assert.equal(h.read('payments/fixture-payment').workerId,'fixture-worker')}});
test('route mismatch and inactive or unrecognized member cannot create financial records',async()=>{for(const options of [{routeIds:['foreign']},{active:false},{role:'consulta'}]){const h=fixture(options),before=h.all();await assert.rejects(h.service.execute(ctx,request()),e=>e.code==='permission-denied');assert.deepEqual(h.all(),before)}});
test('unauthenticated and malformed requests cannot reach a financial transaction',async()=>{
 for(const actor of [{},null,{uid:'bad/uid'}])await assert.rejects(fixture().service.execute(actor,request()),e=>['unauthenticated','invalid-argument'].includes(e.code));
 for(const change of [{amount:0},{amount:-1},{amount:Infinity},{amount:'20'},{amount:20.001},{expectedVersion:0},{expectedVersion:1.5},{paymentId:'bad/id'},{workerId:'forged'},{userId:'forged'},{routeId:'foreign'},{date:'2020-01-01'},{orgId:'foreign'}]){const h=fixture(),before=h.all();await assert.rejects(h.service.execute(ctx,request(change)),e=>e.code==='invalid-argument');assert.deepEqual(h.all(),before)}
});
test('overpayment, stale version and terminal credit leave records unchanged',async()=>{for(const options of [{input:{amount:121}},{input:{expectedVersion:2}},{credit:{status:'CERRADO_ADMIN'}},{credit:{status:'ANULADO'}},{credit:{status:'RENOVADO'}},{credit:{status:'PAGADO'}},{credit:{noReplay:true}},{credit:{administrativeClosure:{noReplay:true}}}]){const h=fixture(options),before=h.all();await assert.rejects(h.service.execute(ctx,request(options.input)),e=>e.code==='failed-precondition');assert.deepEqual(h.all(),before)}});
test('exact retry is idempotent and actor or payload collision cannot reuse its operation id',async()=>{
 const h=fixture();await h.service.execute(ctx,request());const before=h.all();const replay=await h.service.execute(ctx,request());assert.equal(replay.status,'ALREADY_APPLIED');assert.deepEqual(h.all(),before);assert.equal(replay.result.payment.date,'2026-10-13');
 await assert.rejects(h.service.execute(ctx,request({amount:21})),e=>e.code==='already-exists');
 h.write('members/other-actor',{role:'admin',active:true,routeIds:[]});await assert.rejects(h.service.execute({uid:'other-actor'},request()),e=>e.code==='already-exists');
});
test('payment id is append-only and atomic commit failure publishes nothing',async()=>{
 const h=fixture({seed:{[BASE+'payments/fixture-payment']:{id:'fixture-payment',amount:99,version:1}}}),before=h.all();await assert.rejects(h.service.execute(ctx,request()),e=>e.code==='already-exists');assert.deepEqual(h.all(),before);
 const failed=fixture(),original=failed.all();failed.failCommit();await assert.rejects(failed.service.execute(ctx,request()),/ATOMIC_COMMIT_FAILED/);assert.deepEqual(failed.all(),original);
});
test('competing payments on one credit cannot both consume the same version',async()=>{
 const h=fixture(),results=await Promise.allSettled([h.service.execute(ctx,request()),h.service.execute(ctx,request({paymentId:'competing-payment',operationId:'competing-operation'}))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='failed-precondition').length,1);assert.equal(h.read('credits/fixture-credit').version,2);
});
test('new payment attribution never changes old payments or client/credit assignment',async()=>{
 const old={id:'old-payment',amount:10,userId:'previous',date:'2026-10-01',version:1};const h=fixture({seed:{[BASE+'payments/old-payment']:old}});await h.service.execute(ctx,request());assert.deepEqual(h.read('payments/old-payment'),old);h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),workerId:'new-worker',version:3});await h.service.execute(ctx,request({paymentId:'new-payment',operationId:'new-operation',expectedVersion:3}));assert.equal(h.read('payments/fixture-payment').workerId,'fixture-worker');assert.equal(h.read('payments/new-payment').workerId,'new-worker');assert.equal(h.read('credits/fixture-credit').workerId,'new-worker');
});
test('legacy unassigned credit produces explicit empty attribution and no inferred historical worker',async()=>{
 const h=fixture({credit:{workerId:''}});await h.service.execute(ctx,request());assert.equal(h.read('payments/fixture-payment').workerId,'');assert.equal(h.read('payments/fixture-payment').workerAttribution.source,'CREDIT_ASSIGNMENT_AT_PAYMENT');
});
test('collector cannot start a new payment on an explicitly inactive commercial route or worker',async()=>{for(const seed of [{[BASE+'routes/fixture-route']:{id:'fixture-route',recordType:'ROUTE',active:false}},{[BASE+'routes/fixture-worker']:{id:'fixture-worker',recordType:'WORKER',routeId:'fixture-route',active:false}}]){const h=fixture({seed}),before=h.all();await assert.rejects(h.service.execute(ctx,request()),e=>e.code==='permission-denied');assert.deepEqual(h.all(),before)}});
test('administratively closed operation is never retried or replaced by a payment request',async()=>{for(const record of [{id:'fixture-operation',status:'CERRADO_ADMIN'},{id:'fixture-operation',status:'PENDIENTE',noReplay:true},{id:'fixture-operation',status:'ERROR',administrativeClosure:{noReplay:true}}]){const h=fixture({seed:{[BASE+'operations/fixture-operation']:record}}),before=h.all();await assert.rejects(h.service.execute(ctx,request()),/ADMINISTRATIVELY_CLOSED/);assert.deepEqual(h.all(),before)}});

test('exact retry after credit route and worker reassignment returns the accepted receipt without writes',async()=>{
 const h=fixture(),accepted=await h.service.execute(ctx,request());
 h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),routeId:'reassigned-route',workerId:'reassigned-worker',version:3});
 const before=h.all(),writes=h.writeCalls(),replay=await h.service.execute(ctx,request());
 assert.equal(replay.status,'ALREADY_APPLIED');assert.deepEqual(replay.operation,accepted.operation);assert.deepEqual(replay.result,accepted.result);assert.equal(replay.result.payment.routeId,'fixture-route');assert.equal(replay.result.payment.workerId,'fixture-worker');assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
});

test('exact retry survives collector route removal and commercial assignment changes',async()=>{
 for(const change of ['collector-routes','route-inactive','worker-reassigned']){
  const h=fixture(),accepted=await h.service.execute(ctx,request());
  if(change==='collector-routes')h.write('members/'+UID,{active:true,role:'cobrador',routeIds:[]});
  if(change==='route-inactive')h.write('routes/fixture-route',{id:'fixture-route',recordType:'ROUTE',active:false});
  if(change==='worker-reassigned')h.write('routes/fixture-worker',{id:'fixture-worker',recordType:'WORKER',active:false,routeId:'reassigned-route'});
  const before=h.all(),writes=h.writeCalls(),replay=await h.service.execute(ctx,request());
  assert.equal(replay.status,'ALREADY_APPLIED',change);assert.deepEqual(replay.result,accepted.result);assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
 }
});

test('reassignment never lets a changed payload, actor, org or project reuse an accepted receipt',async()=>{
 const h=fixture();await h.service.execute(ctx,request());
 h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),routeId:'reassigned-route',version:3});
 h.write('credits/other-credit',{...h.read('credits/fixture-credit'),id:'other-credit'});
 h.write('members/other-actor',{active:true,role:'admin',routeIds:[]});
 const before=h.all(),writes=h.writeCalls();
 for(const change of [{amount:21},{paymentId:'other-payment'},{creditId:'other-credit'},{expectedVersion:3}])await assert.rejects(h.service.execute(ctx,request(change)),e=>e.code==='already-exists'&&e.message==='OPERATION_ID_COLLISION');
 await assert.rejects(h.service.execute({uid:'other-actor'},request()),e=>e.code==='already-exists');
 for(const change of [{orgId:'other-org'},{projectId:'other-project'}])await assert.rejects(h.service.execute(ctx,request(change)),e=>e.code==='invalid-argument');
 assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
});

test('reassignment does not bypass active membership for an accepted payment retry',async()=>{
 for(const member of [{active:false,role:'cobrador',routeIds:[]},{active:true,role:'consulta',routeIds:[]}]){
  const h=fixture();await h.service.execute(ctx,request());h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),routeId:'reassigned-route',version:3});h.write('members/'+UID,member);
  const before=h.all(),writes=h.writeCalls();await assert.rejects(h.service.execute(ctx,request()),e=>e.code==='permission-denied'&&e.message==='V2_ACTIVE_MEMBER_REQUIRED');assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
 }
});

test('noReplay on an accepted operation blocks confirmation after reassignment without writes',async()=>{
 for(const closure of [{status:'CERRADO_ADMIN'},{noReplay:true},{administrativeClosure:{noReplay:true}}]){
  const h=fixture();await h.service.execute(ctx,request());h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),routeId:'reassigned-route',version:3});h.write('operations/fixture-operation',{...h.read('operations/fixture-operation'),...closure});
  const before=h.all(),writes=h.writeCalls();await assert.rejects(h.service.execute(ctx,request()),e=>e.code==='failed-precondition'&&e.message==='OPERATION_ADMINISTRATIVELY_CLOSED');assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
 }
});

test('new operation still requires the current route and commercial assignment after an accepted payment',async()=>{
 for(const change of ['credit-route','collector-routes','route-inactive','worker-reassigned']){
  const h=fixture();await h.service.execute(ctx,request());
  if(change==='credit-route')h.write('credits/fixture-credit',{...h.read('credits/fixture-credit'),routeId:'reassigned-route'});
  if(change==='collector-routes')h.write('members/'+UID,{active:true,role:'cobrador',routeIds:[]});
  if(change==='route-inactive')h.write('routes/fixture-route',{id:'fixture-route',recordType:'ROUTE',active:false});
  if(change==='worker-reassigned')h.write('routes/fixture-worker',{id:'fixture-worker',recordType:'WORKER',active:true,routeId:'reassigned-route'});
  const before=h.all(),writes=h.writeCalls();await assert.rejects(h.service.execute(ctx,request({operationId:'new-operation',paymentId:'new-payment',expectedVersion:2})),e=>e.code==='permission-denied');assert.deepEqual(h.all(),before);assert.equal(h.writeCalls(),writes);
 }
});
