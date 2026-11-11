// Mi Cartera PRO V2 — manual safe refresh for Cloud data and the installed PWA.
(function(root){'use strict';
const $=id=>document.getElementById(id),K='mi-cartera-v2-validation-state';let busy=false;
function styles(){if($('v2RefreshStyles'))return;const s=document.createElement('style');s.id='v2RefreshStyles';s.textContent='.v2-refresh-button{border:1px solid rgba(255,255,255,.7);background:#fff;color:#17658b;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.v2-refresh-button:disabled{opacity:.65;cursor:wait}';document.head.appendChild(s)}
function unsaved(){const active=document.querySelector('.page.active')?.id,ids=active==='clientForm'?['fName','fPhone','fDni','fAddress','fGuarantor','fGuarantorPhone','fReference','fRoute','fLocation']:active==='creditForm'?['cClient','cDate','cFirst','cCapital','cRate','cTerm','cMaturity']:[];return ids.some(id=>String($(id)?.value||'').trim()!=='')||Boolean($('cAccepted')?.checked)}
function render(){root.MiCarteraV2CreditFormParity?.refreshClientOptions?.();root.MiCarteraV2CreditFormParity?.updateClientTools?.();root.V2UI?.render?.();root.MiCarteraV2Cards?.render?.();root.MiCarteraV2Agenda?.render?.();root.MiCarteraV2DashboardParity?.render?.();root.MiCarteraV2AdminParity?.render?.();root.MiCarteraPartners?.render?.();root.MiCarteraV2CommercialUI?.render?.()}
function install(){styles();const header=document.querySelector('header');if(!header)return;let b=$('manualRefreshButton');if(!b){b=document.createElement('button');b.id='manualRefreshButton';b.type='button';b.className='v2-refresh-button';b.textContent='↻ Actualizar';const badge=$('versionGuard');header.insertBefore(b,badge||null)}b.onclick=run}
function blockReason(result){
 if(result?.status==='SKIPPED_PENDING_LOCAL_OPERATIONS'||root.MiCarteraV2CloudRehydration?.pending?.()||root.MiCarteraV2SyncBridge?.status?.()?.pending>0){
  return 'Hay una operación pendiente; los datos locales se conservaron.';
 }
 if(unsaved())return 'Guarda el cliente o el crédito antes de actualizar.';
 if(result&&result.status!=='REHYDRATED')return 'La cartera cambió durante la sincronización. Vuelve a intentar la actualización.';
 return '';
}
async function run(){
 if(busy)return;
 if(unsaved()){
  alert('Guarda el cliente o el crédito antes de actualizar. La actualización está bloqueada para proteger los datos que estás digitando.');
  return;
 }
 const b=$('manualRefreshButton');
 const finish=(label,title)=>{
  if(!b)return;
  b.textContent=label;b.title=title;
  setTimeout(()=>{b.textContent='↻ Actualizar';b.disabled=false},1800);
 };
 busy=true;
 if(b){b.disabled=true;b.textContent='↻ Actualizando…';b.title=''}
 try{
  const initialBlock=blockReason();
  if(initialBlock){finish('⚠ Pendiente',initialBlock);return}
  const auth=root.MiCarteraV2AuthCloudGate?.state?.();
  const result=auth?.ready&&root.MiCarteraV2CloudRehydration?.rehydrate?await root.MiCarteraV2CloudRehydration.rehydrate():null;
  const syncBlock=blockReason(result);
  if(syncBlock){finish('⚠ Pendiente',syncBlock);return}
  render();
  const {updateAvailable}=await root.MiCarteraV2VersionGuard.checkPublished();
  const reloadBlock=blockReason();
  if(reloadBlock){finish('⚠ Pendiente',reloadBlock);return}
  if(updateAvailable){
   if(b)b.textContent='✓ Nueva versión';
   root.location?.reload?.();
   return;
  }
  if(result?.status==='REHYDRATED')finish('✓ Actualizado','Datos y versión verificados.');
  else finish('✓ Versión comprobada','La versión instalada está al día.');
 }catch(e){
  if(b){b.textContent='⚠ Revisar';b.disabled=false}
  alert('No se pudo actualizar sin riesgo: '+String(e?.message||e||'Error desconocido'));
 }finally{busy=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();root.MiCarteraV2Refresh={run,render,unsaved,install};
})(window);
