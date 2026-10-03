// Durable operation queue. Web Locks protect read/modify/write across documents.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sync-errors.js'):root.MiCarteraV2SyncErrors,root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2OfflineQueue=api;})(typeof globalThis!=='undefined'?globalThis:this,function(E,root){'use strict';
const sid=v=>String(v??'').trim();
const stable=v=>JSON.stringify(normalize(v));function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v}function identity(op){const copy={...op};delete copy.createdAt;return stable(copy)}
const CLOSED='CERRADO_ADMIN',ledgerKey=key=>'mi-cartera-v2-journal-admin-closures:'+key;
function incomingPayment(op){return op?.type==='PAYMENT'&&op.writes?.some(w=>w.path?.startsWith('payments/')&&w.kind==='create')&&op.writes.every(w=>w.path?.startsWith('payments/')&&w.kind==='create'||w.path?.startsWith('entries/')&&w.kind==='create'||w.path?.startsWith('audit/')&&w.kind==='create'||w.path?.startsWith('credits/')&&w.kind==='set'||w.path==='routes/leader-cash-revision'&&['create','set'].includes(w.kind))}
const metadataStore=()=>typeof module==='object'&&module.exports?require('./transaction-store.js'):root.MiCarteraV2Store;
function canResumeMetadata(item,closed){const proof=item.administrativeContinuation,T=metadataStore();return !isTerminal(item)&&proof?.kind==='NEW_METADATA_AFTER_ADMIN_CLOSURE'&&T?.isMetadataOperation?.(item.operation)===true&&proof.fingerprint===T.fingerprint(item.operation)&&proof.actorId===item.operation.actorId&&proof.closedIds?.length>0&&new Set(proof.closedIds).size===proof.closedIds.length&&proof.closedIds.every(id=>closed.some(x=>x.id===id&&x.administrativeClosure.actorId===proof.actorId&&Date.parse(item.createdAt)>=Date.parse(x.administrativeClosure.confirmedAt)))&&!closed.some(x=>x.id===item.id)}
function canResume(item,closed){if(canResumeMetadata(item,closed))return true;const proof=item.administrativeContinuation;return !isTerminal(item)&&incomingPayment(item.operation)&&proof?.kind==='NEW_PAYMENT_AFTER_ADMIN_CLOSURE'&&proof.actorId===item.operation.actorId&&proof.closedIds?.length===2&&new Set(proof.closedIds).size===2&&proof.closedIds.every(id=>closed.some(x=>x.id===id&&x.administrativeClosure.actorId===proof.actorId&&Date.parse(item.createdAt)>=Date.parse(x.administrativeClosure.confirmedAt)))&&!closed.some(x=>x.id===item.id)}
function isTerminal(item){return item?.status==='SINCRONIZADO'||item?.status===CLOSED&&item.administrativeClosure?.noReplay===true&&item.administrativeClosure?.serverApplied==='NOT_VERIFIED'}
function ledger(storage,key){let rows;try{rows=JSON.parse(storage.getItem(ledgerKey(key))||'[]');if(!Array.isArray(rows)||rows.some(x=>!x.id||!x.operation||x.administrativeClosure?.noReplay!==true||x.administrativeClosure?.serverApplied!=='NOT_VERIFIED')||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('invalid')}catch(cause){throw Object.assign(Error('QUEUE_CLOSURE_STORAGE_INVALID: conserva el diario y su exclusión administrativa.'),{code:'QUEUE_CLOSURE_STORAGE_INVALID',cause})}return rows}
function readJournal(storage,key,raw=storage.getItem(key)||'[]'){
 const rows=JSON.parse(raw),closed=ledger(storage,key);if(!Array.isArray(rows))throw Error('QUEUE_STORAGE_INVALID');
 return rows.map(row=>{const proof=closed.find(x=>x.id===row.id);if(proof){if(identity(proof.operation)!==identity(row.operation))throw Error('ADMINISTRATIVE_OPERATION_COLLISION');return {...row,status:CLOSED,administrativeClosure:proof.administrativeClosure}}if(row.status===CLOSED)throw Error('QUEUE_CLOSURE_PROOF_REQUIRED');return row});
}
function createQueue(storage,key='mi-cartera-v2-operations'){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('STORAGE_REQUIRED');
  if(!E?.classify)throw new Error('SYNC_ERROR_CLASSIFIER_REQUIRED');
  let busy=false;
  function read(){
    try{return readJournal(storage,key)}
    catch(cause){throw Object.assign(new Error('QUEUE_STORAGE_INVALID: conserva los datos de la aplicación; la cola necesita revisión.'),{code:'QUEUE_STORAGE_INVALID',cause});}
  }
  const write=q=>storage.setItem(key,JSON.stringify(q));
  function locked(action){const locks=root.navigator?.locks;if(!locks?.request)return action();return locks.request('mi-cartera-v2-queue:'+key,{mode:'exclusive'},async()=>{try{return {value:await action()}}catch(error){return {error}}}).then(result=>{if(result.error)throw result.error;return result.value});}
  function enqueue(operation){
    const opId=sid(operation?.operationId||operation?.id);
    if(!operation||!opId)throw new Error('OPERATION_ID_REQUIRED');
    const copy=JSON.parse(JSON.stringify({...operation,operationId:opId}));
    return locked(()=>{
      if(ledger(storage,key).some(x=>x.id===opId))throw Object.assign(Error('ADMINISTRATIVE_OPERATION_CLOSED: no reenviar ni recrear el cobro.'),{code:'ADMINISTRATIVE_OPERATION_CLOSED'});
      const q=read(),found=q.find(x=>sid(x.operation?.operationId||x.operation?.id)===opId);
      if(found){if(identity(found.operation)!==identity(copy))throw Object.assign(Error('OPERATION_ID_COLLISION'),{code:'OPERATION_ID_COLLISION'});return found;}
      const item={id:opId,operation:copy,status:'PENDIENTE',attempts:0,nextAttemptAt:0,createdAt:new Date().toISOString(),lastError:null},closed=ledger(storage,key);
      if(incomingPayment(copy)&&closed.length===2&&closed.every(x=>x.administrativeClosure.actorId===copy.actorId))item.administrativeContinuation={kind:'NEW_PAYMENT_AFTER_ADMIN_CLOSURE',actorId:copy.actorId,closedIds:closed.map(x=>x.id)};
      const T=metadataStore();if(closed.length&&closed.every(x=>x.administrativeClosure.actorId===copy.actorId)&&T?.isMetadataOperation?.(copy)===true)item.administrativeContinuation={kind:'NEW_METADATA_AFTER_ADMIN_CLOSURE',actorId:copy.actorId,closedIds:closed.map(x=>x.id),fingerprint:T.fingerprint(copy)};
      q.push(item);write(q);return item;
    });
  }
  async function administrativelyClose(options){
    if(!root.navigator?.locks?.request)throw Error('El cierre requiere acceso exclusivo al diario.');
    if(options?.confirmedByAdministrator!==true||options.reason!=='CLOUD_HTTP_429'||!options.actorId||typeof options.validate!=='function')throw Error('ADMINISTRATIVE_CONFIRMATION_REQUIRED');
    return locked(async()=>{
      options.validate();const raw=storage.getItem(key)||'[]';if(raw!==options.expectedRaw)throw Error('El diario cambió; se conserva completo.');
      const rows=read(),waiting=rows.filter(x=>!isTerminal(x)),ids=options.ids||[];
      if(ids.length!==2||new Set(ids).size!==2||waiting.length!==2||waiting.some(x=>!ids.includes(x.id)||x.operation?.type!=='PAYMENT'||x.operation?.actorId!==options.actorId||x.operation?.id!==x.id))throw Error('ADMINISTRATIVE_SCOPE_MISMATCH');
      options.validate();const at=new Date().toISOString(),backupKey='mi-cartera-v2-journal-review-backup:admin:'+key+':'+Date.now();
      if(storage.getItem(backupKey)!=null&&storage.getItem(backupKey)!==raw)throw Error('ADMINISTRATIVE_BACKUP_COLLISION');storage.setItem(backupKey,raw);
      const records=waiting.map(x=>({id:x.id,operation:x.operation,administrativeClosure:{kind:'ADMINISTRATIVE_LOCAL_CLOSURE',actorId:options.actorId,confirmedAt:at,reason:options.reason,reference:options.reference,previousStatus:x.status,serverApplied:'NOT_VERIFIED',noReplay:true,backupKey}}));
      const previous=ledger(storage,key);if(records.some(x=>previous.some(p=>p.id===x.id)))throw Error('ADMINISTRATIVE_OPERATION_CLOSED');
      options.validate();storage.setItem(ledgerKey(key),JSON.stringify(previous.concat(records)));
      // The exclusion ledger is authoritative even if the redundant queue status
      // cannot be rewritten (storage full). Original payloads are never changed.
      let metadataWritten=true;try{write(rows.map(x=>{const proof=records.find(p=>p.id===x.id);return proof?{...x,status:CLOSED,administrativeClosure:proof.administrativeClosure}:x}))}catch{metadataWritten=false}
      return {closed:records.length,pending:read().filter(x=>!isTerminal(x)).length,backupKey,ledgerKey:ledgerKey(key),metadataWritten};
    });
  }
  async function prepareForExecution(id,prepare){if(!root.navigator?.locks?.request)throw Error('FRESH_LEADER_REVISION_LOCK_REQUIRED');return locked(async()=>{
    const q=read(),item=q.find(x=>x.id===id);if(!item||isTerminal(item))throw Error('OPERATION_NOT_SENDABLE');
    if(!item.operation.requiresLeaderCashRevision)return JSON.parse(JSON.stringify(item.operation));
    if(typeof prepare!=='function')throw Error('FRESH_LEADER_REVISION_REQUIRED');
    const before=item.operation,prepared=await prepare(JSON.parse(JSON.stringify(before)));
    const business=op=>({...op,requiresLeaderCashRevision:undefined,writes:op.writes.filter(w=>w.path!=='routes/leader-cash-revision')});
    const guards=prepared?.writes?.filter(w=>w.path==='routes/leader-cash-revision')||[];
    if(prepared?.requiresLeaderCashRevision||stable(business(before))!==stable(business(prepared))||guards.length!==1||guards[0].data.version!==guards[0].expectedVersion+1)throw Error('QUEUED_PREPARATION_INVALID');
    item.operation=prepared;write(q);return JSON.parse(JSON.stringify(prepared));
  })}
  async function flush(executor,now=Date.now()){
    if(busy)return {status:'BUSY'};
    if(typeof executor!=='function')throw new Error('EXECUTOR_REQUIRED');
    busy=true;
    try{
      const q=read();let applied=0,failed=0,blocked=0,conflicts=0;
      if(q.every(isTerminal))return {status:'DONE',applied,failed,blocked,conflicts,pending:0};
      for(const item of q){
        const current=read().find(x=>x.id===item.id);if(!current)throw Error('QUEUE_ROW_MISSING');if(isTerminal(current))continue;
        if(['BLOQUEADO','CONFLICTO'].includes(current.status)||Number(current.nextAttemptAt||0)>now)break;
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
        const merged=q.map(item=>isTerminal(latest.get(item.id))?latest.get(item.id):item).concat(fresh.filter(x=>!seen.has(x.id)));
        write(merged);return merged;
      });
      return {status:'DONE',applied,failed,blocked,conflicts,pending:merged.filter(x=>!isTerminal(x)&&!['BLOQUEADO','CONFLICTO'].includes(x.status)).length};
    }finally{busy=false;}
  }
  function inspect(){const closed=ledger(storage,key);return read().map(x=>({id:x.id,type:x.operation?.type,status:x.status,attempts:x.attempts,nextAttemptAt:x.nextAttemptAt,lastError:x.lastError,administrativeClosure:x.administrativeClosure,resumeAfterAdministrativeClosure:canResume(x,closed)}));}
  return {enqueue,flush,inspect,administrativelyClose,prepareForExecution};
}
return {createQueue,isTerminal,readJournal,ledgerKey};
});
