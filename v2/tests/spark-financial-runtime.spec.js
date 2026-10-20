'use strict';
// Transport and ACK boundary only; SDK, transaction adapter and endpoint are all in memory.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../core/transaction-store'),A=require('../cloud/firestore-atomic-adapter'),Q=require('../core/offline-operation-queue'),O=require('../cloud/operational-sync');
const clone=x=>JSON.parse(JSON.stringify(x));
const ACTIONS={CREDIT_CREATE:'CREDIT_CREATED',INTEREST_RENEWAL:'INTEREST_RENEWAL',REFINANCE:'CREDIT_REFINANCED',CASH_MOVEMENT:'CASH_MOVEMENT',PARTNER_LOAN_CREATED:'PARTNER_LOAN_CREATED',PARTNER_CONTACT_UPDATED:'PARTNER_CONTACT_UPDATED',PARTNER_INTEREST_PAID:'PARTNER_INTEREST_PAID',PARTNER_CAPITAL_RETURNED:'PARTNER_CAPITAL_RETURNED',PARTNER_SETTLED:'PARTNER_SETTLED'};
function operation(type='CASH_MOVEMENT'){
 const entities=[],add=(collection,id,kind='create',extra={})=>entities.push({collection,kind,data:{id,version:kind==='create'?1:2,...extra}});
 if(['CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE'].includes(type)){
  if(type!=='CREDIT_CREATE')add('credits','old-credit','set',{capital:100,total:120,status:'RENOVADO',renewedTo:'new-credit'});
  add('credits','new-credit','create',{capital:100,total:120,clientId:'client',status:'ACTIVO'});
  if(type==='INTEREST_RENEWAL')add('payments','renewal-payment','create',{creditId:'old-credit',amount:10,userId:'manager'});
  add(type==='INTEREST_RENEWAL'?'entries':'expenses','cash','create',{type:type==='INTEREST_RENEWAL'?'INGRESO':'EGRESO',amount:10});
 }else if(type==='CASH_MOVEMENT')add('entries','cash','create',{type:'INGRESO',amount:10});
 else{
  add('entries','partner-master',type==='PARTNER_LOAN_CREATED'?'create':'set',{type:'INGRESO',amount:100,partnerLoan:{principal:100,partner:'SOCIO FICTICIO',repayments:[],interestPayments:[],terms:[{from:'2026-11-18',amount:10}]}});
  if(['PARTNER_INTEREST_PAID','PARTNER_CAPITAL_RETURNED','PARTNER_SETTLED'].includes(type))add('expenses','partner-payment','create',{type:'EGRESO',amount:10,partnerLoanId:'partner-master',category:type==='PARTNER_INTEREST_PAID'?'INTERES_SOCIO':'DEVOLUCION_CAPITAL_SOCIO'});
 }
 return {operationId:'financial-op',type,entities,audit:{id:'audit-financial-op',actorId:'manager',role:'admin',action:ACTIONS[type],entityType:'FICTIONAL',entityId:entities[0].data.id,operationId:'financial-op',at:'2026-10-18T12:00:00.000Z',detail:{fixture:true}}};
}
function acknowledgement(op){return {status:'APPLIED',operation:{id:op.id,type:op.type,actorId:op.actorId,status:'APPLIED',writeCount:op.writes.length,source:'SPARK_FINANCIAL_ENDPOINT'},result:{writes:clone(op.writes).map(w=>({...w,data:{...w.data,...(w.path.startsWith('audit/')?{at:'2026-10-18T12:01:00.000Z',version:1}:{}),updatedAt:'2026-10-18T12:01:00.000Z'}}))}};}
function setup(source='cloud/runtime-cloud.js',{mode='external',missing=false,endpoint}={}){
 let auth={ready:true,uid:'manager',role:'admin',routeIds:[]},modeConfig={backendMode:mode};const storage=new Map(),documents=new Map(),calls={financial:[],transactions:0,payment:0,metadata:0};
 const native={get:async ref=>{const value=documents.get(ref);return {id:ref.split('/').at(-1),exists:()=>!!value,data:()=>clone(value)};},set:(ref,value)=>documents.set(ref,clone(value))};
 const w={navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},addEventListener(){},MI_CARTERA_V2_PILOT_CONFIG:modeConfig,MI_CARTERA_V2_FIREBASE_TEMPLATE:{projectId:'demo-mi-cartera-spark'},MiCarteraV2VersionGuard:{requireReady(){}},MiCarteraV2AuthCloudGate:{ORG:'v2-mi-cartera-pilot',requireReady:()=>({...auth}),state:()=>({...auth})},MiCarteraV2PilotConfig:{evaluate:()=>({ready:true})},MiCarteraV2FirestoreAdapter:A,MiCarteraV2Store:T,MiCarteraV2OfflineQueue:Q,MiCarteraV2OperationalSync:O,MiCarteraV2CommercialActions:{assertMetadataSession(){calls.metadata++;}},MiCarteraV2SyncBridge:{configure(sync){this.sync=sync;}},firebaseFunctionsV2:{recordInstallment:async()=>{calls.payment++;throw Error('EXPECTED_EXISTING_PAYMENT_ROUTE');}}};
 if(!missing)w.firebaseFunctionsV2.recordFinancialOperation=async op=>{calls.financial.push(clone(op));return endpoint?endpoint(op,{setAuth:value=>{auth={...auth,...value};},w}):acknowledgement(op);};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../',source),'utf8'),{window:w},{filename:source});
 const runtime=w.MiCarteraV2CloudRuntime.configure({orgId:'v2-mi-cartera-pilot',actorId:'manager',mode:'PILOT',cloudEnabled:true,allowRealWrites:true,db:{},doc:(_db,...parts)=>parts.join('/'),runTransaction:async(_db,fn)=>{calls.transactions++;return fn(native);}});
 const submit=input=>w.MiCarteraV2SyncBridge.sync.submit(input);
 function seedVersions(input){for(const e of input.entities||[])if(e.kind!=='create')documents.set('orgs/v2-mi-cartera-pilot/'+e.collection+'/'+e.data.id,{...clone(e.data),version:e.data.version-1});}
 return {w,runtime,calls,documents,submit,seedVersions,modeConfig,setAuth:value=>{auth={...auth,...value};}};
}
for(const source of ['cloud/runtime-cloud.js','app/cloud/runtime-cloud.js']){
 for(const type of Object.keys(ACTIONS))test(source+' external '+type+' uses the financial endpoint and no browser transaction',async()=>{
  const h=setup(source),input=operation(type),out=await h.submit(input);a.equal(out.status,'APPLIED');a.equal(h.calls.financial.length,1);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
  const sent=h.calls.financial[0];a.equal(sent.id,input.operationId);a.equal(sent.operationId,input.operationId);a.equal(sent.actorId,'manager');a.equal(sent.type,type);a.ok(sent.writes.every(w=>typeof w.path==='string'&&Number.isInteger(w.expectedVersion)));a.equal(sent.writes.filter(w=>w.path.startsWith('audit/')).length,1);
 });
 test(source+' default Functions mode keeps the existing generic transaction for financial operations',async()=>{
  const h=setup(source,{mode:'functions'}),input=operation('PARTNER_INTEREST_PAID');h.seedVersions(input);const out=await h.submit(input);a.equal(out.status,'APPLIED');a.equal(h.calls.financial.length,0);a.equal(h.calls.transactions,1);a.ok(h.documents.has('orgs/v2-mi-cartera-pilot/expenses/partner-payment'));
 });
 test(source+' external transport selection remains immutable after configure',async()=>{
  const h=setup(source);h.modeConfig.backendMode='functions';h.w.MI_CARTERA_V2_PILOT_CONFIG={backendMode:'functions'};await h.submit(operation());a.equal(h.calls.financial.length,1);a.equal(h.calls.transactions,0);
 });
 test(source+' default transport selection does not become external after configure',async()=>{
  const h=setup(source,{mode:'functions'});h.modeConfig.backendMode='external';await h.submit(operation());a.equal(h.calls.financial.length,0);a.equal(h.calls.transactions,1);
 });
 test(source+' missing external financial endpoint fails without generic fallback or queueing',async()=>{
  const h=setup(source,{missing:true});await a.rejects(h.submit(operation()),e=>/FINANCIAL_ENDPOINT_NOT_CONFIGURED/.test(e.message)&&e.noQueue===true);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
 });
 test(source+' external network failure cannot enqueue a generic browser financial mutation',async()=>{
  const h=setup(source,{endpoint:async()=>{throw Object.assign(Error('UNAVAILABLE'),{code:'unavailable'});}});await a.rejects(h.submit(operation()),e=>e.noQueue===true);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
 });
 test(source+' exact ALREADY_APPLIED and reordered canonical writes are accepted',async()=>{
  const h=setup(source,{endpoint:op=>{const r=acknowledgement(op);r.status='ALREADY_APPLIED';r.result.writes.reverse();return r;}});a.equal((await h.submit(operation('PARTNER_INTEREST_PAID'))).status,'ALREADY_APPLIED');a.equal(h.calls.transactions,0);
 });
 test(source+' accepted audit may use server ISO timestamp and version 1 while financial values stay exact',async()=>{
  const h=setup(source,{endpoint:op=>{const r=acknowledgement(op);for(const w of r.result.writes)w.data.createdAt='2026-10-18T12:01:00.000Z';return r;}});a.equal((await h.submit(operation())).status,'APPLIED');
 });
 test(source+' account change before acknowledgement rejects the response without local fallback',async()=>{
  const h=setup(source,{endpoint:(op,{setAuth})=>{setAuth({uid:'other-manager'});return acknowledgement(op);}});await a.rejects(h.submit(operation()),/ACTOR_CHANGED|SESSION_CHANGED|SCOPE_CHANGED/);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
 });
 test(source+' existing PAYMENT remains on its dedicated authoritative endpoint',async()=>{
  const h=setup(source),input=operation('INTEREST_RENEWAL');input.type='PAYMENT';input.entities=input.entities.filter(e=>e.data.id!=='new-credit');input.entities.find(e=>e.collection==='payments').data.creditId='old-credit';await a.rejects(h.submit(input),/EXPECTED_EXISTING_PAYMENT_ROUTE/);a.equal(h.calls.payment,1);a.equal(h.calls.financial.length,0);a.equal(h.calls.transactions,0);
 });
 test(source+' commercial metadata stays on its existing guarded transaction',async()=>{
  const h=setup(source),input={operationId:'route-op',type:'ROUTE_SAVED',entities:[{collection:'routes',kind:'create',data:{id:'fictional-route',recordType:'ROUTE',version:1}}],audit:{id:'audit-route',actorId:'manager',role:'admin',action:'ROUTE_SAVED',operationId:'route-op'}};a.equal((await h.submit(input)).status,'APPLIED');a.equal(h.calls.financial.length,0);a.equal(h.calls.transactions,1);a.ok(h.calls.metadata>0);
 });
 test(source+' unknown financial types cannot reach the external-mode generic transaction',async()=>{
  const h=setup(source),input=operation();input.type='UNSUPPORTED_CASH_MUTATION';await a.rejects(h.submit(input),e=>/FINANCIAL_OPERATION_NOT_SUPPORTED/.test(e.message)&&e.noQueue===true);a.equal(h.calls.financial.length,0);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
 });
 test(source+' client metadata remains generic without permitting a financial record type in routes',async()=>{
  const h=setup(source),input={operationId:'client-op',type:'CLIENT_CREATE',entities:[{collection:'clients',kind:'create',data:{id:'client',name:'FICTICIO',version:1}}],audit:{id:'audit-client',actorId:'manager',role:'admin',action:'CLIENT_CREATED',operationId:'client-op'}};
  a.equal((await h.submit(input)).status,'APPLIED');a.equal(h.calls.transactions,1);a.equal(h.calls.financial.length,0);
  const forged={operationId:'forged-op',type:'ROUTE_SAVED',entities:[{collection:'routes',kind:'create',data:{id:'forged-term',recordType:'TERM',version:1}}],audit:{id:'audit-forged',actorId:'manager',role:'admin',action:'ROUTE_SAVED',operationId:'forged-op'}};
  await a.rejects(h.submit(forged),/FINANCIAL_OPERATION_NOT_SUPPORTED/);a.equal(h.calls.transactions,1);
 });
}
for(const [label,tamper]of [
 ['unaccepted status',r=>{r.status='QUEUED';}],['wrong operation id',r=>{r.operation.id='other-op';}],['wrong operation type',r=>{r.operation.type='PARTNER_SETTLED';}],['wrong operation actor',r=>{r.operation.actorId='other-manager';}],['non-applied operation',r=>{r.operation.status='PENDING';}],['wrong writeCount',r=>{r.operation.writeCount++;}],
 ['missing canonical writes',r=>{delete r.result.writes;}],['missing write',r=>{r.result.writes.pop();}],['duplicate write path',r=>{r.result.writes[1]=clone(r.result.writes[0]);}],['different path',r=>{r.result.writes[0].path='entries/other';}],['different kind',r=>{r.result.writes[0].kind='set';}],['different expected version',r=>{r.result.writes[0].expectedVersion=99;}],['changed cash amount',r=>{r.result.writes[0].data.amount=11;}],['changed data id',r=>{r.result.writes[0].data.id='other';}],
 ['wrong audit operation',r=>{r.result.writes.at(-1).data.operationId='other-op';}],['wrong audit actor',r=>{r.result.writes.at(-1).data.actorId='other-manager';}],['wrong audit role',r=>{r.result.writes.at(-1).data.role='cobrador';}],['wrong audit action',r=>{r.result.writes.at(-1).data.action='PARTNER_SETTLED';}],['invalid audit date',r=>{r.result.writes.at(-1).data.at='tomorrow';}],['invalid audit version',r=>{r.result.writes.at(-1).data.version=2;}],['changed audit financial detail',r=>{r.result.writes.at(-1).data.detail={fixture:false};}],['invalid technical timestamp',r=>{r.result.writes[0].data.updatedAt='not-a-date';}]
])test('canonical financial ACK rejects '+label+' without fallback',async()=>{
 const h=setup(undefined,{endpoint:op=>{const r=acknowledgement(op);tamper(r);return r;}});await a.rejects(h.submit(operation()),e=>/FINANCIAL_ACK_INVALID/.test(e.message)&&e.noQueue===true);a.equal(h.calls.transactions,0);a.equal(h.runtime.inspect().length,0);
});
test('canonical financial ACK rejects a changed nested partner principal',async()=>{
 const h=setup(undefined,{endpoint:op=>{const r=acknowledgement(op);r.result.writes[0].data.partnerLoan.principal=101;return r;}});await a.rejects(h.submit(operation('PARTNER_LOAN_CREATED')),/FINANCIAL_ACK_INVALID/);a.equal(h.calls.transactions,0);
});
