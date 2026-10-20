'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),F=require('../core/financial-engine'),S=require('../core/schedule-engine');
let N;try{N=require('../app/cloud/spark-native-credit');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),day='2026-10-19';
function operation(type='CREDIT_CREATE'){
 const old={id:'old',clientId:'client',routeId:'route',workerId:'worker',capital:100,total:120,rate:20,term:3,freq:'daily',principalPaid:20,interestPaid:4,penaltyPaid:0,status:'ACTIVO',version:1,schedule:S.generate({total:120,term:3,freq:'daily',firstPaymentDate:day})};Object.assign(old.schedule[0],{paid:24,balance:16,status:'PARCIAL'});
 let next,cash,payment,prior;
 if(type==='CREDIT_CREATE'){next={id:'new',clientId:'client',routeId:'route',workerId:'worker',capital:100,total:120,rate:20,term:3,freq:'daily',restDay:'',firstPaymentDate:day,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1};cash={id:'cash',date:day,type:'EGRESO',amount:100,concept:'DESEMBOLSO_CREDITO',ref:'new',routeId:'route',version:1};}
 else{
  const result=type==='INTEREST_RENEWAL'?F.interestRenewal(old,{newCreditId:'new',paymentId:'payment',interestAmount:16,operationId:'credit-op',date:day,rate:20,term:3,freq:'daily',method:'V2_DURABLE'}):F.refinance(old,{newCreditId:'new',newCapital:150,previousBalance:96,operationId:'credit-op',date:day,rate:20,term:3,freq:'daily'});
  prior=result.oldCredit;next={...result.newCredit,routeId:'route',workerId:'worker',restDay:'',renewalMode:type==='INTEREST_RENEWAL'?'INTEREST':'REFINANCE',previousBalance:96,netDisbursement:type==='INTEREST_RENEWAL'?0:54,requestedFirstPaymentDate:day};
  if(result.payment){payment={...result.payment,version:1,routeId:'route',userId:'manager',workerId:'worker',workerAttribution:{source:'CREDIT_ASSIGNMENT_AT_RENEWAL'}};cash={id:'cash',date:day,type:'INGRESO',amount:16,concept:'COBRO_INTERES',ref:'payment',routeId:'route',version:1};}
  else cash={id:'cash',date:day,type:'EGRESO',amount:54,concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:'new',routeId:'route',version:1};
 }
 next.schedule=S.generate({total:next.total,term:3,freq:'daily',firstPaymentDate:day});next.firstPaymentDate=next.schedule[0].date;if(prior)next.maturity=next.schedule.at(-1).date;
 const writes=[];if(prior)writes.push({path:'credits/old',kind:'set',expectedVersion:1,data:prior});writes.push({path:'credits/new',kind:'create',expectedVersion:0,data:next});if(payment)writes.push({path:'payments/payment',kind:'create',expectedVersion:0,data:payment});if(cash)writes.push({path:(cash.type==='INGRESO'?'entries':'expenses')+'/cash',kind:'create',expectedVersion:0,data:cash});
 writes.push({path:'audit/audit-credit',kind:'create',expectedVersion:0,data:{id:'audit-credit',actorId:'manager',role:'ADMIN',action:type==='CREDIT_CREATE'?'CREDIT_CREATED':type==='REFINANCE'?'CREDIT_REFINANCED':type,entityType:'CREDIT',entityId:'new',operationId:'credit-op',at:day+'T12:00:00Z',detail:type==='CREDIT_CREATE'?{clientId:'client',capital:100,accepted:true}:{from:'old',...(payment?{interest:16}:{previousBalance:96,newCapital:150,cashDisbursed:54}),term:3,freq:'daily'}}});
 return {op:{id:'credit-op',type,actorId:'manager',createdAt:day+'T12:00:00Z',writes},old};
}
function fixture(type,options={}){
 a.equal(typeof N?.createSparkCreditStore,'function');const {op,old}=operation(type);let docs=new Map([['financialControls/release',{protocol:'SPARK_NATIVE_BASELINE',state:'ACTIVE',baselineId:'trusted-fictional-baseline',creditIndexProtocol:'spark-credit-index-v1'}],['clients/client',{id:'client',routeId:'route',workerId:'worker',version:1}],['credits/old',old],['financialControls/cash--leader',{accountId:'leader',balanceCents:100000,version:1,baselineId:'trusted-fictional-baseline'}]]),checks=0,tail=Promise.resolve(),failFinal=false;
 const batches=[],adapter={runAtomic:fn=>{const task=tail.then(async()=>{const draft=new Map([...docs].map(([k,v])=>[k,clone(v)])),paths=[];let wrote=false;const out=await fn({get:async key=>{a.equal(wrote,false,'reads must precede writes');return clone(draft.get(key)||null);},set:async(key,value)=>{wrote=true;paths.push(key);draft.set(key,clone(value));}});if(failFinal&&paths.includes('operations/credit-op'))throw Error('FINAL_COMMIT_FAILED');docs=draft;batches.push(paths);return out;});tail=task.catch(()=>{});return task;}};
 const cash={prepare:async(tx,{operationId,actorId,accountId,deltaCents,date})=>{const path='financialControls/cash--'+accountId,before=await tx.get(path);if(!before?.baselineId)throw Error('CASH_BASELINE_REQUIRED');if(before.balanceCents+deltaCents<0)throw Error('INSUFFICIENT_CASH');return {path,data:{...before,balanceCents:before.balanceCents+deltaCents,version:before.version+1,lastOperationId:operationId,actorId,date}};}};
 const store=N.createSparkCreditStore({adapter,actorId:'manager',cash,stamp:()=>({fakeServerTimestamp:true}),validateSession:()=>{checks++;options.validate?.();}});
 return {op,old,store,batches,read:p=>clone(docs.get(p)),write:(p,v)=>docs.set(p,clone(v)),remove:p=>docs.delete(p),all:()=>clone([...docs]),failFinal:()=>{failFinal=true;},checks:()=>checks};
}
for(const type of ['CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE'])test('Spark credit '+type+' prepares proofs and atomically commits its original financial bundle',async()=>{
 const h=fixture(type),out=await h.store.execute(h.op);a.equal(out.status,'APPLIED');a.equal(h.read('credits/new').nativeCreditOperationId,'credit-op');a.equal(h.read('operations/credit-op').protocol,'spark-credit-v1');a.equal(h.read('audit/audit-credit').role,'admin');a.equal(h.read('audit/audit-credit').version,1);a.ok(h.batches.slice(0,-1).every(paths=>paths.every(p=>/^(creditProposals|creditAuthorizations|creditCalendars|creditCertificates)\//.test(p))));a.equal(h.batches.at(-1).length,h.op.writes.length+3);a.equal(h.read('financialControls/cash--leader').balanceCents,type==='CREDIT_CREATE'?90000:type==='INTEREST_RENEWAL'?101600:94600);a.equal(h.read('operations/credit-op').writeCount,h.op.writes.length);a.ok(h.checks()>3);
});
test('retry returns original receipt after newer credit revision and rejects changed actor or payload',async()=>{
 const h=fixture('REFINANCE'),first=await h.store.execute(h.op);h.write('credits/new',{...h.read('credits/new'),version:2,principalPaid:10});const before=h.all(),out=await h.store.execute(h.op);a.equal(out.status,'ALREADY_APPLIED');a.deepEqual(out.result,first.result);a.deepEqual(h.all(),before);
 const changed=clone(h.op);changed.writes.find(w=>w.path==='expenses/cash').data.amount=55;await a.rejects(h.store.execute(changed),/INVALID|COLLISION|MISMATCH/);const other=clone(h.op);other.actorId='other-manager';await a.rejects(h.store.execute(other),/ACTOR/);
});
test('retry rejects a forged APPLIED record missing financial companions or certificate',async()=>{
 for(const missing of ['audit/audit-credit','expenses/cash','credits/new','creditCertificates/credit-op--new-2']){const h=fixture();await h.store.execute(h.op);h.remove(missing);await a.rejects(h.store.execute(h.op),/INCOMPLETE|MISSING|COLLISION/);}
 const h=fixture();await h.store.execute(h.op);h.write('operations/credit-op',{...h.read('operations/credit-op'),type:'REFINANCE'});await a.rejects(h.store.execute(h.op),/COLLISION/);
});
test('failed final transaction keeps financial documents unchanged; no applied marker is emitted',async()=>{
 const h=fixture('INTEREST_RENEWAL'),old=h.read('credits/old');h.failFinal();await a.rejects(h.store.execute(h.op),/FINAL_COMMIT_FAILED/);a.deepEqual(h.read('credits/old'),old);for(const p of ['credits/new','payments/payment','entries/cash','audit/audit-credit','operations/credit-op'])a.equal(h.read(p),undefined);
});
test('session cancellation stops preparation without financial writes',async()=>{
 let checks=0;const h=fixture('CREDIT_CREATE',{validate:()=>{if(++checks>4)throw Error('SESSION_CHANGED');}});await a.rejects(h.store.execute(h.op),/SESSION_CHANGED/);a.equal(h.read('credits/new'),undefined);a.equal(h.read('operations/credit-op'),undefined);
});
test('certificates validate variable extra installments without an arbitrary term limit',async()=>{
 const h=fixture();const next=h.op.writes.find(w=>w.path==='credits/new').data;next.term=150;next.total=120;next.schedule=S.generateWithExtras({total:120,term:150,freq:'daily',firstPaymentDate:day,extraPayments:[{date:'2027-12-31',amount:30}]});next.firstPaymentDate=next.schedule[0].date;
 const out=await h.store.execute(h.op);a.equal(out.status,'APPLIED');const last=h.read('creditCertificates/credit-op--new-150');a.equal(last.end,151);a.equal(last.prefix.at(-1),12000);a.equal(last.regularPrefix.at(-1),150);
});
test('malformed totals, dates, paid rows and net disbursement cannot be prepared',async()=>{
 for(const mutate of [op=>{op.writes.find(w=>w.path==='credits/new').data.total=121;},op=>{op.writes.find(w=>w.path==='credits/new').data.schedule[1].date=day;},op=>{op.writes.find(w=>w.path==='credits/new').data.schedule[0].paid=1;},op=>{op.writes.find(w=>w.path==='expenses/cash').data.amount=101;}]){const h=fixture();mutate(h.op);await a.rejects(h.store.execute(h.op));a.equal(h.read('credits/new'),undefined);}
 const h=fixture('REFINANCE');h.op.writes.find(w=>w.path==='credits/new').data.netDisbursement=55;await a.rejects(h.store.execute(h.op),/INVALID|MISMATCH/);a.equal(h.read('credits/new'),undefined);
});
test('current source version, noReplay and assigned worker cannot be bypassed',async()=>{
 for(const changed of [{version:2},{noReplay:true},{administrativeClosure:{noReplay:true}},{status:'CERRADO_ADMIN'}]){const h=fixture('REFINANCE');h.write('credits/old',{...h.old,...changed});await a.rejects(h.store.execute(h.op));a.equal(h.read('credits/new'),undefined);}
 const h=fixture();h.op.writes.find(w=>w.path==='credits/new').data.workerId='foreign-worker';await a.rejects(h.store.execute(h.op),/ASSIGNMENT|SCOPE|MISMATCH/);
});
test('two actors cannot share a preparation or replace its immutable payload',async()=>{
 const h=fixture();await h.store.execute(h.op);const p=h.read('creditProposals/credit-op');h.write('creditProposals/credit-op',{...p,actorId:'other-manager'});await a.rejects(h.store.execute(h.op),/COLLISION/);
});
test('canonicalization accepts omitted worker snapshot and uppercase manager role only when source agrees',async()=>{
 const h=fixture();delete h.op.writes.find(w=>w.path==='credits/new').data.workerId;await h.store.execute(h.op);a.equal(h.read('credits/new').workerId,'worker');a.equal(h.read('audit/audit-credit').role,'admin');
 const bad=fixture();bad.op.writes.find(w=>w.path==='audit/audit-credit').data.role='cobrador';await a.rejects(bad.store.execute(bad.op),/MANAGER|ROLE/);
});
test('absent trusted cash baseline or insufficient funds fail before financial preparation',async()=>{
 for(const missing of [true,false]){const h=fixture();if(missing)h.remove('financialControls/cash--leader');else h.write('financialControls/cash--leader',{accountId:'leader',balanceCents:9999,version:1,baselineId:'trusted-fictional-baseline'});await a.rejects(h.store.execute(h.op),/CASH_BASELINE_REQUIRED|INSUFFICIENT_CASH/);a.equal(h.read('credits/new'),undefined);a.equal(h.read('creditProposals/credit-op'),undefined);a.equal(h.read('operations/credit-op'),undefined);}
});
test('zero-net refinancing still requires an existing cash account and does not fabricate income',async()=>{
 const h=fixture('REFINANCE'),next=h.op.writes.find(w=>w.path==='credits/new').data;Object.assign(next,{capital:96,total:115.2,netDisbursement:0,schedule:S.generate({total:115.2,term:3,freq:'daily',firstPaymentDate:day})});h.op.writes=h.op.writes.filter(w=>!w.path.startsWith('expenses/'));Object.assign(h.op.writes.find(w=>w.path==='audit/audit-credit').data.detail,{newCapital:96,cashDisbursed:0});await h.store.execute(h.op);a.equal(h.read('financialControls/cash--leader').balanceCents,100000);a.equal(h.read('expenses/cash'),undefined);
});
module.exports={operation,fixture};
test('equivalent credit uses a trusted unique index across different operations and document IDs',async()=>{
 const h=fixture();h.write('financialControls/release',{protocol:'SPARK_NATIVE_BASELINE',state:'ACTIVE',baselineId:'trusted-fictional-baseline',creditIndexProtocol:'spark-credit-index-v1'});await h.store.execute(h.op);
 const second=clone(h.op);second.id='second-op';for(const w of second.writes){w.path=w.path.replace('/new','/second-credit').replace('/cash','/second-cash').replace('/audit-credit','/second-audit');w.data.id=w.path.split('/')[1];if(w.data.ref==='new')w.data.ref='second-credit';if(w.data.entityId==='new')w.data.entityId='second-credit';if(w.data.operationId)w.data.operationId=second.id;}
 const before=h.all();await a.rejects(h.store.execute(second),/DUPLICATE_CREDIT/);a.deepEqual(h.all(),before);a.equal(h.read('credits/second-credit'),undefined);
});
test('missing protected uniqueness baseline fails closed before any proposal',async()=>{
 const h=fixture();h.remove('financialControls/release');await a.rejects(h.store.execute(h.op),/CREDIT_INDEX_BASELINE/);a.equal(h.read('creditProposals/credit-op'),undefined);a.equal(h.read('credits/new'),undefined);
});
test('new schedules cannot move agreed dates or redistribute ordinary installments while keeping the same total',async()=>{for(const mutate of [c=>{c.schedule[1].date='2026-11-19';c.schedule[2].date='2026-12-19'},c=>{c.schedule[0].amount+=1;c.schedule[0].balance+=1;c.schedule[1].amount-=1;c.schedule[1].balance-=1}]){const h=fixture();mutate(h.op.writes.find(w=>w.path==='credits/new').data);await a.rejects(h.store.execute(h.op),/SCHEDULE|CALENDAR/);a.equal(h.read('credits/new'),undefined)}});
test('a valid rest-day shift retains the requested first date and exact generated schedule',async()=>{const h=fixture(),c=h.op.writes.find(w=>w.path==='credits/new').data;c.restDay='1';c.schedule=S.generate({total:c.total,term:c.term,freq:c.freq,firstPaymentDate:c.firstPaymentDate,restDay:c.restDay});const out=await h.store.execute(h.op);a.equal(out.status,'APPLIED');a.equal(out.result.credit.firstPaymentDate,day);a.equal(out.result.credit.schedule[0].date,'2026-10-20')});
