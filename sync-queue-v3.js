// Motor definitivo de cola local -> Cloud Firestore.
// No depende de un endpoint externo: procesa la cola local directamente contra Firestore.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(()=>{
  const wait=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>20000)return reject(new Error('Firebase no se inicializó'));setTimeout(tick,200)};tick()});
  const collectionFor=t=>({CLIENTE_CREADO:'clients',CLIENTE_MODIFICADO:'clients',CLIENTE_ELIMINADO:'clients',CREDITO_CREADO:'credits',CREDITO_MODIFICADO:'credits',CREDITO_ELIMINADO:'credits',PAGO_CREADO:'payments',PAGO_MODIFICADO:'payments',PAGO_ELIMINADO:'payments',RECAUDO:'payments',RECAUDO_CREADO:'payments',RUTA_CREADA:'routes',RUTA_MODIFICADA:'routes',RUTA_ELIMINADA:'routes',CAPITAL_INGRESADO:'capital',CAPITAL_MODIFICADO:'capital',CAPITAL_ELIMINADO:'capital',ENTRADA:'entries',ENTRADA_CREADA:'entries',ENTRADA_MODIFICADA:'entries',ENTRADA_ELIMINADA:'entries',GASTO:'expenses',GASTO_CREADO:'expenses',GASTO_MODIFICADO:'expenses',GASTO_ELIMINADO:'expenses',CIERRE_CAJA:'cashClosures',CIERRE_CAJA_MODIFICADO:'cashClosures',AUTORIZACION_APROBADA:'approvals',AUTORIZACION_RECHAZADA:'approvals',SOLICITUD_AUTORIZACION:'approvals'})[t]||null;
  const isDelete=t=>/(_ELIMINADO|_ELIMINADA)$/.test(t);
  const findLocal=(type,payload)=>{const name=collectionFor(type),list=Array.isArray(window.db?.[name])?window.db[name]:[];if(payload?.id!=null)return list.find(x=>String(x.id)===String(payload.id))||null;if(!list.length)return null;const candidates=list.filter(x=>type.startsWith('CREDITO_')?String(x.clientId??'')===String(payload?.clientId??'')&&String(x.date??'')===String(payload?.date??'')&&Number(x.capital??0)===Number(payload?.capital??0):type.startsWith('CLIENTE_')?String(x.name??'')===String(payload?.name??'')&&String(x.phone??'')===String(payload?.phone??''):false);return candidates.length?candidates[candidates.length-1]:null};
  const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))if(x!==undefined)o[k]=clean(x);return o}return v};
  const allowed=(profile,p)=>profile?.role==='admin'||profile?.role==='supervisor'||(Array.isArray(profile?.routeIds)&&p?.routeId!=null&&profile.routeIds.map(String).includes(String(p.routeId)));
  const process=async()=>{
    if(!navigator.onLine||!window.db)return {ok:false,processed:0,remaining:window.db?.syncQueue?.length||0};
    const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{};if(!cloud.cloudEnabled||!cfg.projectId)return {ok:false,processed:0,remaining:0};
    const app=await wait(),auth=getAuth(app),fs=getFirestore(app),u=auth.currentUser;if(!u)return {ok:false,processed:0,remaining:0};
    const orgId=cloud.orgId||'mi-cartera';let profile=null;try{const snap=await getDoc(doc(fs,'users',u.uid));profile=snap.exists()?snap.data():null}catch(e){console.warn('Cola: no se pudo leer perfil',e)}
    const queue=Array.isArray(db.syncQueue)?db.syncQueue:[];let processed=0;
    for(const item of queue.slice()){
      if(!item||!['PENDIENTE','ERROR'].includes(item.status))continue;
      const col=collectionFor(item.type);if(!col){item.status='ERROR';item.error='Tipo de operación no soportado por Cloud';continue;}
      const payload=item.payload&&typeof item.payload==='object'?item.payload:{};const local=findLocal(item.type,payload);const merged=local?{...local,...payload}:payload;const id=merged?.id!=null?String(merged.id):null;
      if(!allowed(profile,merged)){item.attempts=(item.attempts||0)+1;item.error='Sin permiso para la ruta';continue;}
      if(id==null){item.attempts=(item.attempts||0)+1;item.error='No se pudo determinar el ID del documento';continue;}
      try{
        item.attempts=(item.attempts||0)+1;
        const ref=doc(fs,`orgs/${orgId}/${col}`,id);
        if(isDelete(item.type)) await deleteDoc(ref);
        else await setDoc(ref,clean({...merged,id,orgId,userId:u.uid,updatedAt:new Date().toISOString()}),{merge:true});
        item.status='SINCRONIZADO';item.syncedAt=new Date().toISOString();delete item.error;processed++;
      }catch(e){item.status='ERROR';item.error=String(e?.code||e?.message||e);}
    }
    db.settings=db.settings||{};db.settings.lastOnline=new Date().toISOString();
    if(typeof persist==='function')persist();else localStorage.setItem('mi_cartera_pro_v21',JSON.stringify(db));
    try{updateSyncUI()}catch(_){}
    return {ok:true,processed,remaining:queue.filter(x=>x.status==='PENDIENTE'||x.status==='ERROR').length};
  };
  window.processSyncQueue=()=>process().catch(e=>{console.error('Cola Cloud',e);return {ok:false,processed:0,error:String(e)}});
  let running=false;
  window.syncQueueV3=async()=>{if(running)return {ok:false,busy:true};running=true;try{return await window.processSyncQueue()}finally{running=false}};
  const start=()=>{if(window.__prestamoYaQueueV3)return;window.__prestamoYaQueueV3=true;window.addEventListener('online',()=>setTimeout(()=>window.syncQueueV3(),1200));setTimeout(()=>window.syncQueueV3(),1800);setInterval(()=>{if(navigator.onLine)window.syncQueueV3()},20000)};
  start();
})();
