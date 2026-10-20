// Mi Cartera PRO V2 — explicit Cloud runtime wiring. Never auto-connects to V1.
(function(root){'use strict';
function metadataSession(op){if(!['WORKER_ASSIGNMENT','ROUTE_SAVED','WORKER_SAVED'].includes(op?.type))return;if(typeof root.MiCarteraV2CommercialActions?.assertMetadataSession!=='function')throw Error('METADATA_AUTH_GUARD_REQUIRED');root.MiCarteraV2CommercialActions.assertMetadataSession(op)}
function configure(cfg){
 const version=root.MiCarteraV2VersionGuard,authGate=root.MiCarteraV2AuthCloudGate,pilot=root.MiCarteraV2PilotConfig;
 if(!version)throw new Error('V2_VERSION_GUARD_REQUIRED');version.requireReady();
 if(!authGate)throw new Error('V2_AUTH_CLOUD_GATE_REQUIRED');const auth=authGate.requireReady();
 if(!pilot)throw new Error('V2_PILOT_GATE_REQUIRED');const decision=pilot.evaluate(cfg);
 if(!decision.ready){const e=new Error('V2_PILOT_NOT_READY:'+decision.reasons.join(','));e.code='V2_PILOT_NOT_READY';e.reasons=decision.reasons;throw e;}
 const A=root.MiCarteraV2FirestoreAdapter,T=root.MiCarteraV2Store,Q=root.MiCarteraV2OfflineQueue,S=root.MiCarteraV2OperationalSync,B=root.MiCarteraV2SyncBridge;
 if(!A||!T||!Q||!S||!B)throw new Error('V2_CLOUD_MODULES_REQUIRED');
 if(!cfg?.orgId||!String(cfg.orgId).startsWith('v2-')||cfg.orgId==='mi-cartera')throw new Error('V2_ORG_ID_REQUIRED');
 if(cfg.orgId!=='v2-mi-cartera-pilot')throw new Error('V2_PILOT_ORG_MISMATCH');
 if(cfg.actorId&&cfg.actorId!==auth.uid)throw new Error('V2_ACTOR_AUTH_MISMATCH');
 const session=root.MiCarteraV2SessionStorage,sessionToken=session?.capture?.(),projectId=String(sessionToken?.projectId||root.MI_CARTERA_V2_FIREBASE_TEMPLATE?.projectId||root.firebaseSdkV2?.app?.options?.projectId||cfg.projectId||'');
 const safeCfg={...cfg,actorId:auth.uid},adapter=A.createFirestoreAtomicAdapter(safeCfg),genericStore=T.createStore(adapter,{validateSession:metadataSession});
 const authKey=current=>JSON.stringify([current.uid,current.role,current.workerId||'',(current.routeIds||[]).map(String).sort()]);
 const configuredAuth=authKey(auth);
 const backendMode=root.MI_CARTERA_V2_PILOT_CONFIG?.backendMode===undefined?'functions':root.MI_CARTERA_V2_PILOT_CONFIG.backendMode;
 if(!['functions','external','spark-native'].includes(backendMode))throw Error('V2_BACKEND_MODE_INVALID');
 const externalFinancial=backendMode==='external',financialEndpoint=externalFinancial?root.firebaseFunctionsV2?.recordFinancialOperation:null;
 const financialActions={CREDIT_CREATE:'CREDIT_CREATED',INTEREST_RENEWAL:'INTEREST_RENEWAL',REFINANCE:'CREDIT_REFINANCED',CASH_MOVEMENT:'CASH_MOVEMENT',PARTNER_LOAN_CREATED:'PARTNER_LOAN_CREATED',PARTNER_CONTACT_UPDATED:'PARTNER_CONTACT_UPDATED',PARTNER_INTEREST_PAID:'PARTNER_INTEREST_PAID',PARTNER_CAPITAL_RETURNED:'PARTNER_CAPITAL_RETURNED',PARTNER_SETTLED:'PARTNER_SETTLED'};
 function actor(operation){const current=authGate.requireReady();if(current.uid!==auth.uid||operation?.actorId&&operation.actorId!==current.uid)throw Error('V2_SYNC_ACTOR_CHANGED');if(sessionToken)session.assertCurrent(sessionToken);if(authKey(current)!==configuredAuth||authGate.ORG&&authGate.ORG!==safeCfg.orgId||projectId&&String(root.MI_CARTERA_V2_FIREBASE_TEMPLATE?.projectId||root.firebaseSdkV2?.app?.options?.projectId||cfg.projectId||'')!==projectId)throw Error('V2_SYNC_SCOPE_CHANGED');return authKey(current)}
 const nativeCash=backendMode==='spark-native'?root.MiCarteraV2SparkCash?.createSparkCash({validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,increment:root.firestoreV2?.increment}):null;
 const nativePayment=backendMode==='spark-native'?root.MiCarteraV2SparkPayment?.createSparkPaymentStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,cash:nativeCash}):null;
 const nativeCredit=backendMode==='spark-native'?root.MiCarteraV2SparkCredit?.createSparkCreditStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,cash:nativeCash}):null;
 const nativePartners=backendMode==='spark-native'?root.MiCarteraV2SparkPartners?.createSparkPartnerStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,today:root.MiCarteraV2SparkCash.businessDate,cash:nativeCash}):null;
 if(backendMode==='spark-native'&&!nativePayment)throw Error('V2_SPARK_PAYMENT_MODULE_REQUIRED');
 function nativeSubmit(store,operation){if(root.navigator.onLine===false)throw Object.assign(Error('Sin conexión. La operación queda pendiente de confirmación.'),{code:'unavailable',noQueue:false});return store.execute(operation)}
 function nativePending(){throw Object.assign(Error('Esta operación todavía no está habilitada en la versión de pruebas. No se registró ningún movimiento.'),{code:'V2_SPARK_CONTRACT_PENDING',noQueue:true})}
 const copy=value=>JSON.parse(JSON.stringify(value)),canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
 function financialFailure(){throw Error('V2_FINANCIAL_ACK_INVALID')}
 function iso(value){if(typeof value!=='string')return false;try{return new Date(value).toISOString()===value}catch(_){return false}}
 function financialData(value,audit,expected){
  if(!value||typeof value!=='object'||Array.isArray(value))financialFailure();const normalized=copy(value);
  for(const key of ['createdAt','updatedAt']){if(!expected&&Object.prototype.hasOwnProperty.call(normalized,key)&&!iso(normalized[key]))financialFailure();delete normalized[key];}
  if(audit){
   if(normalized.actorId!==auth.uid||String(normalized.role||'').toLowerCase()!==String(auth.role||'').toLowerCase())financialFailure();
   if(!expected&&!iso(normalized.at))financialFailure();delete normalized.at;normalized.role=String(normalized.role).toLowerCase();
   if(expected&&normalized.version===undefined)normalized.version=1;if(normalized.version!==1)financialFailure();
  }
  return canonical(normalized);
 }
 async function serverFinancial(operation){
  try{
   const expected=copy(operation),expectedScope=actor(expected);
   if(typeof financialEndpoint!=='function')throw Error('V2_FINANCIAL_ENDPOINT_NOT_CONFIGURED');
   const action=Object.prototype.hasOwnProperty.call(financialActions,expected.type)?financialActions[expected.type]:null;
   if(!action||expected.actorId!==auth.uid||!Array.isArray(expected.writes)||!expected.writes.length)throw Error('INVALID_V2_FINANCIAL_OPERATION');
   const paths=new Set(),audits=[];
   for(const write of expected.writes){
    if(!write||! /^(credits|payments|entries|expenses|audit)\/[A-Za-z0-9_-]{1,100}$/.test(write.path)||paths.has(write.path)||!['create','set'].includes(write.kind)||!Number.isInteger(write.expectedVersion)||write.expectedVersion<0||write.data?.id!==write.path.split('/')[1])throw Error('INVALID_V2_FINANCIAL_OPERATION');
    paths.add(write.path);if(write.path.startsWith('audit/'))audits.push(write);
   }
   if(audits.length!==1||audits[0].kind!=='create'||audits[0].expectedVersion!==0||audits[0].data.operationId!==expected.id||audits[0].data.action!==action)throw Error('INVALID_V2_FINANCIAL_OPERATION');
   financialData(audits[0].data,true,true);
   const response=await financialEndpoint(copy(expected));
   if(actor(expected)!==expectedScope)throw Error('V2_FINANCIAL_SESSION_CHANGED');
   const record=response?.operation,writes=response?.result?.writes;
   if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||record?.id!==expected.id||record.type!==expected.type||record.actorId!==auth.uid||record.status!=='APPLIED'||record.writeCount!==expected.writes.length||!Array.isArray(writes)||writes.length!==expected.writes.length)financialFailure();
   const actual=new Map();for(const write of writes){if(!write||actual.has(write.path))financialFailure();actual.set(write.path,write);}
   for(const write of expected.writes){const received=actual.get(write.path),audit=write.path.startsWith('audit/');if(!received||received.kind!==write.kind||received.expectedVersion!==write.expectedVersion||financialData(received.data,audit,false)!==financialData(write.data,audit,true))financialFailure();}
   return response;
  }catch(error){throw Object.assign(error&&typeof error==='object'?error:new Error(String(error)),{noQueue:true})}
 }
 function genericOperation(operation){
  if(externalFinancial&&(!Array.isArray(operation?.writes)||operation.writes.some(write=>{
   const collection=String(write?.path||'').split('/')[0];
   return !['clients','routes','audit','credits'].includes(collection)||(collection==='credits'&&write.kind!=='metadata')||(collection==='routes'&&['TERM','COMMISSION_POSITION','CREDIT_ADMIN_REVIEW'].includes(write.data?.recordType));
  })))throw Object.assign(Error('V2_EXTERNAL_FINANCIAL_OPERATION_NOT_SUPPORTED'),{noQueue:true});
  return genericStore.execute(operation);
 }
 async function serverPayment(operation){
  try{
   const expectedScope=actor(operation),payments=operation.writes?.filter(write=>write.path.startsWith('payments/'))||[],credits=operation.writes?.filter(write=>write.path.startsWith('credits/'))||[],payment=payments[0],credit=credits[0],endpoint=root.firebaseFunctionsV2?.recordInstallment;
   if(typeof endpoint!=='function')throw Error('V2_PAYMENT_ENDPOINT_NOT_CONFIGURED');
   if(payments.length!==1||credits.length!==1||payment.kind!=='create'||credit.kind!=='set'||payment.data?.creditId!==credit.data?.id||payment.data?.userId!==auth.uid)throw Error('INVALID_V2_PAYMENT_OPERATION');
   const input={creditId:credit.data.id,paymentId:payment.data.id,operationId:operation.id,amount:payment.data.amount,expectedVersion:credit.expectedVersion},response=await endpoint(input);
   if(actor(operation)!==expectedScope)throw Error('V2_PAYMENT_SESSION_CHANGED');
   const result=response?.result;
   if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||response.operation?.id!==input.operationId||result?.credit?.id!==input.creditId||result.credit.version!==input.expectedVersion+1||result.payment?.id!==input.paymentId||result.payment.userId!==auth.uid||result.payment.operationId!==input.operationId||result.payment.amount!==input.amount||result.entry?.ref!==input.paymentId||result.entry.amount!==input.amount||result.audit?.operationId!==input.operationId)throw Error('V2_PAYMENT_ACK_INVALID');
   return response;
  }catch(error){throw Object.assign(error&&typeof error==='object'?error:new Error(String(error)),{noQueue:true})}
 }
 async function serverCommission(operation){
  try{
   const expectedScope=actor(operation),isTerms=operation.type==='COMMISSION_TERMS_SAVED';
   if(typeof root.MiCarteraV2Commissions?.assertSession!=='function')throw Error('V2_COMMISSION_AUTH_GUARD_REQUIRED');
   root.MiCarteraV2Commissions.assertSession(operation);
   const position=operation.writes?.find(w=>w.path.startsWith('routes/')&&w.data?.recordType==='COMMISSION_POSITION'),target=operation.writes?.find(w=>isTerms?w.path.startsWith('routes/')&&w.data?.recordType==='TERM':w.path.startsWith('expenses/')&&w.data?.category==='COMISION_GESTOR');
   const endpoint=root.firebaseFunctionsV2?.[isTerms?'saveCommissionTerms':'settleCommission'];
   if(typeof endpoint!=='function')throw Error('V2_COMMISSION_ENDPOINT_NOT_CONFIGURED');
   if(!position||!target||target.kind!=='create'||target.data.workerId!==position.data.workerId)throw Error('INVALID_COMMISSION_OPERATION');
   const input={operationId:operation.id,workerId:position.data.workerId,expectedVersion:position.expectedVersion};
   for(const key of isTerms?(target.data.mode==='PERCENT'?['effectiveDate','mode','basis','rate']:target.data.mode==='FIXED_PERIOD'?['effectiveDate','mode','amount','periodDays']:['effectiveDate','mode','amount']):['amount'])input[key]=target.data[key];
   const response=await endpoint(input);
   if(actor(operation)!==expectedScope)throw Error('V2_COMMISSION_SESSION_CHANGED');
   root.MiCarteraV2Commissions.assertSession(operation);
   const result=response?.result,value=isTerms?result?.term:result?.expense;
   if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||response.operation?.id!==operation.id||response.operation.type!==operation.type||result?.position?.id!==position.data.id||result.position.workerId!==input.workerId||result.position.version!==input.expectedVersion+1||value?.id!==target.data.id||value.workerId!==input.workerId||result.audit?.actorId!==auth.uid||result.audit.operationId!==operation.id||result.audit.action!==operation.type||(!isTerms&&(value.amount!==input.amount||value.type!=='EGRESO'||value.category!=='COMISION_GESTOR'||value.cashAccountId!=='leader')))throw Error('V2_COMMISSION_ACK_INVALID');
   return response;
  }catch(error){throw Object.assign(error&&typeof error==='object'?error:new Error(String(error)),{noQueue:true})}
 }
 async function serverReview(operation){try{const expectedScope=actor(operation),review=operation.writes?.find(w=>w.data?.recordType==='CREDIT_ADMIN_REVIEW'),endpoint=root.firebaseFunctionsV2?.requestCreditReview;if(typeof endpoint!=='function')throw Error('V2_REVIEW_ENDPOINT_NOT_CONFIGURED');if(typeof root.MiCarteraV2CreditAdminReview?.assertSession!=='function')throw Error('V2_REVIEW_AUTH_GUARD_REQUIRED');root.MiCarteraV2CreditAdminReview.assertSession(operation);if(!review||review.kind!=='create')throw Error('INVALID_REVIEW_OPERATION');const input={operationId:operation.id,creditId:review.data.creditId,expectedCreditVersion:review.data.creditVersion,reason:review.data.reason},response=await endpoint(input);if(actor(operation)!==expectedScope)throw Error('V2_REVIEW_SESSION_CHANGED');root.MiCarteraV2CreditAdminReview.assertSession(operation);const result=response?.result;if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||response.operation?.id!==operation.id||response.operation.type!==operation.type||result?.review?.id!==review.data.id||result.review.creditId!==input.creditId||result.review.status!=='PENDING'||result.audit?.actorId!==auth.uid||result.audit.operationId!==operation.id||result.audit.action!==operation.type)throw Error('V2_REVIEW_ACK_INVALID');return response}catch(error){throw Object.assign(error&&typeof error==='object'?error:new Error(String(error)),{noQueue:true})}}
 // Capture one immutable session generation for both submission and its acknowledgement.
 // Never consume or rewrite earlier UID-only/unscoped custody queues.
 const store={async execute(operation){actor(operation);const result=await (nativePayment&&Object.prototype.hasOwnProperty.call(financialActions,operation?.type)?(['CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE'].includes(operation.type)&&nativeCredit?nativeSubmit(nativeCredit,operation):operation.type.startsWith('PARTNER_')&&nativePartners?nativeSubmit(nativePartners,operation):nativePending()):externalFinancial&&Object.prototype.hasOwnProperty.call(financialActions,operation?.type)?serverFinancial(operation):operation?.type==='PAYMENT'?(nativePayment?nativeSubmit(nativePayment,operation):serverPayment(operation)):['COMMISSION_TERMS_SAVED','COMMISSION_PAID'].includes(operation?.type)?(nativePayment?nativePending():serverCommission(operation)):operation?.type==='CREDIT_ADMIN_REVIEW_REQUESTED'?(nativePayment?nativePending():serverReview(operation)):genericOperation(operation));actor(operation);return result}},queueKey=session?.queueKey?.({projectId,orgId:safeCfg.orgId,uid:auth.uid})||(projectId?'mi-cartera-v2-cloud-operations-scoped:'+encodeURIComponent(JSON.stringify([projectId,safeCfg.orgId,auth.uid])):'mi-cartera-v2-cloud-operations:'+auth.uid),queue=Q.createQueue(root.localStorage,queueKey),sync=S.createOperationalSync({store,queue,actorId:auth.uid,validateSession:actor});B.configure(sync);
 let flushing=false;
 async function flush(){version.requireReady();actor();if(flushing||!root.navigator.onLine)return {status:'SKIPPED'};flushing=true;try{return await queue.flush(op=>store.execute(op))}finally{flushing=false}}
 root.addEventListener('online',()=>{try{actor()}catch{return {status:'SKIPPED_SCOPE'}}return flush()});
 return {flush,inspect:queue.inspect,status:()=>({online:root.navigator.onLine,queue:queue.inspect(),orgId:safeCfg.orgId,actorId:auth.uid,role:auth.role,mode:'PILOT'})};
}
root.MiCarteraV2CloudRuntime={configure};
})(window);
