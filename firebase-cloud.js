// Arranque seguro de Préstamo Ya.
// El núcleo principal ya se ejecuta desde index.html. Este archivo solo
// limpia una vez la caché antigua, carga Firebase y centraliza la sincronización.
(async()=>{
  try{
    const cleanKey='prestamo_ya_cache_clean_v2';
    if(!sessionStorage.getItem(cleanKey)){
      sessionStorage.setItem(cleanKey,'1');
      if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister().catch(()=>false)));}
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}
      location.reload();return;
    }
    const core=document.createElement('script');core.type='module';core.src='./firebase-cloud-core.js?v=33';document.head.appendChild(core);
    const installGuards=()=>{
      if(typeof window.currentUser!=='function'||typeof window.go!=='function'){setTimeout(installGuards,300);return;}
      if(window.__prestamoYaGuards)return;window.__prestamoYaGuards=true;
      const restricted=['users','investors','settings','audit','profile'];
      const originalGo=window.go;window.go=(id)=>{const role=window.currentUser()?.role||'consulta';if(!['admin','supervisor'].includes(role)&&restricted.includes(id))return toast('Acceso restringido a administración');return originalGo(id)};
      const manager=['admin','supervisor'];
      for(const name of ['openCapitalForm','addRoute','assignCollector','openUserForm','saveUser','toggleUser','saveSettings','saveProfile']){
        const fn=window[name];if(typeof fn==='function')window[name]=(...args)=>{if(!manager.includes(window.currentUser()?.role))return toast('Acceso restringido a administración');return fn(...args)};
      }
      const payment=window.registerPayment;if(typeof payment==='function')window.registerPayment=(id,...args)=>{const cr=(db.credits||[]).find(x=>String(x.id)===String(id));const u=window.currentUser?.();const ids=Array.isArray(u?.routeIds)?u.routeIds:[];if(!manager.includes(u?.role)&&cr&&!ids.includes(cr.routeId)&&!ids.includes(String(cr.routeId)))return toast('No autorizado para esta ruta');return payment(id,...args)};
    };
    installGuards();
    const getPushable=()=>{
      const pending=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
      const role=(typeof currentUser==='function'?currentUser()?.role:'consulta')||'consulta';
      const manager=['admin','supervisor'].includes(role);
      const types=manager?['CLIENTE_CREADO','CLIENTE_MODIFICADO','CREDITO_CREADO','CREDITO_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION','AUTORIZACION_APROBADA','AUTORIZACION_RECHAZADA','CLIENTE_ELIMINADO']:['CLIENTE_CREADO','CLIENTE_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION'];
      return pending.filter(x=>types.includes(x.type));
    };
    const markSynced=(items)=>{
      if(!Array.isArray(items)||!items.length)return;
      const stamp=new Date().toISOString();
      items.forEach(x=>{x.status='SINCRONIZADO';x.syncedAt=stamp;x.error='';});
      db.settings=db.settings||{};db.settings.lastOnline=stamp;
      try{persist();updateSyncUI();renderAll()}catch(e){console.warn(e)}
    };
    const bridge=()=>{
      if(typeof window.cloudSyncNow==='function'){
        if(!window.__prestamoYaCloudWrapped){
          const rawSync=window.cloudSyncNow;
          window.cloudSyncNow=async()=>{
            const handled=getPushable();
            const ok=await rawSync();
            if(ok===true)markSynced(handled);
            return ok;
          };
          window.__prestamoYaCloudWrapped=true;
        }
        window.syncNow=async()=>{
          if(!navigator.onLine)return toast('Sin internet: la información sigue guardada localmente.');
          const pending=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
          if(!pending.length)return toast('No hay operaciones pendientes.');
          const ok=await window.cloudSyncNow();
          if(ok===true){const left=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR').length;toast(left?'Sincronización completada. Pendientes restantes: '+left:'Sincronización completada.');}
          return ok;
        };
        if(!window.__prestamoYaAutoSync){window.__prestamoYaAutoSync=true;window.addEventListener('online',()=>setTimeout(()=>window.syncNow().catch(()=>{}),900));}
        return;
      }
      setTimeout(bridge,300);
    };
    bridge();console.log('Préstamo Ya: integración Cloud cargada correctamente');
  }catch(e){console.error('Préstamo Ya: no se pudo cargar la integración Cloud',e);try{window.toast&&window.toast('Error de carga de Cloud. Recargue la página.')}catch(_){}
  }
})();