// Reparación de sincronización de clientes: CLIENTE_CREADO / CLIENTE_MODIFICADO.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
(async()=>{
 const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{}; if(!cloud.cloudEnabled||!cfg.projectId)return;
 const wait=()=>new Promise((res,rej)=>{const t=Date.now(),f=()=>{if(getApps().length)return res(getApp());if(Date.now()-t>20000)return rej(Error('Firebase no se inicializó'));setTimeout(f,200)};f()});
 const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))if(x!==undefined)o[k]=clean(x);return o}return v};
 const sync=async()=>{const app=await wait(),auth=getAuth(app),fs=getFirestore(app),u=auth.currentUser;if(!u||!window.db)return false;const orgId=cloud.orgId||'mi-cartera',ps=await getDoc(doc(fs,'users',u.uid)),p=ps.exists()?ps.data():{},manager=['admin','supervisor'].includes(p.role),routes=(p.routeIds||[]).map(String),allowed=c=>manager||routes.includes(String(c?.routeId));
  const q=Array.isArray(db.syncQueue)?db.syncQueue:[],pending=q.filter(x=>(x.type==='CLIENTE_CREADO'||x.type==='CLIENTE_MODIFICADO')&&(x.status==='PENDIENTE'||x.status==='ERROR')),pushed=new Set();
  // El payload de la cola es la fuente de verdad de un cambio pendiente; no dependemos de que db.clients ya tenga la versión nueva.
  for(const item of pending){const payload=item.payload&&typeof item.payload==='object'?item.payload:null,id=payload?.id??item.id;if(id==null)continue;const local=(db.clients||[]).find(c=>String(c.id)===String(id));const c=payload||local;if(!c||!allowed(c))continue;await setDoc(doc(fs,`orgs/${orgId}/clients`,String(id)),clean({...c,orgId,userId:u.uid,updatedAt:new Date().toISOString()}),{merge:true});pushed.add(String(id));}
  // Si no quedó payload pendiente, republica los clientes locales actualizados recientemente para reparar marcas antiguas de sincronización.
  if(!pending.length){for(const c of(db.clients||[]).filter(allowed)){const t=Date.parse(c.updatedAt||c.createdAt||'');if(Number.isFinite(t)&&Date.now()-t<24*60*60*1000)await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),clean({...c,orgId,userId:u.uid,updatedAt:c.updatedAt||new Date().toISOString()}),{merge:true})}}
  const snap=await getDocs(query(collection(fs,`orgs/${orgId}/clients`),where('orgId','==',orgId))),cloudClients=snap.docs.map(d=>({id:d.id,...d.data()})).filter(allowed),map=new Map((db.clients||[]).map(c=>[String(c.id),c]));
  for(const c of cloudClients){const old=map.get(String(c.id))||{};map.set(String(c.id),{...old,...c,id:c.id})}db.clients=Array.from(map.values());
  for(const item of q){const id=item.payload?.id??item.id;if((item.type==='CLIENTE_CREADO'||item.type==='CLIENTE_MODIFICADO')&&pushed.has(String(id)))item.status='SINCRONIZADO'}
  try{persist();renderAll();updateSyncUI()}catch(_){}window.__prestamoYaClientSync={ok:true,changed:[...pushed],count:db.clients.length};return true;
 };
 window.syncClientsNow=()=>sync().catch(e=>{console.error('Sincronización clientes',e);return false});
 let wired=false;const wire=()=>{if(wired)return;const app=getApps()[0];if(!app)return setTimeout(wire,500);wired=true;const auth=getAuth(app);onAuthStateChanged(auth,u=>{if(u)setTimeout(()=>window.syncClientsNow(),1200)});window.addEventListener('online',()=>setTimeout(()=>window.syncClientsNow(),1000));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>window.syncClientsNow(),500)});setInterval(()=>{if(navigator.onLine&&auth.currentUser)window.syncClientsNow()},30000)};wire();
})();
