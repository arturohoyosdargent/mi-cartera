// Préstamo Ya — reparación de selección de cliente en créditos.
(()=>{
'use strict';
if(window.__prestamoYaClientSaveFixV1)return;
window.__prestamoYaClientSaveFixV1=true;
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const num=v=>Number(v||0);
const resolveClient=()=>{
 const dbx=window.db||{},list=Array.isArray(dbx.clients)?dbx.clients:[];
 const ids=[window.__selectedClientForProposal,window.selectedClient,window.__finalRenewalState?.clientId].filter(v=>v!=null&&v!=='');
 for(const id of ids){const c=list.find(x=>String(x.id)===String(id));if(c)return c}
 const box=$('creditClientBox'),first=String(box?.innerText||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)[0]||'';
 if(first){const c=list.find(x=>norm(x.name)===norm(first));if(c)return c}
 return null;
};
const payload=()=>{
 const c=resolveClient();
 if(c){window.__selectedClientForProposal=c.id;window.selectedClient=c.id;window.__finalRenewalState=window.__finalRenewalState||{};window.__finalRenewalState.clientId=c.id}
 const renewalId=$('renewalCreditSelect')?.value||null;
 return {c,p:{clientId:c?.id||'',clientID:c?.id||'',clienteId:c?.id||'',client:c,clientName:c?.name||'',clienteNombre:c?.name||'',date:$('cDate')?.value||'',first:$('cFirst')?.value||'',firstPaymentDate:$('cFirst')?.value||'',capital:num($('cCapital')?.value),principal:num($('cCapital')?.value),amount:num($('cCapital')?.value),monto:num($('cCapital')?.value),interestRate:num($('cRate')?.value),rate:num($('cRate')?.value),tasa:num($('cRate')?.value),termWeeks:num($('cTerm')?.value),weeks:num($('cTerm')?.value),plazo:num($('cTerm')?.value),freq:$('cFreq')?.value||'weekly',frequency:$('cFreq')?.value||'weekly',restDay:$('cRestDay')?.value||'none',maturity:$('cMaturity')?.value||'',renewalOf:renewalId,renewalLoanId:renewalId,isRenewal:!!renewalId,previousBalance:num($('renewalBalanceInput')?.value),origenRenovacion:renewalId}};
};
const install=()=>{
 const originalSave=window.saveCredit;
 if(typeof originalSave==='function'&&!originalSave.__clientFix){
  const wrapped=function(data){const q=payload();if(!q.c){window.toast?.('Selecciona un cliente válido antes de guardar el crédito');return false}return originalSave.call(this,{...(data||{}),...q.p})};
  wrapped.__clientFix=true;window.saveCredit=wrapped;
 }
 const originalAccept=window.acceptCreditProposal;
 if(typeof originalAccept==='function'&&!originalAccept.__clientFix){
  const accept=function(){const q=payload();if(!q.c){window.toast?.('Selecciona un cliente válido antes de aceptar el préstamo');return false}
   const save=window.saveCredit;if(typeof save!=='function'){window.toast?.('No está disponible el guardado del crédito');return false}
   try{const result=save(q.p);$('creditProposalModal')?.remove();if(result&&typeof result.then==='function')result.then(()=>window.toast?.('Crédito aceptado y guardado correctamente.')).catch(e=>{console.error(e);window.toast?.('No se pudo guardar el crédito')});else setTimeout(()=>window.toast?.('Crédito aceptado y guardado correctamente.'),350);return result}catch(e){console.error('Aceptación de crédito',e);window.toast?.('No se pudo guardar el crédito');return false}
  };
  accept.__clientFix=true;window.acceptCreditProposal=accept;
 }
};
install();setTimeout(install,200);setTimeout(install,700);setTimeout(install,1500);
})();
