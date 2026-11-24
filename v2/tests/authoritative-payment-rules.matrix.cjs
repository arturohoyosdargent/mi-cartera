'use strict';
// Synthetic-only matrix shared by Rules API request generation and the local emulator.
const ORG='v2-mi-cartera-pilot',PREFIX='orgs/'+ORG+'/',ID='authority-fixture-',ROUTE=ID+'route',OTHER_ROUTE=ID+'foreign-route',WORKER=ID+'worker',CLIENT=ID+'client',CREDIT=ID+'credit',EXISTING_PAYMENT=ID+'historical-payment';
const roles=['admin','supervisor','cobrador','gestor'];
const actors=Object.fromEntries([...roles,'consulta','inactive','v1-only','nonmember'].map(role=>[role,ID+role]));
const credit={id:CREDIT,clientId:CLIENT,routeId:ROUTE,workerId:WORKER,capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-11-20',amount:120,paid:0,balance:120}]};
const payment={id:EXISTING_PAYMENT,creditId:CREDIT,clientId:CLIENT,userId:actors.cobrador,routeId:ROUTE,workerId:WORKER,amount:20,capitalAmount:16.67,interestAmount:3.33,concept:'CUOTA',version:1};
const entry={id:ID+'historical-entry',type:'INGRESO',concept:'COBRO_CUOTA',amount:20,ref:EXISTING_PAYMENT,workerId:WORKER,routeId:ROUTE,cashAccountId:WORKER,version:1};
const documents={
 [PREFIX+'routes/'+ROUTE]:{id:ROUTE,recordType:'ROUTE',active:true,workerId:WORKER},
 [PREFIX+'routes/'+OTHER_ROUTE]:{id:OTHER_ROUTE,recordType:'ROUTE',active:true,workerId:ID+'foreign-worker'},
 [PREFIX+'routes/'+WORKER]:{id:WORKER,recordType:'WORKER',active:true,authUid:actors.gestor,routeId:ROUTE,workerId:WORKER},
 [PREFIX+'routes/client-access-'+WORKER+'-'+CLIENT]:{id:'client-access-'+WORKER+'-'+CLIENT,recordType:'CLIENT_ACCESS',workerId:WORKER,clientId:CLIENT,active:true,creditCount:1},
 [PREFIX+'clients/'+CLIENT]:{id:CLIENT,name:'SYNTHETIC AUTHORITY CLIENT',routeId:ROUTE,workerId:WORKER,version:1},
 [PREFIX+'credits/'+CREDIT]:credit,
 [PREFIX+'payments/'+EXISTING_PAYMENT]:payment,
 [PREFIX+'entries/'+entry.id]:entry,
 ['users/'+actors['v1-only']]:{uid:actors['v1-only'],orgId:ORG,role:'admin',routeIds:[ROUTE],active:true}
};
for(const role of [...roles,'consulta'])documents[PREFIX+'members/'+actors[role]]={role,active:true,routeIds:[ROUTE],...(role==='gestor'?{workerId:WORKER}:{})};
documents[PREFIX+'members/'+actors.inactive]={role:'admin',active:false,routeIds:[ROUTE]};
const V1='authority-fixture-legacy-org',V1_PREFIX='orgs/'+V1+'/',V1_ADMIN=ID+'v1-admin',V1_COLLECTOR=ID+'v1-collector';
for(const [uid,role]of [[V1_ADMIN,'admin'],[V1_COLLECTOR,'cobrador']])documents['users/'+uid]={uid,orgId:V1,role,routeIds:[ROUTE],active:true};
documents[V1_PREFIX+'credits/'+CREDIT]=credit;
const cases=[];
function add(id,actor,method,suffix,{before,data,expectation='DENY',liveExpectation=expectation,afterDocuments={},extraBefore={}}={}){
 const documentPath=suffix.startsWith('users/')||suffix.startsWith('orgs/')?suffix:PREFIX+suffix;
 const beforeDocuments={...documents,...extraBefore};if(before!==undefined)beforeDocuments[documentPath]=before;
 else if(['create','update','delete'].includes(method))delete beforeDocuments[documentPath];
 const after={...beforeDocuments,...afterDocuments};if(data!==undefined)after[documentPath]=data;if(method==='delete')delete after[documentPath];
 cases.push({id,actor:actor===null?null:actors[actor]||actor,method,documentPath,data,beforeDocuments,afterDocuments:after,expectation,liveExpectation});
}
for(const role of roles){
 for(const action of ['PAYMENT_RECORDED','INTEREST_RENEWAL'])add(role+' cannot forge financial audit '+action,role,'create','audit/'+ID+role+'-audit-'+action,{data:{id:ID+role+'-audit-'+action,action,actorId:actors[role]},liveExpectation:'ALLOW'});
 for(const source of ['V2_PAYMENT_ENDPOINT','V2_INTEREST_RENEWAL_ENDPOINT'])add(role+' cannot forge financial audit source '+source,role,'create','audit/'+ID+role+'-audit-source-'+source,{data:{id:ID+role+'-audit-source-'+source,action:'WORKER_ASSIGNMENT',source,actorId:actors[role]},liveExpectation:'ALLOW'});
 for(const action of ['CREDIT_CREATED','CREDIT_REFINANCED','CREDIT_PAYMENT_PROMISE_SET','CLIENT_UPDATED'])add(role+' legitimate audit preserved '+action,role,'create','audit/'+ID+role+'-legitimate-'+action,{data:{id:ID+role+'-legitimate-'+action,action,actorId:actors[role]},expectation:'ALLOW'});
 for(const [label,amount,concept] of [['isolated',20,'CUOTA'],['negative',-20,'CUOTA'],['mora',5,'MORA'],['interest-renewal',10,'INTERES'],['reversal',-20,'CUOTA']]){
  const id=ID+role+'-'+label,record={...payment,id,userId:actors[role],amount,concept,cashMovementId:'entry-'+id,...(label==='reversal'?{recordType:'PAYMENT_REVERSAL',reversesPaymentId:EXISTING_PAYMENT}:{})};
  add(role+' payment '+label,role,'create','payments/'+id,{data:record,liveExpectation:'ALLOW'});
 }
 add(role+' payment update',role,'update','payments/'+EXISTING_PAYMENT,{before:payment,data:{...payment,amount:999}});
 add(role+' payment tombstone',role,'update','payments/'+EXISTING_PAYMENT,{before:payment,data:{...payment,tombstone:true,version:2}});
 add(role+' payment delete',role,'delete','payments/'+EXISTING_PAYMENT,{before:payment});
 for(const type of ['PAYMENT','INTEREST_RENEWAL','PAYMENT_REVERSE','PAYMENT_REVERSAL'])add(role+' cannot forge '+type+' receipt',role,'create','operations/'+ID+role+'-receipt-'+type,{data:{id:ID+role+'-receipt-'+type,type,actorId:actors[role],status:'APPLIED',requestKey:'SYNTHETIC-FORGEABLE-HASH',result:{credit,payment,entry}},liveExpectation:role==='cobrador'?'DENY':'ALLOW'});
 for(const source of ['V2_PAYMENT_ENDPOINT','V2_INTEREST_RENEWAL_ENDPOINT'])add(role+' cannot forge canonical source '+source,role,'create','operations/'+ID+role+'-source-'+source,{data:{id:ID+role+'-source-'+source,type:'WORKER_ASSIGNMENT',source,actorId:actors[role],status:'APPLIED'},liveExpectation:role==='cobrador'?'DENY':'ALLOW'});
 add(role+' cannot relabel authoritative receipt',role,'update','operations/'+ID+role+'-old-receipt',{before:{id:ID+role+'-old-receipt',type:'PAYMENT',source:'V2_PAYMENT_ENDPOINT',actorId:actors[role],status:'APPLIED'},data:{id:ID+role+'-old-receipt',type:'CREDIT_CREATE',actorId:actors[role],status:'APPLIED'},liveExpectation:['admin','supervisor'].includes(role)?'ALLOW':'DENY'});
 for(const concept of ['COBRO_CUOTA','COBRO_MORA','COBRO_INTERES']){
  const id=ID+role+'-'+concept,ref='pay-'+id,record={...entry,id,concept,ref,userId:actors[role]};
  const futurePayment={...payment,id:ref,userId:actors[role],cashMovementId:id};
  add(role+' direct cash '+concept,role,'create','entries/'+id,{data:record,afterDocuments:{[PREFIX+'payments/'+ref]:futurePayment},liveExpectation:role==='cobrador'||role==='gestor'&&concept==='COBRO_MORA'?'DENY':'ALLOW'});
 }
 for(const field of ['principalPaid','interestPaid','penaltyPaid','schedule','capital','total','status']){
  const changed=field==='schedule'?[{...credit.schedule[0],paid:120,balance:0}]:field==='status'?'PAGADO':999;
  add(role+' forged credit '+field,role,'update','credits/'+CREDIT,{before:credit,data:{...credit,[field]:changed,version:2},liveExpectation:role==='cobrador'?'DENY':'ALLOW'});
 }
 add(role+' relabel historical collection entry',role,'update','entries/'+entry.id,{before:entry,data:{...entry,concept:'APORTE_CAPITAL',version:2},liveExpectation:['admin','supervisor'].includes(role)?'ALLOW':'DENY'});
 const reversal={...payment,id:'reversal-'+EXISTING_PAYMENT,recordType:'PAYMENT_REVERSAL',reversesPaymentId:EXISTING_PAYMENT};
 add(role+' tombstone collection entry',role,'update','entries/'+entry.id,{before:entry,data:{...entry,tombstone:true,deletedAt:'2026-11-20T00:00:00.000Z',updatedAt:'2026-11-20T00:00:00.000Z',version:2},afterDocuments:{[PREFIX+'payments/'+reversal.id]:reversal},liveExpectation:role==='cobrador'?'DENY':'ALLOW'});
}
for(const role of ['consulta','inactive','v1-only','nonmember',null])add((role||'anonymous')+' cannot create V2 payment',role,'create','payments/'+ID+(role||'anonymous'),{data:payment});
for(const role of roles){
 add(role+' reads allowed payment',role,'get','payments/'+EXISTING_PAYMENT,{before:{...payment,userId:actors[role]},expectation:'ALLOW'});
 add(role+' reads assigned credit',role,'get','credits/'+CREDIT,{before:credit,expectation:'ALLOW'});
 add(role+' reads own member',role,'get','members/'+actors[role],{before:documents[PREFIX+'members/'+actors[role]],expectation:'ALLOW'});
 add(role+' cannot edit member',role,'update','members/'+actors[role],{before:documents[PREFIX+'members/'+actors[role]],data:{role:'admin',active:true,routeIds:[ROUTE]}});
}
for(const role of ['cobrador','gestor']){
 add(role+' cannot read other payment',role,'get','payments/'+ID+'foreign-payment',{before:{...payment,id:ID+'foreign-payment',workerId:ID+'foreign-worker',routeId:OTHER_ROUTE,userId:ID+'foreign-user'}});
 add(role+' cannot read foreign credit',role,'get','credits/'+ID+'foreign-credit',{before:{...credit,id:ID+'foreign-credit',workerId:ID+'foreign-worker',routeId:OTHER_ROUTE}});
}
for(const role of ['inactive','v1-only','nonmember',null])add((role||'anonymous')+' cannot read V2 credit',role,'get','credits/'+CREDIT,{before:credit});
for(const role of ['admin','supervisor','gestor']){
 add(role+' metadata operation receipt preserved',role,'create','operations/'+ID+role+'-metadata-receipt',{data:{id:ID+role+'-metadata-receipt',type:'WORKER_ASSIGNMENT',actorId:actors[role],status:'APPLIED'},expectation:'ALLOW'});
 add(role+' new unpaid credit',role,'create','credits/'+ID+role+'-new-credit',{data:{...credit,id:ID+role+'-new-credit'},expectation:'ALLOW'});
 add(role+' cannot seed paid aggregate',role,'create','credits/'+ID+role+'-new-paid-credit',{data:{...credit,id:ID+role+'-new-paid-credit',principalPaid:100},liveExpectation:'ALLOW'});
 add(role+' edits reference metadata',role,'update','credits/'+CREDIT,{before:credit,data:{...credit,beneficiaryReference:'SYNTHETIC METADATA',version:2},expectation:'ALLOW'});
 add(role+' credit logical deletion preserves financial fields',role,'update','credits/'+CREDIT,{before:credit,data:{...credit,tombstone:true,deletedAt:'2026-11-23T00:00:00.000Z',updatedAt:'2026-11-23T00:00:00.000Z',version:2},expectation:'ALLOW'});
 const promise={id:ID+'promise',installmentNumber:1,date:'2026-11-25',observation:'SYNTHETIC METADATA',amount:120,status:'ACTIVE',actorId:actors[role]};
 const promised={...credit,schedule:[{...credit.schedule[0],paymentPromise:promise}],paymentPromise:promise,version:2};
 add(role+' installment commitment metadata preserved',role,'update','credits/'+CREDIT,{before:credit,data:promised,expectation:'ALLOW'});
 add(role+' installment commitment cancellation preserved',role,'update','credits/'+CREDIT,{before:promised,data:{...promised,schedule:[{...promised.schedule[0],paymentPromise:{...promise,status:'CANCELLED'},paymentPromiseHistory:[promise]}],paymentPromise:null,version:3},expectation:'ALLOW'});
 add(role+' promise cannot hide paid balance change',role,'update','credits/'+CREDIT,{before:credit,data:{...promised,schedule:[{...promised.schedule[0],paid:120,balance:0}]},liveExpectation:'ALLOW'});
 const multiCredit={...credit,schedule:[1,2,3].map(number=>({...credit.schedule[0],number,date:'2026-11-'+(19+number)}))};
 const multiPromise={...promise,installmentNumber:2};
 const multiPromised={...multiCredit,schedule:multiCredit.schedule.map((row,i)=>i===1?{...row,paymentPromise:multiPromise}:row),version:2};
 add(role+' middle installment commitment preserved',role,'update','credits/'+CREDIT,{before:multiCredit,data:multiPromised,expectation:'ALLOW'});
 for(const position of [1,3])add(role+' '+(position===1?'first':'last')+' installment commitment preserved',role,'update','credits/'+CREDIT,{before:multiCredit,data:{...multiCredit,schedule:multiCredit.schedule.map((row,i)=>i===position-1?{...row,paymentPromise:{...promise,installmentNumber:position}}:row),version:2},expectation:'ALLOW'});
 add(role+' promise cannot reorder untouched installments',role,'update','credits/'+CREDIT,{before:multiCredit,data:{...multiPromised,schedule:[multiCredit.schedule[2],multiPromised.schedule[1],multiCredit.schedule[0]]},liveExpectation:'ALLOW'});
 add(role+' promise cannot change a second installment',role,'update','credits/'+CREDIT,{before:multiCredit,data:{...multiPromised,schedule:[{...multiCredit.schedule[0],balance:0},multiPromised.schedule[1],multiCredit.schedule[2]]},liveExpectation:'ALLOW'});
 const nextId=ID+role+'-refinance',next={...credit,id:nextId,renewedFrom:CREDIT,renewalMode:'REFINANCE',netDisbursement:0};
 add(role+' refinance preserves paid fields',role,'update','credits/'+CREDIT,{before:credit,data:{...credit,status:'RENOVADO',renewedTo:nextId,renewedAt:'2026-11-20',version:2},afterDocuments:{[PREFIX+'credits/'+nextId]:next},expectation:'ALLOW'});
 const oldMissingPaid={...credit};for(const key of ['principalPaid','interestPaid','penaltyPaid'])delete oldMissingPaid[key];
 add(role+' refinance normalizes absent paid aggregates to zero',role,'update','credits/'+CREDIT,{before:oldMissingPaid,data:{...credit,status:'RENOVADO',renewedTo:nextId,renewedAt:'2026-11-20',version:2},afterDocuments:{[PREFIX+'credits/'+nextId]:next},expectation:'ALLOW'});
}
for(const role of ['admin','supervisor']){
 add(role+' cannot promote metadata receipt to payment',role,'update','operations/'+ID+role+'-promoted-receipt',{before:{id:ID+role+'-promoted-receipt',type:'WORKER_ASSIGNMENT',actorId:actors[role]},data:{id:ID+role+'-promoted-receipt',type:'PAYMENT',actorId:actors[role],status:'APPLIED'},liveExpectation:'ALLOW'});
 add(role+' manager assignment metadata',role,'update','credits/'+CREDIT,{before:credit,data:{...credit,workerId:ID+'reassigned-worker',routeId:OTHER_ROUTE,version:2},expectation:'ALLOW'});
 add(role+' noncollection cash entry',role,'create','entries/'+ID+role+'-capital',{data:{id:ID+role+'-capital',type:'INGRESO',concept:'APORTE_CAPITAL',amount:500,version:1},expectation:'ALLOW'});
 add(role+' noncollection cash expense',role,'create','expenses/'+ID+role+'-expense',{data:{id:ID+role+'-expense',type:'EGRESO',category:'OTROS_GASTOS',concept:'SYNTHETIC OFFICE',amount:5,version:1},expectation:'ALLOW'});
 add(role+' Socios journal preserved',role,'create','entries/'+ID+role+'-partner',{data:{id:ID+role+'-partner',type:'INGRESO',category:'PRESTAMO_SOCIO',concept:'PRESTAMO_SOCIO',amount:500,partnerLoan:{id:ID+role+'-partner',principal:500,repayments:[],interestPayments:[]},version:1},expectation:'ALLOW'});
 for(const collection of ['capital','routes','cashClosures'])add(role+' '+collection+' deployed write preserved',role,'create',collection+'/'+ID+role+'-'+collection,{data:{id:ID+role+'-'+collection,amount:500,active:true,version:1},expectation:'ALLOW'});
 add(role+' noncollection expense logical deletion',role,'update','expenses/'+ID+role+'-expense',{before:{id:ID+role+'-expense',type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100},data:{id:ID+role+'-expense',type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,tombstone:true,version:2},expectation:'ALLOW'});
 add(role+' cannot relabel expense as collection',role,'update','expenses/'+ID+role+'-expense',{before:{id:ID+role+'-expense',type:'EGRESO',concept:'OTROS_GASTOS',amount:5},data:{id:ID+role+'-expense',type:'INGRESO',concept:'COBRO_CUOTA',amount:999},liveExpectation:'ALLOW'});
}
add('gestor retains WORKER document read','gestor','get','routes/'+WORKER,{before:documents[PREFIX+'routes/'+WORKER],expectation:'ALLOW'});
add('gestor retains assigned ROUTE document read','gestor','get','routes/'+ROUTE,{before:documents[PREFIX+'routes/'+ROUTE],expectation:'ALLOW'});
add('gestor retains contact access read','gestor','get','clients/'+CLIENT,{before:{...documents[PREFIX+'clients/'+CLIENT],workerId:ID+'foreign-worker'},expectation:'ALLOW'});
const disbursementId=ID+'gestor-disbursement',newCreditId=ID+'gestor-disbursement-credit';
add('gestor credit disbursement batch preserved','gestor','create','expenses/'+disbursementId,{data:{id:disbursementId,type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,ref:newCreditId,routeId:ROUTE,workerId:WORKER,cashAccountId:WORKER},afterDocuments:{[PREFIX+'credits/'+newCreditId]:{...credit,id:newCreditId,disbursementMovementId:disbursementId}},expectation:'ALLOW'});
add('gestor cannot forge contact classification','gestor','update','clients/'+CLIENT,{before:documents[PREFIX+'clients/'+CLIENT],data:{...documents[PREFIX+'clients/'+CLIENT],portfolioClassification:'BUENO'}});
add('collector cannot forge classification on create','cobrador','create','clients/'+ID+'forged-classification',{data:{id:ID+'forged-classification',routeId:ROUTE,portfolioClassification:'BUENO'}});
for(const role of ['admin','supervisor','gestor'])add(role+' cannot access unapproved V2 org',role,'get','orgs/v2-unapproved/credits/'+CREDIT,{before:credit});
const legacyPayment={...payment,userId:V1_COLLECTOR};
add('V1 admin payment create preserved',V1_ADMIN,'create',V1_PREFIX+'payments/'+ID+'legacy-create',{data:legacyPayment,expectation:'ALLOW'});
add('V1 collector own payment create preserved',V1_COLLECTOR,'create',V1_PREFIX+'payments/'+ID+'legacy-collector-create',{data:legacyPayment,expectation:'ALLOW'});
add('V1 admin payment update preserved',V1_ADMIN,'update',V1_PREFIX+'payments/'+ID+'legacy-update',{before:legacyPayment,data:{...legacyPayment,amount:99},expectation:'ALLOW'});
add('V1 admin payment delete preserved',V1_ADMIN,'delete',V1_PREFIX+'payments/'+ID+'legacy-delete',{before:legacyPayment,expectation:'ALLOW'});
add('V1 collector credit read preserved',V1_COLLECTOR,'get',V1_PREFIX+'credits/'+CREDIT,{before:credit,expectation:'ALLOW'});
module.exports={ORG,PREFIX,ID,ROUTE,OTHER_ROUTE,WORKER,CLIENT,CREDIT,EXISTING_PAYMENT,V1,V1_PREFIX,V1_ADMIN,V1_COLLECTOR,roles,actors,credit,payment,entry,documents,cases};
