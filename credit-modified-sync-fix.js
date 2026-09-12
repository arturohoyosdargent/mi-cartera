// Reparación específica: CREDITO_MODIFICADO debe llegar a Firestore aun cuando el crédito tenga routeId histórico inconsistente.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
(()=>{
 const wait=()=>{if(!window.db||!Array.isArray(window.db.syncQueue)||!getApps().length)return setTimeout(wait,500);install()};
 function install(){if(window.__creditModifiedSyncFix)return;window.__creditModifiedSyncFix=true;
  window.syncModifiedCreditsNow=async()=>{
   if(!navigator.onLine)return {ok:false,reason:'OFFLINE'};
   const app=getApp(),auth=getAuth(app),fs=getFirestore(app),u=auth.currentUser;if(!u)return {ok:false,reason:'AUTH_REQUIRED'};
   const orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';const q=window.db.syncQueue||[];let processed=0,errors=0;
   for(const item of q){if(item?.type!=='CREDITO_MODIFICADO'||!['PENDIENTE','ERROR','ENVIANDO'].includes(item.status))continue;
    const payload=item.payload&&typeof item.payload==='object'?item.payload:{};const id=payload.id!=null?String(payload.id):null;if(!id){item.status='ERROR';item.error='ID_NO_DETERMINADO';errors++;continue}
    try{
     item.status='ENVIANDO';item.attempts=(item.attempts||0)+1;const ref=doc(fs,`orgs/${orgId}/credits`,id);const snap=await getDoc(ref);if(!snap.exists())throw new Error('CREDITO_NO_EXISTE_EN_CLOUD');
     const current=snap.data()||{},merged={...current,...payload,id,orgId,userId:u.uid,updatedAt:new Date().toISOString()};
     if(current.routeId!=null)merged.routeId=String(current.routeId);else if(merged.routeId!=null)merged.routeId=String(merged.routeId);
     if(merged.clientId!=null)merged.clientId=String(merged.clientId);
     await setDoc(ref,merged,{merge:true});const verify=await getDocFromServer(ref);if(!verify.exists())throw new Error('CREDITO_MODIFICADO_NO_CONFIRMADO');
     item.status='SINCRONIZADO';item.syncedAt=new Date().toISOString();delete item.error;processed++;
    }catch(e){item.status='ERROR';item.error=String(e?.code||e?.message||e);item.lastErrorAt=new Date().toISOString();errors++}
    try{window.persist?.();window.updateSyncUI?.();window.renderAll?.()}catch(_){ }
   }
   return {ok:true,processed,errors,remaining:q.filter(x=>['PENDIENTE','ENVIANDO'].includes(x?.status)).length};
  };
  setTimeout(()=>window.syncModifiedCreditsNow().catch(()=>{}),1500);setInterval(()=>{if(navigator.onLine)window.syncModifiedCreditsNow().catch(()=>{})},12000);
 }
 wait();
})();