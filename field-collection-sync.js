// Sincronización segura de cobranzas de campo.
(async()=>{
  const start=Date.now();
  const wait=()=>new Promise(resolve=>{const tick=()=>{if(typeof window.registerPayment==='function'&&typeof window.cloudSyncNow==='function')return resolve();if(Date.now()-start>15000)return resolve();setTimeout(tick,200)};tick()});
  await wait();
  if(typeof window.registerPayment!=='function'||typeof window.cloudSyncNow!=='function')return;
  if(window.__prestamoYaFieldSync)return;
  window.__prestamoYaFieldSync=true;

  const reconcile=()=>{
    try{
      if(!window.db||!Array.isArray(db.credits)||!Array.isArray(db.payments))return;
      for(const cr of db.credits){
        const ps=db.payments.filter(p=>String(p.creditId)===String(cr.id));
        if(!ps.length||!Array.isArray(cr.schedule))continue;
        const paid=ps.reduce((s,p)=>s+Math.max(0,Number(p.amount||0)),0);
        const target=Math.min(Number(cr.total||0),paid);
        if(typeof window.applyPaidToSchedule==='function')window.applyPaidToSchedule(cr,target);
        else cr.paid=target;
      }
      if(typeof window.renderAll==='function')window.renderAll();
    }catch(e){console.warn('Reconciliación de cobranza:',e)}
  };

  const rawSync=window.cloudSyncNow;
  window.cloudSyncNow=async()=>{
    const ok=await rawSync();
    if(ok===true)reconcile();
    return ok;
  };

  const rawPayment=window.registerPayment;
  window.registerPayment=(id,...args)=>{
    const before=(db.payments||[]).length;
    const result=rawPayment(id,...args);
    try{
      const created=(db.payments||[]).slice(before).find(p=>String(p.creditId)===String(id))||(db.payments||[]).filter(p=>String(p.creditId)===String(id)).slice(-1)[0];
      const u=typeof window.currentUser==='function'?window.currentUser():null;
      if(created&&u){created.user=u.name||u.email||'Cobrador';created.userId=u.id||u.uid||null;}
      if(created&&typeof window.enqueueSync==='function')window.enqueueSync('RECAUDO',created);
      if(typeof window.persist==='function')window.persist();
      reconcile();
      if(navigator.onLine)setTimeout(()=>window.cloudSyncNow().catch(()=>{}),300);
    }catch(e){console.warn('Sincronización de cobranza de campo:',e)}
    return result;
  };
})();
