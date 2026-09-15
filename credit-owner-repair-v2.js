// Préstamo Ya — reparación directa de propietarios verificados v2.
(()=>{
'use strict';
if(window.__prestamoYaCreditOwnerRepairV2)return;
window.__prestamoYaCreditOwnerRepairV2=true;
const KNOWN={
 '1789432343734':{name:'Alfredo Lopez Martel',phone:'51947127238'},
 '1789205624924':{name:'Víctor Coronado Cordova',phone:'51944581617'}
};
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const digits=v=>String(v??'').replace(/\D/g,'');
const firebase=async()=>{const [A,U,F]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')]);if(!A.getApps().length)return null;const app=A.getApp(),auth=U.getAuth(app),fs=F.getFirestore(app);return{auth,fs,F}};
const findLocal=rule=>{const cs=Array.isArray(window.db?.clients)?window.db.clients:[];const e=cs.filter(c=>norm(c?.name)===norm(rule.name)&&digits(c?.phone)===digits(rule.phone));return e.length===1?e[0]:null};
const repair=async()=>{
 let api=null;try{api=await firebase()}catch(e){console.warn('owner v2 firebase',e)}
 const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';let changed=false;
 for(const[id,rule]of Object.entries(KNOWN)){
  let cr=(window.db?.credits||[]).find(c=>String(c?.id)===id);
  let client=findLocal(rule);
  if(api?.auth?.currentUser){
   try{const ref=api.F.doc(api.fs,`orgs/${orgId}/credits`,id),snap=await api.F.getDoc(ref);if(snap.exists()){cr={...(cr||{}),...snap.data(),id};}}
   catch(e){console.warn('owner v2 credit read',id,e)}
   if(!client){try{const q=api.F.query(api.F.collection(api.fs,`orgs/${orgId}/clients`),api.F.where('orgId','==',orgId));const snap=await api.F.getDocs(q);const hits=snap.docs.map(d=>d.data()).filter(c=>norm(c?.name)===norm(rule.name)&&digits(c?.phone)===digits(rule.phone));if(hits.length===1)client=hits[0]}catch(e){console.warn('owner v2 clients read',e)}}
  }
  if(!cr||!client)continue;
  const cid=client.id??client.uid;
  if(cid==null)continue;
  cr.clientId=cid;if(!cr.routeId&&client.routeId)cr.routeId=client.routeId;
  window.db.credits=window.db.credits||[];const idx=window.db.credits.findIndex(c=>String(c?.id)===id);if(idx>=0)window.db.credits[idx]=cr;else window.db.credits.push(cr);changed=true;
  if(api?.auth?.currentUser){try{await api.F.setDoc(api.F.doc(api.fs,`orgs/${orgId}/credits`,id),{...cr,id,orgId,userId:api.auth.currentUser.uid,updatedAt:new Date().toISOString()},{merge:true})}catch(e){console.warn('owner v2 credit write',id,e)}}
 }
 if(changed){try{window.persist?.();window.renderAll?.()}catch(e){}}
 return changed;
};
window.__prestamoYaRepairKnownOwnersV2=repair;
window.addEventListener('load',()=>setTimeout(()=>repair().catch(()=>{}),3500));
})();
