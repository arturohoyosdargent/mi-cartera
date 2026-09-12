// Corrección segura de renovación: no usar MutationObserver sobre todo el documento.
(()=>{
  const $=id=>document.getElementById(id),money=v=>typeof window.money==='function'?window.money(v):'S/ '+Number(v||0).toFixed(2);
  const remain=id=>{const cr=(db.credits||[]).find(x=>String(x.id)===String(id));if(!cr)return 0;try{return Number(window.status(cr).remain||0)}catch(_){return Math.max(0,Number(cr.total||0)-Number(cr.paid||0))}};
  const clientId=()=>window.__selectedClientForProposal||window.__finalRenewalState?.clientId||window.selectedClient;
  const refresh=()=>{const sel=$('renewalCreditSelect');if(!sel||!clientId())return;const credits=(db.credits||[]).filter(c=>String(c.clientId)===String(clientId())&&remain(c.id)>0.009);const current=sel.value;const html='<option value="">No renovar · crédito nuevo</option>'+credits.map(c=>`<option value="${c.id}">🔄 Renovar crédito #${c.id} · Saldo ${money(remain(c.id))}</option>`).join('');if(sel.innerHTML!==html){sel.innerHTML=html;if(current&&credits.some(c=>String(c.id)===String(current)))sel.value=current;else if(window.__finalRenewalState?.renewalId)sel.value=String(window.__finalRenewalState.renewalId)}};
  const protect=()=>{const input=$('renewalBalanceInput');if(!input)return;const id=$('renewalCreditSelect')?.value;if(!id||document.activeElement===input||input.dataset.edited==='1')return;const v=remain(id);if(input.value!==v.toFixed(2))input.value=v.toFixed(2);const r=$('renewalBalanceResult');if(r)r.innerHTML=`Saldo anterior: <b>${money(v)}</b>`};
  const start=()=>{refresh();protect();setTimeout(start,1000)};start();
})();
