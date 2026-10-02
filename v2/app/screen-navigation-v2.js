// Mi Cartera PRO V2 — consistent close/back controls for every secondary screen.
(function(root){'use strict';
const HOME='home',KEY='mi-cartera-v2-validation-state',OWNER='mi-cartera-v2-local-owner';
function canReadLocal(){
  try{
    const auth=root.MiCarteraV2AuthCloudGate?.state?.(),local=JSON.parse(root.localStorage.getItem(KEY)||'{}');
    const actor=String(local.session?.actorId||''),owner=String(root.localStorage.getItem(OWNER)||actor);
    return !!(auth?.ready&&auth.uid&&actor===String(auth.uid)&&owner===String(auth.uid));
  }catch{return false}
}
function syncVisibility(){
  const allowed=canReadLocal();
  document.querySelectorAll('main .page').forEach(page=>{
    const blocked=page.id!=='security'&&!allowed;
    page.hidden=blocked;page.inert=blocked;page.style.display=blocked?'none':'';
    if(!allowed)page.classList.toggle('active',page.id==='security');
  });
  if(!allowed){
    document.getElementById('v2SharePreview')?.remove();
    document.getElementById('v2RenewalReview')?.remove();
    document.getElementById('v2RenewCancel')?.click();
    document.getElementById('v2RenewalHub')?.remove();
    document.getElementById('v2BackupPanel')?.remove();
    document.getElementById('partnerForm')?.remove();
  }
}
function guardShow(){
  if(typeof root.show!=='function'||root.show.__v2SessionViewGuard)return;
  const original=root.show;
  const guarded=function(target){syncVisibility();return original.call(root,canReadLocal()?target:'security')};
  guarded.__v2SessionViewGuard=true;root.show=guarded;
}
function go(target){if(typeof root.show==='function')root.show(target||HOME)}
function close(){const active=document.querySelector('.page.active')?.id||'';const parent={clientForm:'clients',creditForm:'credits',agenda:'home',collections:'home',cash:'more',reports:'more',security:'more',admin:'more',more:'home',clients:'home',credits:'home'}[active]||HOME;go(parent)}
function install(){
  guardShow();syncVisibility();
  document.querySelectorAll('main .page').forEach(page=>{if(page.id===HOME||page.querySelector(':scope > .screen-toolbar'))return;const bar=document.createElement('div');bar.className='screen-toolbar';bar.innerHTML='<button type="button" class="btn screen-close" aria-label="Cerrar pantalla">✕ Cerrar</button><button type="button" class="btn screen-home" aria-label="Ir al inicio">⌂ Inicio</button>';bar.querySelector('.screen-close').addEventListener('click',close);bar.querySelector('.screen-home').addEventListener('click',()=>go(HOME));page.prepend(bar)});
}
for(const event of ['v2-auth-cloud-state','mi-cartera-v2-rehydrated','mi-cartera-v2-sync','storage'])root.addEventListener(event,syncVisibility);
document.addEventListener('DOMContentLoaded',install);
root.MiCarteraV2ScreenNavigation={install,close,go,canReadLocal,syncVisibility};
syncVisibility();
})(window);
