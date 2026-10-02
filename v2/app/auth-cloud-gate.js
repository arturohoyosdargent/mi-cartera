// Mi Cartera PRO V2 — Firebase Auth + isolated V2 membership gate.
// V2 never falls back to a fake local administrator: no membership means no cloud access.
(function(root){'use strict';
const ORG='v2-mi-cartera-pilot';
const FALLBACK_ORG=ORG;
function activeOrg(){return root.MiCarteraV2PilotConfig?.requestedOrg?.()||root.MiCarteraV2PilotConfig?.state?.config?.orgId||FALLBACK_ORG}
const ROLES=[...['admin','supervisor','cobrador'],'gestor'];
const state={ready:false,authenticated:false,member:false,uid:null,email:null,role:null,routeIds:[],reason:'WAITING_VERSION',mode:'CLOUD_AUTH',preserveLocal:true,nextMembershipAttemptAt:0};
let started=false,explicitLogout=false,unsubscribe=null,authWork=Promise.resolve(),membershipFlight=null;
function emit(){if(typeof root.dispatchEvent!=='function')return;const C=root.CustomEvent;if(C)root.dispatchEvent(new C('v2-auth-cloud-state',{detail:{...state}}));}
function block(reason,extra={}){
  Object.assign(state,{
    ready:false,
    authenticated:extra.authenticated===true,
    member:false,
    uid:extra.uid??(extra.authenticated===true?state.uid:null),
    email:extra.email??(extra.authenticated===true?state.email:null),
    role:null,
    routeIds:[],workerId:null,
    reason,
    nextMembershipAttemptAt:extra.nextMembershipAttemptAt||0,
    mode:'CLOUD_AUTH',
    preserveLocal:extra.preserveLocal!==undefined?!!extra.preserveLocal:true
  });
  emit();
  return {...state};
}
function userBase(user){Object.assign(state,{ready:false,authenticated:true,uid:user?.uid||null,email:user?.email||null,member:false,role:null,routeIds:[],preserveLocal:true,nextMembershipAttemptAt:0});}
function versionReady(){return root.MiCarteraV2VersionGuard?.state?.().ready===true;}
function authReason(error){const code=String(error?.code||'').replace(/^auth\//,'');return code?`AUTH_${code.toUpperCase().replace(/-/g,'_')}`:'AUTH_FAILED'}
function evaluateUser(user){
  const uid=user?.uid||null;
  if(membershipFlight?.uid===uid)return membershipFlight.promise;
  if(uid&&uid===state.uid&&state.nextMembershipAttemptAt>Date.now())return Promise.resolve({...state});
  const flight={uid};
  flight.promise=Promise.resolve().then(()=>evaluateUserOnce(user)).finally(()=>{if(membershipFlight===flight)membershipFlight=null});
  membershipFlight=flight;return flight.promise;
}
async function evaluateUserOnce(user){
  if(!user){
    if(explicitLogout){explicitLogout=false;return block('AUTH_REQUIRED',{preserveLocal:true});}
    return block('AUTH_REQUIRED');
  }
  userBase(user);
  const identity={authenticated:true,uid:user.uid,email:user.email||null,preserveLocal:true};
  if(!versionReady())return block('VERSION_NOT_VERIFIED',identity);
  const fs=root.firestoreV2;
  if(!fs?.db||!fs.doc||!fs.getDoc)return block('V2_FIRESTORE_NOT_READY',identity);
  let snap;
  try{
    const orgId=activeOrg();
    const ref=orgId===ORG?fs.doc(fs.db,'orgs',ORG,'members',user.uid):fs.doc(fs.db,'orgs',orgId,'members',user.uid);
    if(root.navigator.onLine===false){const lease=JSON.parse(localStorage.getItem('v2-member:'+orgId+':'+user.uid)||'null');if(!lease||Date.now()-lease.at>86400000)throw Error('Conéctate para renovar tu sesión de trabajo sin internet');snap={exists:()=>true,data:()=>lease.member};}else snap=await fs.getDoc(ref);
  }catch(error){
    if(root.firebaseAuthV2?.auth?.currentUser?.uid!==user.uid)return {...state};
    const code=String(error?.code||error?.message||error);
    const delay=/RESOURCE[-_ ]EXHAUSTED|QUOTA/i.test(code)?300000:/unavailable|deadline-exceeded|aborted/i.test(code)?60000:0;
    return block('V2_MEMBERSHIP_READ_FAILED:'+code,{...identity,nextMembershipAttemptAt:delay?Date.now()+delay:0});
  }
  // A result from a prior account or unverified version cannot authorize sync.
  if(root.firebaseAuthV2?.auth?.currentUser?.uid!==user.uid||!versionReady())return {...state};
  if(!snap?.exists?.()){localStorage.removeItem('v2-member:'+activeOrg()+':'+user.uid);return block('V2_MEMBERSHIP_REQUIRED',identity);}
  const member=snap.data()||{};
  if(member.active!==true){localStorage.removeItem('v2-member:'+activeOrg()+':'+user.uid);return block('V2_MEMBERSHIP_INACTIVE',identity);}
  if(!ROLES.includes(String(member.role||''))){localStorage.removeItem('v2-member:'+activeOrg()+':'+user.uid);return block('V2_ROLE_INVALID',identity);}if(root.navigator.onLine!==false)localStorage.setItem('v2-member:'+activeOrg()+':'+user.uid,JSON.stringify({at:Date.now(),member}));
  if(member.role==='gestor'){
    if(!member.workerId||!Array.isArray(member.routeIds)||!member.routeIds.length)return block('V2_WORKER_SCOPE_REQUIRED',identity);
    if(root.navigator.onLine===false)return block('V2_WORKER_ONLINE_REQUIRED',identity);
    try{
      const worker=await fs.getDoc(fs.doc(fs.db,'orgs',activeOrg(),'routes',member.workerId)),w=worker.exists()?worker.data():{};
      const route=w.routeId?await fs.getDoc(fs.doc(fs.db,'orgs',activeOrg(),'routes',w.routeId)):null;
      if(w.recordType!=='WORKER'||w.active!==true||w.authUid!==user.uid||!member.routeIds.includes(w.routeId)||!route?.exists?.()||route.data().active!==true)return block('V2_WORKER_INACTIVE_OR_UNLINKED',identity);
    }catch(error){return block('V2_WORKER_READ_FAILED:'+String(error?.code||error?.message||error),identity)}
    if(root.firebaseAuthV2?.auth?.currentUser?.uid!==user.uid||!versionReady())return {...state};
  }
  Object.assign(state,{ready:true,authenticated:true,member:true,uid:user.uid,email:user.email||member.email||null,role:String(member.role),routeIds:Array.isArray(member.routeIds)?member.routeIds:[],workerId:member.role==='gestor'?member.workerId:null,reason:'CLOUD_AUTH_READY',mode:'CLOUD_AUTH',preserveLocal:false});
  try{
    const runtime=root.MiCarteraV2CloudRuntime;
    if(!runtime?.configure)throw new Error('V2_CLOUD_RUNTIME_NOT_READY');
    const orgId=activeOrg();
    runtime.configure({mode:orgId===FALLBACK_ORG?'PILOT':'COMMERCIAL',cloudEnabled:true,allowRealWrites:true,orgId,actorId:user.uid,db:fs.db,doc:fs.doc,runTransaction:fs.runTransaction});
  }catch(error){return block('V2_CLOUD_NOT_READY:'+String(error?.code||error?.message||error),identity);}
  emit();
  return {...state};
}
async function start(){
  if(started){const user=root.firebaseAuthV2?.auth?.currentUser;if(user&&!state.ready&&versionReady())return evaluateUser(user);return {...state};}
  if(!versionReady())return block('VERSION_NOT_VERIFIED');
  const fb=root.firebaseAuthV2;
  if(!fb?.auth||typeof fb.onAuthStateChanged!=='function')return block('FIREBASE_AUTH_NOT_READY');
  started=true;
  unsubscribe=fb.onAuthStateChanged(fb.auth,user=>{
    authWork=authWork.then(()=>evaluateUser(user)).catch(error=>block('AUTH_STATE_FAILED:'+String(error?.code||error?.message||error)));
    return authWork;
  });
  return {...state};
}
async function signIn(email,password){
  const fb=root.firebaseAuthV2;
  if(!fb?.auth||typeof fb.signInWithEmailAndPassword!=='function'){const e=new Error('FIREBASE_AUTH_NOT_READY');e.code='FIREBASE_AUTH_NOT_READY';throw e;}
  await start();
  try{
    const credential=await fb.signInWithEmailAndPassword(fb.auth,String(email||'').trim(),String(password||''));
    return await evaluateUser(credential?.user||fb.auth.currentUser);
  }catch(error){block(authReason(error),{preserveLocal:true});throw error;}
}
async function refreshMembership(){return evaluateUser(root.firebaseAuthV2?.auth?.currentUser||null)}
async function signOut(){
  const fb=root.firebaseAuthV2;
  if(!fb?.auth||typeof fb.signOut!=='function'){explicitLogout=false;return block('AUTH_REQUIRED',{preserveLocal:true});}
  explicitLogout=true;
  root.MiCarteraV2SyncBridge?.reset?.();
  try{await fb.signOut(fb.auth);return {...state};}catch(error){explicitLogout=false;throw error;}
}
root.addEventListener('mi-cartera-v2-firebase-ready',()=>{start()});
root.addEventListener('mi-cartera-v2-firebase-error',e=>block('FIREBASE_BOOTSTRAP_FAILED:'+String(e.detail||root.firebaseV2BootstrapError||'')));
root.addEventListener('v2-version-state',e=>{
  if(e.detail?.ready)start();
  else block('VERSION_NOT_VERIFIED',{authenticated:state.authenticated,uid:state.uid,email:state.email,preserveLocal:true});
});
root.MiCarteraV2AuthCloudGate={
  get ORG(){return activeOrg()},
  FALLBACK_ORG,
  activeOrg,
  ROLES,
  state:()=>({...state}),
  start,
  refreshMembership,
  signIn,
  signOut,
  requireReady(){if(!state.ready){const e=new Error('V2_AUTH_NOT_READY:'+state.reason);e.code='V2_AUTH_NOT_READY';e.detail={...state};throw e}return {...state}}
};
queueMicrotask(()=>{if(versionReady())start()});
})(window);
