// Préstamo Ya — consistencia de crédito después de registrar pagos.
// Evita que un pull de Cloud reemplace un crédito local actualizado antes de que
// el cambio de saldo/pago quede reflejado en el documento del crédito.
(()=>{
'use strict';
if(window.__prestamoYaCloudCreditConsistencyV1)return;
window.__prestamoYaCloudCreditConsistencyV1=true;
const FIREBASE_APP='https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
const FIREBASE_AUTH='https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
const FIREBASE_FS='https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))if(x!==undefined)o[k]=clean(x);return o}return v};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const persist=()=>{try{if(!window.db)return;window.db.settings=window.db.settings||{};window.db.settings.lastOnline=new Date().toISOString();localStorage.setItem('mi_cartera_pro_v21',JSON.stringify(window.db));localStorage.setItem('mi_cartera_pro_v19',JSON.stringify(window.db));window.persist?.();window.updateSyncUI?.()}catch(e){console.warn('Cloud credit consistency persistence',e)}};
const pendingPaymentCreditIds=()=>{const q=Array.isArray(window.db?.syncQueue)?window.db.syncQueue:[];return [...new Set(q.filter(x=>x&&['PAGO_CREADO','PAGO_MODIFICADO','RECAUDO','RECAUDO_CREADO'].includes(x.type)&&['PENDIENTE','ENVIANDO','ERROR'].includes(x.status)).map(x=>x?.payload?.creditId).filter(v=>v!=null).map(String))]};
async function firebase(){const [A,U,F]=await Promise.all([import(FIREBASE_APP),import(FIREBASE_AUTH),import(FIREBASE_FS)]);if(!A.getApps().length)return null;const app=A.getApp(),auth=U.getAuth(app),fs=F.getFirestore(app);return {app,auth,fs,F}};
async function pushCreditState(ids){if(!ids.length||!navigator.onLine)return {pushed:0,errors:0};let api;try{api=await firebase()}catch(e){return {pushed:0,errors:1,error:String(e?.message||e)}}if(!api?.auth?.currentUser)return {pushed:0,errors:0};const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';let pushed=0,errors=0;for(const id of ids){const cr=(window.db?.credits||[]).find(x=>String(x.id)===String(id));if(!cr)continue;try{const ref=api.F.doc(api.fs,`orgs/${orgId}/credits`,String(cr.id));await api.F.setDoc(ref,clean({...cr,id:String(cr.id),orgId,userId:api.auth.currentUser.uid,updatedAt:new Date().toISOString()}),{merge:true});pushed++}catch(e){errors++;console.warn('No se pudo sincronizar crédito después del pago',id,e)}}if(pushed)persist();return {pushed,errors}};
const install=()=>{const raw=window.syncQueueV3;if(typeof raw!=='function'||raw.__creditConsistencyV1)return false;const wrapped=async function(...args){const before=pendingPaymentCreditIds();const result=await raw.apply(this,args);const after=pendingPaymentCreditIds();const ids=[...new Set([...before,...after])];if(ids.length)await pushCreditState(ids);return result};wrapped.__creditConsistencyV1=true;window.syncQueueV3=wrapped;window.processSyncQueue=window.processSyncQueue;return true};
const boot=()=>{if(install())return;setTimeout(boot,500)};boot();
})();
