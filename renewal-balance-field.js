// Campo visible y editable para el saldo anterior de una renovación.
(()=>{
 const $=id=>document.getElementById(id);
 const money=v=>'S/ '+Number(v||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
 const wait=()=>{if(!$('finalRenewalBox'))return setTimeout(wait,250);install()};
 function install(){
  if(window.__renewalBalanceFieldInstalled)return;window.__renewalBalanceFieldInstalled=true;
  const box=$('finalRenewalBox');if(!box)return;
  const wrap=document.createElement('div');wrap.className='field';wrap.style.marginTop='10px';
  wrap.innerHTML='<label><b>Saldo anterior a cancelar S/</b></label><input class="input" id="renewalBalanceInput" type="number" min="0" step="0.01" value="0.00"><div class="small muted">Si existe un saldo pendiente, ingrésalo o verifica el importe detectado. Este monto se descuenta del nuevo capital y no se entrega nuevamente al cliente.</div><div id="renewalBalanceResult" class="info" style="margin-top:8px;background:#fff7e8;border-left:4px solid var(--orange)">Saldo anterior: <b>S/ 0.00</b></div>';
  const notice=$('renewalNotice');(notice||box).insertAdjacentElement('afterend',wrap);
  const input=$('renewalBalanceInput');
  const state=window.__finalRenewalState;
  function selectedBalance(){const id=state?.renewalId;if(!id)return 0;const old=(db.credits||[]).find(x=>String(x.id)===String(id));if(!old)return 0;try{return Number(window.status(old).remain||0)}catch(e){return Math.max(0,Number(old.total||0)-Number(old.paid||0))}}
  function refresh(){const auto=selectedBalance();if(document.activeElement!==input||!input.dataset.edited)input.value=auto.toFixed(2);const val=Number(input.value||0);$('renewalBalanceResult').innerHTML=`Saldo anterior: <b>${money(val)}</b>${auto!==val?' · detectado automáticamente: '+money(auto):''}`;if(state)state.manualRenewalBalance=val;}
  input.addEventListener('input',()=>{input.dataset.edited='1';refresh();});
  $('renewalCreditSelect')?.addEventListener('change',()=>{input.dataset.edited='';setTimeout(refresh,30)});
  setInterval(()=>{if(document.body.contains(input))refresh()},1200);refresh();
 }
 wait();
})();
