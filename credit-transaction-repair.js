import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(()=>{
 const VERSION='credit-transaction-repair-v2';
 const persist=()=>{try{const d=window.db;if(!d)return;d.settings=d.settings||{};d.settings.lastOnline=new Date().toISOString();localStorage.setItem('mi_cartera_pro_v21',JSON.stringify(d));localStorage.setItem('mi_cartera_pro_v19',JSON.stringify(d));if(typeof window.persist==='function')window.persist();}catch(e){console.warn('Transaction repair persistence',e)}};
 window.__prestamoYaTransactionRepair=async function(){
  const out={version:VERSION,processed:0,errors:0,skipped:0,details:[]};
  try{
   const cfg=window.MI_CARTERA_FIREBASE||{}, oc=window.MI_CARTERA_CLOUD||{};
   if(!oc.cloudEnabled||!cfg.apiKey||!cfg.projectId||!cfg.appId){out.skipped=1;out.reason='CLOUD_NOT_CONFIGURED';return out;}
   const app=getApps().find(a=>a.name==='[DEFAULT]')||getApps()[0]||initializeApp(cfg);
   const auth=getAuth(app), fs=getFirestore(app), user=auth.currentUser;
   if(!user){out.skipped=1;out.reason='AUTH_REQUIRED';return out;}
   const orgId=oc.orgId||'mi-cartera';
   const queue=Array.isArray(window.db?.syncQueue)?window.db.syncQueue:[];
   const targets=queue.filter(x=>['CREDITO_MODIFICADO','CREDITO_CREADO'].includes(x?.type)&&['PENDIENTE','ERROR','ENVIANDO'].includes(x?.status));
   for(const item of targets){
    const id=item?.payload?.id ?? item?.payload?.creditId ?? item?.idLocal;
    if(id==null){item.status='ERROR';item.error='ID_NO_DETERMINADO';out.errors++;out.details.push({id:item?.id,type:item?.type,error:item.error});persist();continue;}
    try{
     item.status='ENVIANDO';item.error='';persist();if(typeof window.updateSyncUI==='function')window.updateSyncUI();
     const local=(window.db?.credits||[]).find(c=>String(c.id)===String(id))||{};
     const payload={...local,...(item.payload||{}),id:String(id),orgId,userId:user.uid,updatedAt:new Date().toISOString()};
     if(payload.routeId!=null)payload.routeId=String(payload.routeId);
     const ref=doc(fs,`orgs/${orgId}/credits`,String(id));
     await Promise.race([setDoc(ref,payload,{merge:true}),new Promise((_,rej)=>setTimeout(()=>rej(new Error('WRITE_TIMEOUT')),12000))]);
     const snap=await Promise.race([getDocFromServer(ref),new Promise((_,rej)=>setTimeout(()=>rej(new Error('VERIFY_TIMEOUT')),10000))]);
     if(!snap.exists())throw new Error('VERIFY_NOT_FOUND');
     item.status='SINCRONIZADO';item.syncedAt=new Date().toISOString();item.error='';out.processed++;out.details.push({id:String(id),type:item.type,status:item.status});persist();if(typeof window.updateSyncUI==='function')window.updateSyncUI();
    }catch(e){item.status='ERROR';item.error=e?.code||e?.message||'SYNC_ERROR';item.lastAttempt=new Date().toISOString();out.errors++;out.details.push({id:String(id),type:item?.type,status:item.status,error:item.error});persist();if(typeof window.updateSyncUI==='function')window.updateSyncUI();}
   }
   out.ok=out.errors===0;window.__prestamoYaTransactionRepairLast=out;return out;
  }catch(e){out.errors++;out.ok=false;out.reason=e?.code||e?.message||'REPAIR_FATAL';window.__prestamoYaTransactionRepairLast=out;return out;}
 };
 window.prestamoYaTransactionRepair=window.__prestamoYaTransactionRepair;
})();