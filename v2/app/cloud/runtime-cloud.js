// Mi Cartera PRO V2 â€” explicit Cloud runtime wiring. Never auto-connects to V1.
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
 const safeCfg={...cfg,actorId:auth.uid},adapter=A.createFirestoreAtomicAdapter(safeCfg),genericStore=T.createStore(adapter,{validateSession:op=>{actor(op);metadataSession(op)}});
 const authKey=current=>JSON.stringify([current.uid,current.role,current.workerId||'',(current.routeIds||[]).map(String).sort()]);
 const configuredAuth=authKey(auth);
 const backendMode=root.MI_CARTERA_V2_PILOT_CONFIG?.backendMode===undefined?'functions':root.MI_CARTERA_V2_PILOT_CONFIG.backendMode;
 if(!['functions','external','spark-native','b2-compatible'].includes(backendMode))throw Error('V2_BACKEND_MODE_INVALID');
 if(backendMode==='b2-compatible'&&!projectId)throw Error('V2_QUEUE_PROJECT_REQUIRED');
 const externalFinancial=backendMode==='external',financialEndpoint=externalFinancial?root.firebaseFunctionsV2?.recordFinancialOperation:null;
 const financialActions={CREDIT_CREATE:'CREDIT_CREATED',INTEREST_RENEWAL:'INTEREST_RENEWAL',REFINANCE:'CREDIT_REFINANCED',CASH_MOVEMENT:'CASH_MOVEMENT',PARTNER_LOAN_CREATED:'PARTNER_LOAN_CREATED',PARTNER_CONTACT_UPDATED:'PARTNER_CONTACT_UPDATED',PARTNER_INTEREST_PAID:'PARTNER_INTEREST_PAID',PARTNER_CAPITAL_RETURNED:'PARTNER_CAPITAL_RETURNED',PARTNER_SETTLED:'PARTNER_SETTLED'};
 function actor(operation){const current=authGate.requireReady();if(current.uid!==auth.uid||operation?.actorId&&operation.actorId!==current.uid)throw Error('V2_SYNC_ACTOR_CHANGED');if(sessionToken)session.assertCurrent(sessionToken);if(authKey(current)!==configuredAuth||authGate.ORG&&authGate.ORG!==safeCfg.orgId||projectId&&String(root.MI_CARTERA_V2_FIREBASE_TEMPLATE?.projectId||root.firebaseSdkV2?.app?.options?.projectId||cfg.projectId||'')!==projectId)throw Error('V2_SYNC_SCOPE_CHANGED');return authKey(current)}
 const nativeCash=backendMode==='spark-native'?root.MiCarteraV2SparkCash?.createSparkCash({validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,increment:root.firestoreV2?.increment}):null;
 const nativePayment=backendMode==='spark-native'?root.MiCarteraV2SparkPayment?.createSparkPaymentStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,cash:nativeCash}):null;
 const nativeCredit=backendMode==='spark-native'?root.MiCarteraV2SparkCredit?.createSparkCreditStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,cash:nativeCash}):null;
 const nativePartners=backendMode==='spark-native'?root.MiCarteraV2SparkPartners?.createSparkPartnerStore({adapter,actorId:auth.uid,validateSession:actor,stamp:root.firestoreV2?.serverTimestamp,today:root.MiCarteraV2SparkCash.businessDate,cash:nativeCash}):null;
 if(backendMode==='spark-native'&&!nativePayment)throw Error('V2_SPARK_PAYMENT_MODULE_REQUIRED');
 function onlineSubmit(store,operation){if(root.navigator.onLine===false)throw Object.assign(Error('Sin conexiÃ³n. La operaciÃ³n queda pendiente de confirmaciÃ³n.'),{code:'unavailable',noQueue:false});return store.execute(operation)}
 function nativePending(){throw Object.assign(Error('Esta operaciÃ³n todavÃ­a no estÃ¡ habilitada en la versiÃ³n de pruebas. No se registrÃ³ ningÃºn movimiento.'),{code:'V2_SPARK_CONTRACT_PENDING',noQueue:true})}
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
 // The durable payment queue contains intent only. It never carries a credit,
 // allocation, cash entry or audit supplied by the browser.
 const paymentOwner=root.localStorage.getItem('mi-cartera-v2-local-owner');
 const paymentScope=canonical({projectId,orgId:safeCfg.orgId,actor:configuredAuth,owner:paymentOwner});
 const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
 const cents=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6;
 const cash=value=>Math.round(value*100);
 function paymentActor(operation){actor(operation);if(root.localStorage.getItem('mi-cartera-v2-local-owner')!==paymentOwner||operation?.paymentScope!==undefined&&operation.paymentScope!==paymentScope)throw Error('V2_SYNC_SCOPE_CHANGED');if(!['admin','supervisor','cobrador'].includes(String(auth.role).toLowerCase()))throw Error('V2_PAYMENT_ROLE_REQUIRED');}
 function paymentOperation(operation){
  paymentActor(operation);let input;
  if(operation?.paymentIntent){if(operation.writes!==undefined)throw Error('INVALID_V2_PAYMENT_OPERATION');input=copy(operation.paymentIntent);}
  else{
   const writes=operation?.writes,payments=writes?.filter(write=>/^payments\//.test(write.path))||[],credits=writes?.filter(write=>/^credits\//.test(write.path))||[],normal=payments.filter(write=>write.data?.concept!=='MORA'),mora=payments.filter(write=>write.data?.concept==='MORA'),payment=normal[0],credit=credits[0];
   if(!Array.isArray(writes)||normal.length!==1||credits.length!==1||mora.length>1||payments.length!==normal.length+mora.length||payment.kind!=='create'||credit.kind!=='set'||payment.path!=='payments/'+payment.data?.id||credit.path!=='credits/'+credit.data?.id||payment.data.creditId!==credit.data.id||payment.data.userId!==auth.uid)throw Error('INVALID_V2_PAYMENT_OPERATION');
   input={creditId:credit.data.id,paymentId:payment.data.id,operationId:operation.id,amount:payment.data.amount,expectedVersion:credit.expectedVersion};
   if(mora.length){const extra=mora[0];if(extra.kind!=='create'||extra.path!=='payments/'+extra.data?.id||extra.data.creditId!==input.creditId||extra.data.normalPaymentId!==input.paymentId||extra.data.userId!==auth.uid||extra.data.operationId!==input.operationId+'-mora'||payment.data.agreedMoraAmount!==extra.data.amount||payment.data.moraPaymentId!==extra.data.id)throw Error('INVALID_V2_PAYMENT_OPERATION');Object.assign(input,{moraAmount:extra.data.amount,moraPaymentId:extra.data.id});}
   else if(payment.data.agreedMoraAmount||payment.data.moraPaymentId)throw Error('INVALID_V2_PAYMENT_OPERATION');
  }
  const hasMora=Object.prototype.hasOwnProperty.call(input,'moraAmount'),keys=['creditId','paymentId','operationId','amount','expectedVersion',...(hasMora?['moraAmount','moraPaymentId']:[])];
  if(operation.type!=='PAYMENT'||operation.actorId!==auth.uid||operation.id!==operation.operationId||input.operationId!==operation.id||Object.keys(input).length!==keys.length||keys.some(key=>!Object.prototype.hasOwnProperty.call(input,key))||!['creditId','paymentId','operationId'].every(key=>validId(input[key]))||!cents(input.amount)||input.amount<=0||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1||hasMora&&(!['admin','supervisor'].includes(String(auth.role).toLowerCase())||!cents(input.moraAmount)||input.moraAmount<=0||!validId(input.moraPaymentId)||input.moraPaymentId===input.paymentId))throw Error('INVALID_V2_PAYMENT_OPERATION');
  return {id:input.operationId,operationId:input.operationId,type:'PAYMENT',actorId:auth.uid,paymentIntent:input,paymentScope};
 }
 function assertPaymentAck(response,input){
  const result=response?.result,c=result?.credit,p=result?.payment,e=result?.entry,a=result?.audit,op=response?.operation,mora=input.moraAmount||0;
  function invalid(){throw Error('V2_PAYMENT_ACK_INVALID')}
  function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00.000Z').toISOString().slice(0,10)===value;}
  if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||op?.id!==input.operationId||op.type!=='PAYMENT'||op.source!=='V2_PAYMENT_ENDPOINT'||op.actorId!==auth.uid||op.status!=='APPLIED'||op.writeCount!==(mora?6:4)||canonical(op.result)!==canonical(result)||!c||c.id!==input.creditId||c.version!==input.expectedVersion+1||!validId(c.clientId)||typeof (c.routeId||'')!=='string'||typeof (c.workerId||'')!=='string'||!['ACTIVO','PAGADO'].includes(c.status)||c.tombstone||c.renewedTo||!['capital','total','principalPaid','interestPaid','penaltyPaid'].every(key=>cents(c[key]))||c.principalPaid>c.capital||c.total<c.capital||!Array.isArray(c.schedule)||!c.schedule.length)invalid();
  if(String(auth.role).toLowerCase()==='cobrador'&&!(auth.routeIds||[]).includes(c.routeId))invalid();
  let balance=0,total=0;
  for(const row of c.schedule){if(!cents(row.amount)||row.amount<=0||!cents(row.paid)||!cents(row.balance)||cash(row.paid)+cash(row.balance)!==cash(row.amount))invalid();balance+=cash(row.balance);total+=cash(row.amount);}
  if(total!==cash(c.total)||!p||p.id!==input.paymentId||p.creditId!==c.id||p.clientId!==c.clientId||p.userId!==auth.uid||p.operationId!==input.operationId||p.version!==1||p.amount!==input.amount||p.concept!=='CUOTA'||p.method!=='V2_SERVER'||!date(p.date)||p.routeId!==String(c.routeId||'')||p.workerId!==String(c.workerId||'').trim()||p.workerAttribution?.source!=='CREDIT_ASSIGNMENT_AT_PAYMENT'||!iso(p.workerAttribution.capturedAt)||!['amount','capitalAmount','interestAmount','penaltyAmount','balanceAfterPayment'].every(key=>cents(p[key]))||p.penaltyAmount!==0||cash(p.capitalAmount)+cash(p.interestAmount)!==cash(input.amount)||cash(p.balanceAfterPayment)!==balance||p.capitalAmount>c.principalPaid||p.interestAmount>c.interestPaid||p.totalInstallments!==c.schedule.length||!Array.isArray(p.installmentApplications)||!p.installmentApplications.length||p.installmentNumber!==p.installmentNo||p.installmentNumber!==p.installmentFrom||p.installmentFrom!==p.installmentApplications[0].number||p.installmentTo!==p.installmentApplications.at(-1).number)invalid();
  let applied=0,previous=0;
  for(const row of p.installmentApplications){const q=c.schedule[row.number-1];if(!Number.isInteger(row.number)||row.number<=previous||!q||!['amount','balanceBefore','balanceAfter'].every(key=>cents(row[key]))||row.amount<=0||cash(row.balanceBefore)-cash(row.balanceAfter)!==cash(row.amount)||row.balanceAfter!==q.balance||row.status!==(row.balanceAfter===0?'PAGADA':'PARCIAL')||q.status!==row.status)invalid();previous=row.number;applied+=cash(row.amount);}
  if(applied!==cash(input.amount)||c.status!==(balance===0?'PAGADO':'ACTIVO'))invalid();
  function entry(value,payment,concept,operationId){if(!value||value.id!=='entry-'+payment.id||value.ref!==payment.id||value.version!==1||value.type!=='INGRESO'||value.concept!==concept||value.amount!==payment.amount||value.date!==p.date||value.userId!==auth.uid||value.routeId!==String(c.routeId||'')||value.operationId!==operationId)invalid();}
  entry(e,p,'COBRO_CUOTA',input.operationId);
  if(!a||a.id!=='audit-'+input.operationId||a.version!==1||a.actorId!==auth.uid||String(a.role).toLowerCase()!==String(auth.role).toLowerCase()||a.action!=='PAYMENT_RECORDED'||a.entityType!=='PAYMENT'||a.entityId!==p.id||a.operationId!==input.operationId||!iso(a.at)||a.detail?.creditId!==c.id||a.detail.amount!==input.amount||a.detail.capitalAmount!==p.capitalAmount||a.detail.interestAmount!==p.interestAmount||a.detail.routeId!==String(c.routeId||'')||a.detail.workerId!==p.workerId)invalid();
  if(mora){const mp=result.moraPayment;if(!mp||mp.id!==input.moraPaymentId||mp.normalPaymentId!==p.id||mp.operationId!==input.operationId+'-mora'||mp.creditId!==c.id||mp.clientId!==c.clientId||mp.date!==p.date||mp.amount!==mora||mp.penaltyAmount!==mora||mp.capitalAmount!==0||mp.interestAmount!==0||mp.concept!=='MORA'||mp.version!==1||mp.userId!==auth.uid||mp.routeId!==String(c.routeId||'')||mp.workerId!==p.workerId||canonical(mp.workerAttribution)!==canonical(p.workerAttribution)||mp.balanceAfterPayment!==p.balanceAfterPayment||p.agreedMoraAmount!==mora||p.moraPaymentId!==mp.id||a.detail.moraAmount!==mora||a.detail.moraPaymentId!==mp.id||cash(a.detail.totalReceived)!==cash(input.amount)+cash(mora)||a.detail.moraWithinAgreement!==true)invalid();entry(result.moraEntry,mp,'COBRO_MORA',input.operationId+'-mora');}
  else if(result.moraPayment||result.moraEntry||p.agreedMoraAmount||p.moraPaymentId||a.detail.moraAmount||a.detail.moraPaymentId)invalid();
  return copy(response);
 }
 function paymentQueueRows(){
  let rows;try{rows=JSON.parse(root.localStorage.getItem(queueKey)||'[]')}catch(_){throw Error('V2_PAYMENT_QUEUE_INVALID')}
  if(!Array.isArray(rows))throw Error('V2_PAYMENT_QUEUE_INVALID');return rows;
 }
 function paymentNeedsReview(row){return ['BLOQUEADO','CONFLICTO','CERRADO_ADMIN'].includes(row?.status)||row?.noReplay||row?.administrativeClosure?.noReplay||row?.operation?.noReplay||row?.operation?.administrativeClosure?.noReplay||row?.operation?.status==='CERRADO_ADMIN';}
 function assertPaymentRetryAllowed(operationId){
  if(paymentQueueRows().some(row=>String(row?.operation?.operationId||row?.operation?.id||row?.id||'')===operationId&&paymentNeedsReview(row)))throw Error('V2_PAYMENT_PENDING_REVIEW_REQUIRED');
 }
 async function serverPayment(operation){
  try{
   const expected=paymentOperation(operation),expectedScope=actor(expected),input=expected.paymentIntent,endpoint=root.firebaseFunctionsV2?.recordInstallment;
   assertPaymentRetryAllowed(input.operationId);
   if(typeof endpoint!=='function')throw Error('V2_PAYMENT_ENDPOINT_NOT_CONFIGURED');
   if(root.navigator.onLine===false)throw Object.assign(Error('V2_PAYMENT_OFFLINE'),{code:'unavailable'});
   const response=await endpoint(copy(input));paymentActor(expected);
   if(actor(expected)!==expectedScope)throw Error('V2_PAYMENT_SESSION_CHANGED');
   return assertPaymentAck(response,input);
  }catch(error){const e=error&&typeof error==='object'?error:new Error(String(error)),retry=/^(?:functions\/)?(?:unavailable|deadline-exceeded|network-request-failed)$/.test(String(e.code||''))||/^(?:NETWORK|TIMEOUT|OFFLINE)$/.test(String(e.code||''));throw Object.assign(e,{noQueue:!retry})}
 }
 async function serverInterestRenewal(operation){
  try{
   const expectedScope=actor(operation);
   if(!['admin','supervisor'].includes(String(auth.role).toLowerCase()))throw Error('V2_RENEWAL_MANAGER_REQUIRED');
   const writes=operation.writes||[],old=writes.find(w=>w.path.startsWith('credits/')&&w.kind==='set'),next=writes.find(w=>w.path.startsWith('credits/')&&w.kind==='create'),payment=writes.find(w=>w.path.startsWith('payments/')),entry=writes.find(w=>w.path.startsWith('entries/'));
   if(operation.type!=='INTEREST_RENEWAL'||operation.actorId!==auth.uid||!old||!next||!payment||!entry||writes.filter(w=>w.path.startsWith('credits/')).length!==2||writes.filter(w=>w.path.startsWith('payments/')).length!==1||payment.kind!=='create'||entry.kind!=='create'||payment.data.creditId!==old.data.id||payment.data.userId!==auth.uid||next.data.renewedFrom!==old.data.id||old.data.renewedTo!==next.data.id)throw Error('INVALID_V2_INTEREST_RENEWAL_OPERATION');
   const planned=next.data,input={creditId:old.data.id,newCreditId:planned.id,paymentId:payment.data.id,entryId:entry.data.id,operationId:operation.id,expectedVersion:old.expectedVersion,date:planned.date,rate:planned.rate,term:planned.term,freq:planned.freq,firstPaymentDate:planned.requestedFirstPaymentDate||planned.schedule?.find(q=>!q.extra)?.date||planned.firstPaymentDate,restDay:planned.restDay??'',extraPayments:(planned.schedule||[]).filter(q=>q.extra).map(q=>({date:q.date,amount:q.amount}))};
   if(!['creditId','newCreditId','paymentId','entryId','operationId'].every(key=>validId(input[key]))||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1)throw Error('INVALID_V2_INTEREST_RENEWAL_OPERATION');
   const endpoint=root.firebaseFunctionsV2?.recordInterestRenewal;
   if(typeof endpoint!=='function')throw Error('V2_RENEWAL_ENDPOINT_NOT_CONFIGURED');
   if(root.navigator.onLine===false)throw Error('V2_RENEWAL_OFFLINE');
   const response=await endpoint(copy(input));
   if(actor(operation)!==expectedScope)throw Error('V2_RENEWAL_SESSION_CHANGED');
   const r=response?.result,o=response?.operation,c=r?.newCredit,p=r?.payment,e=r?.entry,a=r?.audit;
   if(!['APPLIED','ALREADY_APPLIED'].includes(response?.status)||o?.id!==input.operationId||o.type!=='INTEREST_RENEWAL'||o.source!=='V2_INTEREST_RENEWAL_ENDPOINT'||o.actorId!==auth.uid||o.status!=='APPLIED'||o.writeCount!==5||canonical(o.result)!==canonical(r)||r?.oldCredit?.id!==input.creditId||r.oldCredit.version!==input.expectedVersion+1||r.oldCredit.status!=='RENOVADO'||r.oldCredit.renewedTo!==input.newCreditId||!c||c.id!==input.newCreditId||c.renewedFrom!==input.creditId||c.status!=='ACTIVO'||c.version!==1||c.renewalMode!=='INTEREST'||c.netDisbursement!==0||c.date!==input.date||c.rate!==input.rate||c.term!==input.term||c.freq!==input.freq||!cents(c.capital)||!cents(c.total)||c.principalPaid!==0||c.interestPaid!==0||c.penaltyPaid!==0||!Array.isArray(c.schedule)||!c.schedule.length||c.schedule.some(q=>!cents(q.amount)||q.amount<=0||q.paid!==0||q.balance!==q.amount)||cash(c.total)!==c.schedule.reduce((n,q)=>n+cash(q.amount),0)||!p||p.id!==input.paymentId||p.creditId!==input.creditId||p.userId!==auth.uid||p.operationId!==input.operationId||p.concept!=='INTERES'||p.capitalAmount!==0||p.penaltyAmount!==0||!cents(p.amount)||p.amount<=0||p.interestAmount!==p.amount||p.date!==input.date||!e||e.id!==input.entryId||e.ref!==p.id||e.type!=='INGRESO'||e.concept!=='COBRO_INTERES'||e.amount!==p.amount||e.date!==p.date||!a||a.id!=='audit-'+input.operationId||a.action!=='INTEREST_RENEWAL'||a.actorId!==auth.uid||a.operationId!==input.operationId)throw Error('V2_RENEWAL_ACK_INVALID');
   return copy(response);
  }catch(error){throw Object.assign(error&&typeof error==='object'?error:Error(String(error)),{noQueue:true})}
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
 async function readClientCollection(){
  const fs=root.firestoreV2;
  if(!fs?.getDocsFromServer||!fs?.collection)throw Error('No se pudo verificar la cartera actual.');
  const snapshot=await fs.getDocsFromServer(fs.collection(safeCfg.db,'orgs',safeCfg.orgId,'clients'));
  return snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));
 }
 let manualClientStore;
 function executeB2(operation){
  if(!['admin','supervisor'].includes(String(auth.role).toLowerCase())||
    !['CLIENT_CREATE','CLIENT_UPDATE'].includes(operation?.type))return onlineSubmit(genericStore,operation);
  const locks=root.MiCarteraV2ClientImportStore;
  if(!locks?.retryClientLockConflicts)throw Error('No se pudo verificar la identidad del cliente.');
  manualClientStore ||= T.createStore(locks.retryClientLockConflicts(adapter), {
   validateSession:actor,prepareCommit:guardManualClient
  });
  return onlineSubmit(manualClientStore,operation);
 }
 async function guardManualClient(tx,operation,prepared,now){
  const locks=root.MiCarteraV2ClientImportStore,core=root.MiCarteraV2ClientImportCore;
  const rows=prepared.filter(({w})=>/^clients\/[^/]+$/.test(w.path));
  if(!sessionToken||!locks?.readClientLock||!locks?.writeClientLock||!core?.manualIdentityChanges||
    !core?.assertManualIdentity||rows.length!==1)throw Error('No se pudo verificar la identidad del cliente.');
  const {w,current}=rows[0],create=operation.type==='CLIENT_CREATE';
  if((create?w.kind!=='create'||current!=null:!['set','update'].includes(w.kind)||!current||current.tombstone||current.deletedAt)||
    w.path!=='clients/'+w.data?.id)throw Error('No se pudo verificar el alta o la edición del cliente.');
  const changes=core.manualIdentityChanges(create?null:current,w.data);
  if(!create&&!changes.some(Boolean))return;
  const lock=await locks.readClientLock(tx);
  const clients=await readClientCollection();
  actor(operation);
  core.assertManualIdentity(w.data,changes,clients);
  return ()=>locks.writeClientLock(tx,lock,now);
 }
 function submitClientImport(operation){
  const modules=root.MiCarteraV2ClientImportStore,core=root.MiCarteraV2ClientImportCore;
  const fs=root.firestoreV2;
  if(backendMode!=='b2-compatible'||root.MI_CARTERA_V2_PILOT_CONFIG?.allowClientImport===false||
    !sessionToken||!modules?.createStore||!core?.assertNewClients||
    !fs?.getDocsFromServer||!fs?.collection){
   throw Error('La importación no está disponible en esta sesión.');
  }
  version.requireReady();
  if(root.navigator.onLine===false)throw Error('Conéctate a internet y vuelve a confirmar la importación.');
  return modules.createStore({
   adapter,
   validateSession(op){actor(op);return authGate.requireReady()},
   assertNewClients:core.assertNewClients,
   readClients:readClientCollection
  }).execute(operation);
 }
 // Capture one immutable session generation for both submission and its acknowledgement.
 // Never consume or rewrite earlier UID-only/unscoped custody queues.
 const authoritativePayment=operation=>operation?.type==='PAYMENT'&&backendMode!=='spark-native';
 const store={async execute(operation){actor(operation);if(operation?.type==='CLIENT_IMPORT')return submitClientImport(operation);const result=await (authoritativePayment(operation)?serverPayment(operation):operation?.type==='INTEREST_RENEWAL'&&backendMode==='b2-compatible'?serverInterestRenewal(operation):backendMode==='b2-compatible'?executeB2(operation):nativePayment&&Object.prototype.hasOwnProperty.call(financialActions,operation?.type)?(['CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE'].includes(operation.type)&&nativeCredit?onlineSubmit(nativeCredit,operation):operation.type.startsWith('PARTNER_')&&nativePartners?onlineSubmit(nativePartners,operation):nativePending()):externalFinancial&&Object.prototype.hasOwnProperty.call(financialActions,operation?.type)?serverFinancial(operation):operation?.type==='PAYMENT'?onlineSubmit(nativePayment,operation):['COMMISSION_TERMS_SAVED','COMMISSION_PAID'].includes(operation?.type)?(nativePayment?nativePending():serverCommission(operation)):operation?.type==='CREDIT_ADMIN_REVIEW_REQUESTED'?(nativePayment?nativePending():serverReview(operation)):genericOperation(operation));actor(operation);return result}},queueKey=session?.queueKey?.({projectId,orgId:safeCfg.orgId,uid:auth.uid})||(projectId?'mi-cartera-v2-cloud-operations-scoped:'+encodeURIComponent(JSON.stringify([projectId,safeCfg.orgId,auth.uid])):'mi-cartera-v2-cloud-operations:'+auth.uid),durableQueue=Q.createQueue(root.localStorage,queueKey),queue={inspect:durableQueue.inspect,flush(executor,...args){return durableQueue.flush(operation=>{if(authoritativePayment(operation)&&(!operation.paymentIntent||!operation.paymentScope))throw Error('V2_SYNC_SCOPE_CHANGED');return executor(operation);},...args)},enqueue(operation){return durableQueue.enqueue(authoritativePayment(operation)?paymentOperation(operation):operation)}},sync=S.createOperationalSync({store,queue,actorId:auth.uid,validateSession:actor});B.configure(sync);
 function pendingPayment(creditId,expectedVersion){
  paymentActor();const rows=JSON.parse(root.localStorage.getItem(queueKey)||'[]');
  if(!Array.isArray(rows))throw Error('V2_PAYMENT_QUEUE_INVALID');
  const matches=rows.filter(row=>row.operation?.type==='PAYMENT'&&row.operation?.paymentIntent?.creditId===creditId&&row.operation.paymentIntent.expectedVersion===expectedVersion);
  if(matches.length>1)throw Error('V2_PAYMENT_PENDING_REVIEW_REQUIRED');
  const row=matches[0];if(!row)return null;
  if(paymentNeedsReview(row))throw Error('V2_PAYMENT_PENDING_REVIEW_REQUIRED');
  return copy(paymentOperation(row.operation).paymentIntent);
 }
 root.MiCarteraV2CloudRuntime.pendingPayment=pendingPayment;
 root.MiCarteraV2CloudRuntime.assertPaymentAcknowledgement=assertPaymentAck;
 let flushing=false;
 async function flush(){version.requireReady();actor();if(flushing||!root.navigator.onLine)return {status:'SKIPPED'};flushing=true;try{return await queue.flush(op=>store.execute(op))}finally{flushing=false}}
 root.addEventListener('online',()=>{try{actor()}catch{return {status:'SKIPPED_SCOPE'}}return flush()});
 // Membership/custody can recover after the browser's only online event.
 // Retry once readiness is observed; old runtime closures still fail actor().
 async function recoverPayments(){try{actor();if(root.navigator.onLine===false)return;const result=await flush();if(result.applied&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('mi-cartera-v2-sync',{detail:{ok:true,result,actorId:auth.uid}}));}catch(_){}}
 root.addEventListener('v2-auth-cloud-state',recoverPayments);
 if(root.navigator.onLine!==false&&queue.inspect().some(row=>row.type==='PAYMENT'&&['PENDIENTE','ERROR'].includes(row.status)))Promise.resolve().then(recoverPayments);
 return {flush,inspect:queue.inspect,pendingPayment,status:()=>({online:root.navigator.onLine,queue:queue.inspect(),orgId:safeCfg.orgId,actorId:auth.uid,role:auth.role,mode:'PILOT'})};
}
root.MiCarteraV2CloudRuntime={configure};
})(window);
