// Reparación de sincronización de clientes: asegura que CLIENTE_CREADO/MODIFICADO lleguen a Firestore y regresen al dispositivo.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{};
  if(!cloud.cloudEnabled||!cfg.projectId)return;
  const waitApp=()=>new Promise((resolve,reject)=>{const t=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-t>20000)return reject(new Error('Firebase no se inicializó'));setTimeout(tick,200)};tick()});
  const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))if(x!==undefined) o[k]=clean(x);return o}return v};
  const sync=async()=>{
    const app=await waitApp(),auth=getAuth(app),fs=getFirestore(app),u=auth.currentUser;
    if(!u||!window.db)return false;
    const orgId=cloud.orgId||'mi-cartera';
    const profileSnap=await getDoc(doc(fs,'users',u.uid));
    const profile=profileSnap.exists()?profileSnap.data():{};
    const manager=['admin','supervisor'].includes(profile.role);
    const routeIds=(Array.isArray(profile.routeIds)?profile.routeIds:[]).map(String);
    const allowed=c=>manager||routeIds.includes(String(c?.routeId));
    const queue=Array.isArray(db.syncQueue)?db.syncQueue:[];
    const changedIds=new Set(queue.filter(q=>(q.type==='CLIENTE_CREADO'||q.type==='CLIENTE_MODIFICADO')&&(q.status==='PENDIENTE'||q.status==='ERROR')).map(q=>String(q.payload?.id??q.id??'' )).filter(Boolean));
    const localClients=(db.clients||[]).filter(allowed);
    // Primero publica únicamente los clientes que realmente cambiaron o fueron creados.
    for(const id of changedIds){
      const c=(db.clients||[]).find(x=>String(x.id)===id);
      if(!c||!allowed(c))continue;
      await setDoc(doc(fs,`orgs/${orgId}/clients`,id),clean({...c,orgId,userId:u.uid,updatedAt:new Date().toISOString()}),{merge:true});
    }
    // También corrige un caso en que la cola haya quedado marcada como sincronizada de forma incorrecta.
    if(!changedIds.size&&localClients.length){
      const recent=localClients.filter(c=>c.updatedAt||c.createdAt).filter(c=>{const t=Date.parse(c.updatedAt||c.createdAt);return Number.isFinite(t)&&Date.now()-t<24*60*60*1000});
      for(const c of recent)await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),clean({...c,orgId,userId:u.uid,updatedAt:c.updatedAt||new Date().toISOString()}),{merge:true});
    }
    // Luego lee Cloud y mezcla sin perder campos locales.
    const snap=await getDocs(query(collection(fs,`orgs/${orgId}/clients`),where('orgId','==',orgId)));
    const cloudClients=snap.docs.map(d=>({id:d.id,...d.data()})).filter(allowed);
    const map=new Map((db.clients||[]).map(c=>[String(c.id),c]));
    for(const c of cloudClients){const old=map.get(String(c.id))||{};map.set(String(c.id),{...old,...c,id:c.id})}
    db.clients=Array.from(map.values());
    try{persist()}catch(_){}
    try{renderAll()}catch(_){}
    window.__prestamoYaClientSync={ok:true,at:new Date().toISOString(),count:db.clients.length,changed:[...changedIds]};
    // Marca solo las operaciones que realmente fueron publicadas.
    for(const q of queue){if((q.type==='CLIENTE_CREADO'||q.type==='CLIENTE_MODIFICADO')&&changedIds.has(String(q.payload?.id??q.id??'')))q.status='SINCRONIZADO';}
    try{persist();updateSyncUI()}catch(_){}
    return true;
  };
  window.syncClientsNow=()=>sync().catch(e=>{console.error('Sincronización de clientes:',e);return false});
  let wired=false;
  const wire=()=>{if(wired)return;const app=getApps()[0];if(!app)return setTimeout(wire,500);wired=true;const auth=getAuth(app);onAuthStateChanged(auth,user=>{if(user)setTimeout(()=>window.syncClientsNow(),1200)});window.addEventListener('online',()=>setTimeout(()=>window.syncClientsNow(),1200));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>window.syncClientsNow(),500)});setInterval(()=>{if(navigator.onLine&&auth.currentUser)window.syncClientsNow()},30000)};
  wire();
})();
