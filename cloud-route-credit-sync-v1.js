// Préstamo Ya — sincronización obligatoria de créditos para usuarios de ruta v1.
// Antes de que cloudSyncNow haga pullCloud(), sube el estado local de los créditos
// de las rutas asignadas. Evita que Cloud reemplace un pago/estado reciente con una
// versión antigua del crédito.
(()=>{
'use strict';
if(window.__prestamoYaCloudRouteCreditSyncV1)return;
window.__prestamoYaCloudRouteCreditSyncV1=true;
const APP='https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
const AUTH='https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
const FS='https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))if(x!==undefined)o[k]=clean(x);return o}return v};
const push=async()=>{
 if(!navigator.onLine||!window.db)return {pushed:0,errors:0};
 let A,U,F;try{[A,U,F]=await Promise.all([import(APP),import(AUTH),import(FS)])}catch(e){return {pushed:0,errors:1}};
 if(!A.getApps().length)return {pushed:0,errors:0};
 const app=A.getApp(),auth=U.getAuth(app),fs=F.getFirestore(app),u=auth.currentUser;if(!u)return {pushed:0,errors:0};
 const profile=window.__prestamoYaQueueProfile||{};
 const isAll=['admin','supervisor'].includes(profile.role||window.currentUser?.()?.role);
 const routes=Array.isArray(profile.routeIds)?profile.routeIds.map(String):[];
 const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';
 const credits=(window.db.credits||[]).filter(cr=>isAll||routes.includes(String(cr.routeId)));
 let pushed=0,errors=0;
 for(const cr of credits){
  if(!cr?.id)continue;
  try{await F.setDoc(F.doc(fs,`orgs/${orgId}/credits`,String(cr.id)),clean({...cr,id:String(cr.id),orgId,userId:u.uid,updatedAt:new Date().toISOString()}),{merge:true});pushed++}
  catch(e){errors++;console.warn('Ruta: no se pudo sincronizar crédito',cr.id,e)}
 }
 return {pushed,errors};
};
const install=()=>{
 const raw=window.cloudSyncNow;if(typeof raw!=='function'||raw.__routeCreditSyncV1)return false;
 const wrapped=async function(...args){
  try{await push()}catch(e){console.warn('Pre-sync créditos de ruta',e)}
  return raw.apply(this,args)
 };
 wrapped.__routeCreditSyncV1=true;
 wrapped.pushRouteCredits=push;
 window.cloudSyncNow=wrapped;
 return true;
};
const boot=()=>{if(install())return;setTimeout(boot,400)};boot();
window.prestamoYaSyncRouteCredits=push;
})();
