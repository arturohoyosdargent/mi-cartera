// UI adicional para el motor de propuestas de crédito.
(()=>{
 const install=()=>{
  const form=document.getElementById('creditForm');
  if(!form||typeof window.previewCreditProposal!=='function')return setTimeout(install,300);
  if(window.__prestamoYaCreditProposalUI)return;window.__prestamoYaCreditProposalUI=true;
  const bar=form.querySelector('.actionbar');
  if(bar&&!document.getElementById('previewCreditBtn')){
   const b=document.createElement('button');b.id='previewCreditBtn';b.type='button';b.className='btn orange';b.textContent='👁 Vista previa / enviar';b.onclick=()=>window.previewCreditProposal();
   bar.insertBefore(b,bar.firstChild);
  }
  const extras=document.getElementById('creditExtrasBox');
  if(extras&&!document.getElementById('extraPaymentHint')){const p=document.createElement('div');p.id='extraPaymentHint';p.className='small muted';p.style.marginTop='8px';p.textContent='Ejemplo: 4 cuotas semanales de viernes + un abono adicional el miércoles. El total pactado no aumenta; se redistribuye el saldo entre las cuotas programadas.';extras.appendChild(p)}
 };
 install();
})();
