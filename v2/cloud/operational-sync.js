// Mi Cartera PRO V2 — safe operational sync boundary. No Firebase globals, no polling.
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2OperationalSync=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
function sid(v){return String(v??'').trim()}function clone(v){return JSON.parse(JSON.stringify(v))}
function createOperationalSync(cfg){const store=cfg?.store;if(!store||typeof store.execute!=='function')throw new Error('V2_STORE_REQUIRED');const queue=cfg?.queue||null;const actorId=sid(cfg?.actorId||'v2-user');const state={status:'IDLE',lastFlushAt:null,lastError:null};
 function requireSend(){cfg?.beforeSend?.()}
 async function execute(op){cfg?.beforeExecute?.(op);if(op.requiresLeaderCashRevision){const prepared=await queue.prepareForExecution(op.id,cfg.prepareQueuedOperation);for(const key of Object.keys(op))delete op[key];Object.assign(op,prepared)}let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('NETWORK_TIMEOUT: operación conservada para sincronizar'),{code:'deadline-exceeded'})),Number(cfg.requestTimeoutMs)||4000)});return Promise.race([Promise.resolve().then(()=>store.execute(op)),deadline]).finally(()=>clearTimeout(timer));}
 function operation(input){if(!input?.operationId)throw new Error('OPERATION_ID_REQUIRED');const writes=[];for(const x of input.entities||[]){if(!x?.collection||!x?.data?.id)throw new Error('SYNC_ENTITY_INVALID');let data=clone(x.data);if(input.metadataOnly&&x.collection==='routes'){const allowed=root.MiCarteraV2Store.metadataRecordFields(data.recordType);if(!allowed)throw Error('INVALID_METADATA_RECORD');data=Object.fromEntries(allowed.filter(k=>Object.prototype.hasOwnProperty.call(data,k)).map(k=>[k,data[k]]))}const expected=x.kind==='create'?0:Number(data.version||0)-1,fields=input.metadataOnly?root.MiCarteraV2Store?.metadataFields?.(input.type,x.collection):null,clientId=x.collection==='clients'?data.id:data.clientId;if(fields){data=Object.fromEntries(fields.filter(k=>Object.prototype.hasOwnProperty.call(data,k)).map(k=>[k,data[k]]))}writes.push({...(fields?{clientId,before:clone(input.metadataBefore?.[x.collection+'/'+x.data.id]||{})}:{}),kind:fields?'metadata':x.kind||'set',path:`${x.collection}/${data.id}`,data,expectedVersion:expected});}if(input.audit?.id)writes.push({kind:'create',path:`audit/${input.audit.id}`,data:clone(input.audit),expectedVersion:0});return {id:sid(input.operationId),operationId:sid(input.operationId),type:sid(input.type||'OPERATIONAL'),createdAt:input.createdAt||new Date().toISOString(),actorId,writes,...(input.requiresLeaderCashRevision?{requiresLeaderCashRevision:true}:{})};}
 async function submit(input){
  requireSend();
  const op=operation(input);if(input.metadataOnly&&root.MiCarteraV2Store?.isMetadataOperation?.(op)!==true)throw Error('INVALID_METADATA_OPERATION');
  if(!queue)return store.execute(op);
  const hadPending=queue.inspect().some(x=>!(root.MiCarteraV2OfflineQueue?.isTerminal?.(x)??x.status==='SINCRONIZADO'));
  // Connectivity hints are not delivery guarantees. Persist the complete write
  // set before starting any request, including when Android reports online.
  await queue.enqueue(op);
  state.status='PENDING';
  emit('mi-cartera-v2-sync',{source:'operation-journalled',operationId:op.id});
  const queued=()=>({status:'QUEUED',durable:true,operationId:op.id});
  if(root.navigator?.onLine===false||hadPending||op.requiresLeaderCashRevision)return queued();
  let accepted=null,failure=null;
  // Use the same queue executor/acknowledgement path as reconnection. It retains
  // the journal until a recognised server result and preserves queue ordering.
  await queue.flush(async current=>{try{const result=await execute(current);if(current.id===op.id)accepted=result;return result}catch(error){if(current.id===op.id)failure=error;throw error}});
  const item=queue.inspect().find(x=>x.id===op.id);
  if(item?.status==='SINCRONIZADO'){state.status='SYNCED';state.lastError=null;return accepted||{status:'ALREADY_APPLIED',operationId:op.id};}
  state.lastError=item?.lastError||null;
  if(item&&['BLOQUEADO','CONFLICTO'].includes(item.status)){state.status='ERROR';throw failure||new Error(item.lastError||'V2_OPERATION_NEEDS_REVIEW');}
  return queued();
 }
 async function flush(){requireSend();if(!queue||typeof queue.flush!=='function')return {status:'NO_QUEUE'};state.status='SYNCING';try{const result=await queue.flush(op=>execute(op));state.status=result.blocked||result.conflicts?'ERROR':result.pending?'PENDING':'SYNCED';state.lastFlushAt=new Date().toISOString();state.lastError=null;return result}catch(error){state.status='ERROR';state.lastError=String(error?.code||error?.message||error||'SYNC_FAILED');throw error;}}
 function emit(name,detail){if(typeof root?.dispatchEvent!=='function')return;try{const E=typeof root.CustomEvent==='function'?root.CustomEvent:null;if(E)root.dispatchEvent(new E(name,{detail}));}catch(_){}}
 function reconnect(){if(typeof root?.addEventListener!=='function'||!queue||typeof queue.flush!=='function')return false;root.addEventListener('online',async()=>{try{const result=await flush();emit('mi-cartera-v2-sync',{ok:true,result,state:getState()});}catch(error){emit('mi-cartera-v2-sync',{ok:false,error:state.lastError,state:getState()});}});return true}
 function getState(){return clone(state)}
 return {operation,submit,flush,getState,reviewRequired:()=>cfg?.reviewRequired?.()===true,inspect:()=>queue?queue.inspect():[]};}
return {createOperationalSync};});
