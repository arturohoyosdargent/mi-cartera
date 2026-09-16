(()=>{
  const root=window;
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const scheduleRemaining=cr=>Array.isArray(cr?.schedule)&&cr.schedule.length?cr.schedule.reduce((s,q)=>s+Math.max(0,Number(q?.amount||0)-Number(q?.paid||0)),0):null;
  const isPaid=cr=>{
    if(!cr)return false;
    const sr=scheduleRemaining(cr);
    if(sr!==null&&sr<=0.005)return true;
    const status=norm(cr.status||cr.state||cr.estado);
    return ['paid','pagado','cancelado','completed','completado'].includes(status);
  };
  const clientFor=cr=>(root.db?.clients||[]).find(c=>String(c.id)===String(cr?.clientId));
  const creditSearchText=(cr,card)=>{
    const c=clientFor(cr)||{};
    return norm([card?.textContent,c.name,c.phone,c.dni,c.document,c.reference,cr?.id].filter(Boolean).join(' '));
  };
  const applySearch=()=>{
    const input=document.getElementById('creditSearch');
    const list=document.getElementById('creditsList');
    if(!input||!list)return;
    const q=norm(input.value);
    [...list.children].forEach(card=>{
      const raw=card.querySelector?.('[onclick*="openCollect"],[onclick*="showCredit"],[onclick*="editCredit"]')?.getAttribute('onclick')||'';
      const m=raw.match(/\((['"]?)([^,'")]+)\1/);
      const cr=m?(root.db?.credits||[]).find(x=>String(x.id)===String(m[2])):null;
      card.style.display=!q||creditSearchText(cr,card).includes(q)?'':'none';
    });
  };
  const installSearch=()=>{
    const section=document.getElementById('credits');
    const summary=document.getElementById('creditsSummary');
    const list=document.getElementById('creditsList');
    if(!section||!summary||!list)return setTimeout(installSearch,250);
    if(!document.getElementById('creditSearch')){
      const box=document.createElement('div');box.className='card';
      box.innerHTML='<input class="search" id="creditSearch" autocomplete="off" placeholder="🔍 Buscar cliente por nombre, DNI, teléfono o crédito">';
      summary.parentNode.insertBefore(box,summary);
      box.querySelector('input').addEventListener('input',applySearch);
    }
    let queued=false;
    new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;applySearch()})}).observe(list,{childList:true});
    applySearch();
  };
  const installPaidGuard=()=>{
    if(root.__prestamoYaPaidCreditGuard)return;
    if(typeof root.openCollect!=='function'||typeof root.registerPayment!=='function')return setTimeout(installPaidGuard,250);
    root.__prestamoYaPaidCreditGuard=true;
    const rawOpen=root.openCollect,rawRegister=root.registerPayment;
    root.openCollect=function(id,...args){
      const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
      if(cr&&isPaid(cr)){
        if(typeof root.toast==='function')root.toast('Crédito pagado: no tiene saldo pendiente para recaudar');
        return;
      }
      return rawOpen(id,...args);
    };
    root.registerPayment=function(id,...args){
      const cr=(root.db?.credits||[]).find(x=>String(x.id)===String(id));
      if(cr&&isPaid(cr)){
        if(typeof root.toast==='function')root.toast('Operación bloqueada: este crédito ya está pagado');
        return;
      }
      return rawRegister(id,...args);
    };
  };
  installSearch();installPaidGuard();
})();
