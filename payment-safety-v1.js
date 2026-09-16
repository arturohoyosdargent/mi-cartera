(()=>{
  const root=window;
  const moneySafe=n=>typeof root.money==='function'?root.money(Number(n||0)):`S/${Number(n||0).toFixed(2)}`;
  const remaining=cr=>Math.max(0,Number(cr?.total||0)-Number(cr?.paid||0));
  const firstPending=cr=>{const q=(cr?.schedule||[]).find(x=>Number(x?.paid||0)<Number(x?.amount||0));return q?Math.max(0,Number(q.amount||0)-Number(q.paid||0)):0};
  const install=()=>{
    if(root.__prestamoYaPaymentSafetyInstalled)return;
    if(typeof root.openCollect!=='function'||typeof root.registerPayment!=='function'||typeof root.currentDue!=='function')return setTimeout(install,250);
    root.__prestamoYaPaymentSafetyInstalled=true;
    const rawOpen=root.openCollect;
    const rawRegister=root.registerPayment;
    root.openCollect=function(id){
      const out=rawOpen(id);
      try{
        const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
        if(!cr)return out;
        const due=Math.max(0,Number(root.currentDue(cr)||0));
        const future=firstPending(cr);
        const rem=remaining(cr);
        const input=document.getElementById('payAmount');
        if(input){
          input.max=rem.toFixed(2);
          input.dataset.maxRemaining=rem.toFixed(2);
          if(due<=0&&future>0)input.value=Math.min(future,rem).toFixed(2);
        }
        const body=document.getElementById('collectBody');
        const firstCard=body?.querySelector('.card');
        if(firstCard&&due<=0&&future>0){
          const note=document.createElement('div');
          note.className='small muted';
          note.style.marginTop='8px';
          note.textContent=`No hay monto vencido/por cobrar hoy. El valor sugerido corresponde a la próxima cuota pendiente (${moneySafe(Math.min(future,rem))}). Saldo pendiente total: ${moneySafe(rem)}.`;
          firstCard.appendChild(note);
        }
      }catch(e){console.warn('Préstamo Ya · payment safety UI',e)}
      return out;
    };
    root.registerPayment=function(id,...args){
      const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
      if(!cr)return typeof root.toast==='function'?root.toast('Crédito no encontrado'):undefined;
      const input=document.getElementById('payAmount');
      const amount=Number(input?.value||0);
      const rem=remaining(cr);
      if(!(amount>0))return typeof root.toast==='function'?root.toast('Ingrese un monto válido'):undefined;
      if(!(rem>0))return typeof root.toast==='function'?root.toast('Este crédito no tiene saldo pendiente'):undefined;
      if(amount>rem+0.005){
        if(input){input.value=rem.toFixed(2);input.focus()}
        return typeof root.toast==='function'?root.toast(`El abono no puede superar el saldo pendiente (${moneySafe(rem)})`):undefined;
      }
      return rawRegister(cr.id,...args);
    };
  };
  install();
})();
