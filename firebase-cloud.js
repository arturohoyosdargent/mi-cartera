// Arranque seguro de Préstamo Ya.
// El núcleo principal ya se ejecuta desde index.html. Este archivo solo
// limpia una vez la caché antigua y luego carga la integración Firebase.
(async()=>{
  try{
    const cleanKey='prestamo_ya_cache_clean_v2';
    if(!sessionStorage.getItem(cleanKey)){
      sessionStorage.setItem(cleanKey,'1');
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister().catch(()=>false)));
      }
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
      location.reload();
      return;
    }
    const core=document.createElement('script');
    core.type='module';
    core.src='./firebase-cloud-core.js?v=31';
    document.head.appendChild(core);
    const bridge=()=>{
      if(typeof window.cloudSyncNow==='function'){
        window.syncNow=async()=>{
          if(!navigator.onLine)return toast('Sin internet: la información sigue guardada localmente.');
          const pending=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
          if(!pending.length)return toast('No hay operaciones pendientes.');
          const ok=await window.cloudSyncNow();
          if(ok===true){
            pending.forEach(x=>{x.status='SINCRONIZADO';x.syncedAt=new Date().toISOString();x.error='';});
            db.settings.lastOnline=new Date().toISOString();
            try{persist();updateSyncUI();renderAll();}catch(e){console.warn('No se pudo refrescar la cola local',e)}
            toast('Sincronización completada: '+pending.length+' operación(es).');
          }
        };
        return;
      }
      setTimeout(bridge,300);
    };
    bridge();
    console.log('Préstamo Ya: integración Cloud cargada correctamente');
  }catch(e){
    console.error('Préstamo Ya: no se pudo cargar la integración Cloud',e);
    try{window.toast&&window.toast('Error de carga de Cloud. Recargue la página.')}catch(_){}
  }
})();