// Préstamo Ya — reparación de selección de cliente en créditos.
(()=>{
'use strict';
if(window.__prestamoYaClientSaveFixV2)return;
window.__prestamoYaClientSaveFixV2=true;
const $=id=>document.getElementById(id),norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const resolveClient=()=>{const dbx=window.db||{},list=Array.isArray(dbx.clients)?dbx.clients:[];const ids=[window.__selectedClientForProposal,window.selectedClient,window.__finalRenewalState?.clientId];for(const id of ids){if(id!=null&&id!==''){const c=list.find(x=>String(x.id)===String(id));if(c)return c}}const first=String($('creditClientBox')?.innerText||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)[0]||'';return first?list.find(x=>norm(x.name)===norm(first)):null};
const syncSelection=()=>{const c=resolveClient();if(!c)return null;window.__selectedClientForProposal=c.id;window.selectedClient=c.id;window.__finalRenewalState=window.__finalRenewalState||{};window.__finalRenewalState.clientId=c.id;try{selectedClient=c.id}catch(_){}return c};
const install=()=>{syncSelection();const originalSave=window.saveCredit;if(typeof originalSave==='function'&&!originalSave.__clientFix){const wrapped=function(...args){const c=syncSelection();if(!c){window.toast?.('Selecciona un cliente válido antes de guardar el crédito');return false}try{selectedClient=c.id}catch(_){}return originalSave.apply(this,args)};wrapped.__clientFix=true;window.saveCredit=wrapped}const originalAccept=window.acceptCreditProposal;if(typeof originalAccept==='function'&&!originalAccept.__clientFix){const wrapped=function(...args){const c=syncSelection();if(!c){window.toast?.('Selecciona un cliente válido antes de aceptar el préstamo');return false}try{selectedClient=c.id}catch(_){}return originalAccept.apply(this,args)};wrapped.__clientFix=true;window.acceptCreditProposal=wrapped}};
install();setTimeout(install,150);setTimeout(install,500);setTimeout(install,1200);setInterval(()=>{if(document.getElementById('creditForm')?.classList.contains('active'))syncSelection()},1500);
})();
