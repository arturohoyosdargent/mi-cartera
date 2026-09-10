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
    core.src='./firebase-cloud-core.js?v=27';
    document.head.appendChild(core);
    console.log('Préstamo Ya: integración Cloud cargada correctamente');
  }catch(e){
    console.error('Préstamo Ya: no se pudo cargar la integración Cloud',e);
    try{window.toast&&window.toast('Error de carga de Cloud. Recargue la página.')}catch(_){}
  }
})();
