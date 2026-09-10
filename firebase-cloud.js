// Arranque seguro de Préstamo Ya.
// Primero elimina cualquier Service Worker/caché antiguo que pueda estar mostrando una versión rota de index.html.
(async()=>{
  try{
    const cleanKey='prestamo_ya_cache_clean_v1';
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
    const res=await fetch('./index.html?bootstrap='+Date.now(),{cache:'no-store'});
    const html=await res.text();
    const start=html.indexOf('<script>');
    const marker='</script>\n<script src="firebase-config.js';
    const end=html.indexOf(marker,start);
    if(start<0||end<0)throw new Error('No se encontró el script principal');
    const code=html.slice(start+'<script>'.length,end);
    const main=document.createElement('script');
    main.textContent=code;
    document.head.appendChild(main);
    const core=document.createElement('script');
    core.type='module';
    core.src='./firebase-cloud-core.js?v=26';
    document.head.appendChild(core);
    console.log('Préstamo Ya: núcleo principal cargado correctamente');
  }catch(e){
    console.error('Préstamo Ya: no se pudo cargar el núcleo principal',e);
    try{window.toast&&window.toast('Error de carga de la aplicación. Recargue la página.')}catch(_){}
  }
})();
