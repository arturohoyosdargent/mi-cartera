// Mi Cartera PRO V2 — authenticated Cloud <-> local rehydration for the isolated pilot.
// Existing local V2 rows are uploaded only when their ID is absent in Cloud; Cloud rows win
// on an ID collision. This preserves local work without overwriting another device's data.
(function(root){'use strict';
const ORG='v2-mi-cartera-pilot',K='mi-cartera-v2-validation-state';
const MAP={clients:'clients',credits:'credits',payments:'payments',entries:'cashMovements',expenses:'cashMovements',audit:'audit'};
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
function pending(){
  try{
    const uid=root.MiCarteraV2AuthCloudGate?.state?.().uid||root.MiCarteraV2AuthCloudGate?.requireReady?.()?.uid;
    if(!uid)return false;
    // The scoped key is authoritative; the legacy unscoped key is checked once as a
    // safety stop for operations created by the earlier local-only build.
    for(const key of ['mi-cartera-v2-cloud-operations:'+uid,'mi-cartera-v2-cloud-operations']){
      const q=JSON.parse(root.localStorage.getItem(key)||'[]');
      if(Array.isArray(q)&&q.some(x=>!['SINCRONIZADO','BLOQUEADO','CONFLICTO'].includes(x?.status)))return true;
    }
    return false;
  }catch{return true}
}
async function readCollection(name,auth){
  const f=root.firestoreV2;
  if(!f?.db||!f?.collection||!f?.getDocs)throw new Error('V2_FIRESTORE_READ_NOT_READY');
  const base=f.collection(f.db,'orgs',ORG,name),refs=[];
  if(auth.role==='cobrador'){
    if(!f.query||!f.where)throw new Error('V2_FIRESTORE_QUERY_NOT_READY');
    if(name==='payments')refs.push(f.query(base,f.where('userId','==',auth.uid)));
    else if(name==='clients'||name==='credits')for(const rid of (auth.routeIds||[]))refs.push(f.query(base,f.where('routeId','==',rid)));
    else return [];
  }else refs.push(base);
  const out=[],seen=new Set();
  for(const ref of refs){
    const snap=await f.getDocs(ref);
    snap.forEach(d=>{const raw=d.data()||{};if(raw.tombstone===true)return;const data={...raw,id:raw.id||d.id};if(!seen.has(String(data.id))){seen.add(String(data.id));out.push(data)}});
  }
  return out;
}
function cloudRow(name,row,auth){
  const data=clone(row),id=rowId(data);if(!id)return null;data.id=id;
  if(name==='payments'&&!data.userId)data.userId=auth.uid;
  if(name==='audit'){if(!data.actorId)data.actorId=auth.uid;if(!data.role)data.role=auth.role;}
  return data;
}
async function pushLocalMissing(local,names,rows,auth){
  const f=root.firestoreV2;
  if(!managers(auth)||!f?.setDoc||!f?.doc)return {written:0,failed:0,available:false};
  const remoteByName=new Map();
  for(let i=0;i<names.length;i++)remoteByName.set(names[i],new Set((rows[i]||[]).map(rowId).filter(Boolean)));
  let written=0,failed=0;
  for(const name of names){
    const seen=remoteByName.get(name)||new Set();
    for(const row of localRows(local,name)){
      const data=cloudRow(name,row,auth),id=rowId(data);if(!data||seen.has(id))continue;
      try{
        await f.setDoc(f.doc(f.db,'orgs',ORG,name,id),data,{merge:true});
        seen.add(id);written++;
      }catch(error){failed++;console.warn('V2 local row was kept locally; Cloud upload failed',name,id,error)}
    }
  }
  return {written,failed,available:true};
}
async function rehydrate(){
  const auth=root.MiCarteraV2AuthCloudGate?.requireReady?.();
  if(!auth?.uid)throw new Error('V2_AUTH_REQUIRED');
  if(pending())return {status:'SKIPPED_PENDING_LOCAL_OPERATIONS'};
  const names=Object.keys(MAP).filter(n=>!MANAGER_ONLY.has(n)||managers(auth));
  let rows=await Promise.all(names.map(n=>readCollection(n,auth)));
  const local=readLocal();
  const upload=await pushLocalMissing(local,names,rows,auth);
  if(upload.written)rows=await Promise.all(names.map(n=>readCollection(n,auth)));
  const manager=managers(auth);
  const next={...local,clients:[],credits:[],payments:[],cashMovements:manager?[]:(Array.isArray(local.cashMovements)?local.cashMovements:[]),audit:[]};
  for(let i=0;i<names.length;i++){
    const name=names[i],target=MAP[name];
    const effective=manager&&upload.available?mergeMissing(rows[i],localRows(local,name)):rows[i];
    if(target==='cashMovements')next[target].push(...effective);
    else next[target]=effective;
  }
  next.session={...(local.session||{}),actorId:auth.uid,role:auth.role,routeIds:Array.isArray(auth.routeIds)?auth.routeIds:[]};
  root.localStorage.setItem(K,JSON.stringify(clone(next)));
  dispatch('mi-cartera-v2-rehydrated',{ok:true,counts:{clients:next.clients.length,credits:next.credits.length,payments:next.payments.length,cashMovements:next.cashMovements.length},uploaded:upload.written,uploadFailed:upload.failed});
  dispatch('mi-cartera-v2-sync',{ok:true,source:'cloud-rehydration'});
  root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
  return {status:'REHYDRATED',uploaded:upload.written,uploadFailed:upload.failed};
}
function clearOnLogout(e){
  if(e?.detail?.authenticated!==false)return;
  if(root.navigator?.onLine===false)return;
  if(e?.detail?.preserveLocal===true){
    const local=readLocal();
    // Sign-out hides the active session but intentionally retains all local V2
    // business rows. They can be rehydrated again after the same user signs in.
    root.localStorage.setItem(K,JSON.stringify({...local,session:null}));
    dispatch('mi-cartera-v2-sync',{ok:true,source:'logout-session-only'});
    root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();
    return;
  }
  const local=readLocal(),next={...local,clients:[],credits:[],payments:[],cashMovements:[],audit:[],session:null};
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
root.MiCarteraV2CloudRehydration={rehydrate,pending,pushLocalMissing};
// If Firebase restores an existing browser session before this script finishes
// loading, consume the already-published ready state after the shell is present.
if(root.document){
  const kick=()=>{const current=root.MiCarteraV2AuthCloudGate?.state?.();if(current?.ready)onAuth({detail:current})};
  if(root.document.readyState==='loading')root.addEventListener('DOMContentLoaded',kick);else setTimeout(kick,0);
}
})(window);
