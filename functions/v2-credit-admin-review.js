'use strict';
const {createHash}=require('node:crypto'),C=require('./v2-commercial-model');
const ORG='v2-mi-cartera-pilot',clone=x=>JSON.parse(JSON.stringify(x)),validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x),closed=x=>x?.noReplay===true||x?.administrativeClosure?.noReplay===true||x?.status==='CERRADO_ADMIN';
function fail(code,message){throw Object.assign(Error(message),{code})}
function createCreditReviewService({runAtomic,now=()=>new Date().toISOString()}={}){
 if(typeof runAtomic!=='function')throw Error('ATOMIC_ADAPTER_REQUIRED');const path=(col,id)=>'orgs/'+ORG+'/'+col+(id?'/'+id:'');
 async function execute(context,input){
  if(!context?.uid)fail('unauthenticated','AUTH_REQUIRED');
  if(!validId(context.uid)||!input||Object.keys(input).some(k=>!['operationId','creditId','expectedCreditVersion','reason'].includes(k))||!validId(input.operationId)||!validId(input.creditId)||!Number.isInteger(input.expectedCreditVersion)||input.expectedCreditVersion<1||typeof input.reason!=='string'||input.reason.trim().length<10||input.reason.length>1000)fail('invalid-argument','INVALID_ADMIN_REVIEW_REQUEST');
  const request={operationId:input.operationId,creditId:input.creditId,expectedCreditVersion:input.expectedCreditVersion,reason:input.reason.trim()},requestKey=createHash('sha256').update(JSON.stringify({uid:context.uid,...request})).digest('hex');
  return runAtomic(async tx=>{
   const member=await tx.get(path('members',context.uid));if(member?.active!==true||!['admin','supervisor'].includes(member.role))fail('permission-denied','V2_REVIEW_MANAGER_REQUIRED');
   const existing=await tx.get(path('operations',request.operationId));if(existing){if(closed(existing))fail('failed-precondition','OPERATION_ADMINISTRATIVELY_CLOSED');if(existing.requestKey!==requestKey||existing.actorId!==context.uid||existing.type!=='CREDIT_ADMIN_REVIEW_REQUESTED'||existing.status!=='APPLIED'||!existing.result)fail('already-exists','OPERATION_ID_COLLISION');return {status:'ALREADY_APPLIED',operation:clone(existing),result:clone(existing.result)}}
   const credit=await tx.get(path('credits',request.creditId));if(!credit||credit.id!==request.creditId||credit.tombstone||closed(credit))fail('failed-precondition','CREDIT_NOT_REVIEWABLE');if(credit.version!==request.expectedCreditVersion)fail('failed-precondition','VERSION_CONFLICT');
   const reviewId='credit-admin-review-'+credit.id,auditId='audit-'+request.operationId;
   if(await tx.get(path('routes',reviewId)))fail('already-exists','REVIEW_ALREADY_REQUESTED');if(await tx.get(path('audit',auditId)))fail('already-exists','AUDIT_ALREADY_EXISTS');
   const payments=(await tx.list(path('payments'))).filter(p=>p.creditId===credit.id);if(!payments.length)fail('failed-precondition','PAYMENT_HISTORY_REQUIRED');
   const timestamp=now(),review={id:reviewId,recordType:'CREDIT_ADMIN_REVIEW',creditId:credit.id,creditVersion:credit.version,reason:request.reason,status:'PENDING',balanceAtRequest:C.creditBalance(credit),paymentCount:payments.length,requestedBy:context.uid,requestedAt:timestamp,operationId:request.operationId,version:1};
   const audit={id:auditId,at:timestamp,actorId:context.uid,role:member.role,action:'CREDIT_ADMIN_REVIEW_REQUESTED',entityType:'CREDIT',entityId:credit.id,operationId:request.operationId,detail:{reviewId,reason:review.reason,balanceAtRequest:review.balanceAtRequest,paymentCount:review.paymentCount,financialEffect:'NONE'},version:1};
   const result={review,audit},operation={id:request.operationId,type:'CREDIT_ADMIN_REVIEW_REQUESTED',actorId:context.uid,requestKey,status:'APPLIED',source:'V2_CREDIT_REVIEW_ENDPOINT',appliedAt:timestamp,writeCount:2,result};
   await tx.create(path('routes',review.id),review);await tx.create(path('audit',audit.id),audit);await tx.create(path('operations',operation.id),operation);return {status:'APPLIED',operation,result:clone(result)};
  });
 }
 return {execute};
}
function createCreditReviewCallable({db,HttpsError}){const service=createCreditReviewService({runAtomic:fn=>db.runTransaction(tx=>fn({get:async p=>{const s=await tx.get(db.doc(p));return s.exists?s.data():null},list:async p=>(await tx.get(db.collection(p))).docs.map(s=>s.data()),create:async(p,v)=>{tx.create(db.doc(p),v)}}))});return async request=>{try{return await service.execute({uid:request.auth?.uid},request.data)}catch(error){const codes=['unauthenticated','invalid-argument','permission-denied','failed-precondition','already-exists'];throw new HttpsError(codes.includes(error.code)?error.code:'internal',codes.includes(error.code)?error.message:'No se pudo confirmar la revisión administrativa.')}}}
module.exports={createCreditReviewService,createCreditReviewCallable};
