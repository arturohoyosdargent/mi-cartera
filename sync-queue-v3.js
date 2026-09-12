// Préstamo Ya — cola offline/Cloud v11.
// Firestore es la autoridad final de permisos: no bloquear créditos localmente por un routeId/profile desactualizado.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc, getDoc, getDocFromServer, waitForPendingWrites } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(()=>{
  const waitFirebase=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>20000)return reject(new Error('Firebase no se inicializó'));setTimeout(tick,200)};tick()});
  const collectionFor=t=>({CLIENTE_CREADO:'clients',CLIENTE_MODIFICADO:'clients',CLIENTE_ELIMINADO:'clients',CREDITO_CREADO:'credits',CREDITO_MODIFICADO:'credits',CREDITO_ELIMINADO:'credits',PAGO_CREADO:'payments',PAGO_MODIFICADO:'payments',PAGO_ELIMINADO:'payments',RECAUDO:'payments',RECAUDO_CREADO:'payments',RUTA_CREADA:'routes',RUTA_MODIFICADA:'routes',RUTA_ELIMINADA:'routes',CAPITAL_INGRESADO:'capital',CAPITAL_MODIFICADO:'capital',CAPITAL_ELIMINADO:'capital',ENTRADA:'entries',ENTRADA_CREADA:'entries',ENTRADA_MODIFICADA:'entries',ENTRADA_ELIMINADA:'entries',GASTO:'expenses',GASTO_CREADO:'expenses',GASTO_MODIFICADO:'expenses',GASTO_ELIMINADO:'expenses',CIERRE_CAJA:'cashClosures',CIERRE_CAJA_MODIFICADO:'cashClosures',AUTORIZACION_APROBADA:'approvals',AUTORIZACION_RECHAZADA:'approvals',SOLICITUD_AUTORIZACION:'approvals'})[t]||null;
  const isDelete=t=>/(_ELIMINADO|_ELIMINADA)$/.test(t);
  const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))if(x!==undefined)o[k]=clean(x);return o}return v};
  const findLocal=(type,payload)=>{const name=collectionFor(type),list=Array.isArray(window.db?.[name])?window.db[name]:[];if(payload?.id!=null){const exact=list.find(x=>String(x.id)===String(payload.id));if(exact)return exact}if(!list.length)return null;const candidates=list.filter(x=>type.startsWith('CREDITO_')?String(x.clientId??'')===String(payload?.clientId??'')&&String(x.date??'')===String(payload?.date??'')&&Number(x.capital??0)===Number(payload?.capital??0):type.startsWith('CLIENTE_')?String(x.name??'')===String(payload?.name??'')&&String(x.phone??'')===String(payload?.phone??''):false);return candidates.length?candidates[candidates.length-1]:null};
  // Não faça uma autorização local divergente da regra Firestore. O precheck anterior podia deixar
  // CREDITO_MODIFICADO em PENDIENTE mesmo quando o usuário já tinha permissão no servidor.
  const routeAllowed=(p,item)=>{if(['admin','supervisor'].includes(p?.role))return true;const col=collectionFor(item.type);if(['clients','payments','cashClosures','approvals'].includes(col))return true;if(col==='credits')return true;return false};
  const persist=()=>{try{const db=window.db;if(!db)return;db.settings=db.settings||{};db.settings.lastOnline=new Date().toISOString();const raw=JSON.stringify(db);localStorage.setItem('mi_cartera_pro_v21',raw);localStorage.setItem('mi_cartera_pro_v19',raw);window.persist?.()}catch(e){console.warn('Cola: persistencia',e)}};
  const ui=()=>{try{window.updateSyncUI?.()}catch(_){} try{window.renderAll?.()}catch(_){} };
  async function loadProfile(auth,fs){const u=auth.currentUser;if(!u)return null;try{const snap=await getDoc(doc(fs,'users',u.uid));const p=snap.exists()?snap.data():null;if(p)window.__prestamoYaQueueProfile=p;return p||window.__prestamoYaQueueProfile||null}catch(e){console.warn('Cola: perfil Cloud',e);return window.__prestamoYaQueueProfile||null}}
  async function process(){
    const db=window.db;if(!navigator.onLine||!db)return {ok:false,processed:0,remaining:db?.syncQueue?.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length||0,reason:'offline'};
    const app=await waitFirebase();const auth=getAuth(app),fs=getFirestore(app),u=auth.currentUser;if(!u)return {ok:false,processed:0,remaining:db.syncQueue?.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length||0,reason:'no-auth'};
    const profile=await loadProfile(auth,fs);if(!profile||profile.active===false)return {ok:false,processed:0,remaining:db.syncQueue?.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length||0,reason:'no-profile'};
    const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';const queue=Array.isArray(db.syncQueue)?db.syncQueue:[];let processed=0,errors=0;
    // Recupera operações que ficaram ENVIANDO por fechamento/reload do navegador.
    for(const item of queue){if(item?.status==='ENVIANDO')item.status='PENDIENTE'}
    for(const item of queue.slice()){
      if(!item||!['PENDIENTE','ERROR'].includes(item.status))continue;
      const col=collectionFor(item.type);if(!col){item.status='ERROR';item.error='Tipo no soportado';errors++;continue}
      if(!routeAllowed(profile,item)){item.status='ERROR';item.error='Función no gestionada por la cola';item.attempts=(item.attempts||0)+1;errors++;continue}
      const payload=item.payload&&typeof item.payload==='object'?item.payload:{};const local=findLocal(item.type,payload);const merged=local?{...local,...payload}:payload;const id=merged?.id!=null?String(merged.id):null;
      if(id==null){item.status='ERROR';item.error='No se pudo determinar el ID';item.attempts=(item.attempts||0)+1;errors++;continue}
      try{
        item.attempts=(item.attempts||0)+1;item.status='ENVIANDO';delete item.error;const ref=doc(fs,`orgs/${orgId}/${col}`,id);
        if(isDelete(item.type)){await deleteDoc(ref);await waitForPendingWrites(fs);const check=await getDocFromServer(ref);if(check.exists())throw new Error('FIRESTORE_DELETE_NO_CONFIRMADO')}
        else{await setDoc(ref,clean({...merged,id,orgId,userId:u.uid,updatedAt:new Date().toISOString()}),{merge:true});await waitForPendingWrites(fs);const check=await getDocFromServer(ref);if(!check.exists())throw new Error('FIRESTORE_WRITE_NO_CONFIRMADO')}
        item.status='SINCRONIZADO';item.syncedAt=new Date().toISOString();delete item.error;processed++;
      }catch(e){item.status='ERROR';item.error=String(e?.code||e?.message||e);item.lastErrorAt=new Date().toISOString();errors++}
      persist();ui();
    }
    const pending=queue.filter(x=>x&&['PENDIENTE','ENVIANDO'].includes(x.status)).length;const sending=queue.filter(x=>x&&x.status==='ENVIANDO').length;const errorCount=queue.filter(x=>x&&x.status==='ERROR').length;window.__prestamoYaQueueLast={processed,errors,remaining:pending,sending,errorCount,at:new Date().toISOString(),role:profile.role||'consulta'};return {ok:true,processed,errors,remaining:pending,sending,errorCount};
  }
  window.processSyncQueue=()=>process().catch(e=>{console.error('Cola Cloud',e);return {ok:false,processed:0,errors:1,remaining:window.db?.syncQueue?.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length||0,error:String(e)}});
  let running=false;window.syncQueueV3=async()=>{if(running)return {ok:false,busy:true};running=true;try{return await window.processSyncQueue()}finally{running=false}};
  window.ackQueueAfterCloudSync=()=>{ui();return {processed:0,remaining:window.db?.syncQueue?.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length||0,mode:'ack-by-write-confirmation'}};
  window.waitForCloudWrites=async()=>{try{const app=await waitFirebase();await waitForPendingWrites(getFirestore(app));return true}catch(e){console.warn('waitForCloudWrites',e);return false}};
  window.prestamoYaSyncDiagnostics=async()=>{const q=Array.isArray(window.db?.syncQueue)?window.db.syncQueue:[];let firebase={auth:false,uid:null,profile:null,profileReadError:null},sw=[];try{sw=await navigator.serviceWorker?.getRegistrations?.()||[]}catch(e){}try{const app=await waitFirebase(),auth=getAuth(app),fs=getFirestore(app);firebase.auth=!!auth.currentUser;firebase.uid=auth.currentUser?.uid||null;const p=auth.currentUser?await loadProfile(auth,fs):null;firebase.profile=p?{role:p.role,active:p.active,orgId:p.orgId,routeIds:p.routeIds}:null}catch(e){firebase.profileReadError=String(e?.code||e?.message||e)}const result={timestamp:new Date().toISOString(),online:navigator.onLine,appVersion:'sync-queue-v11',queue:q.map((x,i)=>({index:i,id:x?.id,type:x?.type,status:x?.status,attempts:x?.attempts||0,error:x?.error||null,payloadId:x?.payload?.id??null,clientId:x?.payload?.clientId??null,routeId:x?.payload?.routeId??null,createdAt:x?.createdAt||null,syncedAt:x?.syncedAt||null})),firebase,serviceWorkers:sw.map(r=>({scope:r.scope,state:r.active?.state||null,script:r.active?.scriptURL||null})),last:window.__prestamoYaQueueLast||null,localKeys:Object.keys(localStorage).filter(k=>/mi_cartera|prestamo/i.test(k))};console.table(result.queue);console.log('Préstamo Ya diagnóstico completo:',result);return result};
  if(!window.__prestamoYaQueueV11){window.__prestamoYaQueueV11=true;window.addEventListener('online',()=>setTimeout(()=>window.syncQueueV3(),1000));setTimeout(()=>window.syncQueueV3(),2500);setInterval(()=>{if(navigator.onLine)window.syncQueueV3()},15000)}
})();