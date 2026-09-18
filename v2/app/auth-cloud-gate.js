// Mi Cartera PRO V2 — temporary local administrator gate.
// Firebase Authentication is disabled because every available project API key is rejected by Google.
// This mode keeps the pilot operational on this device using isolated localStorage only.
(function(root){'use strict';
const state={ready:false,authenticated:true,member:true,uid:'admin-local-v2',email:null,role:'admin',routeIds:[],reason:'WAITING_VERSION',mode:'LOCAL_ADMIN'};
const publish=()=>root.dispatchEvent(new CustomEvent('v2-auth-cloud-state',{detail:{...state}}));
function activate(){const guard=root.MiCarteraV2VersionGuard;if(!guard?.state?.().ready){state.ready=false;state.reason='VERSION_NOT_VERIFIED';publish();return {...state}}state.ready=true;state.reason='LOCAL_ADMIN_READY';publish();return {...state}}
async function start(){return activate()}
async function refreshMembership(){return activate()}
async function signIn(){return activate()}
async function signOut(){return activate()}
root.addEventListener('v2-version-state',e=>{if(e.detail?.ready)activate();else{state.ready=false;state.reason='VERSION_NOT_VERIFIED';publish()}});
root.MiCarteraV2AuthCloudGate={state:()=>({...state}),start,refreshMembership,signIn,signOut,requireReady(){if(!state.ready){const e=new Error('V2_LOCAL_ADMIN_NOT_READY:'+state.reason);e.code='V2_LOCAL_ADMIN_NOT_READY';throw e}return {...state}}};
queueMicrotask(()=>{if(root.MiCarteraV2VersionGuard?.state?.().ready)activate()});
})(window);
