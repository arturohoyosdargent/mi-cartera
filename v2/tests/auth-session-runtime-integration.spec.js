// Real session/Auth gate/runtime/rehydration integration; only Firebase SDK boundaries are fictional memory.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Window}=require('happy-dom');
const APP=path.join(__dirname,'../app'),PROJECT='demo-mi-cartera-session',ORG='v2-mi-cartera-pilot',UID='fixture-integration-A',KEY='mi-cartera-v2-validation-state';
const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
async function fixture({readBarrier=null,membershipBarrier=null,locks=true,seed=null,pending=null,member={active:true,role:'admin',routeIds:[]}}={}){
 const w=new Window({url:'https://fixture.invalid/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}}),context=vm.createContext(w),remote=new Map();
 let versionReady=false,authCallback,reads=0,writes=0,currentBarrier=readBarrier,currentMember=member;const authEvents=[];
 w.addEventListener('v2-auth-cloud-state',event=>authEvents.push(clone(event.detail)));
 w.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:PROJECT};w.MI_CARTERA_V2_PILOT_CONFIG={mode:'PILOT',cloudEnabled:true,allowRealWrites:true,orgId:ORG};
 w.MiCarteraV2VersionGuard={state:()=>({ready:versionReady}),requireReady(){assert.equal(versionReady,true)}};
 w.firebaseAuthV2={auth:{currentUser:null},onAuthStateChanged:(_auth,callback)=>{authCallback=callback;return ()=>{}}};
 const queueKey='mi-cartera-v2-cloud-operations-scoped:'+encodeURIComponent(JSON.stringify([PROJECT,ORG,UID]));
 if(seed){const scope={projectId:PROJECT,orgId:ORG,uid:UID},key='mi-cartera-v2-scoped-state:'+encodeURIComponent(JSON.stringify([PROJECT,ORG,UID]));w.localStorage.setItem(key,JSON.stringify({version:1,scope,owner:UID,raw:JSON.stringify(seed),confirmed:true}))}
 if(pending!==null)w.localStorage.setItem(queueKey,pending);
 if(locks)Object.defineProperty(w.navigator,'locks',{configurable:true,value:{request:async(_name,_options,callback)=>callback()}});
 else Object.defineProperty(w.navigator,'locks',{configurable:true,value:undefined});
 const snapshot=(ref,value)=>({id:ref.path.split('/').at(-1),exists:()=>value!==undefined,data:()=>clone(value)});
 w.firestoreV2={db:{},doc:(_db,...parts)=>({path:parts.join('/')}),getDoc:async ref=>{const captured=clone(currentMember);if(membershipBarrier)await membershipBarrier.promise;return snapshot(ref,captured)},collection:(_db,...parts)=>({path:parts.join('/')}),where:(field,op,value)=>({field,op,value}),query:(base,clause)=>({...base,clause}),getDocs:async ref=>{reads++;if(currentBarrier)await currentBarrier.promise;const rows=[...remote].filter(([key,value])=>key.startsWith(ref.path+'/')&&(!ref.clause||value[ref.clause.field]===ref.clause.value));return {forEach:callback=>rows.forEach(([key,value])=>callback(snapshot({path:key},value)))}} ,runTransaction:async(_db,callback)=>{
  const staged=new Map();const result=await callback({get:async ref=>snapshot(ref,remote.get(ref.path)),set:(ref,value)=>staged.set(ref.path,clone(value))});for(const [key,value] of staged){remote.set(key,value);writes++}return result;
 }};
 const load=file=>vm.runInContext(fs.readFileSync(path.join(APP,file),'utf8'),context,{filename:file});
 for(const file of ['core/sync-errors.js','core/offline-operation-queue.js','core/transaction-store.js','cloud/firestore-atomic-adapter.js','cloud/operational-sync.js','cloud/runtime-cloud.js','operation-sync-bridge.js','operation-commit-gate.js','pilot-config.js','session-storage-v2.js','auth-cloud-gate.js','local-ownership-bootstrap-v2.js','cloud-rehydration-v2.js'])load(file);
 const drain=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve))};
 await drain();versionReady=true;await w.MiCarteraV2AuthCloudGate.start();
 return {w,queueKey,drain,authEvents,auth:async(uid=UID)=>{w.firebaseAuthV2.auth.currentUser=uid?{uid,email:uid+'@fixture.invalid'}:null;return authCallback(w.firebaseAuthV2.auth.currentUser)},barrier:value=>{currentBarrier=value},member:value=>{currentMember=value},version:value=>{versionReady=value;w.dispatchEvent(new w.CustomEvent('v2-version-state',{detail:{ready:value}}))},reads:()=>reads,writes:()=>writes,remote,close:()=>w.happyDOM.abort()};
}
const input={operationId:'fixture-after-confirmation',type:'CASH_MOVEMENT',entities:[{collection:'entries',kind:'create',data:{id:'fixture-cash',type:'INGRESO',amount:5,version:1}}]};
for(const role of ['admin','supervisor','cobrador'])test('real Auth and session integration admits first '+role+' login and enables writes only after confirmed hydration',async()=>{
 const barrier=deferred(),h=await fixture({readBarrier:barrier,member:{active:true,role,routeIds:[]}});try{
  await h.auth();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,true,'verified membership must enable session activation and hydration');
  assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false,'Cloud transport waits for confirmed local custody');
  await assert.rejects(h.w.MiCarteraV2OperationCommitGate.submit({bridge:h.w.MiCarteraV2SyncBridge,versionGuard:h.w.MiCarteraV2VersionGuard,authGate:h.w.MiCarteraV2AuthCloudGate,operation:input}),/V2_CLOUD_SYNC_NOT_CONFIGURED/);assert.equal(h.writes(),0);
  barrier.resolve();await h.drain();assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,true);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);
  if(role==='admin'){const result=await h.w.MiCarteraV2SyncBridge.submit(input);assert.equal(result.status,'APPLIED');assert.equal(h.remote.get('orgs/'+ORG+'/entries/fixture-cash').amount,5)}
 }finally{barrier.resolve();await h.close()}
});
test('real Auth and session integration preserves same-owner pending custody and configures its transport without remote hydration',async()=>{
 const seed={clients:[],credits:[{id:'fixture-closed',status:'CERRADO_ADMIN',noReplay:true}],payments:[],cashMovements:[],audit:[],commercial:[],session:{actorId:UID,role:'admin',routeIds:[]}},pending='[{"id":"fixture-pending","status":"PENDIENTE","operation":{"actorId":"'+UID+'"}}]',h=await fixture({seed,pending});try{
  await h.auth();await h.drain();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,true);assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,true);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);assert.equal(h.reads(),0);assert.equal(h.writes(),0);assert.equal(h.w.localStorage.getItem(h.queueKey),pending);assert.equal(JSON.parse(h.w.localStorage.getItem(KEY)).credits[0].noReplay,true);
 }finally{await h.close()}
});
test('real Auth and session integration keeps transport unavailable when first-login custody lacks an exclusive lock',async()=>{
 const h=await fixture({locks:false});try{await h.auth();await h.drain();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,true);assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,false);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false);assert.equal(h.writes(),0)}finally{await h.close()}
});
test('real Auth and session integration disconnects on involuntary auth loss and rejects the former session token after A-B-A',async()=>{
 const h=await fixture();try{await h.auth();await h.drain();const token=h.w.MiCarteraV2SessionStorage.capture();assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);await h.auth(null);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false);await h.auth('fixture-integration-B');await h.drain();assert.equal(JSON.parse(h.w.localStorage.getItem(KEY)).session.actorId,'fixture-integration-B');await h.auth(null);await h.auth();await h.drain();assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);assert.throws(()=>h.w.MiCarteraV2SessionStorage.assertCurrent(token),/SCOPE_CHANGED/);assert.equal(h.writes(),0)}finally{await h.close()}
});
test('real Auth and session integration does not reconnect transport after membership is revoked',async()=>{
 const h=await fixture();try{await h.auth();await h.drain();assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);h.member({active:false,role:'admin'});await h.w.MiCarteraV2AuthCloudGate.refreshMembership();await h.drain();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,false);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false);assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,false);assert.equal(h.writes(),0)}finally{await h.close()}
});
test('late membership cannot start hydration or reconnect transport after the version becomes blocked',async()=>{
 const membership=deferred(),h=await fixture({membershipBarrier:membership});try{const login=h.auth();await h.drain();h.version(false);membership.resolve();await login;await h.drain();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,false);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false);assert.equal(h.reads(),0,'an invalidated membership response must never start business-data hydration');assert.equal(h.authEvents.some(state=>state.ready),false);assert.equal(h.writes(),0)}finally{membership.resolve();await h.close()}
});
test('late membership for A cannot publish a ready grant after the native Auth user changes to B',async()=>{
 const membership=deferred(),h=await fixture({membershipBarrier:membership});try{const loginA=h.auth();await h.drain();const loginB=h.auth('fixture-integration-B');membership.resolve();await Promise.all([loginA,loginB]);await h.drain();assert.equal(h.authEvents.some(state=>state.ready&&state.uid===UID),false,'obsolete membership A must never publish a ready authorization');assert.equal(h.w.MiCarteraV2AuthCloudGate.state().uid,'fixture-integration-B');assert.equal(h.w.MiCarteraV2SessionStorage.state().uid,'fixture-integration-B');assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,true);assert.equal(h.writes(),0)}finally{membership.resolve();await h.close()}
});
for(const change of ['organization','project'])test('late membership cannot authorize a different '+change+' scope',async()=>{
 const membership=deferred(),h=await fixture({membershipBarrier:membership});try{const login=h.auth();await h.drain();if(change==='organization')h.w.MiCarteraV2PilotConfig.setTenant('v2-fictional-other');else h.w.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:'demo-fictional-other'};membership.resolve();await login;await h.drain();assert.equal(h.w.MiCarteraV2AuthCloudGate.state().ready,false);assert.equal(h.w.MiCarteraV2SyncBridge.status().configured,false);assert.equal(h.reads(),0);assert.equal(h.authEvents.some(state=>state.ready),false);assert.equal(h.writes(),0)}finally{membership.resolve();await h.close()}
});
