// Mi Cartera PRO V2 — operation acceptance gate with isolated local fallback.
(function(root){'use strict';
let actionRunning=false;
const ACTION_LOCK='mi-cartera-v2-local-action';
function busyError(){return Object.assign(new Error('Hay una operación en curso. Espera a que termine antes de guardar otro movimiento.'),{code:'V2_OPERATION_IN_PROGRESS'})}
async function runAction(action){
  if(actionRunning)throw busyError();
  actionRunning=true;
  try{
    const locks=root.navigator?.locks;
    return locks?.request?await locks.request(ACTION_LOCK,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw busyError();return action()}):await action();
  }finally{actionRunning=false}
}
async function submit({bridge,versionGuard,authGate,operation,onStatus}){
  if(!versionGuard)throw new Error('V2_VERSION_GUARD_MISSING');
  if(versionGuard.ensureReady)await versionGuard.ensureReady();else versionGuard.requireReady();
  if(!authGate)throw new Error('V2_AUTH_GATE_MISSING');
  if(authGate.state?.().ready!==true&&authGate.refreshMembership)await authGate.refreshMembership();
  const auth=authGate.requireReady();
  if(String(auth?.role||'').toLowerCase()==='cobrador')throw Object.assign(new Error('Esta versión requiere una cuenta de administrador o supervisor para guardar, por los permisos actuales de Firestore. Puedes seguir consultando tus datos; la operación no se guardó ni quedó pendiente.'),{code:'V2_WRITE_ROLE_NOT_SUPPORTED'});
  root.MiCarteraV2CloudRehydration?.assertOwner?.(auth?.uid);
  if(root.MiCarteraV2CloudRehydration?.isRunning?.())throw Error('Los datos se están actualizando. Espera un momento y vuelve a registrar el movimiento.');
  if(!bridge)throw new Error('V2_SYNC_BRIDGE_MISSING');
  if(typeof bridge.status==='function'&&bridge.status()?.configured===false)throw Object.assign(new Error('V2_CLOUD_SYNC_NOT_CONFIGURED'),{code:'V2_CLOUD_SYNC_NOT_CONFIGURED'});
  if(typeof bridge.submit!=='function')throw Object.assign(new Error('V2_CLOUD_SYNC_NOT_CONFIGURED'),{code:'V2_CLOUD_SYNC_NOT_CONFIGURED'});
  if((bridge.status?.().queue||[]).some(x=>['CONFLICTO','BLOQUEADO'].includes(x.status)))throw Error('Hay una operación pendiente de revisión. Conserva el respaldo y resuelve el conflicto antes de registrar más movimientos.');
  const r=await bridge.submit(operation);
  const status=String(r?.status||'').toUpperCase();
  if(onStatus)onStatus(status||'UNKNOWN');
  if(status==='OFFLINE')throw Object.assign(new Error('Sin conexión. La operación no se guardó; vuelve a intentarla cuando recuperes internet.'),{code:'V2_OFFLINE_RETRY_REQUIRED',retryable:true,result:r});
  if(status==='QUEUED'&&r.durable===true)return r;
  if(['LOCAL_ONLY','QUEUED'].includes(status))throw Object.assign(new Error('La operación todavía no está confirmada en Firestore. No se aplicó en la app; vuelve a intentarla cuando la sincronización esté disponible.'),{code:'V2_CLOUD_CONFIRMATION_REQUIRED',retryable:true,result:r});if(!['COMMITTED','ALREADY_COMMITTED','DUPLICATE','APPLIED','ALREADY_APPLIED'].includes(status))throw Object.assign(new Error('V2_OPERATION_NOT_DURABLY_ACCEPTED'),{code:'V2_OPERATION_NOT_DURABLY_ACCEPTED',result:r});
  return r;
}
root.MiCarteraV2OperationCommitGate={submit,runAction,isActionRunning:()=>actionRunning,ACTION_LOCK};
})(window);
