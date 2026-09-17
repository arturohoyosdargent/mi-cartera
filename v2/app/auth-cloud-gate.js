// Mi Cartera PRO V2 — authenticated membership gate for Cloud runtime.
// Fail-closed: Cloud financial sync is not configured unless auth, membership, release and pilot gate are all ready.
(async function(root){'use strict';
const ORG='v2-mi-cartera-pilot';
const state={ready:false,authenticated:false,member:false,uid:null,role:null,reason:'AUTH_NOT_READY'};
const publish=()=>root.dispatchEvent(new CustomEvent('v2-auth-cloud-state',{detail:{...state}}));
function block(reason){state.ready=false;state.reason=reason;publish();return {...state};}
try{
  const fb=root.firebaseSdkV2,fs=root.firestoreV2,guard=root.MiCarteraV2VersionGuard,pilot=root.MiCarteraV2PilotConfig;
  if(!fb?.app||!fs?.db||!fs?.doc||!fs?.getDoc)return block('FIREBASE_PREFLIGHT_REQUIRED');
  if(!guard?.state().ready)return block('VERSION_NOT_VERIFIED');
  const authSdk=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  const auth=authSdk.getAuth(fb.app);root.firebaseAuthV2={auth,authSdk};
  authSdk.onAuthStateChanged(auth,async user=>{
    if(!user){state.authenticated=false;state.member=false;state.uid=null;state.role=null;return block('AUTH_REQUIRED');}
    state.authenticated=true;state.uid=user.uid;
    try{
      const snap=await fs.getDoc(fs.doc(fs.db,'orgs',ORG,'members',user.uid));
      if(!snap.exists())return block('V2_MEMBERSHIP_REQUIRED');
      const m=snap.data()||{};
      if(m.active!==true)return block('V2_MEMBERSHIP_INACTIVE');
      if(!['admin','supervisor','cobrador'].includes(m.role))return block('V2_ROLE_INVALID');
      state.member=true;state.role=m.role;
      const decision=pilot?.evaluate?.(root.MI_CARTERA_V2_PILOT_CONFIG||{});
      if(!decision?.ready)return block('PILOT_GATE_NOT_READY');
      state.ready=true;state.reason='READY';publish();
    }catch(e){block(e?.code||e?.message||'MEMBERSHIP_CHECK_FAILED');}
  });
}catch(e){block(e?.code||e?.message||'AUTH_BOOTSTRAP_FAILED');}
root.MiCarteraV2AuthCloudGate={state:()=>({...state}),requireReady(){if(!state.ready){const e=new Error('V2_AUTH_CLOUD_NOT_READY:'+state.reason);e.code='V2_AUTH_CLOUD_NOT_READY';throw e;}return {...state};}};
})(window);
