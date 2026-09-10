// Cargador de seguridad: el index contiene una secuencia </script> dentro de una plantilla HTML.
// Recuperamos el script principal como texto y lo inyectamos como script DOM para evitar eval/CSP.
(async()=>{
  try{
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
    core.src='./firebase-cloud-core.js?v=23';
    document.head.appendChild(core);
    console.log('Préstamo Ya: núcleo principal cargado correctamente');
  }catch(e){
    console.error('Préstamo Ya: no se pudo cargar el núcleo principal',e);
    try{window.toast&&window.toast('Error de carga de la aplicación. Recargue la página.')}catch(_){}
  }
})();
