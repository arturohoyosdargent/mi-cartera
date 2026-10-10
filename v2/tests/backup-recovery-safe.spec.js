const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Window}=require('happy-dom');
const ROOT=path.resolve(process.env.SOURCE||'v2'),KEY='mi-cartera-v2-validation-state',OWNER='mi-cartera-v2-local-owner';
const CURRENT_STABLE={sha:'b'.repeat(40),tag:'stable-certified-fixture-current',build:'v2-pilot-20261009-b2-certified-fixture-1'};
const PREVIOUS_STABLE={sha:'a'.repeat(40),tag:'stable-certified-fixture-previous',build:'v2-pilot-20261008-b2-certified-fixture-1'};
function fixture(){
  const w=new Window({url:'https://fixture.test/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});
  w.document.write('<main><button data-app-recovery>Recuperar app</button></main>');
  const context=vm.createContext(w),load=name=>{const file=path.join(ROOT,'app',name);if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:name});};
  const data={clients:[{id:'fictional-client',name:'Cliente ficticio'}],credits:[{id:'fictional-credit'}],payments:[{id:'fictional-payment',amount:30}],cashMovements:[{id:'fictional-cash',amount:50}],audit:[],session:{actorId:'fixture-admin',role:'ADMIN'}};
  for(const [key,value] of Object.entries({[KEY]:JSON.stringify(data),[OWNER]:'fixture-admin','mi-cartera-v2-before-client-migration':'historical-fixture','mi-cartera-v2-cloud-operations:fixture-admin':'[{"status":"PENDING"}]','firebase:authUser:fixture':'fictional-token'}))w.localStorage.setItem(key,value);
  let auth={ready:true,authenticated:true,member:true,uid:'fixture-admin',role:'admin'},unsaved=false,accept=true;
  const calls={confirm:[],release:[],verify:0,update:0,messages:[],reload:0},alerts=[];
  w.alert=x=>alerts.push(String(x));w.confirm=x=>{calls.confirm.push(String(x));return accept;};w.location.reload=()=>{calls.reload++;};
  w.MiCarteraV2AuthCloudGate={ORG:'fixture-authenticated-org',state:()=>({...auth}),requireReady:()=>{if(!auth.ready)throw Error('AUTH_NOT_READY');return {...auth};}};
  w.MiCarteraV2VersionGuard={state:()=>({ready:true,publishedBuild:'v2-pilot-20261008-b2-installed-fixture-1',workerBuild:'v2-pilot-20261008-b2-installed-fixture-1'}),verify:async()=>{calls.verify++;return {ready:true};}};
  w.MiCarteraV2StableCatalog={current:{...CURRENT_STABLE},previous:{...PREVIOUS_STABLE}};
  w.MiCarteraV2Refresh={unsaved:()=>unsaved,run:()=>{throw Error('Recovery must never refresh financial data');}};
  w.MiCarteraV2CloudRehydration={rehydrate:()=>{throw Error('Recovery must never rehydrate financial data');}};
  w.firebaseAuthV2={auth:{currentUser:{uid:'fixture-admin'}},signOut:()=>{throw Error('Recovery must never touch Auth');}};
  w.firestoreV2={getDoc:()=>{throw Error('Recovery must never access Firestore');},setDoc:()=>{throw Error('Recovery must never write Firestore');}};
  const registration={scope:'https://fixture.test/app/',update:async()=>{calls.update++;},waiting:{postMessage:message=>calls.messages.push(message)}};
  Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{getRegistration:async scope=>{a.equal(String(scope),'https://fixture.test/app/');return registration;}}});
  Object.defineProperty(w.navigator,'onLine',{configurable:true,value:true});
  w.fetch=async(url,options)=>{calls.release.push({url:String(url),options});return {ok:true,json:async()=>({build:'v2-pilot-20261009-b2-published-fixture-1'})};};
  const snapshot=()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}));
  return {w,load,data,calls,alerts,registration,snapshot,accept:v=>accept=v,unsaved:v=>unsaved=v,auth:v=>{auth={...auth,...v};},close:()=>w.happyDOM.abort()};
}
function recovery(h){h.load('app-recovery-v2.js');a.ok(h.w.MiCarteraV2AppRecovery,'The app recovery module must expose its guarded UI API');return h.w.MiCarteraV2AppRecovery;}
function stableRecovery(h){const api=recovery(h);a.equal(typeof api.prepareStableRestore,'function','Preparing the certified stable administrative request must be implemented');a.equal(typeof api.copyStableRequest,'function','Copying the guarded stable request must be implemented');return api;}

test('backup UI retires V1 migration and reversal while keeping V2 download and restore',async()=>{const h=fixture();try{
  h.load('backup-v2.js');h.w.MiCarteraV2Backup.open();const panel=h.w.document.getElementById('v2BackupPanel');
  a.doesNotMatch(panel.textContent,/Importar clientes desde V1|Revertir importación|Reversión/);a.equal(panel.querySelector('#v1ClientsFile'),null);a.equal(panel.querySelector('#inspectV1Clients'),null);a.equal(panel.querySelector('#rollbackClientMigration'),null);
  a.ok(panel.querySelector('#v2BackupDownload'));a.ok(panel.querySelector('#v2RestoreFile'));a.ok(panel.querySelector('#v2RestoreApply'));a.deepEqual(JSON.parse(JSON.stringify(h.w.MiCarteraV2Backup.payload().counts)),{clients:1,credits:1,payments:1,cashMovements:1});
  for(const name of ['validate','inspect','apply','rollback'])a.equal(h.w.MiCarteraV2Backup[name],undefined,'Historical V1 actions must not remain callable from the active browser API');
}finally{await h.close();}});

test('V2 restore retains its existing confirmation and before-restore snapshot',async()=>{const h=fixture();try{
  h.load('backup-v2.js');const api=h.w.MiCarteraV2Backup,raw={app:'Mi Cartera PRO V2',schema:'v2-backup',version:2,db:{...h.data,clients:[{id:'restored-fictional-client',name:'Respaldo ficticio'}]}};
  const before=h.snapshot();h.accept(false);a.equal(api.restoreV2(raw),false);a.deepEqual(h.snapshot(),before);
  h.accept(true);a.equal(api.restoreV2(raw),true);a.deepEqual(JSON.parse(h.w.localStorage.getItem(KEY)),raw.db);a.deepEqual(JSON.parse(h.w.localStorage.getItem('mi-cartera-v2-before-restore')).db,h.data);
  a.throws(()=>api.restoreV2({db:{clients:[]}}),/respaldo válido/);
}finally{await h.close();}});

test('authenticated administrator sees installed app and certified current/previous identities from the catalog',async()=>{const h=fixture();try{
  const api=recovery(h),before=h.snapshot();a.equal(api.canOpen(),true);a.equal(api.open(),true);const panel=h.w.document.getElementById('v2AppRecoveryPanel');
  a.match(panel.textContent,/v2-pilot-20261008-b2-installed-fixture-1/);a.match(panel.textContent,new RegExp(CURRENT_STABLE.sha));a.match(panel.textContent,new RegExp(CURRENT_STABLE.tag));a.match(panel.textContent,new RegExp(CURRENT_STABLE.build));a.match(panel.textContent,new RegExp(PREVIOUS_STABLE.sha));
  a.equal(panel.querySelector('#v2AppRecoveryStable').textContent,'Restaurar última versión estable');
  a.match(panel.textContent,/administrativ|publicación/i);a.match(panel.textContent,/datos|cartera/i);a.equal(panel.querySelector('input[type=file]'),null);a.equal(panel.querySelector('[data-rollback]'),null);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('recovery fails closed for absent authentication, membership, admin role or matching owner',async()=>{
  for(const scenario of ['missing-gate','not-ready','not-authenticated','not-member','no-uid','collector','supervisor','no-owner','foreign-owner','missing-firebase-user','foreign-firebase-user']){const h=fixture();try{
    const api=recovery(h);if(scenario==='missing-gate')h.w.MiCarteraV2AuthCloudGate=null;if(scenario==='not-ready')h.auth({ready:false});if(scenario==='not-authenticated')h.auth({authenticated:false});if(scenario==='not-member')h.auth({member:false});if(scenario==='no-uid')h.auth({uid:null});if(scenario==='collector')h.auth({role:'cobrador'});if(scenario==='supervisor')h.auth({role:'supervisor'});if(scenario==='no-owner')h.w.localStorage.removeItem(OWNER);if(scenario==='foreign-owner')h.w.localStorage.setItem(OWNER,'another-fictional-owner');
    if(scenario==='missing-firebase-user')h.w.firebaseAuthV2.auth.currentUser=null;if(scenario==='foreign-firebase-user')h.w.firebaseAuthV2.auth.currentUser={uid:'another-fictional-user'};
    const before=h.snapshot();a.equal(api.canOpen(),false,scenario);a.equal(api.open(),false,scenario);a.equal((await api.checkAndUpdate()).status,'BLOCKED',scenario);a.equal(api.reload(),false,scenario);api.syncAccess();a.equal(h.w.document.querySelector('[data-app-recovery]').hidden,true);a.equal(h.w.document.querySelector('[data-app-recovery]').disabled,true);a.equal(h.calls.confirm.length,0);a.equal(h.calls.release.length,0);a.equal(h.calls.update,0);a.deepEqual(h.snapshot(),before);
  }finally{await h.close();}}
});

test('confirmed recovery requests only the current published release and app worker without mutating data or Auth',async()=>{const h=fixture();try{
  const api=recovery(h);api.open();const before=h.snapshot();const result=await api.checkAndUpdate();
  a.equal(result.status,'UPDATE_REQUESTED');a.equal(result.publishedBuild,'v2-pilot-20261009-b2-published-fixture-1');a.equal(h.calls.confirm.length,1);a.match(h.calls.confirm[0],/publicad/i);a.match(h.calls.confirm[0],/datos/i);a.match(h.calls.confirm[0],/rollback|estable/i);
  a.equal(h.calls.release.length,1);a.match(h.calls.release[0].url,/^\.\/release\.json\?ts=\d+$/);a.equal(h.calls.release[0].options.cache,'no-store');a.equal(h.calls.verify,1);a.equal(h.calls.update,1);a.deepEqual(JSON.parse(JSON.stringify(h.calls.messages)),[{type:'SKIP_WAITING'}]);a.equal(h.calls.reload,0);a.deepEqual(h.snapshot(),before);
  a.match(h.w.document.getElementById('v2AppRecoveryStatus').textContent,/v2-pilot-20261009-b2-published-fixture-1/);a.equal(h.w.document.getElementById('v2AppRecoveryReload').disabled,false);
}finally{await h.close();}});

test('cancelled confirmation, unsaved forms and offline state prevent any app update',async()=>{for(const scenario of ['cancel','unsaved','offline']){const h=fixture();try{
  const api=recovery(h);if(scenario==='cancel')h.accept(false);if(scenario==='unsaved')h.unsaved(true);if(scenario==='offline')Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:false});
  const before=h.snapshot(),result=await api.checkAndUpdate();a.equal(result.status,scenario==='cancel'?'CANCELLED':'BLOCKED');a.equal(h.calls.release.length,0);a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.calls.reload,0);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}}});

test('session change while checking release closes recovery and prevents later worker activation',async()=>{const h=fixture();try{
  const api=recovery(h);api.open();let finish;h.w.fetch=()=>new Promise(resolve=>finish=resolve);const before=h.snapshot(),pending=api.checkAndUpdate();h.auth({uid:'different-fictional-admin'});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true,uid:'different-fictional-admin'}}));
  a.equal(h.w.document.getElementById('v2AppRecoveryPanel'),null);finish({ok:true,json:async()=>({build:'v2-pilot-20261009-b2-published-fixture-1'})});a.equal((await pending).status,'BLOCKED');a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.calls.messages.length,0);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('invalid or unavailable publication cannot activate a worker or offer recovery as a stable rollback',async()=>{for(const response of [{ok:false,json:async()=>({})},{ok:true,json:async()=>({})},{ok:true,json:async()=>({build:'<script>invalid-release</script>'})}]){const h=fixture();try{
  const api=recovery(h);api.open();h.w.fetch=async()=>response;const before=h.snapshot(),result=await api.checkAndUpdate();a.equal(result.status,'FAILED');a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.calls.messages.length,0);a.equal(h.w.document.getElementById('v2AppRecoveryReload').disabled,true);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}}});

test('reload is separately confirmed after preparation and rechecks forms and authentication',async()=>{const h=fixture();try{
  const api=recovery(h);api.open();a.equal(api.reload(),false);await api.checkAndUpdate();const before=h.snapshot();h.accept(false);a.equal(api.reload(),false);a.equal(h.calls.reload,0);h.accept(true);h.unsaved(true);a.equal(api.reload(),false);a.equal(h.calls.reload,0);h.unsaved(false);a.equal(api.reload(),true);a.equal(h.calls.reload,1);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('a browser without an app worker can prepare a truthful confirmed reload of current Hosting',async()=>{const h=fixture();try{
  delete h.w.navigator.serviceWorker;const api=recovery(h);api.open();const before=h.snapshot(),result=await api.checkAndUpdate();a.equal(result.status,'RELOAD_READY');a.equal(h.calls.update,0);a.match(h.w.document.getElementById('v2AppRecoveryStatus').textContent,/sin.*worker|navegador/i);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('a form edited during the publication request prevents worker update and reload preparation',async()=>{const h=fixture();try{
  const api=recovery(h);api.open();let finish;h.w.fetch=()=>new Promise(resolve=>finish=resolve);const before=h.snapshot(),pending=api.checkAndUpdate();h.unsaved(true);finish({ok:true,json:async()=>({build:'v2-pilot-20261009-b2-published-fixture-1'})});
  a.equal((await pending).status,'BLOCKED');a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.w.document.getElementById('v2AppRecoveryReload').disabled,true);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('wrong worker scope and worker update failure cannot prepare an app reload',async()=>{for(const scenario of ['wrong-scope','update-failed']){const h=fixture();try{
  const api=recovery(h);api.open();if(scenario==='wrong-scope')h.registration.scope='https://fixture.test/other-app/';else h.registration.update=async()=>{throw Error('Fictional network update failure');};const before=h.snapshot(),result=await api.checkAndUpdate();
  a.equal(result.status,'FAILED');a.equal(h.calls.messages.length,0);a.equal(h.w.document.getElementById('v2AppRecoveryReload').disabled,true);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}}});

test('restoring the latest certified stable prepares only a confirmed administrative request with catalog metadata',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();const before=h.snapshot(),result=api.prepareStableRestore();
  a.equal(result.status,'STABLE_REQUEST_PREPARED');a.deepEqual(JSON.parse(JSON.stringify(result.metadata.target)),CURRENT_STABLE);a.deepEqual(JSON.parse(JSON.stringify(result.metadata.previousStable)),PREVIOUS_STABLE);a.equal(result.metadata.scope,'APP_CODE_ONLY');a.equal(result.metadata.approvalRequired,true);a.equal(result.metadata.status,'PENDING_ADMINISTRATIVE_PUBLICATION');
  a.match(h.calls.confirm[0],new RegExp(CURRENT_STABLE.sha));a.match(h.calls.confirm[0],new RegExp(CURRENT_STABLE.build));a.match(h.calls.confirm[0],new RegExp(CURRENT_STABLE.tag));a.match(h.calls.confirm[0],/datos/i);a.match(h.calls.confirm[0],/solicitud|no.*publica/i);
  const text=h.w.document.getElementById('v2StableRestoreRequest').textContent;a.match(text,new RegExp(CURRENT_STABLE.sha));a.match(text,/PENDING_ADMINISTRATIVE_PUBLICATION/);a.doesNotMatch(h.w.document.getElementById('v2AppRecoveryStatus').textContent,/ya restaurad|restaurad[ao] correctamente/i);a.equal(h.calls.release.length,0);a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.calls.reload,0);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('missing or invalid stable catalogs block stable requests while installed version and auxiliary refresh remain available',async()=>{for(const catalog of [undefined,{current:{sha:'invalid',tag:'unsafe',build:CURRENT_STABLE.build}},{current:{sha:CURRENT_STABLE.sha,build:CURRENT_STABLE.build}},{latestPublished:CURRENT_STABLE,previous:PREVIOUS_STABLE}]){const h=fixture();try{
  h.w.MiCarteraV2StableCatalog=catalog;const api=stableRecovery(h);api.open();const before=h.snapshot();a.match(h.w.document.getElementById('v2AppRecoveryInstalled').textContent,/installed-fixture/);a.equal(h.w.document.getElementById('v2AppRecoveryStable').disabled,true);a.equal(api.prepareStableRestore().status,'BLOCKED');a.equal(h.calls.confirm.length,0);a.equal((await api.checkAndUpdate()).status,'UPDATE_REQUESTED');a.deepEqual(h.snapshot(),before);
}finally{await h.close();}}});

test('cancelling or losing administrator access cannot prepare or copy a stable request',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();const before=h.snapshot();h.accept(false);a.equal(api.prepareStableRestore().status,'CANCELLED');a.equal(h.w.document.getElementById('v2StableRestoreRequest').textContent,'');h.accept(true);api.prepareStableRestore();h.auth({role:'cobrador'});a.equal(api.prepareStableRestore().status,'BLOCKED');a.equal((await api.copyStableRequest()).status,'BLOCKED');a.equal(h.calls.release.length,0);a.equal(h.calls.update,0);a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('changing the organization getter blocks recovery until a matching complete authenticated-ready event verifies it',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();api.prepareStableRestore();const before=h.snapshot();h.w.MiCarteraV2AuthCloudGate.ORG='another-fictional-org';a.equal(api.canOpen(),false);a.equal(api.prepareStableRestore().status,'BLOCKED');a.equal(Boolean(h.w.document.getElementById('v2AppRecoveryPanel')),false);
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true}}));a.equal(api.canOpen(),false);h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true,authenticated:true,member:true,uid:'fixture-admin',role:'admin'}}));a.equal(api.canOpen(),true);a.equal(api.prepareStableRestore().status,'STABLE_REQUEST_PREPARED');a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('certified stable changes come only from the catalog and invalidate previously prepared requests',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();api.prepareStableRestore();h.w.MiCarteraV2StableCatalog={current:{sha:'c'.repeat(40),tag:'stable-next-approved-fixture',build:'v2-pilot-20261010-b2-certified-fixture-1'},previous:{...CURRENT_STABLE}};
  const before=h.snapshot();a.equal((await api.copyStableRequest()).status,'BLOCKED');api.open();const panel=h.w.document.getElementById('v2AppRecoveryPanel');a.match(panel.textContent,/stable-next-approved-fixture/);a.match(panel.textContent,new RegExp(CURRENT_STABLE.tag));const request=api.prepareStableRestore();a.equal(request.metadata.target.sha,'c'.repeat(40));a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});

test('stable request copy uses available clipboard only and never contacts a publication endpoint',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();api.prepareStableRestore();let copied='';Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value;}}});const before=h.snapshot();a.equal((await api.copyStableRequest()).status,'COPIED');a.deepEqual(JSON.parse(copied).target,CURRENT_STABLE);a.equal(h.calls.release.length,0);a.equal(h.calls.verify,0);a.equal(h.calls.update,0);a.equal(h.calls.reload,0);a.deepEqual(h.snapshot(),before);
  Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:undefined});a.equal((await api.copyStableRequest()).status,'UNAVAILABLE');a.match(h.w.document.getElementById('v2AppRecoveryStatus').textContent,/seleccion|copiar/i);
}finally{await h.close();}});

test('an authenticated owner transition closes the old panel even when the incoming owner is also an administrator',async()=>{const h=fixture();try{
  const api=stableRecovery(h);api.open();api.prepareStableRestore();h.auth({uid:'second-fictional-admin'});h.w.firebaseAuthV2.auth.currentUser={uid:'second-fictional-admin'};h.w.localStorage.setItem(OWNER,'second-fictional-admin');const before=h.snapshot();
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true,authenticated:true,member:true,uid:'second-fictional-admin',role:'admin'}}));a.equal(api.canOpen(),true);a.equal(Boolean(h.w.document.getElementById('v2AppRecoveryPanel')),false);a.equal((await api.copyStableRequest()).status,'BLOCKED');a.deepEqual(h.snapshot(),before);
}finally{await h.close();}});
