// Mi Cartera PRO V2 — optional bridge from operational UI to safe Cloud sync.
// Cloud is opt-in: without a configured sync instance the app stays isolated/local.
(function(root){'use strict';let sync=null;const pending=new Map();
function configure(instance){if(!instance||typeof instance.submit!=='function')throw new Error('V2_SYNC_INSTANCE_REQUIRED');sync=instance;return true}
function status(){return {configured:!!sync,pending:pending.size}}
async function submit(input){if(!sync)return {status:'LOCAL_ONLY',operationId:input?.operationId||''};const opId=String(input?.operationId||'');if(!opId)throw new Error('OPERATION_ID_REQUIRED');if(pending.has(opId))return pending.get(opId);const task=Promise.resolve().then(()=>sync.submit(input)).finally(()=>pending.delete(opId));pending.set(opId,task);return task}
root.MiCarteraV2SyncBridge={configure,status,submit};})(window);