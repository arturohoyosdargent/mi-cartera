// Préstamo Ya — reparación definitiva de selección de cliente y persistencia del crédito.
(()=>{
'use strict';
if(window.__prestamoYaClientSaveFixV3)return;
window.__prestamoYaClientSaveFixV3=true;
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const num=v=>Number(v||0);
const dbx=()=>window.db||{};
const list=()=>Array.isArray(dbx().clients)?dbx().clients:[];
const resolveClient=()=>{
 const db=dbx();
 const ids=[window.__selectedClientForProposal,window.selectedClient,window.__finalRenewalState?.clientId].filter(v=>v!=null&&v!=='');
 for(const id of ids){const c=list().find(x=>String(x.id)===String(id));if(c)return c}
 const box=$('creditClientBox');
 const first=String(box?.innerText||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)[0]||'';
 if(first){const c=list().find(x=>norm(x.name)===norm(first));if(c)return c}
 const proposal=String(window.__creditProposalText||'');
 const m=proposal.match(/^Cliente:\s*(.+)$/mi);
 if(m){const c=list().find(x=>norm(x.name)===norm(m[1]));if(c)return c}
 return null;
};
const forceSelectedClient=client=>{
 if(!client)return false;
 window.__selectedClientForProposal=client.id;
 window.selectedClient=client.id;
 window.__finalRenewalState=window.__finalRenewalState||{};
 window.__finalRenewalState.clientId=client.id;
 try{window.eval('selectedClient = '+JSON.stringify(client.id));return true}catch(e){console.warn('No se pudo sincronizar selectedClient lexical',e);return false}
};
const payload=()=>{
 const c=resolveClient();
 if(c)forceSelectedClient(c);
 const renewalId=$('renewalCreditSelect')?.value||window.__finalRenewalState?.renewalId||null;
 return {c,p:{clientId:c?.id||'',clientID:c?.id||'',clienteId:c?.id||'',client:c,clientName:c?.name||'',clienteNombre:c?.name||'',date:$('cDate')?.value||'',first:$('cFirst')?.value||'',firstPaymentDate:$('cFirst')?.value||'',capital:num($('cCapital')?.value),principal:num($('cCapital')?.value),amount:num($('cCapital')?.value),monto:num($('cCapital')?.value),interestRate:num($('cRate')?.value),rate:num($('cRate')?.value),tasa:num($('cRate')?.value),termWeeks:num($('cTerm')?.value),weeks:num($('cTerm')?.value),plazo:num($('cTerm')?.value),freq:$('cFreq')?.value||'weekly',frequency:$('cFreq')?.value||'weekly',restDay:$('cRestDay')?.value||'none',maturity:$('cMaturity')?.value||'',renewalOf:renewalId,renewalLoanId:renewalId,isRenewal:!!renewalId,previousBalance:num($('renewalBalanceInput')?.value),origenRenovacion:renewalId}};
};
const install=()=>{
 const originalSave=window.saveCredit;
 if(typeof originalSave==='function'&&!originalSave.__clientFixV3){
  const wrapped=function(data){
   const q=payload();
   if(!q.c){window.toast?.('No se pudo identificar al cliente del crédito');return false}
   if(!forceSelectedClient(q.c)){window.toast?.('No se pudo fijar el cliente del crédito');return false}
   const before=new Set((dbx().credits||[]).map(x=>String(x.id)));
   const result=originalSave.call(this,{...(data||{}),...q.p});
   setTimeout(()=>{
    const credits=dbx().credits||[];
    const found=credits.find(x=>!before.has(String(x.id))&&String(x.clientId)===String(q.c.id));
    if(!found){
      const recent=credits.filter(x=>String(x.clientId)===String(q.c.id)).slice().sort((a,b)=>Number(b.id)-Number(a.id))[0];
      if(!recent)window.toast?.('El crédito no quedó persistido para '+q.c.name+'. Se detuvo el flujo para no crear un registro incorrecto.');
    }
   },220);
   return result;
  };
  wrapped.__clientFixV3=true;window.saveCredit=wrapped;
 }
 const originalAccept=window.acceptCreditProposal;
 if(typeof originalAccept==='function'&&!originalAccept.__clientFixV3){
  const accept=function(){
   const q=payload();
   if(!q.c){window.toast?.('No se pudo identificar al cliente del crédito');return false}
   if(!forceSelectedClient(q.c)){window.toast?.('No se pudo fijar el cliente del crédito');return false}
   try{
    // IMPORTANTE: la función original marca la propuesta como aceptada y luego
    // llama a window.saveCredit(). No debemos llamar al guardado directamente,
    // porque eso vuelve a abrir la propuesta y deja al usuario bloqueado.
    const result=originalAccept.call(this);
    setTimeout(()=>{
      const credits=dbx().credits||[];
      const created=credits.find(x=>String(x.clientId)===String(q.c.id)&&Number(x.capital||0)===Number(q.p.capital||0)&&Number(x.total||0)>=Number(q.p.amount||0));
      if(created){
       window.selectedClient=q.c.id;window.__selectedClientForProposal=q.c.id;
       window.toast?.('Crédito de '+q.c.name+' guardado correctamente.');
       if(typeof window.showCredit==='function')window.showCredit(created.id);
      }else{
       window.toast?.('⚠️ El crédito no quedó registrado. Revisa la cola de sincronización.');
      }
    },350);
    return result;
   }catch(e){console.error('Aceptación de crédito',e);window.toast?.('No se pudo guardar el crédito');return false}
  };
  accept.__clientFixV3=true;window.acceptCreditProposal=accept;
 }
};
install();setTimeout(install,200);setTimeout(install,700);setTimeout(install,1500);setTimeout(install,3000);
})();
