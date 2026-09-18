// Mi Cartera PRO V2 — optional bridge from operational UI to safe Cloud sync.
// Cloud is opt-in: without a configured sync instance the app stays isolated/local.
(function(root){'use strict';let sync=null;const pending=new Map();
function configure(instance){if(!instance||typeof instance.submit!=='function')throw new Error('V2_SYNC_INSTANCE_REQUIRED');sync=instance;return true}
function reset(){sync=null;pending.clear();return true}
function status(){return {configured:!!sync,pending:pending.size,online:typeof navigator==='undefined'?true:navigator.onLine!==false}}
async function submit(input){if(!sync)return {status:'LOCAL_ONLY',operationId:input?.operationId||''};const opId=String(input?.operationId||'');if(!opId)throw new Error('OPERATION_ID_REQUIRED');if(pending.has(opId))return pending.get(opId);if(typeof navigator!=='undefined'&&navigator.onLine===false)return {status:'OFFLINE',operationId:opId,retryable:true};const task=Promise.resolve().then(()=>sync.submit(input)).catch(error=>{const offline=typeof navigator!=='undefined'&&navigator.onLine===false;if(offline)return {status:'OFFLINE',operationId:opId,retryable:true};throw error}).finally(()=>pending.delete(opId));pending.set(opId,task);return task}
root.MiCarteraV2SyncBridge={configure,reset,status,submit};})(window);
