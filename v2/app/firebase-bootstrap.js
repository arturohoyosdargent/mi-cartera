// Mi Cartera PRO V2 — Firebase modular bootstrap for isolated V2 pilot.
// Exposes the minimum Firestore read primitives required by preflight and authenticated V2 rehydration.
(async function(root){'use strict';
const cfg=root.MI_CARTERA_V2_FIREBASE_TEMPLATE;const pilot=root.MI_CARTERA_V2_PILOT_CONFIG;
if(!cfg||!cfg.projectId){root.firebaseV2BootstrapError='FIREBASE_CONFIG_MISSING';return;}
try{
  const appSdk=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const fsSdk=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const app=appSdk.initializeApp(cfg,'mi-cartera-pro-v2-pilot');const db=fsSdk.getFirestore(app);
  root.firebaseSdkV2={appSdk,fsSdk,app};
  root.firestoreV2={db,doc:fsSdk.doc,getDoc:fsSdk.getDoc,collection:fsSdk.collection,getDocs:fsSdk.getDocs,query:fsSdk.query,where:fsSdk.where};
  root.readPilotMarkerV2=async function(orgId){if(!/^v2-/.test(String(orgId||''))||orgId==='mi-cartera')throw Object.assign(new Error('V2_NAMESPACE_REQUIRED'),{code:'V2_NAMESPACE_REQUIRED'});if(pilot?.orgId&&orgId!==pilot.orgId)throw Object.assign(new Error('V2_NAMESPACE_MISMATCH'),{code:'V2_NAMESPACE_MISMATCH'});const snap=await fsSdk.getDoc(fsSdk.doc(db,'orgs',orgId));return snap.exists()?snap.data():null;};
  root.dispatchEvent(new CustomEvent('mi-cartera-v2-firebase-ready'));
}catch(e){root.firebaseV2BootstrapError=e?.code||e?.message||String(e);root.dispatchEvent(new CustomEvent('mi-cartera-v2-firebase-error',{detail:root.firebaseV2BootstrapError}));}
})(window);