'use strict';
// Pure authoritative endpoint. The callable supplies verified Auth identity and an Admin transaction adapter.
const {createHash}=require('node:crypto');
const F=require('./v2-financial-engine');
const ORG='v2-mi-cartera-pilot',SOURCE='CREDIT_ASSIGNMENT_AT_PAYMENT';
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code,message){throw Object.assign(new Error(message),{code})}
function id(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)}
function closed(value){return value?.noReplay===true||value?.administrativeClosure?.noReplay===true||value?.status==='CERRADO_ADMIN'}
function createCollectorPaymentService({runAtomic,now=()=>new Date().toISOString(),businessDate,orgId=ORG}={}){
 if(typeof runAtomic!=='function'||typeof businessDate!=='function'||orgId!==ORG)throw Error('V2_PAYMENT_SERVICE_CONFIG_REQUIRED');
 const path=(collection,key)=>'orgs/'+orgId+'/'+collection+'/'+key;
 async function execute(context,input){
  if(!context?.uid)fail('unauthenticated','AUTH_REQUIRED');
  if(!id(context.uid))fail('invalid-argument','INVALID_ACTOR_ID');
  const keys=['creditId','paymentId','operationId','amount','expectedVersion'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key))||keys.some(key=>!Object.prototype.hasOwnProperty.call(input,key))||!['creditId','paymentId','operationId'].every(key=>id(input[key]))||typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<=0||Math.abs(input.amount-F.money(input.amount))>1e-9||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1)fail('invalid-argument','INVALID_PAYMENT_REQUEST');
  const request=Object.fromEntries(keys.map(key=>[key,input[key]])),uid=context.uid;
  const requestKey=createHash('sha256').update(JSON.stringify({orgId,uid,...request})).digest('hex');
  return runAtomic(async tx=>{
   const member=await tx.get(path('members',uid));
   if(!member||member.active!==true||!['admin','supervisor','cobrador'].includes(member.role))fail('permission-denied','V2_ACTIVE_MEMBER_REQUIRED');
   const credit=await tx.get(path('credits',request.creditId)),existing=await tx.get(path('operations',request.operationId));
   if(!credit||credit.id!==request.creditId||credit.tombstone)fail('failed-precondition','CREDIT_NOT_FOUND');
   // An exact accepted retry acknowledges the original assignment without new writes.
   if(existing){
    if(closed(existing))fail('failed-precondition','OPERATION_ADMINISTRATIVELY_CLOSED');
    if(existing.requestKey!==requestKey||existing.actorId!==uid||existing.type!=='PAYMENT'||existing.status!=='APPLIED'||!existing.result)fail('already-exists','OPERATION_ID_COLLISION');
    return {status:'ALREADY_APPLIED',operation:clone(existing),result:clone(existing.result)};
   }
   if(member.role==='cobrador'&&(!Array.isArray(member.routeIds)||typeof credit.routeId!=='string'||!member.routeIds.includes(credit.routeId)))fail('permission-denied','CREDIT_ROUTE_NOT_ASSIGNED');
   if(member.role==='cobrador'){
    const route=id(credit.routeId)?await tx.get(path('routes',credit.routeId)):null,worker=credit.workerId&&id(credit.workerId)?await tx.get(path('routes',credit.workerId)):null;
    if(route&&(route.recordType!=='ROUTE'||route.active!==true)||worker&&(worker.recordType!=='WORKER'||worker.active!==true||worker.routeId!==credit.routeId))fail('permission-denied','CREDIT_COMMERCIAL_ASSIGNMENT_INACTIVE');
   }
   if(closed(credit)||credit.status!==F.STATUS.ACTIVE||credit.renewedTo)fail('failed-precondition','CREDIT_NOT_ACTIVE');
   if(credit.version!==request.expectedVersion)fail('failed-precondition','VERSION_CONFLICT');
   if(!['capital','total','principalPaid','interestPaid','penaltyPaid'].every(key=>Number.isFinite(Number(credit[key]??0))&&Number(credit[key]??0)>=0))fail('failed-precondition','INVALID_CREDIT_BALANCES');
   if(!Array.isArray(credit.schedule)||!credit.schedule.length)fail('failed-precondition','SCHEDULE_BALANCE_EMPTY');
   const schedule=clone(credit.schedule);
   for(const installment of schedule){const amount=Number(installment.amount),paid=Number(installment.paid||0),balance=Number(installment.balance??(amount-paid));if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(paid)||paid<0||!Number.isFinite(balance)||balance<0||paid>amount||balance>amount||Math.abs(F.money(paid+balance)-F.money(amount))>0.005)fail('failed-precondition','INVALID_SCHEDULE_BALANCE');installment.balance=F.money(balance);}
   const balance=F.money(schedule.reduce((sum,installment)=>sum+installment.balance,0));
   if(!(balance>0)||request.amount>balance)fail('failed-precondition','PAYMENT_EXCEEDS_SCHEDULE_BALANCE');
   const entryId='entry-'+request.paymentId,auditId='audit-'+request.operationId;
   for(const [collection,key] of [['payments',request.paymentId],['entries',entryId],['audit',auditId]])if(await tx.get(path(collection,key)))fail('already-exists','PAYMENT_DESTINATION_ALREADY_EXISTS');
   const timestamp=now(),date=businessDate(timestamp);
   if(typeof timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('failed-precondition','BUSINESS_DATE_UNAVAILABLE');
   let allocated;try{allocated=F.allocateInstallment(credit,{id:request.paymentId,amount:request.amount,date,operationId:request.operationId,method:'V2_SERVER'},balance)}catch(error){fail('failed-precondition',error.message)}
   let left=request.amount,firstTouched=0,lastTouched=0;const applications=[];
   for(let i=0;i<schedule.length&&left>0;i++){const installment=schedule[i],before=installment.balance;if(before<=0)continue;const used=F.money(Math.min(left,before));if(!firstTouched)firstTouched=i+1;lastTouched=i+1;installment.paid=F.money(Number(installment.paid||0)+used);installment.balance=F.money(before-used);installment.status=installment.balance===0?'PAGADA':'PARCIAL';applications.push({number:i+1,amount:used,balanceBefore:before,balanceAfter:installment.balance,status:installment.status});left=F.money(left-used);}
   const next={...allocated.credit,schedule,updatedAt:timestamp};delete next.__firestoreId;
   const payment={...allocated.payment,version:1,userId:uid,routeId:String(credit.routeId||''),workerId:String(credit.workerId||'').trim(),workerAttribution:{source:SOURCE,capturedAt:timestamp},installmentNumber:firstTouched,installmentNo:firstTouched,installmentFrom:firstTouched,installmentTo:lastTouched,totalInstallments:schedule.length,installmentApplications:applications,balanceAfterPayment:F.money(balance-request.amount),updatedAt:timestamp};
   const entry={id:entryId,date,type:'INGRESO',amount:request.amount,concept:'COBRO_CUOTA',ref:payment.id,routeId:payment.routeId,operationId:request.operationId,userId:uid,version:1,updatedAt:timestamp};
   const audit={id:auditId,at:timestamp,actorId:uid,role:member.role,action:'PAYMENT_RECORDED',entityType:'PAYMENT',entityId:payment.id,operationId:request.operationId,detail:{creditId:credit.id,amount:payment.amount,capitalAmount:payment.capitalAmount,interestAmount:payment.interestAmount,routeId:payment.routeId,workerId:payment.workerId},version:1,updatedAt:timestamp};
   const result={credit:next,payment,entry,audit},operation={id:request.operationId,type:'PAYMENT',source:'V2_PAYMENT_ENDPOINT',actorId:uid,requestKey,status:'APPLIED',createdAt:timestamp,appliedAt:timestamp,writeCount:4,result};
   await tx.set(path('credits',credit.id),next);
   for(const [collection,value] of [['payments',payment],['entries',entry],['audit',audit],['operations',operation]])await tx.create(path(collection,value.id),value);
   return {status:'APPLIED',operation,result:clone(result)};
  });
 }
 return {execute};
}
module.exports={createCollectorPaymentService,ORG,SOURCE};
