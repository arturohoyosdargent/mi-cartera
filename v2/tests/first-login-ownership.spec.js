const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Window}=require('happy-dom');
const APP=path.join(__dirname,'../app'),OWNER='mi-cartera-v2-local-owner',KEY='mi-cartera-v2-validation-state',ORG='v2-mi-cartera-pilot';
const authorized=(uid='fresh-fixture-admin',role='admin')=>({ready:true,authenticated:true,member:true,uid,role,routeIds:['fixture-route']});
const empty=()=>({clients:[],credits:[],payments:[],cashMovements:[],audit:[],commercial:[],session:null});
async function fixture({initial={},locks=true,deferred=false}={}){
 const w=new Window({url:'https://fixture.test/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});
 w.document.write('<main><section id="home"><h2>Inicio</h2></section><div id="supportList"></div><button data-app-recovery hidden disabled>Recuperar</button></main>');
 for(const [key,value] of Object.entries(initial))w.localStorage.setItem(key,value);
 // Tokens and a completed foreign queue must stay byte-for-byte intact. A completed
 // queue is intentionally tested separately as an ambiguous initial ownership case.
 w.localStorage.setItem('firebase:authUser:fixture','fictional-token-bytes');
 let auth={ready:false,authenticated:false,member:false,uid:null,role:null},org=ORG,verified=null,reads=0,writes=0,releaseRead;
 const barrier=deferred?new Promise(resolve=>releaseRead=resolve):Promise.resolve();
 w.firebaseAuthV2={auth:{currentUser:null}};
 w.MiCarteraV2AuthCloudGate={get ORG(){return org},state:()=>({...auth}),requireReady:()=>{if(!auth.ready)throw Error('NOT_READY');return {...(verified||auth)}}};
 w.MiCarteraV2VersionGuard={state:()=>({ready:true,publishedBuild:'v2-pilot-20261009-b2-controlled-improvements-1'})};
 w.alert=()=>{};w.MiCarteraV2Refresh={unsaved:()=>false};
 const lockCalls=[];
 Object.defineProperty(w.navigator,'locks',{configurable:true,value:locks?{request:async(name,options,callback)=>{lockCalls.push({name,options});return callback()}}:undefined});
 w.firestoreV2={db:{},collection:(_db,...segments)=>{reads++;return {segments}},
  where:(field,operator,value)=>({field,operator,value}),query:(base,...conditions)=>({base,conditions}),
  getDocs:async()=>{await barrier;return {forEach:()=>{}}},setDoc:()=>{writes++;throw Error('Fixture must never write Cloud')}};
 const ctx=vm.createContext(w),load=name=>vm.runInContext(fs.readFileSync(path.join(APP,name),'utf8'),ctx,{filename:name});
 let hydratedBytes=null;
 w.addEventListener('mi-cartera-v2-rehydrated',e=>{if(e.detail?.ok===true)hydratedBytes=w.localStorage.getItem(KEY)});
 if(fs.existsSync(path.join(APP,'local-ownership-bootstrap-v2.js')))load('local-ownership-bootstrap-v2.js');
 load('cloud-rehydration-v2.js');load('support-center-v2.js');load('app-recovery-v2.js');
 await w.happyDOM.whenAsyncComplete();
 const snapshot=()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)]}));
 const set=(next,nextOrg=org,emit=true)=>{auth={...next};org=nextOrg;w.firebaseAuthV2.auth.currentUser=auth.uid?{uid:auth.uid}:null;if(emit)w.dispatchEvent(new w.CustomEvent('v2-auth-cloud-state',{detail:{...auth}}))};
 const drain=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))};
 return {w,load,set,snapshot,drain,lockCalls,release:()=>releaseRead?.(),verified:x=>verified=x,org:x=>org=x,reads:()=>reads,writes:()=>writes,
  async ready(next=authorized(),nextOrg=ORG){const done=new Promise(resolve=>w.addEventListener('mi-cartera-v2-rehydrated',resolve,{once:true}));set(next,nextOrg);await done;await drain()},
  proof:()=>w.MiCarteraV2LocalOwnershipBootstrap?.state(),
  invariant(){a.equal(w.localStorage.getItem(KEY),hydratedBytes);a.equal(w.localStorage.getItem('firebase:authUser:fixture'),'fictional-token-bytes');a.equal(writes,0)},
  close:()=>w.happyDOM.abort()};
}

test('first clean login with the real hydration producer establishes only technical ownership and unlocks guarded views',async()=>{
 const h=await fixture();try{await h.ready();a.equal(h.w.localStorage.getItem(OWNER),'fresh-fixture-admin');h.invariant();
  const proof=h.proof();a.equal(proof.ready,true);a.equal(proof.orgId,ORG);a.equal(proof.uid,'fresh-fixture-admin');a.ok(Object.isFrozen(proof));
  a.equal(h.lockCalls.length,1);a.equal(h.lockCalls[0].options.mode,'exclusive');
  a.equal(h.w.MiCarteraV2AppRecovery.canOpen(),true);a.equal(h.w.document.querySelector('[data-app-recovery]').hidden,false);
  a.equal(h.w.MiCarteraV2Support.create('ERROR','Reporte ficticio de primer acceso').uid,'fresh-fixture-admin');h.invariant();
 }finally{await h.close()}
});

test('an initially valid empty local shell can onboard a collector without granting app recovery',async()=>{
 const h=await fixture({initial:{[KEY]:JSON.stringify(empty())}});try{await h.ready(authorized('fixture-collector','cobrador'));a.equal(h.w.localStorage.getItem(OWNER),'fixture-collector');
  a.equal(h.w.MiCarteraV2AppRecovery.canOpen(),false);a.equal(h.w.MiCarteraV2Support.create('MEJORA','Mejora ficticia').uid,'fixture-collector');h.invariant();
 }finally{await h.close()}
});

for(const [name,initial] of Object.entries({
 'foreign owner':{[OWNER]:'foreign-fixture-owner'},'empty invalid owner':{[OWNER]:''},'malformed local state':{[KEY]:'{invalid'},
 'unowned financial rows':{[KEY]:JSON.stringify({...empty(),clients:[{id:'old-client'}]})},'unowned session':{[KEY]:JSON.stringify({...empty(),session:{actorId:'old-user',role:'admin'}})},
 'legacy pending queue':{'mi-cartera-v2-cloud-operations':'[{"status":"PENDIENTE"}]'},'foreign pending queue':{'mi-cartera-v2-cloud-operations:foreign-user':'[{"status":"PENDIENTE"}]'},
 'malformed queue':{'mi-cartera-v2-cloud-operations:foreign-user':'{invalid'},'completed foreign queue':{'mi-cartera-v2-cloud-operations:foreign-user':'[{"status":"SINCRONIZADO"}]'}
}))test('onboarding never adopts '+name,async()=>{
 const h=await fixture({initial});try{const queueBefore=Object.fromEntries(Object.entries(h.snapshot()).filter(([k])=>k.startsWith('mi-cartera-v2-cloud-operations')));
  // Explicitly emit a success to show that the initializer cannot be tricked into
  // adopting existing storage even when protected hydration legitimately skips.
  h.set(authorized());await h.drain();h.w.dispatchEvent(new h.w.CustomEvent('mi-cartera-v2-rehydrated',{detail:{ok:true}}));await h.drain();
  a.equal(h.w.localStorage.getItem(OWNER),Object.hasOwn(initial,OWNER)?initial[OWNER]:null);a.notEqual(h.proof()?.ready,true);
  for(const [k,value] of Object.entries(queueBefore))a.equal(h.w.localStorage.getItem(k),value);a.equal(h.writes(),0);
 }finally{await h.close()}
});

for(const scenario of ['no locks','foreign organization','gate verification mismatch','Firebase mismatch','not member','not authenticated'])test('success cannot establish ownership with '+scenario,async()=>{
 const h=await fixture({locks:scenario!=='no locks'});try{
  if(scenario==='gate verification mismatch')h.verified(authorized('different-user'));
  const next=authorized();if(scenario==='not member')next.member=false;if(scenario==='not authenticated')next.authenticated=false;
  h.set(next,scenario==='foreign organization'?'v2-another-fixture-org':ORG,false);
  if(scenario==='Firebase mismatch')h.w.firebaseAuthV2.auth.currentUser={uid:'different-user'};
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:next}));await h.drain();
  a.equal(h.w.localStorage.getItem(OWNER),null);a.notEqual(h.proof()?.ready,true);a.equal(h.writes(),0);
 }finally{await h.close()}
});

for(const change of ['UID','role','organization','readiness','Firebase','OWNER','A-B-A'])test('identity changes during real async hydration block ownership: '+change,async()=>{
 const h=await fixture({deferred:true});try{h.set(authorized());
  if(change==='UID')h.set(authorized('next-user'));if(change==='role')h.set(authorized('fresh-fixture-admin','supervisor'));
  if(change==='organization')h.set(authorized(),'v2-next-fixture-org');if(change==='readiness')h.set({...authorized(),ready:false});
  if(change==='Firebase'){h.w.firebaseAuthV2.auth.currentUser={uid:'other-user'};h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:authorized()}))}
  if(change==='OWNER'){h.w.localStorage.setItem(OWNER,'foreign-user');h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:OWNER,newValue:'foreign-user'}))}
  if(change==='A-B-A'){h.set(authorized('next-user'));h.set(authorized())}
  h.release();await h.drain();a.equal(h.w.localStorage.getItem(OWNER),change==='OWNER'?'foreign-user':null);a.notEqual(h.proof()?.ready,true);a.equal(h.writes(),0);
 }finally{await h.close()}
});

test('a lock delayed by another tab rechecks OWNER and never replaces the newly established owner',async()=>{
 const h=await fixture();try{let acquired;Object.defineProperty(h.w.navigator,'locks',{configurable:true,value:{request:async(name,options,callback)=>new Promise(resolve=>{acquired=()=>resolve(callback())})}});
  h.set(authorized());await h.drain();a.equal(typeof acquired,'function');h.w.localStorage.setItem(OWNER,'other-tab-owner');acquired();await h.drain();
  a.equal(h.w.localStorage.getItem(OWNER),'other-tab-owner');a.notEqual(h.proof()?.ready,true);h.invariant();
 }finally{await h.close()}
});

test('a success with a mismatching hydrated session cannot initialize ownership',async()=>{
 const h=await fixture({deferred:true});try{h.set(authorized());h.w.localStorage.setItem(KEY,JSON.stringify({...empty(),session:{actorId:'foreign-user',role:'admin'}}));
  h.w.dispatchEvent(new h.w.CustomEvent('mi-cartera-v2-rehydrated',{detail:{ok:true}}));await h.drain();a.equal(h.w.localStorage.getItem(OWNER),null);h.release();await h.drain();a.equal(h.w.localStorage.getItem(OWNER),null);
 }finally{await h.close()}
});

test('a failed hydration remains blocked and a bare owner-ready event cannot authorize guarded views',async()=>{
 const h=await fixture({deferred:true});try{h.set(authorized());h.w.dispatchEvent(new h.w.CustomEvent('mi-cartera-v2-rehydrated',{detail:{ok:false}}));
  h.w.dispatchEvent(new h.w.CustomEvent('v2-local-owner-ready',{detail:{ready:true,...authorized(),orgId:ORG}}));await h.drain();
  a.equal(h.w.localStorage.getItem(OWNER),null);a.notEqual(h.proof()?.ready,true);a.equal(h.w.MiCarteraV2AppRecovery.canOpen(),false);a.throws(()=>h.w.MiCarteraV2Support.create('ERROR','Reporte ficticio'),/AUTH/);
  h.release();await h.drain();a.equal(h.w.localStorage.getItem(OWNER),null);
 }finally{await h.close()}
});

test('onboarding proof becomes unusable immediately after the current local owner or Firebase identity changes',async()=>{
 const h=await fixture();try{await h.ready();a.ok(h.proof(),'ownership exposes a current readonly proof');a.equal(h.proof().ready,true);h.w.firebaseAuthV2.auth.currentUser={uid:'different-user'};
  a.equal(h.proof().ready,false);h.w.dispatchEvent(new h.w.CustomEvent('v2-local-owner-ready',{detail:{ready:true,...authorized(),orgId:ORG}}));
  a.equal(h.w.MiCarteraV2AppRecovery.canOpen(),false);a.throws(()=>h.w.MiCarteraV2Support.create('ERROR','Reporte ficticio'),/AUTH/);
 }finally{await h.close()}
});
