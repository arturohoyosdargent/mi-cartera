// Cloud delivery and read-first recovery. Existing/uncertain rows are never replayed.
(function(root){'use strict';
let runtimeGeneration=0;
function metadataSession(op){if(!['WORKER_ASSIGNMENT','CREDIT_REFERENCE_UPDATED','CLIENT_CLASSIFICATION_UPDATED'].includes(op?.type))return;if(typeof root.MiCarteraV2CommercialActions?.assertMetadataSession!=='function')throw Error('METADATA_AUTH_GUARD_REQUIRED');root.MiCarteraV2CommercialActions.assertMetadataSession(op)}
function configure(cfg){
 const version=root.MiCarteraV2VersionGuard,authGate=root.MiCarteraV2AuthCloudGate,pilot=root.MiCarteraV2PilotConfig;
 if(!version)throw Error('V2_VERSION_GUARD_REQUIRED');version.requireReady();if(!authGate)throw Error('V2_AUTH_CLOUD_GATE_REQUIRED');const auth=authGate.requireReady();if(!pilot)throw Error('V2_PILOT_GATE_REQUIRED');
 const decision=pilot.evaluate(cfg);if(!decision.ready)throw Object.assign(Error('V2_PILOT_NOT_READY:'+decision.reasons.join(',')),{code:'V2_PILOT_NOT_READY',reasons:decision.reasons});
 const A=root.MiCarteraV2FirestoreAdapter,T=root.MiCarteraV2Store,Q=root.MiCarteraV2OfflineQueue,S=root.MiCarteraV2OperationalSync,B=root.MiCarteraV2SyncBridge;
 if(!A||!T||!Q||!S||!B)throw Error('V2_CLOUD_MODULES_REQUIRED');
 if(!cfg?.orgId||!String(cfg.orgId).startsWith('v2-')||cfg.orgId==='mi-cartera')throw Error('V2_ORG_ID_REQUIRED');if(cfg.orgId!=='v2-mi-cartera-pilot')throw Error('V2_PILOT_ORG_MISMATCH');if(cfg.actorId&&cfg.actorId!==auth.uid)throw Error('V2_ACTOR_AUTH_MISMATCH');
 const safeCfg={...cfg,actorId:auth.uid},adapter=A.createFirestoreAtomicAdapter(safeCfg),store=T.createStore(adapter,{validateSession:op=>{requireSend();metadataSession(op)}}),queue=Q.createQueue(root.localStorage,'mi-cartera-v2-cloud-operations:'+auth.uid);
 // A continuation is not a server ACK. Reopening protects every unresolved row.
 const protectedIds=queue.inspect().filter(x=>!Q.isTerminal(x)).map(x=>x.id),createdHere=new Set(),generation=++runtimeGeneration;
 function reviewRequired(){const current=queue.inspect();return protectedIds.some(id=>!current.some(x=>x.id===id&&Q.isTerminal(x)))||current.some(x=>!Q.isTerminal(x)&&(!createdHere.has(x.id)||x.reviewBeforeSend||Number(x.attempts)>0||['ERROR','CONFLICTO','BLOQUEADO'].includes(x.status)))}
 function requireSession(){if(generation!==runtimeGeneration)throw Error('V2_RUNTIME_REPLACED');version.requireReady();const current=authGate.requireReady();if(current.uid!==auth.uid)throw new Error('V2_SYNC_ACTOR_CHANGED')}
 function requireSend(){requireSession();if(reviewRequired())throw Object.assign(Error('Hay operaciones pendientes de revisión. Consulta el diario local antes de sincronizar.'),{code:'V2_PENDING_REVIEW_REQUIRED'})}
 const sync=S.createOperationalSync({store,queue,actorId:auth.uid,reviewRequired,allowLocalCollectionsDuringReview:true,onJournalCreated:id=>createdHere.add(id),beforeJournal:requireSession,beforeExecute:op=>{requireSend();metadataSession(op)},prepareQueuedOperation:op=>{if(!root.MiCarteraV2CommercialActions?.prepareQueuedOperation)throw Error('FRESH_LEADER_REVISION_REQUIRED');return root.MiCarteraV2CommercialActions.prepareQueuedOperation(op)},beforeSend:requireSend});B.configure(sync);
 let flushing=false;
 async function flush({rehydrate=true}={}){
  requireSession();if(flushing||root.MiCarteraV2CloudRehydration?.isRunning?.())return {status:reviewRequired()?'REVIEW_REQUIRED':'BUSY'};if(!root.navigator.onLine)return {status:'OFFLINE'};flushing=true;
  try{
   if(reviewRequired()){
    const diaryOpen=()=>root.document?.getElementById?.('v2PendingReview')?.isConnected===true;
    if(diaryOpen())return {status:'REVIEW_REQUIRED',applied:0,pending:queue.inspect().filter(x=>!Q.isTerminal(x)).length};
    // Reads operation markers and records exact local ACKs. Never falls through
    // to the transaction store for NOT_FOUND, UNKNOWN or COLLISION.
    const proof=await root.MiCarteraV2PendingReview?.reconcile?.({validate:()=>{requireSession();if(diaryOpen())throw Error('V2_READ_ONLY_DIARY_OPEN')}});requireSession();
    const pending=queue.inspect().filter(x=>!Q.isTerminal(x)).length;
    return {status:pending||reviewRequired()?'REVIEW_REQUIRED':'RECONCILED',applied:0,confirmed:proof?.confirmed||0,pending};
   }
   const read=root.MiCarteraV2PendingReview?.state?.();if(read?.nextCheckAt>Date.now()&&read.quota)return {status:'QUOTA_WAIT',pending:queue.inspect().filter(x=>!Q.isTerminal(x)).length};
   const result=await sync.flush();if(typeof root.dispatchEvent==='function'&&typeof CustomEvent==='function')root.dispatchEvent(new CustomEvent('mi-cartera-v2-sync',{detail:{ok:!result.conflicts&&!result.blocked,result}}));
   if(rehydrate&&!queue.inspect().some(x=>!Q.isTerminal(x)))await root.MiCarteraV2CloudRehydration?.rehydrate();return result;
  }finally{flushing=false}
 }
 root.MiCarteraV2CloudRuntime.flush=flush;
 if(root.__v2OnlineFlush)root.removeEventListener('online',root.__v2OnlineFlush);
 if(root.__v2SettledFlush)root.removeEventListener('mi-cartera-v2-sync',root.__v2SettledFlush);
 root.__v2OnlineFlush=()=>flush().catch(e=>console.warn('Sincronización pendiente',e));
 root.__v2SettledFlush=e=>{if(e.detail?.source==='operation-settled'&&root.navigator.onLine)setTimeout(root.__v2OnlineFlush,0)};
 root.addEventListener('online',root.__v2OnlineFlush);root.addEventListener('mi-cartera-v2-sync',root.__v2SettledFlush);
 if(root.navigator.onLine)setTimeout(root.__v2OnlineFlush,0);
 return {flush,inspect:queue.inspect,status:()=>({online:root.navigator.onLine,queue:queue.inspect(),orgId:safeCfg.orgId,actorId:auth.uid,role:auth.role,mode:'PILOT'})};
}
root.MiCarteraV2CloudRuntime={configure};
})(window);
