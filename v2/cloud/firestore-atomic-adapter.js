// Mi Cartera PRO V2 — Firestore adapter for transaction-store.js.
// Requires Firebase modular SDK functions supplied explicitly; no legacy globals.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2FirestoreAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function createFirestoreAtomicAdapter(cfg){const {db,runTransaction,doc}=cfg||{};if(!db||typeof runTransaction!=='function'||typeof doc!=='function')throw new Error('FIRESTORE_ADAPTER_CONFIG_REQUIRED');const orgId=String(cfg.orgId||'').trim();if(!orgId)throw new Error('ORG_ID_REQUIRED');
 const ref=path=>{const parts=String(path||'').split('/').filter(Boolean);if(parts.length!==2)throw new Error('INVALID_V2_PATH');return doc(db,'orgs',orgId,parts[0],parts[1]);};
 return {runAtomic:fn=>runTransaction(db,async nativeTx=>{const tx={get:async path=>{const snap=await nativeTx.get(ref(path));return snap.exists()?{...snap.data(),__firestoreId:snap.id}:null;},set:async(path,value)=>{nativeTx.set(ref(path),value,{merge:false});}};return fn(tx);})};}
return {createFirestoreAtomicAdapter};});