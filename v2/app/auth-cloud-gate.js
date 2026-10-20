// Mi Cartera PRO V2 — Firebase Auth + isolated V2 membership gate.
// V2 never falls back to a fake local administrator: no membership means no cloud access.
(function(root){'use strict';
const ORG='v2-mi-cartera-pilot';
const FALLBACK_ORG=ORG;
function activeOrg(){return root.MiCarteraV2PilotConfig?.requestedOrg?.()||root.MiCarteraV2PilotConfig?.state?.config?.orgId||FALLBACK_ORG}
const ROLES=['admin','supervisor','cobrador'];
const state={ready:false,authenticated:false,member:false,uid:null,email:null,role:null,routeIds:[],reason:'WAITING_VERSION',mode:'CLOUD_AUTH',preserveLocal:true};
let started=false,explicitLogout=false,unsubscribe=null,authWork=Promise.resolve(),runtimeScope=null,authRevision=0;
function emit(){if(typeof root.dispatchEvent!=='function')return;const C=root.CustomEvent;if(C)root.dispatchEvent(new C('v2-auth-cloud-state',{detail:{...state}}));}
function disconnectRuntime(){runtimeScope=null;root.MiCarteraV2SyncBridge?.reset?.();}
function block(reason,extra={}){
  authRevision++;
  disconnectRuntime();
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
function userBase(user){Object.assign(state,{ready:false,authenticated:true,uid:user?.uid||null,email:user?.email||null,member:false,role:null,routeIds:[],preserveLocal:true});}
function versionReady(){return root.MiCarteraV2VersionGuard?.state?.().ready===true;}
function authReason(error){const code=String(error?.code||'').replace(/^auth\//,'');return code?`AUTH_${code.toUpperCase().replace(/-/g,'_')}`:'AUTH_FAILED'}
function projectId(){return String(root.MI_CARTERA_V2_FIREBASE_TEMPLATE?.projectId||root.firebaseSdkV2?.app?.options?.projectId||'');}
function connectRuntime(){
  if(!state.ready||!state.authenticated||!state.member)return false;
  if(!versionReady()){block('VERSION_NOT_VERIFIED');return false;}
  const session=root.MiCarteraV2SessionStorage,proof=session?.state?.();
  // Auth readiness lets hydration run; transport additionally requires confirmed local custody.
  if(proof?.ready!==true||proof.uid!==state.uid||proof.role!==state.role||proof.orgId!==activeOrg())return false;
  try{
    const token=session.capture();session.assertCurrent(token);
    const scope=JSON.stringify([token.projectId,token.orgId,token.uid,token.epoch,token.generation,token.authStamp]);
    if(runtimeScope===scope&&root.MiCarteraV2SyncBridge?.status?.().configured===true)return true;
    const runtime=root.MiCarteraV2CloudRuntime,fs=root.firestoreV2;
    if(!runtime?.configure)throw new Error('V2_CLOUD_RUNTIME_NOT_READY');
    const orgId=activeOrg();
    runtime.configure({mode:orgId===FALLBACK_ORG?'PILOT':'COMMERCIAL',cloudEnabled:true,allowRealWrites:true,orgId,actorId:state.uid,db:fs.db,doc:fs.doc,runTransaction:fs.runTransaction});
    runtimeScope=scope;return true;
  }catch(error){block('V2_CLOUD_NOT_READY:'+String(error?.code||error?.message||error));return false;}
}
async function evaluateUser(user,revision=++authRevision){
  if(revision!==authRevision)return {...state};
  disconnectRuntime();
  if(!user){
    if(explicitLogout){explicitLogout=false;return block('AUTH_REQUIRED',{preserveLocal:true});}
    return block('AUTH_REQUIRED');
  }
  userBase(user);
  if(!versionReady())return block('VERSION_NOT_VERIFIED');
  const fs=root.firestoreV2;
  if(!fs?.db||!fs.doc||!fs.getDoc)return block('V2_FIRESTORE_NOT_READY');
  const requestedScope={uid:user.uid,orgId:activeOrg(),projectId:projectId()};
  let snap;
  try{
    const orgId=activeOrg();
    const ref=fs.doc(fs.db,'orgs',orgId,'members',user.uid);
    snap=await fs.getDoc(ref);
  }catch(error){if(revision!==authRevision)return {...state};return block('V2_MEMBERSHIP_READ_FAILED:'+String(error?.code||error?.message||error));}
  // Membership reads can outlive logout, another login, tenant changes or a blocked release.
  if(revision!==authRevision)return {...state};
  if(!versionReady())return block('VERSION_NOT_VERIFIED');
  if(root.firebaseAuthV2?.auth?.currentUser?.uid!==requestedScope.uid||activeOrg()!==requestedScope.orgId||projectId()!==requestedScope.projectId)return block('V2_AUTH_SCOPE_CHANGED');
  if(!snap?.exists?.())return block('V2_MEMBERSHIP_REQUIRED');
  const member=snap.data()||{};
  if(member.active!==true)return block('V2_MEMBERSHIP_INACTIVE');
  if(!ROLES.includes(String(member.role||'')))return block('V2_ROLE_INVALID');
  Object.assign(state,{ready:true,authenticated:true,member:true,uid:user.uid,email:user.email||member.email||null,role:String(member.role),routeIds:Array.isArray(member.routeIds)?member.routeIds:[],reason:'CLOUD_AUTH_READY',mode:'CLOUD_AUTH',preserveLocal:false});
  emit();
  connectRuntime();
  return {...state};
}
async function start(){
  if(started)return {...state};
  if(!versionReady())return block('VERSION_NOT_VERIFIED');
  const fb=root.firebaseAuthV2;
  if(!fb?.auth||typeof fb.onAuthStateChanged!=='function')return block('FIREBASE_AUTH_NOT_READY');
  started=true;
  unsubscribe=fb.onAuthStateChanged(fb.auth,user=>{
    // Invalidate the old grant before a queued membership lookup can finish.
    const revision=++authRevision;disconnectRuntime();
    if(!user){explicitLogout=false;return Promise.resolve(block('AUTH_REQUIRED',{preserveLocal:true}));}
    userBase(user);emit();
    authWork=authWork.then(()=>evaluateUser(user,revision)).catch(error=>revision===authRevision?block('AUTH_STATE_FAILED:'+String(error?.code||error?.message||error)):{...state});
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
root.addEventListener('v2-local-owner-ready',connectRuntime);
// Same-owner pending recovery verifies its retained custody without a remote reread.
root.addEventListener('mi-cartera-v2-sync',event=>{if(event.detail?.source==='verified-local-session')connectRuntime()});
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
