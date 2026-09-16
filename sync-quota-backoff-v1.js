// Préstamo Ya — protección de cuota Firestore v1.
// Evita reintentos cada 10 s cuando Firestore responde resource-exhausted.
(()=>{'use strict';if(window.__prestamoYaQuotaBackoffV1)return;window.__prestamoYaQuotaBackoffV1=true;
  const QUOTA_BACKOFF_MS=15*60*1000;let blockedUntil=0;
  const quotaSeen=()=>{const q=window.db?.syncQueue||[];return q.some(x=>x?.status==='ERROR'&&/resource-exhausted|quota exceeded/i.test(String(x.error||'')))};
  const install=()=>{const raw=window.syncQueueV3;if(typeof raw!=='function'||raw.__quotaBackoffV1)return setTimeout(install,300);const wrapped=async(...args)=>{const now=Date.now();if(now<blockedUntil)return {ok:false,backoff:true,reason:'FIRESTORE_QUOTA_BACKOFF',retryAt:new Date(blockedUntil).toISOString()};if(quotaSeen())blockedUntil=Math.max(blockedUntil,now+QUOTA_BACKOFF_MS);if(Date.now()<blockedUntil)return {ok:false,backoff:true,reason:'FIRESTORE_QUOTA_BACKOFF',retryAt:new Date(blockedUntil).toISOString()};const out=await raw(...args);if(quotaSeen())blockedUntil=Date.now()+QUOTA_BACKOFF_MS;return out};wrapped.__quotaBackoffV1=true;window.syncQueueV3=wrapped;window.prestamoYaQuotaBackoff={version:'v1',get retryAt(){return blockedUntil?new Date(blockedUntil).toISOString():null},clear(){blockedUntil=0}};console.info('Préstamo Ya: protección de cuota Firestore activa');};install();
})();
