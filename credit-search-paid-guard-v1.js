(()=>{
  const root=window;
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const scheduleRemaining=cr=>Array.isArray(cr?.schedule)&&cr.schedule.length?cr.schedule.reduce((s,q)=>s+Math.max(0,Number(q?.amount||0)-Number(q?.paid||0)),0):null;
  const paymentsFor=cr=>(root.db?.payments||[]).filter(p=>String(p?.creditId)===String(cr?.id)&&Number(p?.amount||0)>0);
  const ledgerPaid=cr=>paymentsFor(cr).reduce((s,p)=>s+Number(p.amount||0),0);
  const paymentEvidence=cr=>ledgerPaid(cr)>0.005;
  const apparentPaid=cr=>{
    if(!cr)return false;
    const sr=scheduleRemaining(cr);
    if(sr!==null&&sr<=0.005)return true;
    const status=norm(cr.status||cr.state||cr.estado);
    return ['paid','pagado','cancelado','completed','completado'].includes(status)||Number(cr.paid||0)>=Number(cr.total||0)-0.005;
  };
  const inconsistentPaid=cr=>apparentPaid(cr)&&!paymentEvidence(cr);
  const confirmedPaid=cr=>{
    if(!cr||!paymentEvidence(cr))return false;
    const total=Math.max(0,Number(cr.total||0));
    return total>0&&ledgerPaid(cr)>=total-0.005;
  };
  const clientFor=cr=>(root.db?.clients||[]).find(c=>String(c.id)===String(cr?.clientId));
  const creditSearchText=(cr,card)=>{const c=clientFor(cr)||{};return norm([card?.textContent,c.name,c.phone,c.dni,c.document,c.reference,cr?.id].filter(Boolean).join(' '))};
  const applySearch=()=>{
    const input=document.getElementById('creditSearch'),list=document.getElementById('creditsList');if(!input||!list)return;
    const q=norm(input.value);[...list.children].forEach(card=>{const raw=card.querySelector?.('[onclick*="openCollect"],[onclick*="showCredit"],[onclick*="editCredit"]')?.getAttribute('onclick')||'';const m=raw.match(/\((['"]?)([^,'")]+)\1/);const cr=m?(root.db?.credits||[]).find(x=>String(x.id)===String(m[2])):null;card.style.display=!q||creditSearchText(cr,card).includes(q)?'':'none'});
  };
  const installSearch=()=>{
    const section=document.getElementById('credits'),summary=document.getElementById('creditsSummary'),list=document.getElementById('creditsList');if(!section||!summary||!list)return setTimeout(installSearch,250);
    if(!document.getElementById('creditSearch')){const box=document.createElement('div');box.className='card';box.innerHTML='<input class="search" id="creditSearch" autocomplete="off" placeholder="🔍 Buscar cliente por nombre, DNI, teléfono o crédito">';summary.parentNode.insertBefore(box,summary);box.querySelector('input').addEventListener('input',applySearch)}
    let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;applySearch()})}).observe(list,{childList:true});applySearch();
  };
  const installPaidGuard=()=>{
    if(root.__prestamoYaPaidCreditGuard)return;if(typeof root.openCollect!=='function'||typeof root.registerPayment!=='function')return setTimeout(installPaidGuard,250);
    root.__prestamoYaPaidCreditGuard=true;const rawOpen=root.openCollect,rawRegister=root.registerPayment;
    root.openCollect=function(id,...args){
      const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
      if(cr&&inconsistentPaid(cr)){if(typeof root.toast==='function')root.toast('Revisión requerida: el crédito figura pagado, pero no existe un pago asociado. No se modificó ningún saldo.');root.__lastCreditPaymentMismatch={creditId:cr.id,creditPaid:Number(cr.paid||0),scheduleRemaining:scheduleRemaining(cr),ledgerPaid:ledgerPaid(cr),payments:paymentsFor(cr).length};return}
      if(cr&&confirmedPaid(cr)){if(typeof root.toast==='function')root.toast('Crédito pagado: los pagos registrados cubren el total');return}
      return rawOpen(id,...args);
    };
    root.registerPayment=function(id,...args){
      const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
      if(cr&&inconsistentPaid(cr)){if(typeof root.toast==='function')root.toast('Operación bloqueada: estado de pago inconsistente; requiere conciliación');return}
      if(cr&&confirmedPaid(cr)){if(typeof root.toast==='function')root.toast('Operación bloqueada: los pagos registrados ya cubren este crédito');return}
      return rawRegister(id,...args);
    };
  };
  root.inspectCreditPaymentEvidence=id=>{const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));return cr?{creditId:cr.id,total:Number(cr.total||0),creditPaid:Number(cr.paid||0),scheduleRemaining:scheduleRemaining(cr),ledgerPaid:ledgerPaid(cr),paymentCount:paymentsFor(cr).length,apparentPaid:apparentPaid(cr),confirmedPaid:confirmedPaid(cr),inconsistentPaid:inconsistentPaid(cr)}:null};
  installSearch();installPaidGuard();
})();
