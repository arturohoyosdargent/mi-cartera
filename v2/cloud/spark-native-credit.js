// Spark-native credit: immutable preparation and one-row proofs precede one financial transaction.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../core/schedule-engine.js'):root.MiCarteraV2Schedule);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2SparkCredit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(S){'use strict';
const PROTOCOL='spark-credit-v1',CHUNK=1,TYPES=['CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE'];
const clone=v=>JSON.parse(JSON.stringify(v)),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),need=(ok,error)=>{if(!ok)throw Error(error)};
function clean(v){const n=clone(v);delete n.__firestoreId;delete n.acceptedAt;return n}
function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)}
function cents(v){need(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=9000000000&&v===Math.round(v*100)/100,'INVALID_CREDIT_CENTS');return Math.round(v*100)}
const money=v=>Math.round(v*100)/100,closed=v=>!v||v.tombstone||v.noReplay||v.administrativeClosure?.noReplay||v.status==='CERRADO_ADMIN';
function day(v){need(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'INVALID_CREDIT_DATE');return v}
function proposal(op,actorId,context={}){
 need(key(op?.id)&&TYPES.includes(op.type)&&op.actorId===actorId,'SPARK_CREDIT_ACTOR_OR_ID_INVALID');need(Array.isArray(op.writes),'INVALID_CREDIT_WRITES');
 const writes=op.writes,paths=new Set();for(const w of writes){const parts=String(w.path||'').split('/');need(parts.length===2&&key(parts[1])&&w.data?.id===parts[1]&&!paths.has(w.path),'INVALID_CREDIT_PATH');paths.add(w.path);}
 const one=(col,kind,optional=false)=>{const rows=writes.filter(w=>w.path.startsWith(col+'/')&&(!kind||w.kind===kind));need(rows.length===(optional?Math.min(rows.length,1):1),'INVALID_CREDIT_WRITES');return rows[0]||null};
 const nc=one('credits','create'),oc=op.type==='CREDIT_CREATE'?null:one('credits','set'),pay=one('payments','create',true),entry=one('entries','create',true),expense=one('expenses','create',true),audit=one('audit','create');
 need([nc,pay,entry,expense,audit].filter(Boolean).every(w=>w.expectedVersion===0),'INVALID_CREDIT_VERSION');need(!oc||Number.isInteger(oc.expectedVersion)&&oc.expectedVersion>=1&&oc.data.version===oc.expectedVersion+1,'INVALID_CREDIT_VERSION');
 need(op.type==='CREDIT_CREATE'?writes.length===3&&!pay&&!entry&&expense:op.type==='INTEREST_RENEWAL'?writes.length===5&&pay&&entry&&!expense:writes.length===(expense?4:3)&&!pay&&!entry,'INVALID_CREDIT_WRITES');
 const credit={...clean(nc.data),nativeCreditOperationId:op.id},oldCredit=oc?{...clean(oc.data),nativeCreditOperationId:op.id}:null;
 const knownWorker=context.workerId!==undefined?String(context.workerId||''):String((context.source||context.client)?.workerId||'').trim();
 if(context.source||context.client||context.workerId!==undefined){need(credit.workerId===undefined||String(credit.workerId||'').trim()===knownWorker,'CREDIT_WORKER_ASSIGNMENT_MISMATCH');if(knownWorker||credit.workerId!==undefined)credit.workerId=knownWorker;if(oldCredit&&oldCredit.workerId===undefined&&knownWorker)oldCredit.workerId=knownWorker;}
 const a={...clean(audit.data),role:String(audit.data.role||'').toLowerCase(),version:1},action=op.type==='CREDIT_CREATE'?'CREDIT_CREATED':op.type==='REFINANCE'?'CREDIT_REFINANCED':op.type;
 need(['admin','supervisor'].includes(a.role),'SPARK_CREDIT_MANAGER_ROLE_REQUIRED');need(a.actorId===actorId&&a.operationId===op.id&&a.entityType==='CREDIT'&&a.entityId===credit.id&&a.action===action,'INVALID_CREDIT_AUDIT');
 function ledger(w){if(!w)return null;const d=clean(w.data);for(const [k,v]of Object.entries({actorId,operationId:op.id,creditId:credit.id,cashAccountId:'leader'}))need(d[k]===undefined||d[k]===v,'INVALID_CREDIT_CASH_REFERENCE');return {...d,actorId,operationId:op.id,creditId:credit.id,cashAccountId:'leader'}}
 const payment=pay?clean(pay.data):null;if(payment){need(payment.operationId===op.id||payment.operationId==='PAY|'+payment.id,'INVALID_CREDIT_PAYMENT_REFERENCE');payment.operationId=op.id;need(payment.userId===actorId,'INVALID_CREDIT_PAYMENT_ACTOR');}
 return {id:op.id,type:op.type,protocol:PROTOCOL,actorId,creditId:credit.id,oldCreditId:oldCredit?.id||'',expectedVersion:oc?.expectedVersion||0,extraTotalCents:credit.schedule.filter(r=>r.extra===true).reduce((sum,r)=>sum+cents(r.amount),0),paymentId:payment?.id||'',entryId:entry?.data.id||'',expenseId:expense?.data.id||'',auditId:a.id,credit,oldCredit,payment,entry:ledger(entry),expense:ledger(expense),audit:a};
}
function certificates(p,source,phase='new'){
 const rows=phase==='new'?p.credit.schedule:source?.schedule;if(phase==='old'&&(!Array.isArray(rows)||!rows.length))return [];
 need(Array.isArray(rows)&&rows.length>0,'INVALID_CREDIT_SCHEDULE');const result=[];let sum=0,regular=0,extra=0,lastDate='',lastRegularDate='';
 for(let i=0;i<rows.length;i++){
  const row=rows[i],amount=cents(row.amount),paid=cents(row.paid||0),balance=cents(row.balance??money(row.amount-(row.paid||0))),startSum=sum,startRegular=regular,startExtra=extra;
  need(amount>0&&paid>=0&&balance>=0&&paid+balance===amount,'INVALID_CREDIT_SCHEDULE_BALANCE');
  if(phase==='new'){day(row.date);need(row.date>lastDate&&paid===0&&balance===amount&&row.status==='PENDIENTE','INVALID_NEW_CREDIT_SCHEDULE');if(row.extra!==true){regular++;lastRegularDate=row.date}else extra+=amount;sum+=amount;}
  else sum+=balance;
  result.push({id:p.id+'--'+phase+'-'+i,operationId:p.id,actorId:p.actorId,phase,creditId:phase==='new'?p.creditId:p.oldCreditId,expectedVersion:phase==='new'?0:p.expectedVersion,index:i,start:i,end:i+1,prefix:[startSum,sum],regularPrefix:[startRegular,regular],extraPrefix:[startExtra,extra],lastRegularDate,lastDate:phase==='new'?row.date:''});if(phase==='new')lastDate=row.date;
 }
 if(phase==='new')need(sum===cents(p.credit.total)&&regular===p.credit.term&&(p.type==='CREDIT_CREATE'||p.credit.firstPaymentDate===rows[0].date)&&extra===p.extraTotalCents&&(!p.credit.maturity||p.credit.maturity===rows.at(-1).date),'INVALID_CREDIT_SCHEDULE_TOTAL');
 return result;
}
function validate(p,source,client){
 const c=p.credit;need(S&&typeof S.generateWithExtras==='function','SPARK_SCHEDULE_ENGINE_REQUIRED');const input={total:c.total,term:c.term,freq:c.freq,firstPaymentDate:c.requestedFirstPaymentDate||c.firstPaymentDate,restDay:c.restDay,extraPayments:c.schedule.filter(r=>r.extra===true).map(r=>({date:r.date,amount:r.amount}))};let exact;try{exact=S.generateWithExtras(input)}catch(e){throw Error('INVALID_CREDIT_SCHEDULE: '+e.message)}need(canonical(c.schedule)===canonical(exact),'INVALID_CREDIT_CANONICAL_SCHEDULE');need(c.version===1&&c.status==='ACTIVO'&&c.principalPaid===0&&c.interestPaid===0&&c.penaltyPaid===0,'INVALID_NEW_CREDIT_STATE');need(cents(c.capital)>0&&Number.isFinite(c.rate)&&c.rate>=0&&c.total===money(c.capital*(1+c.rate/100))&&cents(c.total)>0,'INVALID_CREDIT_TOTAL');need(Number.isInteger(c.term)&&c.term>=1&&['daily','weekly','biweekly','monthly'].includes(c.freq),'INVALID_CREDIT_TERMS');
 if(p.type==='CREDIT_CREATE'){
  need(!closed(client)&&client.id===c.clientId&&c.routeId===String(client.routeId||client.route||'').trim()&&String(c.workerId||'')===String(client.workerId||'').trim(),'CREDIT_CLIENT_SCOPE_MISMATCH');
  const e=p.expense;need(e&&e.type==='EGRESO'&&e.concept==='DESEMBOLSO_CREDITO'&&e.ref===c.id&&cents(e.amount)===cents(c.capital)&&e.routeId===c.routeId&&e.version===1,'INVALID_CREDIT_DISBURSEMENT');day(e.date);need(p.audit.detail?.accepted===true&&p.audit.detail.clientId===c.clientId&&p.audit.detail.capital===c.capital,'INVALID_CREDIT_ACCEPTANCE_AUDIT');
 }else{
  need(!closed(source)&&source.id===p.oldCreditId&&source.version===p.expectedVersion&&source.status==='ACTIVO'&&!source.renewedTo,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');
  need(c.clientId===source.clientId&&c.routeId===String(source.routeId||'')&&String(c.workerId||'')===String(source.workerId||'').trim()&&c.renewedFrom===source.id&&c.operationId===p.id,'CREDIT_RENEWAL_SCOPE_MISMATCH');day(c.date);
  const oldParts=certificates(p,source,'old'),balance=oldParts.length?oldParts.at(-1).prefix.at(-1):Math.max(0,cents(source.total)-cents(source.principalPaid||0)-cents(source.interestPaid||0)-cents(source.penaltyPaid||0));
  need(cents(c.previousBalance)===balance,'INVALID_RENEWAL_PREVIOUS_BALANCE');const principal=cents(source.capital)-cents(source.principalPaid||0),interest=money((principal/100)*(Number(source.rate||0)/100));need(principal>=0,'INVALID_RENEWAL_PRINCIPAL');
  const expected={...clean(source),status:'RENOVADO',renewedTo:c.id,renewedAt:c.date,version:source.version+1,nativeCreditOperationId:p.id};
  if(p.type==='INTEREST_RENEWAL'){
   expected.interestPaid=money(Number(source.interestPaid||0)+interest);need(interest>0&&cents(c.capital)===principal&&c.renewalMode==='INTEREST'&&c.netDisbursement===0,'INVALID_INTEREST_RENEWAL');
   const pay=p.payment,e=p.entry;need(pay&&pay.creditId===source.id&&pay.clientId===source.clientId&&pay.routeId===c.routeId&&String(pay.workerId||'')===String(source.workerId||'').trim()&&pay.workerAttribution?.source==='CREDIT_ASSIGNMENT_AT_RENEWAL'&&pay.date===c.date&&pay.concept==='INTERES'&&pay.capitalAmount===0&&pay.interestAmount===interest&&pay.penaltyAmount===0&&pay.amount===interest&&pay.version===1,'INVALID_RENEWAL_PAYMENT');
   need(e&&e.type==='INGRESO'&&e.concept==='COBRO_INTERES'&&e.ref===pay.id&&e.date===c.date&&e.amount===interest&&e.routeId===c.routeId&&e.version===1&&p.audit.detail?.interest===interest,'INVALID_RENEWAL_INTEREST_CASH');
  }else{
   const net=cents(c.capital)-balance;need(net>=0&&c.renewalMode==='REFINANCE'&&cents(c.netDisbursement)===net,'INVALID_REFINANCE_NET');need(net===0?!p.expense:p.expense&&p.expense.type==='EGRESO'&&p.expense.concept==='DESEMBOLSO_REFINANCIAMIENTO'&&p.expense.ref===c.id&&p.expense.date===c.date&&cents(p.expense.amount)===net&&p.expense.routeId===c.routeId&&p.expense.version===1,'INVALID_REFINANCE_DISBURSEMENT');need(p.audit.detail?.previousBalance===balance/100&&p.audit.detail.newCapital===c.capital&&p.audit.detail.cashDisbursed===net/100,'INVALID_REFINANCE_AUDIT');
  }
  need(canonical(p.oldCredit)===canonical(expected),'INVALID_OLD_CREDIT_TRANSITION');need(p.audit.detail?.from===source.id,'INVALID_RENEWAL_AUDIT');
 }
 return [...(p.type==='CREDIT_CREATE'?[]:certificates(p,source,'old')),...certificates(p,null,'new')];
}
const targets=p=>[...(p.oldCredit?[['credits',p.oldCredit]]:[]),['credits',p.credit],...(p.payment?[['payments',p.payment]]:[]),...(p.entry?[['entries',p.entry]]:[]),...(p.expense?[['expenses',p.expense]]:[]),['audit',p.audit]];
function authorizations(p){return ['context','ledger','audit'].map(kind=>({id:p.id+'--'+kind,protocol:PROTOCOL,operationId:p.id,actorId:p.actorId,creditId:p.creditId,expectedVersion:p.expectedVersion,kind}))}
function indexKey(c){need(key(c.clientId)&&Number.isInteger(c.term)&&c.term>0&&['daily','weekly','biweekly','monthly'].includes(c.freq),'INVALID_CREDIT_INDEX');return ['credit',c.clientId,cents(c.capital),cents(c.total),c.term,c.freq,day(c.firstPaymentDate)].join('--')}
function indexRecord(p,baselineId){return {id:indexKey(p.credit),protocol:'spark-credit-index-v1',recordType:'CREDIT_UNIQUENESS',state:'ACTIVE',clientId:p.credit.clientId,capitalCents:cents(p.credit.capital),totalCents:cents(p.credit.total),term:p.credit.term,freq:p.credit.freq,firstPaymentDate:p.credit.firstPaymentDate,creditId:p.creditId,operationId:p.id,actorId:p.actorId,baselineId,version:1}}
function createSparkCreditStore({adapter,actorId,validateSession=()=>{},stamp,cash}={}){
 need(adapter&&typeof adapter.runAtomic==='function'&&key(actorId)&&typeof stamp==='function','SPARK_CREDIT_ADAPTER_REQUIRED');
 need(cash&&typeof cash.prepare==='function','SPARK_CREDIT_CASH_ADAPTER_REQUIRED');
 const guard=op=>validateSession(op);
 function cashChange(p){const date=p.entry?.date||p.expense?.date||p.credit.date;day(date);return {operationId:p.id,actorId,accountId:'leader',deltaCents:p.entry?cents(p.entry.amount):-cents(p.expense?.amount||0),date}}
 async function prepareCash(tx,p){const value=await cash.prepare(tx,cashChange(p));need(value?.path==='financialControls/cash--leader'&&value.data&&typeof value.data==='object','SPARK_CREDIT_CASH_BASELINE_REQUIRED');return value}
 async function prepareIndex(tx,p){const release=await tx.get('financialControls/release'),path='financialControls/'+indexKey(p.credit),existing=await tx.get(path);need(release?.protocol==='SPARK_NATIVE_BASELINE'&&release.state==='ACTIVE'&&key(release.baselineId)&&release.creditIndexProtocol==='spark-credit-index-v1','SPARK_CREDIT_INDEX_BASELINE_REQUIRED');need(!existing,'SPARK_DUPLICATE_CREDIT');return {path,data:indexRecord(p,release.baselineId)}}
 function accepted(record,p,status){need(record?.id===p.id&&record.type===p.type&&record.protocol===PROTOCOL&&record.actorId===actorId&&record.status==='APPLIED'&&record.proposalId===p.id&&record.writeCount===targets(p).length&&!record.noReplay&&!record.administrativeClosure?.noReplay,'SPARK_OPERATION_COLLISION');return {status,operation:record,result:{credit:p.credit,oldCredit:p.oldCredit,payment:p.payment,entry:p.entry,expense:p.expense,audit:p.audit,writes:targets(p).map(([collection,data])=>({path:collection+'/'+data.id,data:clone(data)}))}}}
 async function verifyAccepted(tx,record,p){
  const result=accepted(record,p,'ALREADY_APPLIED'),newParts=certificates(p,null,'new'),oldParts=p.oldCredit?certificates(p,p.oldCredit,'old'):[],newLast=newParts.at(-1),oldLast=oldParts.at(-1);
  need(record.newCertificateId===newLast.id&&record.oldCertificateId===(oldLast?.id||''),'SPARK_OPERATION_COLLISION');
  for(const part of [newLast,oldLast].filter(Boolean)){const saved=await tx.get('creditCertificates/'+part.id);need(saved&&canonical(clean(saved))===canonical(part),'SPARK_CREDIT_CERTIFICATE_MISSING');}
  const savedIndex=await tx.get('financialControls/'+indexKey(p.credit));need(savedIndex&&key(savedIndex.baselineId)&&canonical(clean(savedIndex))===canonical(indexRecord(p,savedIndex.baselineId)),'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');
  for(const [collection,target]of targets(p)){
   const value=await tx.get(collection+'/'+target.id);need(value&&!closed(value),'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');
   if(collection==='credits'){
    need(value.version>=target.version,'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');if(value.version===target.version)need(canonical(clean(value))===canonical(target),'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');
    else for(const k of ['id','clientId','capital','total','renewedFrom','renewedTo','operationId'])if(target[k]!==undefined)need(value[k]===target[k],'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');
   }else need(canonical(clean(value))===canonical(target),'SPARK_CREDIT_ACCEPTANCE_INCOMPLETE');
  }return result;
 }
 async function execute(operation){try{
  guard(operation);need(key(operation?.id)&&operation.actorId===actorId,'SPARK_CREDIT_ACTOR_OR_ID_INVALID');let p;
  const initial=await adapter.runAtomic(async tx=>{
   guard(operation);const record=await tx.get('operations/'+operation.id),saved=await tx.get('creditProposals/'+operation.id);
   if(record){need(saved,'SPARK_OPERATION_COLLISION');p=proposal(operation,actorId,{workerId:saved.credit.workerId||''});need(canonical(clean(saved))===canonical(p),'SPARK_OPERATION_COLLISION');return {accepted:await verifyAccepted(tx,record,p)}}
   const raw=proposal(operation,actorId),source=raw.oldCreditId?await tx.get('credits/'+raw.oldCreditId):null,client=raw.oldCreditId?null:await tx.get('clients/'+raw.credit.clientId);
   p=proposal(operation,actorId,{source,client});const parts=validate(p,source,client);if(saved)need(canonical(clean(saved))===canonical(p),'SPARK_OPERATION_COLLISION');await prepareCash(tx,p);await prepareIndex(tx,p);guard(operation);if(!saved)await tx.set('creditProposals/'+p.id,p);return {parts};
  });guard(operation);if(initial.accepted)return initial.accepted;
  for(const proof of authorizations(p))await adapter.runAtomic(async tx=>{
   guard(operation);const source=p.oldCreditId?await tx.get('credits/'+p.oldCreditId):null,client=p.oldCreditId?null:await tx.get('clients/'+p.credit.clientId),saved=await tx.get('creditAuthorizations/'+proof.id);validate(p,source,client);if(saved)need(canonical(clean(saved))===canonical(proof),'SPARK_CREDIT_AUTHORIZATION_COLLISION');guard(operation);if(!saved)await tx.set('creditAuthorizations/'+proof.id,proof);
  });
  for(const part of initial.parts)for(const collection of (part.phase==='new'?['creditCalendars','creditCertificates']:['creditCertificates']))await adapter.runAtomic(async tx=>{
   guard(operation);const source=p.oldCreditId?await tx.get('credits/'+p.oldCreditId):null,client=p.oldCreditId?null:await tx.get('clients/'+p.credit.clientId),saved=await tx.get(collection+'/'+part.id);validate(p,source,client);if(saved)need(canonical(clean(saved))===canonical(part),'SPARK_CREDIT_CERTIFICATE_COLLISION');guard(operation);if(!saved)await tx.set(collection+'/'+part.id,part);
  });
  const result=await adapter.runAtomic(async tx=>{
   guard(operation);const record=await tx.get('operations/'+p.id),saved=await tx.get('creditProposals/'+p.id);need(saved&&canonical(clean(saved))===canonical(p),'SPARK_OPERATION_COLLISION');if(record)return verifyAccepted(tx,record,p);
   const source=p.oldCreditId?await tx.get('credits/'+p.oldCreditId):null,client=p.oldCreditId?null:await tx.get('clients/'+p.credit.clientId);validate(p,source,client);
   for(const [collection,data]of targets(p)){const current=await tx.get(collection+'/'+data.id);if(collection==='credits'&&data.id===p.oldCreditId)need(current?.version===p.expectedVersion,'SPARK_CREDIT_VERSION_OR_STATE_CHANGED');else need(!current,'SPARK_FINANCIAL_DOCUMENT_EXISTS');}
   const newLast=initial.parts.filter(x=>x.phase==='new').at(-1),oldLast=initial.parts.filter(x=>x.phase==='old').at(-1);
   for(const part of [newLast,oldLast].filter(Boolean)){const proof=await tx.get('creditCertificates/'+part.id);need(proof&&canonical(clean(proof))===canonical(part),'SPARK_CREDIT_CERTIFICATE_MISSING');}
   const cashWrite=await prepareCash(tx,p),indexWrite=await prepareIndex(tx,p);guard(operation);for(const [collection,data]of targets(p))await tx.set(collection+'/'+data.id,{...data,acceptedAt:stamp()});if(typeof cash.commit==='function')await cash.commit(tx,cashWrite);else await tx.set(cashWrite.path,cashWrite.data);await tx.set(indexWrite.path,{...indexWrite.data,acceptedAt:stamp()});
   const value={id:p.id,type:p.type,protocol:PROTOCOL,actorId,status:'APPLIED',proposalId:p.id,newCertificateId:newLast.id,oldCertificateId:oldLast?.id||'',writeCount:targets(p).length,appliedAt:stamp()};await tx.set('operations/'+p.id,value);guard(operation);return accepted(value,p,'APPLIED');
  });guard(operation);return result;
 }catch(error){throw Object.assign(error,{noQueue:!['unavailable','deadline-exceeded','network-request-failed'].includes(String(error?.code||'').replace(/^firestore\//,''))})}}
 return {execute};
}
return {PROTOCOL,CHUNK,TYPES,canonical,cents,proposal,certificates,authorizations,indexKey,indexRecord,validate,createSparkCreditStore};
});
