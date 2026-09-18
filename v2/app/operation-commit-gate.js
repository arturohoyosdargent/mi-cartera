// Mi Cartera PRO V2 — operation acceptance gate with isolated local fallback.
(function(root){'use strict';
async function submit({bridge,versionGuard,authGate,operation,onStatus}){
  if(!versionGuard)throw new Error('V2_VERSION_GUARD_MISSING');
  versionGuard.requireReady();
  if(!authGate)throw new Error('V2_AUTH_GATE_MISSING');
  authGate.requireReady();
  if(!bridge)throw new Error('V2_SYNC_BRIDGE_MISSING');
  const r=await bridge.submit(operation);
  const status=String(r?.status||'').toUpperCase();
  if(onStatus)onStatus(status||'UNKNOWN');
  if(status==='OFFLINE')throw Object.assign(new Error('Sin conexión. La operación no se guardó; vuelve a intentarla cuando recuperes internet.'),{code:'V2_OFFLINE_RETRY_REQUIRED',retryable:true,result:r});
  if(!['LOCAL_ONLY','COMMITTED','QUEUED','ALREADY_COMMITTED','DUPLICATE','APPLIED','ALREADY_APPLIED'].includes(status))throw Object.assign(new Error('V2_OPERATION_NOT_DURABLY_ACCEPTED'),{code:'V2_OPERATION_NOT_DURABLY_ACCEPTED',result:r});
  return r;
}
root.MiCarteraV2OperationCommitGate={submit};
})(window);
