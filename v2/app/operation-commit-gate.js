// Mi Cartera PRO V2 — operation acceptance gate with isolated local fallback.
(function(root){'use strict';
async function submit({bridge,versionGuard,authGate,operation,onStatus}){
  if(!versionGuard)throw new Error('V2_VERSION_GUARD_MISSING');
  if(versionGuard.ensureReady)await versionGuard.ensureReady();else versionGuard.requireReady();
  if(!authGate)throw new Error('V2_AUTH_GATE_MISSING');
  authGate.requireReady();
  if(!bridge)throw new Error('V2_SYNC_BRIDGE_MISSING');
  if(typeof bridge.status==='function'&&bridge.status()?.configured===false)throw Object.assign(new Error('V2_CLOUD_SYNC_NOT_CONFIGURED'),{code:'V2_CLOUD_SYNC_NOT_CONFIGURED'});
  if(typeof bridge.submit!=='function')throw Object.assign(new Error('V2_CLOUD_SYNC_NOT_CONFIGURED'),{code:'V2_CLOUD_SYNC_NOT_CONFIGURED'});
  const r=await bridge.submit(operation);
  const status=String(r?.status||'').toUpperCase();
  if(onStatus)onStatus(status||'UNKNOWN');
  if(status==='OFFLINE')throw Object.assign(new Error('Sin conexión. La operación no se guardó; vuelve a intentarla cuando recuperes internet.'),{code:'V2_OFFLINE_RETRY_REQUIRED',retryable:true,result:r});
  if(['LOCAL_ONLY','QUEUED'].includes(status))throw Object.assign(new Error('La operación todavía no está confirmada en Firestore. No se aplicó en la app; vuelve a intentarla cuando la sincronización esté disponible.'),{code:'V2_CLOUD_CONFIRMATION_REQUIRED',retryable:true,result:r});if(!['COMMITTED','ALREADY_COMMITTED','DUPLICATE','APPLIED','ALREADY_APPLIED'].includes(status))throw Object.assign(new Error('V2_OPERATION_NOT_DURABLY_ACCEPTED'),{code:'V2_OPERATION_NOT_DURABLY_ACCEPTED',result:r});
  return r;
}
root.MiCarteraV2OperationCommitGate={submit};
})(window);
