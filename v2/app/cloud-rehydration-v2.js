// Mi Cartera PRO V2 — authenticated Cloud <-> local rehydration for the isolated pilot.
// Cloud is authoritative once pending operations are acknowledged; never upload absent rows.
// Preserve owner-scoped snapshots before replacing local state.
(function(root){'use strict';
const ORG='v2-mi-cartera-pilot',K='mi-cartera-v2-validation-state';
const OWNER='mi-cartera-v2-local-owner';let hydrating=false;
const RETRY_KEY='mi-cartera-v2-cloud-quota-retry-after',QUOTA_WAIT=300000;
const readState={lastSuccessAt:0,lastError:null,nextAttemptAt:0};
try{const retry=Number(root.localStorage.getItem(RETRY_KEY)||0);if(retry>Date.now()&&retry<=Date.now()+QUOTA_WAIT){readState.nextAttemptAt=retry;readState.lastError='RESOURCE_EXHAUSTED'}}catch{}
function isQuota(error){return /RESOURCE[-_ ]EXHAUSTED|QUOTA/i.test(String(error?.code||'')+' '+String(error?.message||error||''))}
const MAP={clients:'clients',credits:'credits',payments:'payments',entries:'cashMovements',expenses:'cashMovements',audit:'audit',routes:'commercial'};
const MANAGER_ONLY=new Set(['entries','expenses','audit']);
const clone=v=>JSON.parse(JSON.stringify(v));
const managers=auth=>['admin','supervisor'].includes(String(auth?.role||''));
function dispatch(name,detail){const C=root.CustomEvent;if(typeof root.dispatchEvent==='function'&&C)root.dispatchEvent(new C(name,{detail}))}
function readLocal(){try{return JSON.parse(root.localStorage.getItem(K)||'{}')}catch{return {}}}
function rowId(row){const id=row?.id;return id==null||String(id).trim()===''?'':String(id)}
function localRows(local,name){
  if(name==='entries')return (Array.isArray(local.cashMovements)?local.cashMovements:[]).filter(x=>String(x?.type||'').toUpperCase()==='INGRESO');
  if(name==='expenses')return (Array.isArray(local.cashMovements)?local.cashMovements:[]).filter(x=>String(x?.type||'').toUpperCase()==='EGRESO');
  return Array.isArray(local[name])?local[name]:[];
}
function mergeMissing(remote,local){
  const out=Array.isArray(remote)?remote.slice():[],seen=new Set(out.map(rowId).filter(Boolean));
  for(const item of local||[]){const id=rowId(item);if(id&&!seen.has(id)){out.push(clone(item));seen.add(id)}}
  return out;
}
function queueKeys(){const keys=new Set(['mi-cartera-v2-cloud-operations','mi-cartera-v2-cloud-operations:'+root.MiCarteraV2AuthCloudGate?.state?.().uid]);for(let i=0;i<root.localStorage.length;i++){const key=root.localStorage.key(i);if(key?.startsWith('mi-cartera-v2-cloud-operations:'))keys.add(key)}return [...keys]}
function owner(){return root.localStorage.getItem(OWNER)||readLocal().session?.actorId||''}
function foreignPending(uid){try{return queueKeys().some(key=>key!=='mi-cartera-v2-cloud-operations:'+uid&&JSON.parse(root.localStorage.getItem(key)||'[]').some(x=>x?.status!=='SINCRONIZADO'))}catch{return true}}
function assertOwner(uid){if(foreignPending(uid))throw Error('Hay movimientos pendientes de otro usuario. Vuelve a esa sesión para sincronizarlos antes de continuar.');const previous=owner();if(previous&&previous!==uid)throw Error('Espera a que se actualicen los datos de esta sesión antes de registrar movimientos.');if(uid)root.localStorage.setItem(OWNER,uid)}
function pending(){
  try{
    if(root.MiCarteraV2SyncBridge?.status?.().pending>0)return true;
    for(const key of queueKeys()){
      const q=JSON.parse(root.localStorage.getItem(key)||'[]');
      if(Array.isArray(q)&&q.some(x=>x?.status!=='SINCRONIZADO'))return true;
    }
    return false;
  }catch{return true}
}
async function readCollection(name,auth){
  const f=root.firestoreV2;
  if(!f?.db||!f?.collection||!f?.getDocs)throw new Error('V2_FIRESTORE_READ_NOT_READY');
  const base=f.collection(f.db,'orgs',ORG,name),refs=[];
  if(auth.role==='gestor'){
    if(!auth.workerId||!f.query||!f.where)throw new Error('V2_WORKER_SCOPE_REQUIRED');
    refs.push(f.query(base,f.where(name==='audit'?'actorId':'workerId','==',name==='audit'?auth.uid:auth.workerId)));
  }else if(auth.role==='cobrador'){
    if(!f.query||!f.where)throw new Error('V2_FIRESTORE_QUERY_NOT_READY');
    if(name==='payments')refs.push(f.query(base,f.where('userId','==',auth.uid)));
    else if(name==='clients'||name==='credits')for(const rid of (auth.routeIds||[]))refs.push(f.query(base,f.where('routeId','==',rid)));
    else return [];
  }else refs.push(base);
  const out=[],seen=new Set();
  for(const ref of refs){
    let timer;
    const deadline=new Promise((_,reject)=>{if(typeof setTimeout==='function')timer=setTimeout(()=>reject(Object.assign(Error('NETWORK_TIMEOUT: se conservaron los datos locales'),{code:'deadline-exceeded'})),8000)});
    let snap;try{snap=await Promise.race([f.getDocs(ref),deadline])}finally{if(typeof clearTimeout==='function')clearTimeout(timer)}
    snap.forEach(d=>{const raw=d.data()||{};const data={...raw,id:raw.id||d.id};if(!seen.has(String(data.id))){seen.add(String(data.id));out.push(data)}});
  }
  if(name==='routes'&&auth.role==='gestor'){
    if(!f.doc||!f.getDoc)throw new Error('V2_ROUTE_READ_NOT_READY');
    for(const rid of auth.routeIds||[]){
      let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('NETWORK_TIMEOUT')),8000)});
      let snap;try{snap=await Promise.race([f.getDoc(f.doc(f.db,'orgs',ORG,'routes',rid)),deadline])}finally{clearTimeout(timer)}
      if(snap.exists()){const raw=snap.data(),data={...raw,id:raw.id||snap.id};if(data.recordType==='ROUTE'&&!seen.has(data.id)){seen.add(data.id);out.push(data)}}
    }
  }
  return out;
}
function cloudRow(name,row,auth){
  const data=clone(row),id=rowId(data);if(!id)return null;data.id=id;
  if(name==='payments'&&!data.userId)data.userId=auth.uid;
  if(name==='audit'){if(!data.actorId)data.actorId=auth.uid;if(!data.role)data.role=auth.role;}
  return data;
}
async function pushLocalMissing(){return {written:0,failed:0,available:false};}
async function rehydrateOnce(){
  const auth=root.MiCarteraV2AuthCloudGate?.requireReady?.();
  if(!auth?.uid)throw new Error('V2_AUTH_REQUIRED');
  if(pending())return {status:'SKIPPED_PENDING_LOCAL_OPERATIONS'};
  const local=readLocal(),snapshot=JSON.stringify(local),previous=owner(),sameOwner=!previous||previous===auth.uid;
  const stale=()=>JSON.stringify(readLocal())!==snapshot||root.MiCarteraV2AuthCloudGate?.requireReady?.()?.uid!==auth.uid;
  const names=Object.keys(MAP).filter(n=>!MANAGER_ONLY.has(n)||managers(auth)||auth.role==='gestor');
  let rows=await Promise.all(names.map(n=>readCollection(n,auth)));
  if(pending()||stale())return {status:'SKIPPED_PENDING_LOCAL_OPERATIONS'};
  const upload={written:0,failed:0,available:false};
  if(upload.written)rows=await Promise.all(names.map(n=>readCollection(n,auth)));
  if(pending()||stale())return {status:'SKIPPED_PENDING_LOCAL_OPERATIONS'};
  const manager=managers(auth);
  const next={...local,clients:[],credits:[],payments:[],cashMovements:[],audit:[],commercial:[]};
  for(let i=0;i<names.length;i++){
    const name=names[i],target=MAP[name];
    const effective=rows[i];
    const reversed=name==='payments'?new Set(effective.filter(x=>x.recordType==='PAYMENT_REVERSAL'&&x.reversesPaymentId).map(x=>String(x.reversesPaymentId))):new Set();
    const alive=effective.filter(x=>x.tombstone!==true&&x.recordType!=='PAYMENT_REVERSAL'&&!reversed.has(rowId(x)));if(target==='cashMovements')next[target].push(...alive);else next[target]=alive;
  }
  next.session={...(local.session||{}),actorId:auth.uid,role:auth.role,routeIds:Array.isArray(auth.routeIds)?auth.routeIds:[],workerId:auth.workerId||''};
  if(!sameOwner)root.localStorage.setItem('mi-cartera-v2-preserved-state:'+previous,snapshot);
  root.localStorage.setItem('mi-cartera-v2-preserved-state:'+(previous||auth.uid),snapshot);
  root.localStorage.setItem(K,JSON.stringify(clone(next)));
  root.localStorage.setItem(OWNER,auth.uid);
  root.MiCarteraV2Cards?.render?.();
  dispatch('mi-cartera-v2-rehydrated',{ok:true,counts:{clients:next.clients.length,credits:next.credits.length,payments:next.payments.length,cashMovements:next.cashMovements.length},uploaded:upload.written,uploadFailed:upload.failed});
  dispatch('mi-cartera-v2-sync',{ok:true,source:'cloud-rehydration'});
  root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
  return {status:'REHYDRATED',uploaded:upload.written,uploadFailed:upload.failed};
}
async function rehydrate(){
  // Restore only this authenticated owner's local session. Reopening offline or
  // with a durable pending operation cannot wait for a Cloud snapshot to do it.
  const auth=root.MiCarteraV2AuthCloudGate?.state?.();
  if(auth?.ready&&auth.uid&&owner()===auth.uid&&!foreignPending(auth.uid)){
    const local=readLocal(),session={...(local.session||{}),actorId:auth.uid,role:auth.role,routeIds:Array.isArray(auth.routeIds)?auth.routeIds:[],workerId:auth.workerId||''};
    if(JSON.stringify(local.session)!==JSON.stringify(session)){
      root.localStorage.setItem(K,JSON.stringify({...local,session}));
      dispatch('mi-cartera-v2-sync',{ok:true,source:'verified-local-session'});
      root.MiCarteraV2Cards?.render?.();root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
    }
  }
  if(root.navigator.onLine===false)return {status:'OFFLINE'};
  const gate=root.MiCarteraV2OperationCommitGate;
  if(gate?.isActionRunning?.())return {status:'SKIPPED_BUSY'};
  const locks=root.navigator?.locks;
  return locks?.request?locks.request(gate?.ACTION_LOCK||'mi-cartera-v2-local-action',{mode:'exclusive',ifAvailable:true},lock=>lock?rehydrateUnlocked():{status:'SKIPPED_BUSY'}):rehydrateUnlocked();
}
async function rehydrateUnlocked(){
  if(hydrating)return {status:'SKIPPED_BUSY'};
  if(readState.nextAttemptAt>Date.now())return {status:'QUOTA_PAUSED',nextAttemptAt:readState.nextAttemptAt};
  hydrating=true;
  try{
    const result=await rehydrateOnce();
    if(result.status==='REHYDRATED'){
      readState.lastSuccessAt=Date.now();readState.lastError=result.uploadFailed?'LOCAL_UPLOAD_FAILED':null;readState.nextAttemptAt=0;
      try{root.localStorage.removeItem(RETRY_KEY)}catch{}
      dispatch('mi-cartera-v2-sync',{source:'cloud-read-complete'});
    }
    return result;
  }catch(error){
    readState.lastError=String(error?.code||error?.message||error);
    if(isQuota(error)){
      readState.nextAttemptAt=Date.now()+QUOTA_WAIT;
      try{root.localStorage.setItem(RETRY_KEY,String(readState.nextAttemptAt))}catch{}
    }
    dispatch('mi-cartera-v2-rehydrated',{ok:false,error:readState.lastError,nextAttemptAt:readState.nextAttemptAt});
    throw error;
  }finally{hydrating=false}
}
function clearOnLogout(e){
  if(e?.detail?.authenticated!==false)return;
  if(e?.detail?.preserveLocal===true){
    const local=readLocal();
    const previous=owner();if(previous)root.localStorage.setItem(OWNER,previous);
    // Sign-out hides the active session but intentionally retains all local V2
    // business rows. They can be rehydrated again after the same user signs in.
    root.localStorage.setItem(K,JSON.stringify({...local,session:null}));
    dispatch('mi-cartera-v2-sync',{ok:true,source:'logout-session-only'});
    root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
    return;
  }
  const local=readLocal(),next={...local,clients:[],credits:[],payments:[],cashMovements:[],audit:[],commercial:[],session:null};
  root.localStorage.setItem(K,JSON.stringify(next));
  dispatch('mi-cartera-v2-sync',{ok:true,source:'logout-clear'});
  root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
}
let running=false;
async function onAuth(e){
  clearOnLogout(e);
  if(!e?.detail?.ready||running)return;
  running=true;
  try{await rehydrate()}catch(error){dispatch('mi-cartera-v2-rehydrated',{ok:false,error:String(error?.code||error?.message||error)})}
  finally{running=false}
}
root.addEventListener('v2-auth-cloud-state',onAuth);
root.MiCarteraV2CloudRehydration={rehydrate,pending,foreignPending,assertOwner,isRunning:()=>hydrating,pushLocalMissing,state:()=>({...readState})};
// If Firebase restores an existing browser session before this script finishes
// loading, consume the already-published ready state after the shell is present.
if(root.document){
  const kick=()=>{const current=root.MiCarteraV2AuthCloudGate?.state?.();if(current?.ready)onAuth({detail:current})};
  if(root.document.readyState==='loading')root.addEventListener('DOMContentLoaded',kick);else setTimeout(kick,0);
}
})(window);
