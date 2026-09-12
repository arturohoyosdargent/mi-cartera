// Arranque seguro de Préstamo Ya: local-first, sin bloqueo de 15 s y sin borrar caché.
(async()=>{
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js?v=5',{updateViaCache:'none'}).catch(()=>{});
    }

    const loadScript=(src,type='text/javascript')=>new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.type=type;
      s.onload=resolve;
      s.onerror=()=>reject(new Error('No se pudo cargar '+src));
      document.head.appendChild(s);
    });

    // El respaldo/local siempre se carga. Nunca depende de Firebase.
    await loadScript('./backup.js?v=14');

    // Firebase es una capa opcional de sincronización. Si no hay conexión,
    // no se intenta cargar el módulo remoto ni se bloquea el arranque local.
    if(navigator.onLine){
      const core=document.createElement('script');
      core.type='module';
      core.src='./firebase-cloud-core.js?v=46';
      core.onload=()=>console.log('Préstamo Ya: Cloud listo');
      core.onerror=()=>console.warn('Préstamo Ya: Cloud no disponible; continúa en modo local');
      document.head.appendChild(core);
      setTimeout(()=>{
        if(typeof window.cloudSyncNow!=='function'){
          window.cloudSyncNow=async()=>false;
        }
      },5000);
    }else{
      window.cloudSyncNow=async()=>false;
      window.cloudLogin=async()=>toast('Sin internet: la aplicación continúa en modo local.');
      window.cloudLogout=async()=>{};
      console.log('Préstamo Ya: sin internet; modo local activo');
    }

    // Módulos funcionales locales. Se cargan sin esperar a Firebase.
    const localModules=[
      ['./cloud-repair-v2.js?v=3','module'],
      ['./ownership-model.js?v=2','module'],
      ['./session-switch.js?v=2','text/javascript'],
      ['./data-integrity.js?v=3','text/javascript'],
      ['./field-collection-sync.js?v=2','module'],
      ['./credit-proposal.js?v=4','text/javascript'],
      ['./payment-schedule-fix.js?v=2','text/javascript'],
      ['./history-detail.js?v=2','text/javascript'],
      ['./credit-rules-v3.js?v=2','text/javascript'],
      ['./credit-renewal-v3.js?v=2','text/javascript'],
      ['./renewal-balance-field.js?v=2','text/javascript'],
      ['./cloud-ui-fixes.js?v=3','text/javascript'],
      ['./credit-workflow-v4.js?v=2','text/javascript'],
      ['./credit-share-v2.js?v=2','text/javascript'],
      ['./sync-ui-fix.js?v=2','text/javascript'],
      ['./renewal-buttons-fix.js?v=2','text/javascript'],
      ['./renewal-final-fix.js?v=2','text/javascript'],
      ['./renewal-form-v2.js?v=2','text/javascript']
    ];
    for(const [src,type] of localModules){
      try{await loadScript(src,type)}catch(e){console.warn('Módulo opcional no cargado:',src,e)}
    }

    const installGuards=()=>{
      if(typeof window.currentUser!=='function'||typeof window.go!=='function'){
        setTimeout(installGuards,300);return;
      }
      if(window.__prestamoYaGuards)return;
      window.__prestamoYaGuards=true;
      const restricted=['users','investors','settings','audit','profile'];
      const originalGo=window.go;
      window.go=(id)=>{
        const role=window.currentUser()?.role||'consulta';
        if(!['admin','supervisor'].includes(role)&&restricted.includes(id))return toast('Acceso restringido a administración');
        return originalGo(id);
      };
      const manager=['admin','supervisor'];
      for(const name of ['openCapitalForm','addRoute','assignCollector','openUserForm','saveUser','toggleUser','saveSettings','saveProfile']){
        const fn=window[name];
        if(typeof fn==='function')window[name]=(...args)=>{
          if(!manager.includes(window.currentUser()?.role))return toast('Acceso restringido a administración');
          return fn(...args);
        };
      }
      const payment=window.registerPayment;
      if(typeof payment==='function')window.registerPayment=(id,...args)=>{
        const cr=(db.credits||[]).find(x=>String(x.id)===String(id));
        const u=window.currentUser?.();
        const ids=Array.isArray(u?.routeIds)?u.routeIds:[];
        if(!manager.includes(u?.role)&&cr&&!ids.includes(cr.routeId)&&!ids.includes(String(cr.routeId)))return toast('No autorizado para esta ruta');
        return payment(id,...args);
      };
    };
    installGuards();

    const getPushable=()=>{
      const pending=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
      const role=(typeof currentUser==='function'?currentUser()?.role:'consulta')||'consulta';
      const manager=['admin','supervisor'].includes(role);
      const types=manager
        ?['CLIENTE_CREADO','CLIENTE_MODIFICADO','CREDITO_CREADO','CREDITO_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION','AUTORIZACION_APROBADA','AUTORIZACION_RECHAZADA','CLIENTE_ELIMINADO']
        :['CLIENTE_CREADO','CLIENTE_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION'];
      return pending.filter(x=>types.includes(x.type));
    };

    const markSynced=items=>{
      const stamp=new Date().toISOString();
      if(Array.isArray(items))items.forEach(x=>{x.status='SINCRONIZADO';x.syncedAt=stamp;x.error=''});
      db.settings=db.settings||{};
      db.settings.lastOnline=stamp;
      try{persist();updateSyncUI();renderAll()}catch(e){console.warn(e)}
    };

    const bridge=()=>{
      if(typeof window.cloudSyncNow==='function'){
        if(!window.__prestamoYaCloudWrapped){
          const rawSync=window.cloudSyncNow;
          window.cloudSyncNow=async()=>{
            if(!navigator.onLine)return false;
            const handled=getPushable();
            const ok=await rawSync();
            if(ok===true)markSynced(handled);
            return ok;
          };
          window.__prestamoYaCloudWrapped=true;
        }
        window.syncNow=async()=>{
          if(!navigator.onLine)return toast('Sin internet: la información sigue guardada localmente.');
          return window.cloudSyncNow();
        };
        if(!window.__prestamoYaAutoSync){
          window.__prestamoYaAutoSync=true;
          window.addEventListener('online',()=>setTimeout(()=>window.syncNow().catch(()=>{}),900));
        }
        updateSyncUI?.();
        return;
      }
      setTimeout(bridge,500);
    };
    bridge();
    console.log('Préstamo Ya: integración Cloud/local cargada correctamente');
  }catch(e){
    console.error('Préstamo Ya: error de integración',e);
    try{window.toast&&window.toast('La aplicación continúa en modo local.')}catch(_){}
  }
})();
