const {test}=require('node:test'),a=require('node:assert/strict');
let factory;try{factory=require('../../functions/v2-manager-commissions').createCommissionService}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),BASE='orgs/v2-mi-cartera-pilot/';
function fixture({role='admin',cash=1000}={}){
 a.equal(typeof factory,'function','authoritative commission service must be implemented');
 let docs=new Map(Object.entries({
  [BASE+'members/manager']:{active:true,role},
  [BASE+'routes/r1']:{id:'r1',recordType:'ROUTE',active:true,version:1},
  [BASE+'routes/w1']:{id:'w1',workerId:'w1',recordType:'WORKER',routeId:'r1',active:true,version:1},
  [BASE+'payments/p1']:{id:'p1',workerId:'w1',routeId:'r1',amount:120,capitalAmount:100,interestAmount:20,date:'2026-10-14',version:1},
  [BASE+'payments/old']:{id:'old',amount:60,date:'2026-10-10',version:1},
  [BASE+'credits/cr1']:{id:'cr1',capital:100,total:120,version:1},
  [BASE+'entries/capital']:{id:'capital',type:'INGRESO',amount:cash,date:'2026-10-14',version:1}
 })),tail=Promise.resolve(),fail=false,currentDate='2026-10-14';
 const runAtomic=fn=>{const task=tail.then(async()=>{const draft=new Map([...docs].map(([k,v])=>[k,clone(v)]));let wrote=false;
 const tx={get:async p=>{a.equal(wrote,false,'all Firestore reads precede writes');return clone(draft.get(p)||null)},list:async p=>{a.equal(wrote,false);return [...draft].filter(([k])=>k.startsWith(p+'/')).map(([,v])=>clone(v))},set:async(p,v)=>{wrote=true;draft.set(p,clone(v))},create:async(p,v)=>{wrote=true;a.equal(draft.has(p),false);draft.set(p,clone(v))}};
 const out=await fn(tx);if(fail)throw Error('ATOMIC_COMMIT_FAILED');docs=draft;return out});tail=task.catch(()=>{});return task};
 return {service:factory({runAtomic,now:()=> currentDate+'T17:00:00.000Z',businessDate:()=> currentDate}),read:k=>clone(docs.get(BASE+k)),write:(k,v)=>docs.set(BASE+k,clone(v)),all:()=>clone([...docs]),fail:()=>{fail=true},advanceDate:day=>{currentDate=day}};
}
const terms=(changes={})=>({operationId:'term-op',workerId:'w1',expectedVersion:0,effectiveDate:'2026-10-14',mode:'PERCENT',basis:'TOTAL',rate:10,...changes});
const settle=(changes={})=>({operationId:'settle-op',workerId:'w1',expectedVersion:1,amount:12,...changes}),actor={uid:'manager'};
test('terms and settlement preserve payment and credit history and create one authoritative expense and audit',async()=>{const h=fixture(),before=h.all().filter(([p])=>/\/(payments|credits)\//.test(p));const saved=await h.service.saveTerms(actor,terms());a.equal(saved.status,'APPLIED');a.equal(saved.result.position.version,1);const out=await h.service.settle(actor,settle());a.equal(out.result.expense.amount,12);a.equal(out.result.expense.type,'EGRESO');a.equal(out.result.expense.category,'COMISION_GESTOR');a.equal(out.result.expense.workerId,'w1');a.equal(out.result.expense.cashAccountId,'leader');a.equal(out.result.audit.actorId,'manager');a.equal(out.result.audit.action,'COMMISSION_PAID');a.equal(out.result.position.version,2);a.deepEqual(h.all().filter(([p])=>/\/(payments|credits)\//.test(p)),before)});
test('cobrador inactive and unauthenticated actors cannot alter conditions or payroll',async()=>{for(const role of ['cobrador','consulta']){const h=fixture({role}),before=h.all();await a.rejects(h.service.saveTerms(actor,terms()),e=>e.code==='permission-denied');a.deepEqual(h.all(),before)}const h=fixture();h.write('members/manager',{role:'admin',active:false});await a.rejects(h.service.saveTerms(actor,terms()),e=>e.code==='permission-denied');await a.rejects(fixture().service.saveTerms({},terms()),e=>e.code==='unauthenticated')});
test('future immutable terms cannot reinterpret prior payments and same-day replacement is rejected',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());const original=h.read('routes/commission-term-term-op');await a.rejects(h.service.saveTerms(actor,terms({operationId:'same-day',expectedVersion:1})),/EFFECTIVE_DATE/);await h.service.saveTerms(actor,terms({operationId:'future',expectedVersion:1,effectiveDate:'2026-10-15',rate:5}));a.deepEqual(h.read('routes/commission-term-term-op'),original);const out=await h.service.settle(actor,settle({expectedVersion:2}));a.equal(out.result.expense.amount,12)});
test('invalid requests and retrospective conditions never write',async()=>{for(const change of [{effectiveDate:'2026-10-13'},{effectiveDate:'2026-02-30'},{rate:101},{rate:NaN},{workerId:'bad/id'},{orgId:'foreign'},{actorId:'forged'},{mode:'PER_COLLECTION',amount:-1}]){const h=fixture(),before=h.all();await a.rejects(h.service.saveTerms(actor,terms(change)));a.deepEqual(h.all(),before)}const h=fixture();await h.service.saveTerms(actor,terms());for(const amount of [NaN,Infinity,-1,0,12.001,13])await a.rejects(h.service.settle(actor,settle({amount})));a.equal(h.read('expenses/commission-settle-op'),undefined)});
test('reversals or missing payment attribution are recomputed authoritatively before settlement',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());h.write('payments/p1',{...h.read('payments/p1'),status:'REVERSED'});const before=h.all();await a.rejects(h.service.settle(actor,settle()),/COMMISSION_BALANCE/);a.deepEqual(h.all(),before)});
test('two competing settlements and changed term versions cannot consume a position twice',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());const results=await Promise.allSettled([h.service.settle(actor,settle()),h.service.settle(actor,settle({operationId:'second'}))]);a.equal(results.filter(x=>x.status==='fulfilled').length,1);a.equal(results.filter(x=>x.status==='rejected').length,1);const stale=fixture();await stale.service.saveTerms(actor,terms());await stale.service.saveTerms(actor,terms({operationId:'new-term',expectedVersion:1,effectiveDate:'2026-10-15',rate:5}));await a.rejects(stale.service.settle(actor,settle()),/VERSION_CONFLICT/)});
test('server cash check serializes commissions from different workers without spending the same cash',async()=>{const h=fixture({cash:15});h.write('routes/w2',{id:'w2',workerId:'w2',recordType:'WORKER',routeId:'r1',active:true,version:1});h.write('payments/p2',{...h.read('payments/p1'),id:'p2',workerId:'w2'});await h.service.saveTerms(actor,terms());await h.service.saveTerms(actor,terms({operationId:'term2',workerId:'w2'}));const out=await Promise.allSettled([h.service.settle(actor,settle()),h.service.settle(actor,settle({operationId:'settle2',workerId:'w2'}))]);a.equal(out.filter(x=>x.status==='fulfilled').length,1);a.equal(out.filter(x=>x.status==='rejected'&&/CASH_BALANCE/.test(x.reason.message)).length,1)});
test('idempotent retries and closed noReplay operations never duplicate or reopen payroll',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());const saved=h.all();a.equal((await h.service.saveTerms(actor,terms())).status,'ALREADY_APPLIED');a.deepEqual(h.all(),saved);await h.service.settle(actor,settle());const before=h.all();a.equal((await h.service.settle(actor,settle())).status,'ALREADY_APPLIED');a.deepEqual(h.all(),before);await a.rejects(h.service.settle(actor,settle({amount:11})),/COLLISION/);h.write('operations/closed',{id:'closed',status:'CERRADO_ADMIN',administrativeClosure:{noReplay:true}});const closed=h.all();await a.rejects(h.service.settle(actor,settle({operationId:'closed',expectedVersion:2})),/ADMINISTRATIVELY_CLOSED/);a.deepEqual(h.all(),closed)});
test('next-day exact terms retry returns the accepted result after the position advances without writes',async()=>{
 const h=fixture(),accepted=await h.service.saveTerms(actor,terms());
 await h.service.saveTerms(actor,terms({operationId:'future',expectedVersion:1,effectiveDate:'2026-10-15',rate:5}));
 h.advanceDate('2026-10-15');const before=h.all(),retried=await h.service.saveTerms(actor,terms());
 a.equal(retried.status,'ALREADY_APPLIED');a.deepEqual(retried.result,accepted.result);a.deepEqual(retried.operation,accepted.operation);a.deepEqual(h.all(),before);
});
test('next-day new retrospective terms remain invalid and cannot write',async()=>{
 const h=fixture();await h.service.saveTerms(actor,terms());h.advanceDate('2026-10-15');const before=h.all();
 await a.rejects(h.service.saveTerms(actor,terms({operationId:'new-past',expectedVersion:1})),e=>e.code==='invalid-argument'&&e.message==='INVALID_EFFECTIVE_DATE');a.deepEqual(h.all(),before);
});
test('next-day terms retries reject changed payload version worker actor type and organization without writes',async()=>{
 const h=fixture();await h.service.saveTerms(actor,terms());h.write('members/other',{active:true,role:'supervisor'});h.advanceDate('2026-10-15');const before=h.all();
 for(const change of [{rate:11},{expectedVersion:1},{workerId:'w2'}])await a.rejects(h.service.saveTerms(actor,terms(change)),e=>e.code==='already-exists'&&e.message==='OPERATION_ID_COLLISION');
 await a.rejects(h.service.saveTerms({uid:'other'},terms()),e=>e.code==='already-exists'&&e.message==='OPERATION_ID_COLLISION');
 await a.rejects(h.service.settle(actor,settle({operationId:'term-op',expectedVersion:0})),e=>e.code==='already-exists'&&e.message==='OPERATION_ID_COLLISION');
 await a.rejects(h.service.saveTerms(actor,terms({orgId:'foreign'})),e=>e.code==='invalid-argument');a.deepEqual(h.all(),before);
});
test('next-day exact terms retry still requires an active authorized manager',async()=>{
 for(const member of [{active:false,role:'admin'},{active:true,role:'cobrador'}]){
  const h=fixture();await h.service.saveTerms(actor,terms());h.write('members/manager',member);h.advanceDate('2026-10-15');const before=h.all();
  await a.rejects(h.service.saveTerms(actor,terms()),e=>e.code==='permission-denied'&&e.message==='V2_COMMISSION_MANAGER_REQUIRED');a.deepEqual(h.all(),before);
 }
});
test('next-day terms retries preserve historical administrative closure and noReplay formats',async()=>{
 for(const closure of [{status:'CERRADO_ADMIN'},{noReplay:true},{administrativeClosure:{kind:'ADMINISTRATIVE_LOCAL_CLOSURE',noReplay:true,serverApplied:'NOT_VERIFIED'}}]){
  const h=fixture();await h.service.saveTerms(actor,terms());h.write('operations/term-op',{...h.read('operations/term-op'),...closure});h.advanceDate('2026-10-15');const before=h.all();
  await a.rejects(h.service.saveTerms(actor,terms()),e=>e.code==='failed-precondition'&&e.message==='OPERATION_ADMINISTRATIVELY_CLOSED');a.deepEqual(h.all(),before);
 }
});
test('atomic failure and inactive route or worker leave all records untouched',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());const before=h.all();h.fail();await a.rejects(h.service.settle(actor,settle()),/ATOMIC_COMMIT_FAILED/);a.deepEqual(h.all(),before);for(const key of ['routes/w1','routes/r1']){const f=fixture();f.write(key,{...f.read(key),active:false});const old=f.all();await a.rejects(f.service.saveTerms(actor,terms()),/INACTIVE/);a.deepEqual(f.all(),old)}});
test('inactive worker can receive earned historical commission but cannot establish new conditions',async()=>{const h=fixture();await h.service.saveTerms(actor,terms());h.write('routes/w1',{...h.read('routes/w1'),active:false});const before=h.read('payments/p1');await a.rejects(h.service.saveTerms(actor,terms({operationId:'future',expectedVersion:1,effectiveDate:'2026-10-15'})),/INACTIVE/);const out=await h.service.settle(actor,settle());a.equal(out.result.expense.amount,12);a.deepEqual(h.read('payments/p1'),before)});
