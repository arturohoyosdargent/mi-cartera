// Préstamo Ya — reparación persistente de propietarios y pagos v4.
(()=>{
'use strict';
if(window.__prestamoYaCreditOwnerRepairV4)return;
window.__prestamoYaCreditOwnerRepairV4=true;
const KNOWN={
 '1789432343734':{name:'Alfredo Lopez Martel',phone:'51947127238'},
 '1789205624924':{name:'Víctor Coronado Cordova',phone:'51944581617'}
};
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\D/g,'');
let running=false,wrapped=false;
async function firebase(){
 const[A,U,F]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
 ]);
 if(!A.getApps().length)return null;
 const app=A.getApp(); return{auth:U.getAuth(app),fs:F.getFirestore(app),F};
}
function localClient(rule){
 const hits=(window.db?.clients||[]).filter(c=>norm(c?.name)===norm(rule.name)&&digits(c?.phone)===digits(rule.phone));
 return hits.length===1?hits[0]:null;
}
async function cloudClient(api,orgId,rule){
 const snap=await api.F.getDocs(api.F.query(api.F.collection(api.fs,`orgs/${orgId}/clients`),api.F.where('orgId','==',orgId)));
 const hits=snap.docs.map(d=>{const x=d.data()||{};return{...x,id:x.id??d.id,__docId:d.id}}).filter(c=>norm(c.name)===norm(rule.name)&&digits(c.phone)===digits(rule.phone));
 return hits.length===1?hits[0]:null;
}
async function paymentTotal(api,orgId,creditId){
 const snap=await api.F.getDocs(api.F.query(api.F.collection(api.fs,`orgs/${orgId}/payments`),api.F.where('orgId','==',orgId),api.F.where('creditId','==',String(creditId))));
 let total=0; for(const d of snap.docs){const p=d.data()||{},a=Number(p.amount??p.monto??p.paidAmount??0);if(Number.isFinite(a)&&a>0)total+=a} return total;
}
function applyPaid(cr,total){
 if(!(total>Number(cr.paid||0)+0.001))return false;
 cr.paid=total;
 if(Array.isArray(cr.schedule)){let rem=total;for(const row of cr.schedule){const amt=Math.max(0,Number(row.amount||0));const p=Math.min(amt,Math.max(0,rem));row.paid=p;row.balance=Math.max(0,amt-p);rem=Math.max(0,rem-amt)}}
 return true;
}
async function repair(){
 if(running)return false; running=true;
 try{
  const api=await firebase().catch(()=>null); if(!api?.auth?.currentUser)return false;
  const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera'; let changed=false;
  window.db=window.db||{}; window.db.credits=Array.isArray(window.db.credits)?window.db.credits:[];
  for(const[id,rule]of Object.entries(KNOWN)){
   let localCr=window.db.credits.find(c=>String(c?.id)===id)||null;
   let cloudCr=null;
   try{const s=await api.F.getDoc(api.F.doc(api.fs,`orgs/${orgId}/credits`,id));if(s.exists())cloudCr={...s.data(),id}}catch(e){console.warn('owner-v4 credit read',id,e)}
   let cr=localCr||cloudCr; if(!cr)continue;
   let client=localClient(rule);
   if(!client){try{client=await cloudClient(api,orgId,rule)}catch(e){console.warn('owner-v4 client lookup',id,e)}}
   if(!client?.id)continue;
   // Cloud is authoritative for general credit fields; owner mapping below is authoritative for these two verified records.
   cr={...(localCr||{}),...(cloudCr||{}),id};
   const ownerChanged=String(cr.clientId??'')!==String(client.id);
   cr.clientId=client.id;
   if(client.routeId)cr.routeId=client.routeId;
   let paidChanged=false;
   try{paidChanged=applyPaid(cr,await paymentTotal(api,orgId,id))}catch(e){console.warn('owner-v4 payments',id,e)}
   if(ownerChanged||paidChanged||!localCr){
    changed=true;
    const ix=window.db.credits.findIndex(c=>String(c?.id)===id); if(ix>=0)window.db.credits[ix]=cr; else window.db.credits.push(cr);
   }
   // Always rewrite the verified owner to Firestore, even when local data already looks correct.
   try{await api.F.setDoc(api.F.doc(api.fs,`orgs/${orgId}/credits`,id),{...cr,id,clientId:client.id,orgId,userId:api.auth.currentUser.uid,updatedAt:new Date().toISOString()},{merge:true})}catch(e){console.warn('owner-v4 credit write',id,e)}
  }
  if(changed){try{window.persist?.()}catch(_){} try{window.renderAll?.()}catch(_){}}
  return changed;
 }finally{running=false}
}
function installSyncGuard(){
 if(wrapped)return;
 const original=window.cloudSyncNow;
 if(typeof original!=='function')return;
 wrapped=true;
 window.cloudSyncNow=async function(...args){
  // Repair before push, then repair again after pull so stale cloud data can never leave the UI misassigned.
  await repair().catch(()=>{});
  const result=await original.apply(this,args);
  await repair().catch(()=>{});
  return result;
 };
}
window.__prestamoYaRepairKnownOwnersV4=repair;
window.addEventListener('load',()=>{
 let n=0; const timer=setInterval(()=>{installSyncGuard();n++;if(wrapped||n>30)clearInterval(timer)},250);
 setTimeout(async()=>{installSyncGuard();await repair().catch(()=>{});},1200);
 setTimeout(()=>repair().catch(()=>{}),4500);
});
})();
