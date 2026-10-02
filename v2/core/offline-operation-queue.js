// Durable operation queue. Web Locks protect read/modify/write across documents.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sync-errors.js'):root.MiCarteraV2SyncErrors,root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2OfflineQueue=api;})(typeof globalThis!=='undefined'?globalThis:this,function(E,root){'use strict';
const sid=v=>String(v??'').trim();
const stable=v=>JSON.stringify(normalize(v));function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v}function identity(op){const copy={...op};delete copy.createdAt;return stable(copy)}
function createQueue(storage,key='mi-cartera-v2-operations'){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('STORAGE_REQUIRED');
  if(!E?.classify)throw new Error('SYNC_ERROR_CLASSIFIER_REQUIRED');
  let busy=false;
  function read(){
    try{const value=JSON.parse(storage.getItem(key)||'[]');if(!Array.isArray(value))throw Error('not an array');return value;}
    catch(cause){throw Object.assign(new Error('QUEUE_STORAGE_INVALID: conserva los datos de la aplicación; la cola necesita revisión.'),{code:'QUEUE_STORAGE_INVALID',cause});}
  }
  const write=q=>storage.setItem(key,JSON.stringify(q));
  function locked(action){const locks=root.navigator?.locks;if(!locks?.request)return action();return locks.request('mi-cartera-v2-queue:'+key,{mode:'exclusive'},()=>{try{return {value:action()}}catch(error){return {error}}}).then(result=>{if(result.error)throw result.error;return result.value});}
  function enqueue(operation){
    const opId=sid(operation?.operationId||operation?.id);
    if(!operation||!opId)throw new Error('OPERATION_ID_REQUIRED');
    const copy=JSON.parse(JSON.stringify({...operation,operationId:opId}));
    return locked(()=>{
      const q=read(),found=q.find(x=>sid(x.operation?.operationId||x.operation?.id)===opId);
      if(found){if(identity(found.operation)!==identity(copy))throw Object.assign(Error('OPERATION_ID_COLLISION'),{code:'OPERATION_ID_COLLISION'});return found;}
      const item={id:opId,operation:copy,status:'PENDIENTE',attempts:0,nextAttemptAt:0,createdAt:new Date().toISOString(),lastError:null};
      q.push(item);write(q);return item;
    });
  }
  async function flush(executor,now=Date.now()){
    if(busy)return {status:'BUSY'};
    if(typeof executor!=='function')throw new Error('EXECUTOR_REQUIRED');
    busy=true;
    try{
      const q=read();let applied=0,failed=0,blocked=0,conflicts=0;
      for(const item of q){
        if(item.status==='SINCRONIZADO')continue;
        if(['BLOQUEADO','CONFLICTO'].includes(item.status)||Number(item.nextAttemptAt||0)>now)break;
        try{
          const result=await executor(item.operation);
          if(!['APPLIED','ALREADY_APPLIED','COMMITTED','ALREADY_COMMITTED','DUPLICATE'].includes(String(result?.status||'').toUpperCase()))throw new Error('UNKNOWN_EXECUTOR_RESULT');
          item.status='SINCRONIZADO';item.syncedAt=new Date().toISOString();item.lastError=null;applied++;
        }catch(error){
          item.attempts=Number(item.attempts||0)+1;item.lastError=String(error?.message||error);
          const classification=E.classify(error);
          if(classification.kind==='CONFLICT'){item.status='CONFLICTO';item.nextAttemptAt=0;conflicts++;}
          else if(!classification.retry){item.status='BLOQUEADO';item.nextAttemptAt=0;blocked++;}
          else{item.status='ERROR';item.nextAttemptAt=now+Math.min(300000,1000*Math.pow(2,Math.min(item.attempts,8)));failed++;}
          break;
        }
      }
      const merged=await locked(()=>{
        const fresh=read(),latest=new Map(fresh.map(x=>[x.id,x])),seen=new Set(q.map(x=>x.id));
        const merged=q.map(item=>latest.get(item.id)?.status==='SINCRONIZADO'?latest.get(item.id):item).concat(fresh.filter(x=>!seen.has(x.id)));
        write(merged);return merged;
      });
      return {status:'DONE',applied,failed,blocked,conflicts,pending:merged.filter(x=>!['SINCRONIZADO','BLOQUEADO','CONFLICTO'].includes(x.status)).length};
    }finally{busy=false;}
  }
  function inspect(){return read().map(x=>({id:x.id,type:x.operation?.type,status:x.status,attempts:x.attempts,nextAttemptAt:x.nextAttemptAt,lastError:x.lastError}));}
  return {enqueue,flush,inspect};
}
return {createQueue};
});
