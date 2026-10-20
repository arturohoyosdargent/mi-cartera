// Technical liquidity positions. Only the protected release may initialize them.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2SparkCash=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const PROTOCOL='spark-cash-v1',key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const need=(ok,message)=>{if(!ok)throw Error(message)};
function businessDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(new Date())}
function createSparkCash({stamp,increment,today=businessDate,validateSession=()=>{}}={}){
 need(typeof stamp==='function'&&typeof today==='function','SPARK_CASH_ADAPTER_REQUIRED');
 return {async prepare(tx,{operationId,actorId,accountId,deltaCents,date}){
  validateSession({id:operationId,actorId});
  need(key(operationId)&&key(actorId)&&key(accountId)&&Number.isSafeInteger(deltaCents)&&Math.abs(deltaCents)<=900000000000,'INVALID_SPARK_CASH_REQUEST');
  // Historical/future manual movements need their dated-liquidity contract.
  // Never reinterpret an unsupported accounting date as today's cash.
  need(date===today(),'SPARK_DATED_CASH_CONTRACT_REQUIRED');
  // A positive receipt needs no balance disclosure. Firestore rules validate the
  // existing protected baseline and exact increment in the same final transaction.
  if(deltaCents>0&&typeof increment==='function'&&typeof tx.update==='function')return {path:'financialControls/cash--'+accountId,kind:'update',data:{availableCents:increment(deltaCents),version:increment(1),lastOperationId:operationId,acceptedAt:stamp()}};
  const id='cash--'+accountId,path='financialControls/'+id,before=await tx.get(path);
  need(before&&before.id===id&&before.protocol===PROTOCOL&&before.recordType==='CASH_POSITION'&&before.accountId===accountId&&key(before.baselineId)&&before.asOf<=date&&/^\d{4}-\d{2}-\d{2}$/.test(before.asOf)&&Number.isInteger(before.version)&&before.version>=1&&Number.isSafeInteger(before.availableCents)&&before.availableCents>=0,'SPARK_CASH_BASELINE_REQUIRED');
  need(before.lastOperationId!==operationId,'SPARK_CASH_OPERATION_COLLISION');
  const availableCents=before.availableCents+deltaCents;
  need(Number.isSafeInteger(availableCents)&&availableCents>=0&&availableCents<=900000000000,'SPARK_CASH_INSUFFICIENT');
  validateSession({id:operationId,actorId});
  const data={...before,availableCents,version:before.version+1,lastOperationId:operationId,acceptedAt:stamp()};delete data.__firestoreId;
  return {path,data};
 },async commit(tx,write){need(write&&/^financialControls\/cash--[A-Za-z0-9_-]{1,100}$/.test(write.path),'INVALID_SPARK_CASH_WRITE');if(write.kind==='update'){need(typeof tx.update==='function','SPARK_CASH_UPDATE_ADAPTER_REQUIRED');await tx.update(write.path,write.data)}else await tx.set(write.path,write.data)}};
}
return {PROTOCOL,businessDate,createSparkCash};
});
