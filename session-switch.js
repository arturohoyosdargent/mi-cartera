// Cambio explícito de cuenta Cloud sin reinstalar la PWA.
(async()=>{
  try{
    const wait=()=>new Promise(resolve=>{
      const started=Date.now();
      const tick=()=>{
        if(typeof window.cloudLogout==='function'&&typeof window.openCloudLogin==='function')return resolve();
        if(Date.now()-started>15000)return resolve();
        setTimeout(tick,200);
      };
      tick();
    });
    await wait();
    const original=window.openCloudLogin;
    if(typeof original!=='function'||window.__prestamoYaSessionSwitch)return;
    window.__prestamoYaSessionSwitch=true;
    window.openCloudLogin=async()=>{
      const btn=document.getElementById('cloudUserBtn');
      const logged=btn&&btn.textContent&&!/Entrar/i.test(btn.textContent);
      if(logged){
        const name=(btn.textContent||'').replace(/^☁️\s*/,'').trim()||'usuario actual';
        if(!confirm('Sesión Cloud activa como '+name+'.\n\n¿Cerrar sesión para ingresar con otro usuario?'))return;
        try{await window.cloudLogout();}catch(e){console.error('Cambio de cuenta:',e);}
        setTimeout(()=>original(),250);
        return;
      }
      original();
    };
    console.log('Préstamo Ya: cambio de cuenta Cloud habilitado');
  }catch(e){console.warn('Préstamo Ya: no se pudo instalar cambio de cuenta',e);}
})();
