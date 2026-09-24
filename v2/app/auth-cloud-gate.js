// Mi Cartera PRO V2 — Firebase Auth + isolated V2 membership gate.
// V2 never falls back to a fake local administrator: no membership means no cloud access.
(function(root){'use strict';
const ORG='v2-mi-cartera-pilot';
const FALLBACK_ORG=ORG;
function activeOrg(){return root.MiCarteraV2PilotConfig?.requestedOrg?.()||root.MiCarteraV2PilotConfig?.state?.config?.orgId||FALLBACK_ORG}
const ROLES=['admin','supervisor','cobrador'];
const state={ready:false,authenticated:false,member:false,uid:null,email:null,role:null,routeIds:[],reason:'WAITING_VERSION',mode:'CLOUD_AUTH',preserveLocal:true};
let started=false,explicitLogout=false,unsubscribe=null,authWork=Promise.resolve();
function emit(){if(typeof root.dispatchEvent!=='function')return;const C=root.CustomEvent;if(C)root.dispatchEvent(new C('v2-auth-cloud-state',{detail:{...state}}));}
function block(reason,extra={}){
  Object.assign(state,{
    ready:false,
    authenticated:extra.authenticated===true,
    member:false,
    uid:extra.uid??(extra.authenticated===true?state.uid:null),
    email:extra.email??(extra.authenticated===true?state.email:null),
    role:null,
    routeIds:[],
    reason,
    mode:'CLOUD_AUTH',
    preserveLocal:extra.preserveLocal!==undefined?!!extra.preserveLocal:true
  });
  emit();
  return {...state};
}
function userBase(user){Object.assign(state,{authenticated:true,uid:user?.uid||null,email:user?.email||null,member:false,role:null,routeIds:[],preserveLocal:true});}
function versionReady(){return root.MiCarteraV2VersionGuard?.state?.().ready===true;}
function authReason(error){const code=String(error?.code||'').replace(/^auth\//,'');return code?`AUTH_${code.toUpperCase().replace(/-/g,'_')}`:'AUTH_FAILED'}
async function evaluateUser(user){
  if(!user){
    if(explicitLogout){explicitLogout=false;return block('AUTH_REQUIRED',{preserveLocal:true});}
    return block('AUTH_REQUIRED');
  }
  userBase(user);
  if(!versionReady())return block('VERSION_NOT_VERIFIED');
  const fs=root.firestoreV2;
  if(!fs?.db||!fs.doc||!fs.getDoc)return block('V2_FIRESTORE_NOT_READY');
  let snap;
  try{
    const orgId=activeOrg();
    const ref=orgId===ORG?fs.doc(fs.db,'orgs',ORG,'members',user.uid):fs.doc(fs.db,'orgs',orgId,'members',user.uid);
    snap=await fs.getDoc(ref);
  }catch(error){return block('V2_MEMBERSHIP_READ_FAILED:'+String(error?.code||error?.message||error));}
  if(!snap?.exists?.())return block('V2_MEMBERSHIP_REQUIRED');
  const member=snap.data()||{};
  if(member.active!==true)return block('V2_MEMBERSHIP_INACTIVE');
  if(!ROLES.includes(String(member.role||'')))return block('V2_ROLE_INVALID');
  Object.assign(state,{ready:true,authenticated:true,member:true,uid:user.uid,email:user.email||member.email||null,role:String(member.role),routeIds:Array.isArray(member.routeIds)?member.routeIds:[],reason:'CLOUD_AUTH_READY',mode:'CLOUD_AUTH',preserveLocal:false});
  try{
    const runtime=root.MiCarteraV2CloudRuntime;
    if(!runtime?.configure)throw new Error('V2_CLOUD_RUNTIME_NOT_READY');
    const orgId=activeOrg();
    runtime.configure({mode:orgId===FALLBACK_ORG?'PILOT':'COMMERCIAL',cloudEnabled:true,allowRealWrites:true,orgId,actorId:user.uid,db:fs.db,doc:fs.doc,runTransaction:fs.runTransaction});
  }catch(error){return block('V2_CLOUD_NOT_READY:'+String(error?.code||error?.message||error));}
  emit();
  return {...state};
}
async function start(){
  if(started)return {...state};
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
  if(e.detail?.ready)start().then(()=>{const user=root.firebaseAuthV2?.auth?.currentUser;if(user&&!state.ready)return evaluateUser(user)});
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
