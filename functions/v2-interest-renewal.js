'use strict';
// Existing interest-only renewal, calculated and committed inside one server transaction.
const {createHash}=require('node:crypto'),F=require('./v2-financial-engine'),S=require('./v2-schedule-engine');
const ORG='v2-mi-cartera-pilot',SOURCE='V2_INTEREST_RENEWAL_ENDPOINT';
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code,message){throw Object.assign(new Error(message),{code})}
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))&&F.money(value)===value;
const moneySum=values=>{const cents=values.reduce((sum,value)=>sum+Math.round(value*100),0);return Number.isSafeInteger(cents)?cents/100:NaN};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const closed=value=>value?.noReplay===true||value?.administrativeClosure?.noReplay===true||value?.status==='CERRADO_ADMIN';
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value)}
function scheduleTotals(schedule){
 if(!Array.isArray(schedule)||!schedule.length)fail('failed-precondition','INVALID_SCHEDULE_BALANCE');
 const amounts=[],paids=[],balances=[];
 for(const row of schedule){
  if(!row||!date(row.date))fail('failed-precondition','INVALID_SCHEDULE_BALANCE');
  const paid=row.paid??0,balance=row.balance??F.money(row.amount-paid);
  if(!money(row.amount)||row.amount<=0||!money(paid)||!money(balance)||moneySum([paid,balance])!==row.amount)fail('failed-precondition','INVALID_SCHEDULE_BALANCE');
  amounts.push(row.amount);paids.push(paid);balances.push(balance);
 }
 const total=moneySum(amounts),paid=moneySum(paids),balance=moneySum(balances);
 if(!money(total)||!money(paid)||!money(balance))fail('failed-precondition','INVALID_SCHEDULE_BALANCE');
 return {total,paid,balance};
}
function createInterestRenewalService({runAtomic,now=()=>new Date().toISOString(),orgId=ORG}={}){
 if(typeof runAtomic!=='function'||orgId!==ORG)throw Error('V2_RENEWAL_SERVICE_CONFIG_REQUIRED');
 const path=(collection,key)=>'orgs/'+orgId+'/'+collection+'/'+key;
 async function execute(context,input){
  if(!context?.uid)fail('unauthenticated','AUTH_REQUIRED');
  const keys=['creditId','newCreditId','paymentId','entryId','operationId','expectedVersion','date','rate','term','freq','firstPaymentDate','restDay'];
  if(!id(context.uid)||!input||typeof input!=='object'||Array.isArray(input)||keys.some(key=>!Object.prototype.hasOwnProperty.call(input,key))||Object.keys(input).some(key=>![...keys,'extraPayments'].includes(key))||!['creditId','newCreditId','paymentId','entryId','operationId'].every(key=>id(input[key]))||input.creditId===input.newCreditId||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1||!date(input.date)||!date(input.firstPaymentDate)||input.firstPaymentDate<input.date||input.freq==='monthly'&&input.firstPaymentDate===input.date||!['daily','weekly','biweekly','monthly'].includes(input.freq)||typeof input.rate!=='number'||!Number.isFinite(input.rate)||input.rate<0||!Number.isInteger(input.term)||input.term<1||input.term>600||!(input.restDay===''||input.restDay===null||/^[0-6]$/.test(String(input.restDay))))fail('invalid-argument','INVALID_INTEREST_RENEWAL_REQUEST');
  const extras=input.extraPayments??[];
  if(!Array.isArray(extras)||extras.length>20||extras.some(row=>!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['date','amount'].includes(key))||!date(row.date)||row.date<input.date||!money(row.amount)||row.amount<=0))fail('invalid-argument','INVALID_RENEWAL_EXTRAS');
  const request=Object.fromEntries(keys.map(key=>[key,input[key]]));request.restDay=input.restDay==null?'':String(input.restDay);request.extraPayments=extras.map(row=>({date:row.date,amount:row.amount}));
  const uid=context.uid,requestKey=createHash('sha256').update(canonical({orgId,uid,...request})).digest('hex');
  return runAtomic(async tx=>{
   const member=await tx.get(path('members',uid));
   if(!member||member.active!==true||!['admin','supervisor'].includes(member.role))fail('permission-denied','V2_RENEWAL_MANAGER_REQUIRED');
   const old=await tx.get(path('credits',request.creditId)),existing=await tx.get(path('operations',request.operationId));
   if(existing){
    if(closed(existing))fail('failed-precondition','OPERATION_ADMINISTRATIVELY_CLOSED');
    const result=existing.result;
    if(existing.requestKey!==requestKey||existing.actorId!==uid||existing.type!=='INTEREST_RENEWAL'||existing.status!=='APPLIED')fail('already-exists','OPERATION_ID_COLLISION');
    const unverified=()=>fail('failed-precondition','RENEWAL_RECEIPT_NOT_VERIFIED'),before=result?.oldCredit,next=result?.newCredit,p=result?.payment,e=result?.entry,a=result?.audit,at=existing.appliedAt;
    if(existing.source!==SOURCE||existing.id!==request.operationId||existing.writeCount!==5||!before||!next||!p||!e||!a||canonical(Object.keys(result).sort())!==canonical(['oldCredit','newCredit','payment','entry','audit'].sort())||typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||existing.createdAt!==at)unverified();
    if(before.id!==request.creditId||before.version!==request.expectedVersion+1||before.status!==F.STATUS.RENEWED||before.renewedTo!==request.newCreditId||before.renewedAt!==request.date||before.updatedAt!==at||!['capital','total'].every(key=>money(before[key]))||!['principalPaid','interestPaid','penaltyPaid'].every(key=>money(before[key]??0))||Number(before.principalPaid||0)>before.capital||typeof before.rate!=='number'||!Number.isFinite(before.rate)||before.rate<0)unverified();
    const priorSchedule=scheduleTotals(before.schedule),capital=F.principalBalance(before),interest=F.money(capital*before.rate/100),paidBeforeInterest=F.money(Number(before.interestPaid||0)-p.amount),previousPaid=moneySum([Number(before.principalPaid||0),paidBeforeInterest]),expectedTotal=F.money(capital*(1+request.rate/100));
    if(!money(capital)||capital<=0||capital>priorSchedule.balance||!money(interest)||interest<=0||!money(paidBeforeInterest)||!money(previousPaid)||priorSchedule.total!==before.total||priorSchedule.paid!==previousPaid||!money(expectedTotal)||expectedTotal<=0)unverified();
    if(p.id!==request.paymentId||p.creditId!==request.creditId||p.clientId!==before.clientId||p.operationId!==request.operationId||p.userId!==uid||p.date!==request.date||p.concept!=='INTERES'||p.amount!==interest||p.capitalAmount!==0||p.interestAmount!==interest||p.penaltyAmount!==0||p.method!=='V2_SERVER'||p.version!==1||p.updatedAt!==at||p.routeId!==String(before.routeId||'')||p.workerId!==String(before.workerId||'').trim()||p.workerAttribution?.source!=='CREDIT_ASSIGNMENT_AT_RENEWAL'||p.workerAttribution?.capturedAt!==at)unverified();
    let expectedSchedule;try{expectedSchedule=S.generateWithExtras({total:expectedTotal,term:request.term,freq:request.freq,firstPaymentDate:request.firstPaymentDate,restDay:request.restDay,extraPayments:request.extraPayments})}catch(error){unverified()}
    if(next.id!==request.newCreditId||next.version!==1||next.status!==F.STATUS.ACTIVE||next.renewedFrom!==before.id||next.clientId!==before.clientId||next.capital!==capital||next.total!==expectedTotal||next.principalPaid!==0||next.interestPaid!==0||next.penaltyPaid!==0||next.date!==request.date||next.operationId!==request.operationId||next.rate!==request.rate||next.term!==request.term||next.freq!==request.freq||next.restDay!==request.restDay||next.requestedFirstPaymentDate!==request.firstPaymentDate||next.firstPaymentDate!==expectedSchedule[0]?.date||next.maturity!==expectedSchedule.at(-1)?.date||next.previousBalance!==priorSchedule.balance||next.netDisbursement!==0||next.renewalMode!=='INTEREST'||next.routeId!==p.routeId||next.workerId!==p.workerId||next.updatedAt!==at||canonical(next.schedule)!==canonical(expectedSchedule)||expectedSchedule.some(row=>!date(row.date)||!money(row.amount)||row.amount<=0)||before.beneficiaryReference!=null&&next.beneficiaryReference!==String(before.beneficiaryReference))unverified();
    if(e.id!==request.entryId||e.date!==request.date||e.type!=='INGRESO'||e.amount!==interest||e.concept!=='COBRO_INTERES'||e.ref!==p.id||e.routeId!==p.routeId||e.userId!==uid||e.operationId!==request.operationId||e.version!==1||e.updatedAt!==at)unverified();
    if(a.id!=='audit-'+request.operationId||a.at!==at||a.actorId!==uid||!['admin','supervisor'].includes(a.role)||a.action!=='INTEREST_RENEWAL'||a.entityType!=='CREDIT'||a.entityId!==next.id||a.operationId!==request.operationId||a.detail?.from!==before.id||a.detail?.interest!==interest||a.detail?.term!==request.term||a.detail?.freq!==request.freq||a.version!==1||a.updatedAt!==at)unverified();
    // Verify the immutable ledger, while keeping historical credit snapshots independent of later versions.
    for(const [collection,row] of [['payments',result.payment],['entries',result.entry],['audit',result.audit]]){
     const stored=await tx.get(path(collection,row.id));if(!stored||stored.tombstone||stored.deletedAt||canonical(stored)!==canonical(row))unverified();
    }
    return {status:'ALREADY_APPLIED',operation:clone(existing),result:clone(result)};
   }
   if(!old||old.id!==request.creditId||old.tombstone||old.deletedAt||closed(old)||old.status!==F.STATUS.ACTIVE||old.renewedTo)fail('failed-precondition','CREDIT_NOT_ACTIVE');
   if(old.version!==request.expectedVersion)fail('failed-precondition','VERSION_CONFLICT');
   if(!['capital','total'].every(key=>money(old[key]))||!['principalPaid','interestPaid','penaltyPaid'].every(key=>money(old[key]??0))||Number(old.principalPaid||0)>old.capital||typeof old.rate!=='number'||!Number.isFinite(old.rate)||old.rate<0)fail('failed-precondition','INVALID_CREDIT_BALANCES');
   const previousSchedule=scheduleTotals(old.schedule),previousBalance=previousSchedule.balance,previousPaid=moneySum([Number(old.principalPaid||0),Number(old.interestPaid||0)]);
   const capital=F.principalBalance(old),interest=F.money(capital*old.rate/100),total=F.money(capital*(1+request.rate/100));
   const renewedInterestPaid=moneySum([Number(old.interestPaid||0),interest]),renewedPaid=moneySum([Number(old.principalPaid||0),renewedInterestPaid]);
   if(!money(previousPaid)||previousSchedule.total!==old.total||previousSchedule.paid!==previousPaid||!money(previousBalance)||!money(capital)||capital<=0||capital>previousBalance||!money(interest)||interest<=0||!money(total)||total<=0||!money(renewedInterestPaid)||!money(renewedPaid))fail('failed-precondition','INVALID_RENEWAL_BALANCES');
   let schedule;try{schedule=S.generateWithExtras({total,term:request.term,freq:request.freq,firstPaymentDate:request.firstPaymentDate,restDay:request.restDay,extraPayments:request.extraPayments})}catch(error){fail('invalid-argument',error.message)}
   if(!schedule.length||schedule.some(row=>!date(row.date)||!money(row.amount)||row.amount<=0||row.paid!==0||row.balance!==row.amount)||moneySum(schedule.map(row=>row.amount))!==total)fail('invalid-argument','INVALID_RENEWAL_INSTALLMENT');
   const auditId='audit-'+request.operationId;
   for(const [collection,key] of [['credits',request.newCreditId],['payments',request.paymentId],['entries',request.entryId],['audit',auditId]])if(await tx.get(path(collection,key)))fail('already-exists','RENEWAL_DESTINATION_ALREADY_EXISTS');
   const timestamp=now();if(typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp))||new Date(timestamp).toISOString()!==timestamp)fail('failed-precondition','SERVER_TIME_UNAVAILABLE');
   const computed=F.interestRenewal(old,{interestAmount:interest,newCreditId:request.newCreditId,paymentId:request.paymentId,date:request.date,rate:request.rate,term:request.term,freq:request.freq,method:'V2_SERVER',operationId:request.operationId});
   if(computed.oldCredit.interestPaid!==renewedInterestPaid)fail('failed-precondition','INVALID_RENEWAL_BALANCES');
   const oldCredit={...computed.oldCredit,version:old.version+1,updatedAt:timestamp},newCredit={...computed.newCredit,routeId:String(old.routeId||''),workerId:String(old.workerId||'').trim(),renewalMode:'INTEREST',previousBalance,netDisbursement:0,restDay:request.restDay,requestedFirstPaymentDate:request.firstPaymentDate,firstPaymentDate:schedule[0].date,maturity:schedule.at(-1).date,schedule,updatedAt:timestamp};
   if(old.beneficiaryReference!=null)newCredit.beneficiaryReference=String(old.beneficiaryReference);
   delete oldCredit.__firestoreId;
   const payment={...computed.payment,version:1,userId:uid,routeId:newCredit.routeId,workerId:newCredit.workerId,workerAttribution:{source:'CREDIT_ASSIGNMENT_AT_RENEWAL',capturedAt:timestamp},updatedAt:timestamp};
   const entry={id:request.entryId,date:request.date,type:'INGRESO',amount:interest,concept:'COBRO_INTERES',ref:payment.id,routeId:payment.routeId,userId:uid,operationId:request.operationId,version:1,updatedAt:timestamp};
   const audit={id:auditId,at:timestamp,actorId:uid,role:member.role,action:'INTEREST_RENEWAL',entityType:'CREDIT',entityId:newCredit.id,operationId:request.operationId,detail:{from:old.id,interest,term:request.term,freq:request.freq},version:1,updatedAt:timestamp};
   const result={oldCredit,newCredit,payment,entry,audit},operation={id:request.operationId,type:'INTEREST_RENEWAL',source:SOURCE,actorId:uid,requestKey,status:'APPLIED',createdAt:timestamp,appliedAt:timestamp,writeCount:5,result:clone(result)};
   await tx.set(path('credits',oldCredit.id),oldCredit);
   for(const [collection,row] of [['credits',newCredit],['payments',payment],['entries',entry],['audit',audit],['operations',operation]])await tx.create(path(collection,row.id),row);
   return {status:'APPLIED',operation,result:clone(result)};
  });
 }
 return {execute};
}
module.exports={createInterestRenewalService,ORG,SOURCE};
