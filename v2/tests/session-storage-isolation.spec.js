// Fictional in-memory browser/Auth/Firestore only. Never loads firebase-bootstrap or a real SDK.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Window}=require('happy-dom');
const APP=path.join(__dirname,'../app'),K='mi-cartera-v2-validation-state',OWNER='mi-cartera-v2-local-owner';
const PROJECT='mi-cartera-d0d8c',ORG='v2-mi-cartera-pilot',A='fixture-admin-A',B='fixture-collector-B';
const clone=value=>JSON.parse(JSON.stringify(value));
const authorized=(uid=A,role='admin')=>({ready:true,authenticated:true,member:true,uid,role,routeIds:uid===B?['fixture-route-B']:[],email:uid+'@fixture.invalid'});
const initial=()=>({clients:[{id:'fixture-client-A',name:'FICTICIO A'}],credits:[{id:'fixture-credit-A',status:'CERRADO_ADMIN',noReplay:true}],payments:[{id:'fixture-payment-A',amount:10,userId:A}],cashMovements:[{id:'fixture-cash-A',type:'INGRESO',amount:123}],audit:[],commercial:[],session:{actorId:A,role:'admin',routeIds:[]}});
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function fixture({seed=initial(),owner=A,readBarrier=null,bridgePending=0,injectStorageFault=false}={}){
 const w=new Window({url:'https://fixture.invalid/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});
 w.document.write('<input id="loginEmail"><input id="loginPassword"><p id="loginMessage"></p><b id="loginIdentity"></b><button id="loginLogout"></button><button id="loginButton"></button>');
 if(seed!==null)w.localStorage.setItem(K,JSON.stringify(seed));if(owner!==null)w.localStorage.setItem(OWNER,owner);
 w.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:PROJECT};w.MI_CARTERA_V2_PILOT_CONFIG={orgId:ORG};
 let auth={ready:false,authenticated:false,member:false,uid:null,role:null},org=ORG,project=PROJECT,signIns=0,signOuts=0,reads=0;
 w.firebaseAuthV2={auth:{currentUser:null}};
 const set=(next,{emit=true,nextOrg=org,nextProject=project}={})=>{auth=clone(next);org=nextOrg;project=nextProject;w.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:project};w.firebaseAuthV2.auth.currentUser=auth.uid?{uid:auth.uid}:null;if(emit)w.dispatchEvent(new w.CustomEvent('v2-auth-cloud-state',{detail:clone(auth)}));};
 w.MiCarteraV2AuthCloudGate={get ORG(){return org},state:()=>clone(auth),requireReady:()=>{if(!auth.ready)throw Error('NOT_READY');return clone(auth)},signIn:async()=>{signIns++;set(authorized(B,'cobrador'));return clone(auth)},signOut:async()=>{signOuts++;set({ready:false,authenticated:false,member:false,uid:null,role:null,preserveLocal:true});return clone(auth)}};
 w.MiCarteraV2SyncBridge={status:()=>({pending:bridgePending})};
 // Remote rows are fixed fictional data: A gets its own records, B has none.
 w.firestoreV2={db:{},collection:(_db,...parts)=>({orgId:parts[1],name:parts[2]}),where:(field,op,value)=>({field,op,value}),query:(base,clause)=>({...base,clause}),
  getDocs:async ref=>{reads++;if(readBarrier)await readBarrier.promise;const rows=auth.uid===A&&ref.orgId===ORG&&project===PROJECT?(ref.name==='entries'?initial().cashMovements:(initial()[ref.name]||[])):[];return {forEach:fn=>rows.filter(row=>!ref.clause||row[ref.clause.field]===ref.clause.value).forEach(row=>fn({id:row.id,data:()=>clone(row)}))}}};
 Object.defineProperty(w.navigator,'locks',{configurable:true,value:{request:async(_name,_options,callback)=>callback()}});
 let failArchive=false;if(injectStorageFault){const backing=w.localStorage;Object.defineProperty(w,'localStorage',{configurable:true,value:{get length(){return backing.length},key:i=>backing.key(i),getItem:k=>backing.getItem(k),removeItem:k=>backing.removeItem(k),setItem:(k,v)=>{if(failArchive&&k.startsWith('mi-cartera-v2-scoped-state:'))throw Error('FIXTURE_QUOTA_EXCEEDED');backing.setItem(k,v)}}})}
 const ctx=vm.createContext(w),load=name=>vm.runInContext(fs.readFileSync(path.join(APP,name),'utf8'),ctx,{filename:name});
 if(fs.existsSync(path.join(APP,'session-storage-v2.js')))load('session-storage-v2.js');
 load('local-ownership-bootstrap-v2.js');load('cloud-rehydration-v2.js');load('login-v2.js');
 await w.happyDOM.whenAsyncComplete();
 const drain=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 return {w,set,drain,failArchive:()=>{failArchive=true},read:()=>JSON.parse(w.localStorage.getItem(K)||'{}'),signIns:()=>signIns,signOuts:()=>signOuts,reads:()=>reads,close:()=>w.happyDOM.abort()};
}

test('logout removes all business rows from active storage while preserving the owner A archive',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();await h.w.MiCarteraV2Login.logout();await h.drain();
  const data=h.read();assert.deepEqual(data.clients,[],'logout must not expose portfolio A through active local state');assert.deepEqual(data.cashMovements,[],'logout must not expose cash A');assert.equal(data.session,null);
  const archiveKey=Array.from({length:h.w.localStorage.length},(_,i)=>h.w.localStorage.key(i)).find(key=>key.startsWith('mi-cartera-v2-scoped-state:'));const custody=JSON.parse(h.w.localStorage.getItem(archiveKey));assert.equal(custody.owner,A,'A retains ownership of its preserved archive');assert.equal(JSON.parse(custody.raw).credits[0].status,'CERRADO_ADMIN');assert.equal(JSON.parse(custody.raw).credits[0].noReplay,true);
 }finally{await h.close()}
});

test('collector B after A logout never receives cash or clients from A active state',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();await h.w.MiCarteraV2Login.logout();await h.drain();h.set(authorized(B,'cobrador'));await h.drain();
  assert.equal(h.read().session?.actorId,B);assert.deepEqual(h.read().cashMovements,[],'B must not inherit cash A');assert.deepEqual(h.read().clients,[]);assert.deepEqual(h.read().credits,[]);
 }finally{await h.close()}
});

test('same owner A re-login recovers its preserved administrative closure without replay',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();await h.w.MiCarteraV2Login.logout();await h.drain();h.set(authorized());await h.drain();
  assert.equal(h.read().session?.actorId,A);assert.equal(h.read().credits[0].status,'CERRADO_ADMIN');assert.equal(h.read().credits[0].noReplay,true);assert.equal(h.read().cashMovements[0].id,'fixture-cash-A');
 }finally{await h.close()}
});

test('login cannot change identity while current owner has a pending operation',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();const queue='[{"id":"fixture-op","status":"PENDIENTE"}]';h.w.localStorage.setItem('mi-cartera-v2-cloud-operations:'+A,queue);
  await h.w.MiCarteraV2Login.login();await h.drain();assert.equal(h.signIns(),0,'pending owner A work blocks Auth sign-in before switching');assert.equal(h.w.MiCarteraV2AuthCloudGate.state().uid,A);assert.equal(h.w.localStorage.getItem('mi-cartera-v2-cloud-operations:'+A),queue);
 }finally{await h.close()}
});

test('logout cannot clear a profile while the sync bridge has an in-flight operation',async()=>{
 const h=await fixture({bridgePending:1});try{h.set(authorized());await h.drain();await h.w.MiCarteraV2Login.logout();assert.equal(h.signOuts(),0,'in-flight submission blocks sign-out');assert.equal(h.w.MiCarteraV2AuthCloudGate.state().uid,A);
 }finally{await h.close()}
});

test('same UID in another organization does not receive legacy cash or a read from the pilot org',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();h.set(authorized(),{nextOrg:'v2-fixture-other-org'});await h.drain();
  assert.deepEqual(h.read().cashMovements,[],'same UID in another org must start from its separate profile');assert.deepEqual(h.read().clients,[]);assert.equal(h.w.MiCarteraV2SessionStorage?.scope?.()?.orgId,'v2-fixture-other-org');
 }finally{await h.close()}
});

test('late A hydration cannot repopulate active storage after logout even while offline',async()=>{
 const barrier=deferred(),h=await fixture({readBarrier:barrier});try{h.set(authorized());await new Promise(resolve=>setImmediate(resolve));
  Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:false});await h.w.MiCarteraV2Login.logout();barrier.resolve();await h.drain();
  assert.equal(h.read().session,null);assert.deepEqual(h.read().clients,[],'offline logout must clear active data immediately');assert.deepEqual(h.read().cashMovements,[]);
 }finally{barrier.resolve();await h.close()}
});


test('a storage change from another tab invalidates new hydration tokens and ordinary reads',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();h.w.localStorage.setItem(OWNER,B);h.w.localStorage.setItem(K,JSON.stringify({...initial(),session:{actorId:B,role:'cobrador'}}));h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:K,newValue:h.w.localStorage.getItem(K)}));
  assert.throws(()=>h.w.MiCarteraV2SessionStorage.capture(),/SCOPE|OWNER|OTHER_TAB/,'a current Auth user cannot capture a token for another tab profile');assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,false);
 }finally{await h.close()}
});

test('clean first login cannot establish ownership without an exclusive browser lock',async()=>{
 const h=await fixture({seed:null,owner:null});try{Object.defineProperty(h.w.navigator,'locks',{configurable:true,value:undefined});h.set(authorized(B,'cobrador'));await h.drain();assert.equal(h.w.localStorage.getItem(OWNER),null,'technical owner requires exclusive verified confirmation');assert.equal(h.w.MiCarteraV2SessionStorage.state().ready,false);
 }finally{await h.close()}
});

test('same UID in another Firebase project never receives its prior project cash',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();h.set(authorized(),{nextProject:'fictional-other-project'});await h.drain();assert.deepEqual(h.read().cashMovements,[]);assert.deepEqual(h.read().clients,[]);assert.equal(h.w.MiCarteraV2SessionStorage.scope().projectId,'fictional-other-project');
 }finally{await h.close()}
});


test('unowned or mismatching legacy rows stay in custody and are never adopted into a new profile',async()=>{
 for(const [label,owner,legacyActor] of [['unowned',null,A],['foreign owner','fixture-owner-foreign',A],['mismatching actor',A,'fixture-actor-foreign']]){
  const seed=initial();seed.clients=[{id:'fixture-private-legacy-'+label}];seed.session={actorId:legacyActor,role:'admin'};const raw=JSON.stringify(seed),h=await fixture({seed,owner});try{h.set(authorized());await h.drain();const legacy=JSON.parse(h.w.localStorage.getItem('mi-cartera-v2-legacy-custody'));assert.equal(legacy.raw,raw,'legacy source bytes are preserved');assert.equal(legacy.owner,owner,'legacy owner is never reassigned');assert.equal(h.read().clients.some(row=>row.id.startsWith('fixture-private-legacy-')),false,'ambiguous financial rows are not adopted');
  }finally{await h.close()}
 }
});

test('a profile A token cannot become current again after A-B-A',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();const before=h.w.MiCarteraV2SessionStorage.capture();await h.w.MiCarteraV2Login.logout();h.set(authorized(B,'cobrador'));await h.drain();await h.w.MiCarteraV2Login.logout();h.set(authorized());await h.drain();assert.throws(()=>h.w.MiCarteraV2SessionStorage.assertCurrent(before),/SCOPE_CHANGED/);assert.equal(h.read().credits[0].status,'CERRADO_ADMIN');assert.equal(h.read().credits[0].noReplay,true);
 }finally{await h.close()}
});

test('B cannot read A custody through the session API',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();await h.w.MiCarteraV2Login.logout();h.set(authorized(B,'cobrador'));await h.drain();assert.throws(()=>h.w.MiCarteraV2SessionStorage.readScope({projectId:PROJECT,orgId:ORG,uid:A}),/SCOPE_MISMATCH/);assert.deepEqual(h.read().cashMovements,[]);
 }finally{await h.close()}
});

test('administratively closed and noReplay queue rows do not block logout and remain byte-for-byte intact',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();const rows=[{id:'closed',status:'CERRADO_ADMIN',administrativeClosure:{noReplay:true}},{id:'no-replay',status:'PENDIENTE',administrativeClosure:{noReplay:true}},{id:'top-no-replay',status:'ERROR',noReplay:true}],raw=JSON.stringify(rows),key='mi-cartera-v2-cloud-operations:'+A;h.w.localStorage.setItem(key,raw);
  assert.equal(h.w.MiCarteraV2SessionStorage.pending(),false);assert.equal(h.w.MiCarteraV2CloudRehydration.pending(),false);await h.w.MiCarteraV2Login.logout();assert.equal(h.signOuts(),1);assert.equal(h.w.localStorage.getItem(key),raw);assert.deepEqual(h.read().clients,[]);
 }finally{await h.close()}
});

test('the active project/org/UID queue blocks transition without changing any queue bytes',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();const scope={projectId:PROJECT,orgId:ORG,uid:A},key='mi-cartera-v2-cloud-operations-scoped:'+encodeURIComponent(JSON.stringify([PROJECT,ORG,A])),raw='[{"id":"fixture-scope-pending","status":"ERROR"}]';h.w.localStorage.setItem(key,raw);
  assert.equal(h.w.MiCarteraV2SessionStorage.queueKey(scope),key);assert.equal(h.w.MiCarteraV2SessionStorage.pending(),true);assert.equal(h.w.MiCarteraV2CloudRehydration.pending(),true);await h.w.MiCarteraV2Login.logout();assert.equal(h.signOuts(),0);assert.equal(h.w.localStorage.getItem(key),raw);
 }finally{await h.close()}
});

test('involuntary auth loss hides active rows but preserves pending custody for the same scope',async()=>{
 const h=await fixture();try{h.set(authorized());await h.drain();const key='mi-cartera-v2-cloud-operations:'+A,raw='[{"id":"fixture-pending","status":"PENDIENTE"}]';h.w.localStorage.setItem(key,raw);h.set({ready:false,authenticated:false,member:false,uid:null,role:null});await h.drain();assert.deepEqual(h.read().clients,[]);assert.deepEqual(h.read().cashMovements,[]);assert.equal(h.w.localStorage.getItem(OWNER),null);assert.equal(h.w.localStorage.getItem(key),raw);
  h.set(authorized());await h.drain();assert.equal(h.read().session?.actorId,A);assert.equal(h.read().credits[0].status,'CERRADO_ADMIN');assert.equal(h.w.localStorage.getItem(key),raw);
 }finally{await h.close()}
});

test('an archival write failure rejects voluntary logout before Auth changes identity',async()=>{
 const h=await fixture({injectStorageFault:true});try{h.set(authorized());await h.drain();const before=h.w.localStorage.getItem(K);h.failArchive();const out=await h.w.MiCarteraV2Login.logout();assert.equal(out.status,'LOGOUT_FAILED');assert.equal(h.signOuts(),0);assert.equal(h.w.MiCarteraV2AuthCloudGate.state().uid,A);assert.equal(h.w.localStorage.getItem(K),before);
 }finally{await h.close()}
});
test('same UID permission downgrade hides former manager data immediately and preserves its prior custody',async()=>{const h=await fixture();try{h.set(authorized());await h.drain();h.set(authorized(A,'cobrador'));assert.deepEqual(h.read().cashMovements,[],'cash from the former manager grant must disappear before remote hydration');assert.deepEqual(h.read().clients,[]);await h.drain();assert.deepEqual(h.read().cashMovements,[]);const key=Array.from({length:h.w.localStorage.length},(_,i)=>h.w.localStorage.key(i)).find(k=>k.startsWith('mi-cartera-v2-permission-custody:'));assert.ok(key,'previous authorized rows remain in immutable custody');assert.equal(JSON.parse(JSON.parse(h.w.localStorage.getItem(key)).raw).credits[0].noReplay,true)}finally{await h.close()}});
test('collector with no routes cannot adopt role-unknown legacy cash after an earlier logout',async()=>{const seed=initial();seed.session=null;const h=await fixture({seed});try{h.set(authorized(A,'cobrador'));assert.deepEqual(h.read().cashMovements,[]);await h.drain();assert.deepEqual(h.read().cashMovements,[]);const aLegacy=JSON.parse(h.w.localStorage.getItem('mi-cartera-v2-legacy-custody'));assert.equal(JSON.parse(aLegacy.raw).cashMovements[0].amount,123)}finally{await h.close()}});
