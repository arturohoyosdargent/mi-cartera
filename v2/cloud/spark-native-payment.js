// Spark payment protocol: immutable preparation, rule-checked schedule certificates,
// then one transaction for credit, receipt, cash, audit and idempotency record.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2SparkPayment=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const PROTOCOL='spark-payment-v1',CHUNK=1;
const clone=v=>JSON.parse(JSON.stringify(v));
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const requireValue=(ok,error)=>{if(!ok)throw Error(error)};
function cents(v){requireValue(typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&v===Math.round(v*100)/100,'INVALID_PAYMENT_CENTS');return Math.round(v*100)}
function clean(value){const copy=clone(value);delete copy.__firestoreId;delete copy.acceptedAt;return copy}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
function proposal(op,actorId){
 requireValue(key(op?.id)&&op.type==='PAYMENT'&&op.actorId===actorId,'SPARK_PAYMENT_ACTOR_OR_ID_INVALID');
 requireValue(Array.isArray(op.writes)&&op.writes.length===4,'INVALID_PAYMENT_WRITES');
 const find=collection=>{const list=op.writes.filter(w=>String(w.path).startsWith(collection+'/'));requireValue(list.length===1,'INVALID_PAYMENT_WRITES');const w=list[0],id=w.path.slice(collection.length+1);requireValue(key(id)&&w.data?.id===id,'INVALID_PAYMENT_PATH');return w};
 const c=find('credits'),p=find('payments'),e=find('entries'),a=find('audit');
 requireValue(c.kind==='set'&&Number.isInteger(c.expectedVersion)&&c.expectedVersion>=1&&c.data.version===c.expectedVersion+1,'INVALID_PAYMENT_VERSION');
 requireValue([p,e,a].every(w=>w.kind==='create'&&w.expectedVersion===0),'INVALID_PAYMENT_WRITES');
 const amountCents=cents(p.data.amount);requireValue(amountCents>0,'INVALID_PAYMENT_AMOUNT');
 requireValue(p.data.creditId===c.data.id&&p.data.clientId===c.data.clientId&&p.data.userId===actorId&&[op.id,'PAY|'+p.data.id].includes(p.data.operationId)&&e.data.ref===p.data.id&&cents(e.data.amount)===amountCents&&a.data.actorId===actorId&&a.data.operationId===op.id&&a.data.entityId===p.data.id,'INVALID_PAYMENT_LINK');
 return {id:op.id,protocol:PROTOCOL,actorId,creditId:c.data.id,paymentId:p.data.id,entryId:e.data.id,auditId:a.data.id,expectedVersion:c.expectedVersion,amountCents,
  credit:{...clean(c.data),nativePaymentOperationId:op.id},payment:{...clean(p.data),operationId:op.id,cashMovementId:e.data.id},entry:{...clean(e.data),actorId,operationId:op.id,creditId:c.data.id,cashAccountId:String(c.data.workerId||'')||'leader'},audit:{...clean(a.data),role:String(a.data.role).toLowerCase(),version:1}};
}
function certificates(p,before){
 requireValue(before?.id===p.creditId&&before.version===p.expectedVersion&&before.status==='ACTIVO'&&!before.renewedTo&&!before.tombstone&&!before.noReplay&&!before.administrativeClosure?.noReplay,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');
 const schedule=before.schedule,after=p.credit.schedule;requireValue(Array.isArray(schedule)&&schedule.length>0&&Array.isArray(after)&&after.length===schedule.length,'INVALID_PAYMENT_SCHEDULE');
 const total=schedule.reduce((sum,row)=>sum+cents(row.balance??row.amount),0),principal=cents(before.capital)-cents(before.principalPaid||0);
 requireValue(p.amountCents<=total&&total>0&&principal>=0&&principal<=total&&cents(before.principalPaid||0)>=0&&cents(before.interestPaid||0)>=0,'INVALID_PAYMENT_BASELINE_BALANCE');
 const capital=p.amountCents===total?principal:Math.min(principal,Math.round(p.amountCents*principal/total));
 requireValue(cents(p.payment.capitalAmount)===capital&&cents(p.payment.interestAmount)===p.amountCents-capital&&cents(p.payment.penaltyAmount||0)===0,'INVALID_PAYMENT_ALLOCATION');
 const result=[],applications=[];let sum=0;
 for(let start=0;start<schedule.length;start+=CHUNK){const prefix=[sum],applicationPrefix=[applications.length],end=Math.min(start+CHUNK,schedule.length);
  for(let i=start;i<end;i++){const old=schedule[i],bal=cents(old.balance??old.amount),paid=cents(old.paid||0),used=Math.min(bal,Math.max(0,p.amountCents-sum));requireValue(bal>=0&&paid>=0,'INVALID_PAYMENT_SCHEDULE');
   const expected=used?{...old,paid:(paid+used)/100,balance:(bal-used)/100,status:bal===used?'PAGADA':'PARCIAL'}:old;
   requireValue(canonical(clean(after[i]))===canonical(clean(expected)),'INVALID_PAYMENT_SCHEDULE_CHANGE');
   if(used)applications.push({number:i+1,amount:used/100,balanceBefore:bal/100,balanceAfter:(bal-used)/100,status:bal===used?'PAGADA':'PARCIAL'});
   sum+=bal;prefix.push(sum);applicationPrefix.push(applications.length);
  }
  result.push({id:p.id+'--'+result.length,operationId:p.id,actorId:p.actorId,creditId:p.creditId,expectedVersion:p.expectedVersion,index:result.length,start,end,prefix,applicationPrefix});
 }
 return result;
}
function createSparkPaymentStore({adapter,actorId,validateSession=()=>{},stamp,cash}={}){
 requireValue(adapter&&typeof adapter.runAtomic==='function'&&typeof stamp==='function'&&key(actorId),'SPARK_PAYMENT_ADAPTER_REQUIRED');
 const guard=op=>validateSession(op);
 function accepted(record,p,status){requireValue(record?.id===p.id&&record.type==='PAYMENT'&&record.protocol===PROTOCOL&&record.actorId===actorId&&record.status==='APPLIED'&&record.proposalId===p.id&&record.writeCount===4&&record.certificateId===p.id+'--'+(Math.ceil(p.credit.schedule.length/CHUNK)-1)&&record.appliedAt!=null,'SPARK_OPERATION_COLLISION');return {status,operation:record,result:{credit:p.credit,payment:p.payment,entry:p.entry,audit:p.audit}}}
 async function acceptedFromDb(tx,record,p){
  const out=accepted(record,p,'ALREADY_APPLIED');
  const credit=await tx.get('credits/'+p.creditId),certificate=await tx.get('paymentCertificates/'+record.certificateId);
  requireValue(certificate?.id===record.certificateId&&certificate.operationId===p.id&&certificate.actorId===actorId&&certificate.creditId===p.creditId&&certificate.expectedVersion===p.expectedVersion&&certificate.end===p.credit.schedule.length,'SPARK_CERTIFICATE_MISSING');
  for(const [collection,target] of [['payments',p.payment],['entries',p.entry],['audit',p.audit]]){
   const actual=await tx.get(collection+'/'+target.id);
   requireValue(actual&&canonical(clean(actual))===canonical(target)&&actual.acceptedAt!=null&&canonical(actual.acceptedAt)===canonical(record.appliedAt),'SPARK_FINANCIAL_COMPANION_MISSING');
  }
  requireValue(credit?.id===p.creditId&&Number.isInteger(credit.version)&&credit.version>=p.credit.version,'SPARK_FINANCIAL_COMPANION_MISSING');
  if(credit.version===p.credit.version)requireValue(canonical(clean(credit))===canonical(p.credit)&&credit.acceptedAt!=null&&canonical(credit.acceptedAt)===canonical(record.appliedAt),'SPARK_FINANCIAL_COMPANION_MISSING');
  return out;
 }
 async function execute(operation){try{
  guard(operation);const p=proposal(operation,actorId),proposalPath='paymentProposals/'+p.id,operationPath='operations/'+p.id;
  const initial=await adapter.runAtomic(async tx=>{guard(operation);const record=await tx.get(operationPath),saved=await tx.get(proposalPath);if(saved)requireValue(canonical(clean(saved))===canonical(p),'SPARK_OPERATION_COLLISION');if(record){requireValue(saved,'SPARK_OPERATION_COLLISION');return {accepted:await acceptedFromDb(tx,record,p)}}const before=await tx.get('credits/'+p.creditId);requireValue(before?.version===p.expectedVersion,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');const parts=certificates(p,before);guard(operation);if(!saved)await tx.set(proposalPath,p);return {parts}});
  guard(operation);if(initial.accepted)return initial.accepted;
  for(const part of initial.parts)await adapter.runAtomic(async tx=>{guard(operation);const before=await tx.get('credits/'+p.creditId),saved=await tx.get('paymentCertificates/'+part.id);requireValue(before?.version===p.expectedVersion,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');if(saved)requireValue(canonical(clean(saved))===canonical(part),'SPARK_CERTIFICATE_COLLISION');guard(operation);if(!saved)await tx.set('paymentCertificates/'+part.id,part)});
  const result=await adapter.runAtomic(async tx=>{guard(operation);const record=await tx.get(operationPath),saved=await tx.get(proposalPath);requireValue(saved&&canonical(clean(saved))===canonical(p),'SPARK_OPERATION_COLLISION');if(record)return acceptedFromDb(tx,record,p);
   const credit=await tx.get('credits/'+p.creditId),payment=await tx.get('payments/'+p.paymentId),entry=await tx.get('entries/'+p.entryId),audit=await tx.get('audit/'+p.auditId),certificate=await tx.get('paymentCertificates/'+initial.parts.at(-1).id);
   requireValue(credit?.version===p.expectedVersion,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');requireValue(!payment&&!entry&&!audit,'SPARK_FINANCIAL_DOCUMENT_EXISTS');requireValue(certificate&&canonical(clean(certificate))===canonical(initial.parts.at(-1)),'SPARK_CERTIFICATE_MISSING');
   requireValue(cash&&typeof cash.prepare==='function','SPARK_CASH_BASELINE_REQUIRED');const cashWrite=await cash.prepare(tx,{operationId:p.id,actorId,accountId:p.entry.cashAccountId,deltaCents:p.amountCents,date:p.payment.date});guard(operation);
   for(const [collection,data] of [['credits',p.credit],['payments',p.payment],['entries',p.entry],['audit',p.audit]])await tx.set(collection+'/'+data.id,{...data,acceptedAt:stamp()});
   if(typeof cash.commit==='function')await cash.commit(tx,cashWrite);else await tx.set(cashWrite.path,cashWrite.data);
   const value={id:p.id,type:'PAYMENT',protocol:PROTOCOL,actorId,status:'APPLIED',proposalId:p.id,certificateId:certificate.id,writeCount:4,appliedAt:stamp()};await tx.set(operationPath,value);guard(operation);return accepted(value,p,'APPLIED');
  });guard(operation);return result;
 }catch(error){throw Object.assign(error,{noQueue:!['unavailable','deadline-exceeded','network-request-failed'].includes(String(error?.code||'').replace(/^firestore\//,''))})}}
 return {execute};
}
return {PROTOCOL,CHUNK,cents,canonical,proposal,certificates,createSparkPaymentStore};
});
