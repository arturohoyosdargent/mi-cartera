// Mi Cartera PRO V2 — request certified stable app recovery, independently of data.
(function(root){'use strict';
const OWNER='mi-cartera-v2-local-owner',$=id=>document.getElementById(id);
const BUILD=/^v2-pilot-\d{8}-b2-[a-z0-9-]+-\d+$/;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,prepared=null,stableRequest=null,authRevision=0;
function authenticatedOrganization(detail,initial=false){const gate=root.MiCarteraV2AuthCloudGate,a=gate?.state?.(),firebaseUid=root.firebaseAuthV2?.auth?.currentUser?.uid;if(!a||a.ready!==true||a.authenticated!==true||a.member!==true||!a.uid||firebaseUid!==a.uid)return null;if(!initial&&(!detail||detail.ready!==true||detail.authenticated!==true||detail.member!==true||detail.uid!==a.uid||String(detail.role||'').toLowerCase()!==String(a.role||'').toLowerCase()))return null;return {uid:a.uid,org:String(gate.ORG||'')}}
let verifiedOrganization=authenticatedOrganization(null,true);
function stable(value){return value&&typeof value.sha==='string'&&/^[a-f0-9]{40}$/.test(value.sha)&&typeof value.build==='string'&&BUILD.test(value.build)&&typeof value.tag==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value.tag)?{sha:value.sha,build:value.build,tag:value.tag}:null}
function catalog(){const value=root.MiCarteraV2StableCatalog;return {current:stable(value?.current),previous:stable(value?.previous)}}
function catalogIdentity(){return JSON.stringify(catalog())}
function identity(){const a=root.MiCarteraV2AuthCloudGate?.state?.()||{};let owner='';try{owner=localStorage.getItem(OWNER)||''}catch{}return JSON.stringify([a.ready,a.authenticated,a.member,a.uid,String(a.role||'').toLowerCase(),root.firebaseAuthV2?.auth?.currentUser?.uid,owner,root.MiCarteraV2AuthCloudGate?.ORG||''])}
let lastIdentity=identity();
function track(){const next=identity();if(next!==lastIdentity){lastIdentity=next;authRevision++;prepared=null;stableRequest=null;$('v2AppRecoveryPanel')?.remove()}}
function permit(){
 const gate=root.MiCarteraV2AuthCloudGate,a=gate?.state?.(),verified=gate?.requireReady?.();
 if(!a||a.ready!==true||a.authenticated!==true||a.member!==true||!a.uid||String(a.role||'').toLowerCase()!=='admin'||!verified||verified.uid!==a.uid||String(verified.role||'').toLowerCase()!=='admin'||String(localStorage.getItem(OWNER)||'')!==String(a.uid))throw Error('Sólo el administrador autenticado de esta cartera puede recuperar la app.');
 if(!verifiedOrganization||verifiedOrganization.uid!==a.uid||verifiedOrganization.org!==String(gate.ORG||''))throw Error('La organización cambió o no está verificada. Espera una nueva validación de la sesión antes de recuperar la app.');
 const firebaseUid=root.firebaseAuthV2?.auth?.currentUser?.uid;
 if(!firebaseUid||String(firebaseUid)!==String(a.uid))throw Error('La sesión cambió. Vuelve a abrir Recuperar app.');
 return a;
}
function canOpen(){try{permit();return true}catch{return false}}
function scope(){track();const a=permit();return JSON.stringify([a.uid,localStorage.getItem(OWNER),root.MiCarteraV2AuthCloudGate?.ORG||'',authRevision])}
function assertScope(expected){if(scope()!==expected)throw Error('La sesión cambió. Vuelve a abrir Recuperar app.')}
function message(text){const el=$('v2AppRecoveryStatus');if(el)el.textContent=text}
function blocked(text){return Object.assign(Error(text),{code:'V2_APP_RECOVERY_BLOCKED'})}
function safe(){permit();if(!root.MiCarteraV2Refresh?.unsaved)throw blocked('La protección de formularios no está disponible. Vuelve a abrir la app.');if(root.MiCarteraV2Refresh.unsaved())throw blocked('Guarda el cliente o el crédito antes de recuperar la app.');if(navigator.onLine===false)throw blocked('Conéctate a Internet para buscar la app publicada.');}
function assertSafeScope(expected){assertScope(expected);safe()}
function syncAccess(){track();const allowed=canOpen();document.querySelectorAll('[data-app-recovery]').forEach(b=>{b.hidden=!allowed;b.disabled=!allowed});if(!allowed){$('v2AppRecoveryPanel')?.remove();prepared=null;stableRequest=null}return allowed}
function installed(){const s=root.MiCarteraV2VersionGuard?.state?.()||{};const build=$('v2AppRecoveryInstalled');if(build)build.textContent=s.publishedBuild||'No disponible';const worker=$('v2AppRecoveryWorker');if(worker)worker.textContent=s.workerBuild||'No verificada'}
function open(){
 if(!syncAccess()){alert('Sólo el administrador autenticado de esta cartera puede recuperar la app.');return false}
 $('v2AppRecoveryPanel')?.remove();prepared=null;stableRequest=null;const versions=catalog(),describe=v=>v?'<p>'+esc(v.build)+'</p><p>SHA: '+esc(v.sha)+'<br>Tag: '+esc(v.tag)+'</p>':'<p>No hay una versión certificada identificada en el catálogo.</p>',el=document.createElement('div');el.id='v2AppRecoveryPanel';el.className='card';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v2AppRecoveryTitle');el.style='position:fixed;inset:4% 3%;z-index:9999;overflow:auto;background:#fff;padding:18px;box-shadow:0 10px 40px #0004';
 el.innerHTML='<button class="btn" id="v2AppRecoveryClose" type="button">✕ Cerrar</button><h2 id="v2AppRecoveryTitle">Restaurar última versión estable</h2><p>Prepara una solicitud administrativa para restaurar el código de la última app estable certificada. Conserva los datos de tu cartera; no restaura respaldos ni reemplaza pagos, créditos o caja.</p><div class="card"><b>Versión instalada</b><p id="v2AppRecoveryInstalled"></p><p>Service worker informado: <span id="v2AppRecoveryWorker"></span></p></div><div class="card"><b>Última versión estable certificada</b>'+describe(versions.current)+'<p>La restauración requiere una publicación administrativa autorizada. Este panel prepara la solicitud; no cambia Firebase Hosting ni publica la estable.</p><b>Estable inmediatamente anterior</b>'+describe(versions.previous)+'</div><button class="btn blue" id="v2AppRecoveryStable" type="button" '+(versions.current?'':'disabled')+'>Restaurar última versión estable</button><pre id="v2StableRestoreRequest" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><button class="btn" id="v2StableRestoreCopy" type="button" disabled>Copiar solicitud administrativa</button><hr><h3>Acción auxiliar: app publicada actualmente</h3><p>Busca el código que está publicado ahora. Esta acción no restaura la última versión estable.</p><button class="btn" id="v2AppRecoveryUpdate" type="button">Buscar y actualizar app publicada</button><button class="btn" id="v2AppRecoveryReload" type="button" disabled>Recargar app actual</button><p id="v2AppRecoveryStatus" role="status" aria-live="polite">El respaldo y restore de datos V2 se gestionan por separado. La solicitud de estable no ejecuta una publicación.</p>';
 document.body.appendChild(el);$('v2AppRecoveryClose').onclick=()=>el.remove();$('v2AppRecoveryStable').onclick=prepareStableRestore;$('v2StableRestoreCopy').onclick=copyStableRequest;$('v2AppRecoveryUpdate').onclick=checkAndUpdate;$('v2AppRecoveryReload').onclick=reload;installed();return true;
}
function clearStableRequest(){stableRequest=null;if($('v2StableRestoreRequest'))$('v2StableRestoreRequest').textContent='';if($('v2StableRestoreCopy'))$('v2StableRestoreCopy').disabled=true}
function requireStableRequest(){const current=catalog();if(!current.current)throw blocked('No hay un catálogo válido de versiones estables certificadas. La versión instalada sigue disponible.');return current}
function prepareStableRestore(){
 if(busy)return {status:'BUSY'};
 let expected,versions,versionIdentity;try{permit();expected=scope();versions=requireStableRequest();versionIdentity=catalogIdentity()}catch(error){syncAccess();clearStableRequest();message(error.message);return {status:'BLOCKED',reason:error.message}}
 const target=versions.current;
 if(!confirm('Preparar solicitud administrativa para restaurar la APP a la última versión estable certificada:\nBuild: '+target.build+'\nSHA: '+target.sha+'\nTag: '+target.tag+'\nSe conservarán los DATOS actuales de la cartera. Este botón no publica ni cambia Hosting; la restauración requiere autorización y ejecución del procedimiento manual protegido. ¿Preparar solicitud?'))return {status:'CANCELLED'};
 try{assertScope(expected);if(catalogIdentity()!==versionIdentity)throw blocked('Cambió el catálogo certificado. Vuelve a abrir la recuperación.');
  const metadata={action:'RESTORE_LAST_CERTIFIED_STABLE_APP',status:'PENDING_ADMINISTRATIVE_PUBLICATION',scope:'APP_CODE_ONLY',requestedAt:new Date().toISOString(),requestedBy:permit().uid,target,previousStable:versions.previous,approvalRequired:true,preserve:['financial-data','auth-session','pending-operations']};
  stableRequest={scope:expected,catalogIdentity:versionIdentity,metadata};if($('v2StableRestoreRequest'))$('v2StableRestoreRequest').textContent=JSON.stringify(metadata,null,2);if($('v2StableRestoreCopy'))$('v2StableRestoreCopy').disabled=false;message('Solicitud preparada para revisión administrativa. La app aún no se ha restaurado; la publicación requiere autorización. Los datos de la cartera se conservan.');return {status:'STABLE_REQUEST_PREPARED',metadata};
 }catch(error){syncAccess();clearStableRequest();message(error.message);return {status:'BLOCKED',reason:error.message}}
}
async function copyStableRequest(){
 let request;try{permit();request=stableRequest;if(!request)throw blocked('Primero prepara la solicitud para la última estable certificada.');assertScope(request.scope);if(catalogIdentity()!==request.catalogIdentity)throw blocked('Cambió el catálogo certificado. Prepara otra solicitud.')}catch(error){syncAccess();clearStableRequest();message(error.message);return {status:'BLOCKED',reason:error.message}}
 if(typeof navigator.clipboard?.writeText!=='function'){message('El navegador no permite copiar automáticamente. Puedes seleccionar y copiar la solicitud mostrada.');return {status:'UNAVAILABLE'}}
 try{await navigator.clipboard.writeText(JSON.stringify(request.metadata,null,2));assertScope(request.scope);if(catalogIdentity()!==request.catalogIdentity)throw blocked('Cambió el catálogo certificado. Prepara otra solicitud.');message('Solicitud administrativa copiada. No se ejecutó una publicación ni una restauración.');return {status:'COPIED'}}catch(error){const allowed=syncAccess();if(!allowed||error.code==='V2_APP_RECOVERY_BLOCKED'){clearStableRequest();message(error.message);return {status:'BLOCKED',reason:error.message}}message('No se pudo copiar automáticamente. Puedes seleccionar y copiar la solicitud mostrada.');return {status:'UNAVAILABLE',reason:error.message}}
}
async function checkAndUpdate(){
 if(busy)return {status:'BUSY'};
 let expected;try{safe();expected=scope()}catch(error){syncAccess();message(error.message);return {status:'BLOCKED',reason:error.message}}
 if(!confirm('Acción auxiliar: se buscará y preparará el código de la app publicada actualmente y su service worker. No restaura la última versión estable ni restaura datos de la cartera. La recarga se confirma por separado. ¿Continuar?'))return {status:'CANCELLED'};
 try{safe();assertScope(expected)}catch(error){syncAccess();message(error.message);return {status:'BLOCKED',reason:error.message}}
 busy=true;prepared=null;const button=$('v2AppRecoveryUpdate');if(button)button.disabled=true;if($('v2AppRecoveryReload'))$('v2AppRecoveryReload').disabled=true;message('Buscando la app publicada…');
 try{
  const response=await root.fetch('./release.json?ts='+Date.now(),{cache:'no-store'});assertSafeScope(expected);
  if(!response.ok)throw Error('No se pudo consultar la publicación actual. No se preparó una recuperación.');
  const release=await response.json();assertSafeScope(expected);
  if(typeof release?.build!=='string'||!BUILD.test(release.build))throw Error('La publicación no informa una versión V2 válida. No se preparó una recuperación.');
  if(!root.MiCarteraV2VersionGuard?.verify)throw Error('El verificador de versión no está disponible.');
  await root.MiCarteraV2VersionGuard.verify();assertSafeScope(expected);
  let registration=null;
  if(navigator.serviceWorker?.getRegistration){
   const appScope=new URL('./',root.location.href).href;registration=await navigator.serviceWorker.getRegistration(appScope);assertSafeScope(expected);
   if(registration){if(registration.scope!==appScope)throw Error('El service worker no pertenece a esta app. No se modificó su registro.');await registration.update();assertSafeScope(expected);if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'})}
  }
  prepared={scope:expected,publishedBuild:release.build};installed();if($('v2AppRecoveryReload'))$('v2AppRecoveryReload').disabled=false;
  message(registration?'Publicada: '+release.build+'. Se solicitó actualizar el service worker. Recarga la app para comprobar la versión instalada; esta solicitud no confirma un rollback al estable.':'Publicada: '+release.build+'. Este navegador no tiene un service worker registrado para la app. Puedes recargar para abrir la publicación actual.');
  return {status:registration?'UPDATE_REQUESTED':'RELOAD_READY',publishedBuild:release.build};
 }catch(error){const allowed=syncAccess();message(error.message||'No se pudo preparar la recuperación de la app.');return {status:!allowed||error.code==='V2_APP_RECOVERY_BLOCKED'?'BLOCKED':'FAILED',reason:error.message}}
 finally{busy=false;if(button&&canOpen())button.disabled=false}
}
function reload(){
 try{safe();if(!prepared){message('Primero busca la app publicada.');return false}assertScope(prepared.scope)}catch(error){syncAccess();message(error.message);return false}
 if(!confirm('Se recargará la app para abrir la publicación actual '+prepared.publishedBuild+'. No se importará un respaldo ni se restaurarán datos de la cartera. La sincronización normal de la app seguirá su procedimiento habitual. ¿Recargar?'))return false;
 try{safe();assertScope(prepared.scope);root.location.reload();return true}catch(error){syncAccess();message(error.message);return false}
}
function install(){document.querySelectorAll('[data-app-recovery]').forEach(b=>b.onclick=open);syncAccess()}
root.MiCarteraV2AppRecovery={open,canOpen,prepareStableRestore,copyStableRequest,checkAndUpdate,reload,install,syncAccess};
root.addEventListener('v2-auth-cloud-state',event=>{verifiedOrganization=authenticatedOrganization(event.detail);syncAccess()});root.addEventListener('storage',syncAccess);root.addEventListener('v2-version-state',installed);
root.addEventListener('v2-local-owner-ready',()=>{const proof=root.MiCarteraV2LocalOwnershipBootstrap?.state?.(),who=authenticatedOrganization(null,true),a=root.MiCarteraV2AuthCloudGate?.state?.();verifiedOrganization=proof?.ready===true&&who&&proof.uid===who.uid&&proof.orgId===who.org&&proof.role===String(a?.role||'').toLowerCase()?who:null;syncAccess()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
