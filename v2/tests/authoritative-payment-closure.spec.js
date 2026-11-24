'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Q=require('../core/offline-operation-queue'),O=require('../cloud/operational-sync');
const {createCollectorPaymentService}=require('../../functions/v2-collector-payment');
const clone=value=>JSON.parse(JSON.stringify(value)),ROOT=path.resolve(process.env.SOURCE||path.join(__dirname,'..'));
function payload(id='c1'){return {operationId:'op-'+id,type:'PAYMENT',entities:[{collection:'credits',kind:'set',data:{id,version:2}},{collection:'payments',kind:'create',data:{id:'p-'+id,creditId:id,userId:'u1',amount:20,version:1}}]};}
function fixture(source){
 const prefix='orgs/v2-mi-cartera-pilot/',credit=id=>({id,clientId:'client1',routeId:'r1',workerId:'w1',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-10',amount:120,paid:0,balance:120,status:'PENDIENTE'}]});
 let docs=new Map([[prefix+'members/u1',{active:true,role:'admin',routeIds:['r1']}],[prefix+'credits/c1',credit('c1')],[prefix+'credits/c2',credit('c2')]]),calls=0,lostAck=false;
 const service=createCollectorPaymentService({now:()=> '2026-10-13T12:00:00.000Z',businessDate:()=> '2026-10-13',runAtomic:async run=>{const draft=new Map([...docs].map(([key,value])=>[key,clone(value)])),result=await run({get:async key=>clone(draft.get(key)??null),set:async(key,value)=>draft.set(key,clone(value)),create:async(key,value)=>draft.set(key,clone(value))});docs=draft;return result;}});
 const storage=new Map([['mi-cartera-v2-local-owner','u1']]),auth={uid:'u1',role:'admin',ready:true,routeIds:['r1']};
 const w={navigator:{onLine:true},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},addEventListener(){},MI_CARTERA_V2_PILOT_CONFIG:{backendMode:'b2-compatible'},MI_CARTERA_V2_FIREBASE_TEMPLATE:{projectId:'demo-mi-cartera-v2'},MiCarteraV2VersionGuard:{requireReady(){}},MiCarteraV2AuthCloudGate:{ORG:'v2-mi-cartera-pilot',requireReady:()=>({...auth})},MiCarteraV2PilotConfig:{evaluate:()=>({ready:true})},MiCarteraV2SessionStorage:{capture:()=>({projectId:'demo-mi-cartera-v2',generation:'same-custody'}),assertCurrent(){},queueKey:()=> 'fixture-payment-queue'},MiCarteraV2FirestoreAdapter:{createFirestoreAtomicAdapter:()=>({})},MiCarteraV2Store:{createStore:()=>({execute(){throw Error('FINANCIAL_FALLBACK_FORBIDDEN')}})},MiCarteraV2OfflineQueue:Q,MiCarteraV2OperationalSync:O,MiCarteraV2SyncBridge:{configure(sync){this.sync=sync}},firebaseFunctionsV2:{recordInstallment:async input=>{calls++;const result=await service.execute({uid:'u1'},input);if(lostAck){lostAck=false;throw Object.assign(Error('lost ACK'),{code:'functions/unavailable'})}return result;}}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,source),'utf8'),{window:w});
 const runtime=w.MiCarteraV2CloudRuntime.configure({orgId:'v2-mi-cartera-pilot'});
 return {w,runtime,submit:input=>w.MiCarteraV2SyncBridge.sync.submit(input),calls:()=>calls,read:key=>docs.get(prefix+key),raw:()=>storage.get('fixture-payment-queue'),close(change){const rows=JSON.parse(storage.get('fixture-payment-queue'));change(rows[0]);storage.set('fixture-payment-queue',JSON.stringify(rows));},loseAck(){lostAck=true;}};
}
const closures={
 rowStatus:row=>row.status='CERRADO_ADMIN',
 rowNoReplay:row=>row.noReplay=true,
 rowClosure:row=>row.administrativeClosure={noReplay:true},
 operationStatus:row=>row.operation.status='CERRADO_ADMIN',
 operationNoReplay:row=>row.operation.noReplay=true,
 operationClosure:row=>row.operation.administrativeClosure={noReplay:true},
 blocked:row=>row.status='BLOQUEADO',
 conflict:row=>row.status='CONFLICTO'
};
for(const source of ['app/cloud/runtime-cloud.js','cloud/runtime-cloud.js']){
 for(const [name,close] of Object.entries(closures))test(source+' '+name+' refuses recovery and direct payment retry before reaching endpoint',async()=>{
  const h=fixture(source);h.w.navigator.onLine=false;a.equal((await h.submit(payload())).status,'QUEUED');h.close(close);const preserved=h.raw();
  a.throws(()=>h.runtime.pendingPayment('c1',1),/PENDING_REVIEW_REQUIRED/);
  h.w.navigator.onLine=true;await a.rejects(h.submit(payload()),/PENDING_REVIEW_REQUIRED/);
  a.equal(h.calls(),0);a.equal(h.read('credits/c1').version,1);a.equal(h.read('payments/p-c1'),undefined);a.equal(h.raw(),preserved);
  a.equal((await h.runtime.flush()).applied,0);a.equal(h.raw(),preserved);
 });
 test(source+' a closed payment does not block an unrelated credit and accepted exact retries remain valid',async()=>{
  const h=fixture(source);h.w.navigator.onLine=false;await h.submit(payload());h.close(closures.rowNoReplay);h.w.navigator.onLine=true;
  a.equal((await h.submit(payload('c2'))).status,'APPLIED');a.equal(h.read('credits/c1').version,1);a.equal(h.read('credits/c2').version,2);a.equal(h.calls(),1);
  const accepted=fixture(source);accepted.loseAck();a.equal((await accepted.submit(payload())).status,'QUEUED');a.equal((await accepted.runtime.flush()).applied,1);a.equal(accepted.runtime.inspect()[0].status,'SINCRONIZADO');
  a.equal((await accepted.submit(payload())).status,'ALREADY_APPLIED');a.equal(accepted.read('credits/c1').version,2);
 });
}
