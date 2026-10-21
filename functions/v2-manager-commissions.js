'use strict';
// Authoritative commission conditions and disbursements. Historical payments are read only.
const {createHash}=require('node:crypto'),C=require('./v2-commercial-model');
const ORG='v2-mi-cartera-pilot',clone=x=>JSON.parse(JSON.stringify(x));
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const closed=x=>x?.noReplay===true||x?.administrativeClosure?.noReplay===true||x?.status==='CERRADO_ADMIN';
function fail(code,message){throw Object.assign(Error(message),{code})}
function date(x){return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x}
function createCommissionService({runAtomic,now=()=>new Date().toISOString(),businessDate,orgId=ORG}={}){
 if(typeof runAtomic!=='function'||typeof businessDate!=='function'||orgId!==ORG)throw Error('V2_COMMISSION_CONFIG_REQUIRED');
 const path=(col,key)=>'orgs/'+orgId+'/'+col+(key?'/'+key:'');
 async function execute(context,input,type){
  if(!context?.uid)fail('unauthenticated','AUTH_REQUIRED');
  if(!validId(context.uid))fail('invalid-argument','INVALID_ACTOR_ID');
  const terms=type==='COMMISSION_TERMS_SAVED',allowed=terms?['operationId','workerId','expectedVersion','effectiveDate','mode','basis','rate','amount','periodDays']:['operationId','workerId','expectedVersion','amount'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k))||!validId(input.operationId)||!validId(input.workerId)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0)fail('invalid-argument','INVALID_COMMISSION_REQUEST');
  const timestamp=now(),today=businessDate(timestamp);if(!date(today))fail('failed-precondition','BUSINESS_DATE_UNAVAILABLE');
  const request=clone(input);
  if(terms){
   if(!date(input.effectiveDate))fail('invalid-argument','INVALID_EFFECTIVE_DATE');
   try{C.validateTerm(input)}catch(e){fail('invalid-argument',e.message)}
   const fields=input.mode==='PERCENT'?['rate']:['amount'];if(fields.some(k=>typeof input[k]!=='number'||!Number.isFinite(input[k])))fail('invalid-argument','INVALID_TERM_VALUE');
   if(input.mode!=='PERCENT'&&input.amount!==C.money(input.amount))fail('invalid-argument','INVALID_TERM_VALUE');
  }else if(typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<=0||input.amount!==C.money(input.amount))fail('invalid-argument','INVALID_COMMISSION_AMOUNT');
  const requestKey=createHash('sha256').update(JSON.stringify({type,actorId:context.uid,request:Object.fromEntries(Object.keys(request).sort().map(k=>[k,request[k]]))})).digest('hex');
  return runAtomic(async tx=>{
   const member=await tx.get(path('members',context.uid));
   if(member?.active!==true||!['admin','supervisor'].includes(member.role))fail('permission-denied','V2_COMMISSION_MANAGER_REQUIRED');
   const existing=await tx.get(path('operations',request.operationId));
   if(existing){if(closed(existing))fail('failed-precondition','OPERATION_ADMINISTRATIVELY_CLOSED');if(existing.requestKey!==requestKey||existing.actorId!==context.uid||existing.type!==type||existing.status!=='APPLIED'||!existing.result)fail('already-exists','OPERATION_ID_COLLISION');return {status:'ALREADY_APPLIED',operation:clone(existing),result:clone(existing.result)}}
   // Only new terms are date-sensitive; an exact accepted retry returns its original receipt.
   if(terms&&request.effectiveDate<today)fail('invalid-argument','INVALID_EFFECTIVE_DATE');
   const commercial=await tx.list(path('routes')),worker=C.records({commercial},'WORKER').find(w=>w.id===request.workerId),route=C.records({commercial},'ROUTE').find(r=>r.id===worker?.routeId);
   if(!worker||!route||terms&&(worker.active!==true||route.active!==true))fail('failed-precondition','WORKER_OR_ROUTE_INACTIVE');
   const positionId='commission-position-'+worker.id,old=commercial.find(x=>x.id===positionId);
   if(closed(old))fail('failed-precondition','COMMISSION_POSITION_CLOSED');
   if(Number(old?.version||0)!==request.expectedVersion)fail('failed-precondition','VERSION_CONFLICT');
   const position={id:positionId,recordType:'COMMISSION_POSITION',workerId:worker.id,version:request.expectedVersion+1,lastOperationId:request.operationId,updatedAt:timestamp};
   const auditId='audit-'+request.operationId,audit={id:auditId,at:timestamp,actorId:context.uid,role:member.role,action:type,entityType:'COMMISSION',entityId:worker.id,operationId:request.operationId,detail:{workerId:worker.id},version:1,updatedAt:timestamp};
   if(await tx.get(path('audit',auditId)))fail('already-exists','COMMISSION_DESTINATION_ALREADY_EXISTS');
   let result;
   if(terms){
    const previous=C.records({commercial},'TERM').filter(t=>t.workerId===worker.id);
    if(previous.some(t=>t.effectiveDate>=request.effectiveDate))fail('failed-precondition','EFFECTIVE_DATE_MUST_ADVANCE');
    const termId='commission-term-'+request.operationId;
    if(await tx.get(path('routes',termId)))fail('already-exists','COMMISSION_DESTINATION_ALREADY_EXISTS');
    const term={id:termId,recordType:'TERM',workerId:worker.id,routeId:worker.routeId,effectiveDate:request.effectiveDate,mode:request.mode,version:1,createdAt:timestamp,createdBy:context.uid};
    if(request.mode==='PERCENT'){term.basis=request.basis;term.rate=request.rate}else{term.amount=request.amount;if(request.mode==='FIXED_PERIOD')term.periodDays=request.periodDays}
    audit.detail={...audit.detail,termId:term.id,effectiveDate:term.effectiveDate,mode:term.mode};result={term,position,audit};
   }else{
    const payments=await tx.list(path('payments')),entries=await tx.list(path('entries')),expenses=await tx.list(path('expenses')),cashMovements=[...entries,...expenses];
    const state={commercial,payments,cashMovements},summary=C.summary(state,worker.id,today);
    if(request.amount>summary.commissionPending)fail('failed-precondition','COMMISSION_BALANCE_CHANGED');
    const cash=C.unique(cashMovements).filter(x=>(!x.cashAccountId||x.cashAccountId==='leader')&&String(x.date||today).slice(0,10)<=today);
    if(cash.some(x=>typeof x.amount!=='number'||!Number.isFinite(x.amount)||x.amount<0||!['INGRESO','EGRESO'].includes(x.type)))fail('failed-precondition','INVALID_CASH_LEDGER');
    const available=C.money(cash.reduce((n,x)=>n+(x.type==='INGRESO'?x.amount:-x.amount),0));
    if(request.amount>available)fail('failed-precondition','CASH_BALANCE_CHANGED');
    const expenseId='commission-'+request.operationId;
    if(await tx.get(path('expenses',expenseId)))fail('already-exists','COMMISSION_DESTINATION_ALREADY_EXISTS');
    const expense={id:expenseId,type:'EGRESO',category:'COMISION_GESTOR',concept:'COMISION_GESTOR',amount:request.amount,workerId:worker.id,routeId:worker.routeId,cashAccountId:'leader',commissionAllocations:C.allocateCommission(state,worker.id,today,request.amount),date:today,operationId:request.operationId,userId:context.uid,version:1,updatedAt:timestamp};
    audit.detail={...audit.detail,amount:request.amount,commissionGenerated:summary.commissionGenerated,commissionPaid:summary.commissionPaid,pendingBefore:summary.commissionPending,pendingAfter:C.money(summary.commissionPending-request.amount),allocations:expense.commissionAllocations};result={expense,position,audit};
   }
   const operation={id:request.operationId,type,source:'V2_COMMISSION_ENDPOINT',actorId:context.uid,requestKey,status:'APPLIED',createdAt:timestamp,appliedAt:timestamp,writeCount:3,result};
   if(result.term)await tx.create(path('routes',result.term.id),result.term);
   if(result.expense)await tx.create(path('expenses',result.expense.id),result.expense);
   await tx.set(path('routes',position.id),position);await tx.create(path('audit',audit.id),audit);await tx.create(path('operations',operation.id),operation);
   return {status:'APPLIED',operation,result:clone(result)};
  });
 }
 return {saveTerms:(context,input)=>execute(context,input,'COMMISSION_TERMS_SAVED'),settle:(context,input)=>execute(context,input,'COMMISSION_PAID')};
}
module.exports={createCommissionService,ORG};
