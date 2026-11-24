'use strict';
// Pure authoritative endpoint. The callable supplies verified Auth identity and an Admin transaction adapter.
const {createHash}=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const F=require('./v2-financial-engine');
const ORG='v2-mi-cartera-pilot',SOURCE='CREDIT_ASSIGNMENT_AT_PAYMENT';
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code,message){throw Object.assign(new Error(message),{code})}
function id(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)}
function closed(value){return value?.noReplay===true||value?.administrativeClosure?.noReplay===true||value?.status==='CERRADO_ADMIN'}
function validMoney(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))&&value===F.money(value)}
function moneySum(values){const cents=values.reduce((sum,value)=>sum+Math.round(value*100),0);return Number.isSafeInteger(cents)?cents/100:NaN}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00.000Z'))&&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value}
function createCollectorPaymentService({runAtomic,now=()=>new Date().toISOString(),businessDate,orgId=ORG}={}){
 if(typeof runAtomic!=='function'||typeof businessDate!=='function'||orgId!==ORG)throw Error('V2_PAYMENT_SERVICE_CONFIG_REQUIRED');
 const path=(collection,key)=>'orgs/'+orgId+'/'+collection+'/'+key;
 async function execute(context,input){
  if(!context?.uid)fail('unauthenticated','AUTH_REQUIRED');
  if(!id(context.uid))fail('invalid-argument','INVALID_ACTOR_ID');
  const keys=['creditId','paymentId','operationId','amount','expectedVersion'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>![...keys,'moraAmount','moraPaymentId'].includes(key))||keys.some(key=>!Object.prototype.hasOwnProperty.call(input,key))||!['creditId','paymentId','operationId'].every(key=>id(input[key]))||!validMoney(input.amount)||input.amount<=0||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1)fail('invalid-argument','INVALID_PAYMENT_REQUEST');
  const hasMora=Object.prototype.hasOwnProperty.call(input,'moraAmount'),hasMoraId=Object.prototype.hasOwnProperty.call(input,'moraPaymentId');
  if(hasMora&&!validMoney(input.moraAmount)||input.moraAmount>0&&(!id(input.moraPaymentId)||input.moraPaymentId===input.paymentId)||hasMoraId&&!(input.moraAmount>0))fail('invalid-argument','INVALID_PAYMENT_REQUEST');
  if(!validMoney(moneySum([input.amount,input.moraAmount||0])))fail('invalid-argument','INVALID_PAYMENT_REQUEST');
  const request=Object.fromEntries(keys.map(key=>[key,input[key]])),uid=context.uid;
  // Preserve the original five-field fingerprint for legacy and zero-mora retries.
  if(input.moraAmount>0)Object.assign(request,{moraAmount:input.moraAmount,moraPaymentId:input.moraPaymentId});
  const requestKey=createHash('sha256').update(JSON.stringify({orgId,uid,...request})).digest('hex');
  return runAtomic(async tx=>{
   const member=await tx.get(path('members',uid));
   if(!member||member.active!==true||!['admin','supervisor','cobrador'].includes(member.role))fail('permission-denied','V2_ACTIVE_MEMBER_REQUIRED');
   const credit=await tx.get(path('credits',request.creditId)),existing=await tx.get(path('operations',request.operationId));
   if(!credit||credit.id!==request.creditId||credit.tombstone||credit.deletedAt)fail('failed-precondition','CREDIT_NOT_FOUND');
   // An exact accepted retry acknowledges the original assignment without new writes.
   if(existing){
    if(closed(existing))fail('failed-precondition','OPERATION_ADMINISTRATIVELY_CLOSED');
    if(existing.requestKey!==requestKey||existing.actorId!==uid||existing.type!=='PAYMENT'||existing.status!=='APPLIED'||!existing.result)fail('already-exists','OPERATION_ID_COLLISION');
    const receipt=existing.result,p=receipt.payment,e=receipt.entry,a=receipt.audit,c=receipt.credit,withMora=request.moraAmount>0;
    const unverified=()=>fail('failed-precondition','PAYMENT_RECEIPT_UNVERIFIED');
    if(existing.source!=='V2_PAYMENT_ENDPOINT'||existing.id!==request.operationId||existing.writeCount!==(withMora?6:4)||!p||!e||!a||!c||!isDeepStrictEqual(Object.keys(receipt).sort(),(withMora?['credit','payment','entry','audit','moraPayment','moraEntry']:['credit','payment','entry','audit']).sort()))unverified();
    if(p.id!==request.paymentId||p.creditId!==request.creditId||p.operationId!==request.operationId||p.userId!==uid||p.amount!==request.amount||p.concept!=='CUOTA'||p.penaltyAmount!==0||!validMoney(p.capitalAmount)||!validMoney(p.interestAmount)||moneySum([p.capitalAmount,p.interestAmount])!==p.amount||!validMoney(p.balanceAfterPayment)||!validDate(p.date)||p.version!==1||p.method!=='V2_SERVER')unverified();
    if(c.id!==request.creditId||c.version!==request.expectedVersion+1||c.clientId!==p.clientId||String(c.routeId||'')!==p.routeId||String(c.workerId||'').trim()!==p.workerId||!Array.isArray(c.schedule)||!c.schedule.every(row=>row&&validMoney(row.balance))||moneySum(c.schedule.map(row=>row.balance))!==p.balanceAfterPayment)unverified();
    if(e.id!=='entry-'+request.paymentId||e.ref!==p.id||e.type!=='INGRESO'||e.concept!=='COBRO_CUOTA'||e.amount!==p.amount||e.date!==p.date||e.routeId!==p.routeId||e.operationId!==request.operationId||e.userId!==uid||e.version!==1)unverified();
    if(a.id!=='audit-'+request.operationId||a.actorId!==uid||a.action!=='PAYMENT_RECORDED'||a.entityType!=='PAYMENT'||a.entityId!==p.id||a.operationId!==request.operationId||a.detail?.creditId!==request.creditId||a.detail?.amount!==p.amount||a.detail?.capitalAmount!==p.capitalAmount||a.detail?.interestAmount!==p.interestAmount||a.detail?.routeId!==p.routeId||a.detail?.workerId!==p.workerId)unverified();
    const proof=[['payments',request.paymentId,p],['entries','entry-'+request.paymentId,e],['audit','audit-'+request.operationId,a]];
    if(withMora){
     const mp=receipt.moraPayment,me=receipt.moraEntry;
     if(!mp||!me||p.agreedMoraAmount!==request.moraAmount||p.moraPaymentId!==request.moraPaymentId||mp.id!==request.moraPaymentId||mp.normalPaymentId!==p.id||mp.operationId!==request.operationId+'-mora'||mp.creditId!==p.creditId||mp.clientId!==p.clientId||mp.date!==p.date||mp.userId!==uid||mp.routeId!==p.routeId||mp.workerId!==p.workerId||!isDeepStrictEqual(mp.workerAttribution,p.workerAttribution)||mp.amount!==request.moraAmount||mp.concept!=='MORA'||mp.capitalAmount!==0||mp.interestAmount!==0||mp.penaltyAmount!==request.moraAmount||mp.balanceAfterPayment!==p.balanceAfterPayment||mp.version!==1)unverified();
     if(me.id!=='entry-'+request.moraPaymentId||me.ref!==mp.id||me.amount!==mp.amount||me.type!=='INGRESO'||me.concept!=='COBRO_MORA'||me.date!==p.date||me.routeId!==p.routeId||me.operationId!==request.operationId+'-mora'||me.userId!==uid||me.version!==1||a.detail.moraAmount!==mp.amount||a.detail.moraPaymentId!==mp.id||a.detail.totalReceived!==moneySum([p.amount,mp.amount])||a.detail.moraWithinAgreement!==true)unverified();
     proof.push(['payments',request.moraPaymentId,mp],['entries','entry-'+request.moraPaymentId,me]);
    }else if(p.agreedMoraAmount!==undefined||p.moraPaymentId!==undefined)unverified();
    // The immutable ledger proves the receipt; current credit assignment/version may have advanced.
    for(const [collection,key,value] of proof){const persisted=await tx.get(path(collection,key));if(!persisted||persisted.tombstone||persisted.deletedAt||!isDeepStrictEqual(persisted,value))unverified();}
    return {status:'ALREADY_APPLIED',operation:clone(existing),result:clone(existing.result)};
   }
   if(request.moraAmount>0&&!['admin','supervisor'].includes(member.role))fail('permission-denied','MANUAL_MORA_REQUIRES_MANAGER');
   if(member.role==='cobrador'&&(!Array.isArray(member.routeIds)||typeof credit.routeId!=='string'||!member.routeIds.includes(credit.routeId)))fail('permission-denied','CREDIT_ROUTE_NOT_ASSIGNED');
   if(member.role==='cobrador'){
    const route=id(credit.routeId)?await tx.get(path('routes',credit.routeId)):null,worker=credit.workerId&&id(credit.workerId)?await tx.get(path('routes',credit.workerId)):null;
    if(route&&(route.recordType!=='ROUTE'||route.active!==true)||worker&&(worker.recordType!=='WORKER'||worker.active!==true||worker.routeId!==credit.routeId))fail('permission-denied','CREDIT_COMMERCIAL_ASSIGNMENT_INACTIVE');
   }
   if(closed(credit)||credit.status!==F.STATUS.ACTIVE||credit.renewedTo)fail('failed-precondition','CREDIT_NOT_ACTIVE');
   if(credit.version!==request.expectedVersion)fail('failed-precondition','VERSION_CONFLICT');
   if(!['capital','total'].every(key=>validMoney(credit[key]))||!['principalPaid','interestPaid','penaltyPaid'].every(key=>validMoney(credit[key]??0))||Number(credit.principalPaid||0)>credit.capital)fail('failed-precondition','INVALID_CREDIT_BALANCES');
   if(!Array.isArray(credit.schedule)||!credit.schedule.length)fail('failed-precondition','SCHEDULE_BALANCE_EMPTY');
   // Copy rows without JSON coercion: non-finite persisted numbers must be rejected, not defaulted.
   const schedule=credit.schedule.map(installment=>({...installment}));
   for(const installment of schedule){if(!installment||!validDate(installment.date))fail('failed-precondition','INVALID_SCHEDULE_DATE');const amount=installment.amount,paid=installment.paid??0,balance=installment.balance??F.money(amount-paid);if(!validMoney(amount)||amount<=0||!validMoney(paid)||!validMoney(balance)||paid>amount||balance>amount||Math.abs(F.money(paid+balance)-amount)>0.005)fail('failed-precondition','INVALID_SCHEDULE_BALANCE');installment.balance=F.money(balance);}
   const balance=moneySum(schedule.map(installment=>installment.balance));
   const scheduledTotal=moneySum(schedule.map(installment=>installment.amount)),scheduledPaid=moneySum(schedule.map(installment=>Number(installment.paid||0))),creditPaid=moneySum([Number(credit.principalPaid||0),Number(credit.interestPaid||0)]);
   if(!validMoney(balance)||!validMoney(scheduledTotal)||!validMoney(scheduledPaid)||!validMoney(creditPaid)||Math.abs(scheduledTotal-credit.total)>0.005||Math.abs(scheduledPaid-creditPaid)>0.005||F.money(credit.capital-Number(credit.principalPaid||0))>balance)fail('failed-precondition','INVALID_CREDIT_BALANCES');
   if(!(balance>0)||request.amount>balance)fail('failed-precondition','PAYMENT_EXCEEDS_SCHEDULE_BALANCE');
   const entryId='entry-'+request.paymentId,auditId='audit-'+request.operationId;
   const destinations=[['payments',request.paymentId],['entries',entryId],['audit',auditId]];
   if(request.moraAmount>0)destinations.push(['payments',request.moraPaymentId],['entries','entry-'+request.moraPaymentId]);
   for(const [collection,key] of destinations)if(await tx.get(path(collection,key)))fail('already-exists','PAYMENT_DESTINATION_ALREADY_EXISTS');
   let timestamp,date;try{timestamp=now();if(typeof timestamp==='string'&&Number.isFinite(Date.parse(timestamp)))date=businessDate(timestamp)}catch(error){fail('failed-precondition','BUSINESS_DATE_UNAVAILABLE')}
   if(!validDate(date))fail('failed-precondition','BUSINESS_DATE_UNAVAILABLE');
   if(request.moraAmount>0&&!schedule.some(installment=>installment.date<date&&installment.balance>0))fail('failed-precondition','MORA_REQUIRES_OVERDUE_INSTALLMENT');
   let allocated;try{allocated=F.allocateInstallment(credit,{id:request.paymentId,amount:request.amount,date,operationId:request.operationId,method:'V2_SERVER'},balance)}catch(error){fail('failed-precondition',error.message)}
   let left=request.amount,firstTouched=0,lastTouched=0;const applications=[];
   for(let i=0;i<schedule.length&&left>0;i++){const installment=schedule[i],before=installment.balance;if(before<=0)continue;const used=F.money(Math.min(left,before));if(!firstTouched)firstTouched=i+1;lastTouched=i+1;installment.paid=F.money(Number(installment.paid||0)+used);installment.balance=F.money(before-used);installment.status=installment.balance===0?'PAGADA':'PARCIAL';applications.push({number:i+1,amount:used,balanceBefore:before,balanceAfter:installment.balance,status:installment.status});left=F.money(left-used);}
   const next={...allocated.credit,schedule,updatedAt:timestamp};delete next.__firestoreId;
   const payment={...allocated.payment,version:1,userId:uid,routeId:String(credit.routeId||''),workerId:String(credit.workerId||'').trim(),workerAttribution:{source:SOURCE,capturedAt:timestamp},installmentNumber:firstTouched,installmentNo:firstTouched,installmentFrom:firstTouched,installmentTo:lastTouched,totalInstallments:schedule.length,installmentApplications:applications,balanceAfterPayment:F.money(balance-request.amount),updatedAt:timestamp};
   const entry={id:entryId,date,type:'INGRESO',amount:request.amount,concept:'COBRO_CUOTA',ref:payment.id,routeId:payment.routeId,operationId:request.operationId,userId:uid,version:1,updatedAt:timestamp};
   const audit={id:auditId,at:timestamp,actorId:uid,role:member.role,action:'PAYMENT_RECORDED',entityType:'PAYMENT',entityId:payment.id,operationId:request.operationId,detail:{creditId:credit.id,amount:payment.amount,capitalAmount:payment.capitalAmount,interestAmount:payment.interestAmount,routeId:payment.routeId,workerId:payment.workerId},version:1,updatedAt:timestamp};
   const result={credit:next,payment,entry,audit};
   if(request.moraAmount>0){
    Object.assign(payment,{agreedMoraAmount:request.moraAmount,moraPaymentId:request.moraPaymentId});
    result.moraPayment={id:request.moraPaymentId,operationId:request.operationId+'-mora',normalPaymentId:payment.id,creditId:credit.id,clientId:credit.clientId,date,amount:request.moraAmount,concept:'MORA',capitalAmount:0,interestAmount:0,penaltyAmount:request.moraAmount,userId:uid,routeId:payment.routeId,workerId:payment.workerId,workerAttribution:clone(payment.workerAttribution),balanceAfterPayment:payment.balanceAfterPayment,version:1,updatedAt:timestamp};
    result.moraEntry={id:'entry-'+request.moraPaymentId,date,type:'INGRESO',amount:request.moraAmount,concept:'COBRO_MORA',ref:request.moraPaymentId,routeId:payment.routeId,operationId:request.operationId+'-mora',userId:uid,version:1,updatedAt:timestamp};
    Object.assign(audit.detail,{moraAmount:request.moraAmount,moraPaymentId:request.moraPaymentId,totalReceived:moneySum([request.amount,request.moraAmount]),moraWithinAgreement:true});
   }
   const operation={id:request.operationId,type:'PAYMENT',source:'V2_PAYMENT_ENDPOINT',actorId:uid,requestKey,status:'APPLIED',createdAt:timestamp,appliedAt:timestamp,writeCount:request.moraAmount>0?6:4,result};
   await tx.set(path('credits',credit.id),next);
   const writes=[['payments',payment],['entries',entry],['audit',audit]];
   if(result.moraPayment)writes.push(['payments',result.moraPayment],['entries',result.moraEntry]);
   writes.push(['operations',operation]);
   for(const [collection,value] of writes)await tx.create(path(collection,value.id),value);
   return {status:'APPLIED',operation,result:clone(result)};
  });
 }
 return {execute};
}
module.exports={createCollectorPaymentService,ORG,SOURCE};
