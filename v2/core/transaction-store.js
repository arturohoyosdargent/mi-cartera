// Mi Cartera PRO V2 — transactional persistence boundary.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2Store=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const sid=v=>String(v??'').trim();
function assert(ok,msg){if(!ok)throw new Error(msg);}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().filter(k=>!['updatedAt','appliedAt'].includes(k)).map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function fingerprint(operation){let h=2166136261,s=canonical({id:sid(operation.id),type:sid(operation.type),writes:operation.writes});for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
// These writes contain only commercial metadata, never a financial snapshot.
function metadataFields(type,collection){if(type==='CREDIT_REFERENCE_UPDATED'&&collection==='credits')return ['id','version','beneficiaryReference'];if(type==='WORKER_ASSIGNMENT'&&['clients','credits'].includes(collection))return ['id','version','workerId','routeId','assignedAt',...(collection==='clients'?['route']:[])];return null}
function metadataRecordFields(type){return type==='CLIENT_ACCESS'?['id','recordType','workerId','clientId','routeId','creditCount','historicalPaymentCount','active','version']:type==='ASSIGNMENT'?['id','recordType','workerId','routeId','clientId','creditId','previousWorkerId','previousRouteId','effectiveAt','effectiveDate','version']:null}
function isMetadataOperation(op){
 if(!['WORKER_ASSIGNMENT','CREDIT_REFERENCE_UPDATED'].includes(op?.type)||!sid(op.actorId)||!Array.isArray(op.writes)||!op.writes.length)return false;
 const audit=op.writes.filter(w=>/^audit\/[^/]+$/.test(w.path)),detail=audit[0]?.data?.detail;
 if(audit.length!==1||audit[0].kind!=='create'||audit[0].expectedVersion!==0||audit[0].data.actorId!==op.actorId||audit[0].data.action!==op.type||!['admin','supervisor'].includes(String(audit[0].data.role).toLowerCase())||!detail)return false;
 let patches=0;
 for(const w of op.writes){const [col,key,...extra]=String(w.path||'').split('/');if(extra.length||!key||w.data?.id!==key||!Number.isInteger(w.expectedVersion)||w.expectedVersion<0)return false;
  if(['clients','credits'].includes(col)){const allowed=metadataFields(op.type,col);if(w.kind!=='metadata'||!allowed||Object.keys(w.data).some(k=>!allowed.includes(k))||Number(w.data.version)!==w.expectedVersion+1)return false;const base=op.type==='WORKER_ASSIGNMENT'?['workerId','routeId']:['beneficiaryReference'];if(!w.before||Object.keys(w.before).length!==base.length||base.some(k=>typeof w.before[k]!=='string'))return false;patches++;
   if(op.type==='CREDIT_REFERENCE_UPDATED'){if(key!==detail.creditId||w.clientId!==detail.clientId||typeof w.data.beneficiaryReference!=='string')return false}
   else if(w.clientId!==detail.clientId||w.data.workerId!==detail.workerId||w.data.routeId!==detail.routeId||w.data.assignedAt!==detail.effectiveAt||col==='clients'&&key!==detail.clientId||col==='credits'&&!detail.creditIds?.includes(key))return false;
  }else if(col==='routes'){
   if(op.type!=='WORKER_ASSIGNMENT'||!['create','set'].includes(w.kind)||Number(w.data.version)!==w.expectedVersion+1||w.data.clientId!==detail.clientId)return false;
   if(w.data.recordType==='ASSIGNMENT'){if(w.kind!=='create'||!detail.creditIds?.includes(w.data.creditId)||w.data.workerId!==detail.workerId||w.data.routeId!==detail.routeId||w.data.effectiveAt!==detail.effectiveAt||Object.keys(w.data).some(k=>!['id','recordType','workerId','routeId','clientId','creditId','previousWorkerId','previousRouteId','effectiveAt','effectiveDate','version'].includes(k)))return false}
   else if(w.data.recordType==='CLIENT_ACCESS'){if(!sid(w.data.workerId)||key!=='client-access-'+w.data.workerId+'-'+detail.clientId||typeof w.data.active!=='boolean'||!Number.isInteger(w.data.creditCount)||w.data.creditCount<0||!Number.isInteger(w.data.historicalPaymentCount)||w.data.historicalPaymentCount<0||Object.keys(w.data).some(k=>!['id','recordType','workerId','clientId','routeId','creditCount','historicalPaymentCount','active','version'].includes(k)))return false}
   else return false;
  }else if(col!=='audit')return false;
 }
 return patches>0&&(op.type!=='CREDIT_REFERENCE_UPDATED'||patches===1&&op.writes.length===2);
}
function createStore(adapter,options={}){assert(adapter&&typeof adapter.runAtomic==='function','ATOMIC_ADAPTER_REQUIRED');
 async function execute(operation){
 assert(operation&&sid(operation.id),'OPERATION_ID_REQUIRED');
 assert(Array.isArray(operation.writes)&&operation.writes.length,'WRITES_REQUIRED');
 if(operation.writes.some(w=>w.kind==='metadata'))assert(isMetadataOperation(operation),'INVALID_METADATA_OPERATION');
 const fp=fingerprint(operation);
 return adapter.runAtomic(async tx=>{
 const opPath=`operations/${sid(operation.id)}`,existing=await tx.get(opPath);
 if(existing&&!existing.deletedAt){assert(existing.fingerprint===fp,'OPERATION_ID_COLLISION');return {status:'ALREADY_APPLIED',operation:existing};}
 const now=new Date().toISOString(),prepared=[];
 if(operation.writes.some(w=>w.kind==='metadata')&&operation.type==='WORKER_ASSIGNMENT'){const detail=operation.writes.find(w=>w.path.startsWith('audit/')).data.detail;if(detail.workerId){const worker=await tx.get('routes/'+detail.workerId),route=await tx.get('routes/'+detail.routeId);assert(worker?.recordType==='WORKER'&&worker.active===true&&worker.routeId===detail.routeId&&route?.recordType==='ROUTE'&&route.active===true,'METADATA_WORKER_SCOPE_CHANGED')}}
 for(const w of operation.writes){
   assert(w&&sid(w.path),'WRITE_PATH_REQUIRED');
   const current=await tx.get(w.path),cv=Number(current?.version||0);
   if(w.expectedVersion!=null)assert(cv===Number(w.expectedVersion),'VERSION_CONFLICT');
   if(w.kind==='metadata')assert(Object.entries(w.before).every(([k,v])=>String(current?.[k]||'')===v),'METADATA_BASE_CHANGED');
   if(w.kind==='metadata')assert(current&&!current.tombstone&&sid(current.id)===sid(w.data.id)&&(w.path.startsWith('clients/')?sid(current.id):sid(current.clientId))===sid(w.clientId),'METADATA_DOCUMENT_SCOPE_MISMATCH');
   if(w.kind==='create')assert(!current||current.tombstone,'DOCUMENT_ALREADY_EXISTS');
   const requested=w.data?.version;
   if(w.kind!=='delete')assert(requested==null||Number(requested)===cv+1,'INVALID_NEXT_VERSION');
   // Payments are append-only in the deployed rules. Keep old queued delete
   // operations and their fingerprints intact, but persist a separate marker.
   let reversalPath=null;
   if(w.kind==='delete'&&/^payments\/[^/]+$/.test(w.path)){
     assert(current&&!current.tombstone&&current.recordType!=='PAYMENT_REVERSAL','PAYMENT_NOT_REVERSIBLE');
     reversalPath='payments/reversal-'+w.path.slice('payments/'.length);
     assert(!await tx.get(reversalPath),'PAYMENT_ALREADY_REVERSED');
   }
   prepared.push({w,current,cv,reversalPath});
 }
 options.validateSession?.(operation);
 for(const {w,current,cv,reversalPath} of prepared){
   if(reversalPath){
     await tx.set(reversalPath,{id:reversalPath.slice('payments/'.length),recordType:'PAYMENT_REVERSAL',reversesPaymentId:w.path.slice('payments/'.length),creditId:current.creditId||'',userId:current.userId||'',routeId:current.routeId||'',workerId:current.workerId||'',operationId:sid(operation.id),reversedAt:now,tombstone:true,version:1,updatedAt:now});
   }else if(w.kind==='delete'){
     await tx.set(w.path,{...(current||{}),deletedAt:now,tombstone:true,version:cv+1,updatedAt:now});
   }else{
     const value={...(w.kind==='metadata'?current:{}),...(w.data||{}),version:cv+1,updatedAt:now};if(w.kind==='metadata')delete value.__firestoreId;await tx.set(w.path,value);
   }
 }
 const record={id:sid(operation.id),type:sid(operation.type),actorId:sid(operation.actorId),fingerprint:fp,status:'APPLIED',createdAt:operation.createdAt||now,appliedAt:now,writeCount:operation.writes.length};await tx.set(opPath,record);options.validateSession?.(operation);return {status:'APPLIED',operation:record};});}
 return {execute};}
function write(path,data,expectedVersion){return {kind:'set',path:sid(path),data,expectedVersion};}
function create(path,data){return {kind:'create',path:sid(path),data,expectedVersion:0};}
function tombstone(path,expectedVersion){return {kind:'delete',path:sid(path),expectedVersion};}
return {createStore,write,create,tombstone,fingerprint,metadataFields,metadataRecordFields,isMetadataOperation};
});
