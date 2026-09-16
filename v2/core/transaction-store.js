// Mi Cartera PRO V2 — transactional persistence boundary.
// Adapter contract: runAtomic(async tx => { tx.get/set/delete... }).
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2Store=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const sid=v=>String(v??'').trim();
function assert(ok,msg){if(!ok)throw new Error(msg);}
function createStore(adapter){assert(adapter&&typeof adapter.runAtomic==='function','ATOMIC_ADAPTER_REQUIRED');
 async function execute(operation){assert(operation&&sid(operation.id),'OPERATION_ID_REQUIRED');assert(Array.isArray(operation.writes)&&operation.writes.length,'WRITES_REQUIRED');return adapter.runAtomic(async tx=>{const opPath=`operations/${sid(operation.id)}`;const existing=await tx.get(opPath);if(existing&&!existing.deletedAt)return {status:'ALREADY_APPLIED',operation:existing};const now=new Date().toISOString();for(const w of operation.writes){assert(w&&sid(w.path),'WRITE_PATH_REQUIRED');const current=await tx.get(w.path);if(w.expectedVersion!=null){const cv=Number(current?.version||0);assert(cv===Number(w.expectedVersion),'VERSION_CONFLICT');}if(w.kind==='delete'){await tx.set(w.path,{...(current||{}),deletedAt:now,tombstone:true,version:Number(current?.version||0)+1});}else{const next={...(w.data||{}),version:Number(w.data?.version??(Number(current?.version||0)+1)),updatedAt:now};await tx.set(w.path,next);}}
 const record={id:sid(operation.id),type:sid(operation.type),status:'APPLIED',createdAt:operation.createdAt||now,appliedAt:now,writeCount:operation.writes.length};await tx.set(opPath,record);return {status:'APPLIED',operation:record};});}
 return {execute};}
function write(path,data,expectedVersion){return {kind:'set',path:sid(path),data,expectedVersion};}
function tombstone(path,expectedVersion){return {kind:'delete',path:sid(path),expectedVersion};}
return {createStore,write,tombstone};
});