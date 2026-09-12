// Arranque seguro de Préstamo Ya: local-first + Firebase Cloud + una sola tubería de sincronización.
(()=>{try{
 if(!sessionStorage.getItem('prestamo_ya_cache_clean_v30')){
   sessionStorage.setItem('prestamo_ya_cache_clean_v30','1');
   if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister().catch(()=>false))));
   if('caches' in window) caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))));
   location.reload();return;
 }
 const registerSW=()=>{if(!('serviceWorker' in navigator))return;window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=12',{updateViaCache:'none'}).then(r=>r.update().catch(()=>{})).then(()=>console.log('Préstamo Ya: Service Worker v12 activo')).catch(e=>console.warn('Préstamo Ya: Service Worker no disponible',e)),{once:true})};
 registerSW();
 (async()=>{try{
   const load=(src,type='text/javascript')=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.type=type;s.onload=ok;s.onerror=()=>no(new Error(src));document.head.appendChild(s)});
   await load('./backup.js?v=17');
   if(navigator.onLine){const s=document.createElement('script');s.type='module';s.src='./firebase-cloud-core.js?v=49';s.onload=()=>console.log('Préstamo Ya: Cloud listo');s.onerror=()=>console.warn('Préstamo Ya: Cloud no disponible; modo local');document.head.appendChild(s)}else window.cloudSyncNow=async()=>false;
   const modules=[
     ['./cloud-repair-v2.js?v=4','module'],['./ownership-model.js?v=3','module'],['./session-switch.js?v=3','text/javascript'],
     ['./data-integrity.js?v=4','text/javascript'],['./field-collection-sync.js?v=3','module'],['./history-detail.js?v=3','text/javascript'],
     ['./cloud-ui-fixes.js?v=4','text/javascript'],['./credit-share-v2.js?v=3','text/javascript'],['./sync-ui-fix.js?v=4','text/javascript'],
     ['./renewal-buttons-fix.js?v=3','text/javascript'],['./credit-proposal.js?v=8','text/javascript'],['./credit-proposal-ui.js?v=2','text/javascript'],
     ['./client-sync-repair.js?v=3','module'],['./sync-queue-v3.js?v=9','module'],['./address-navigation.js?v=3','text/javascript'],['./renewal-schedule-correction.js?v=2','text/javascript']
   ];
   for(const [src,type] of modules){try{await load(src,type)}catch(e){console.warn('Módulo no cargado:',src)}}
   const guards=()=>{if(typeof window.currentUser!=='function'||typeof window.go!=='function')return setTimeout(guards,300);if(window.__prestamoYaGuards)return;window.__prestamoYaGuards=true;const role=()=>window.currentUser()?.role||'consulta',manager=['admin','supervisor'],originalGo=window.go;window.go=id=>!manager.includes(role())&&['users','investors','settings','audit','profile'].includes(id)?toast('Acceso restringido a administración'):originalGo(id);for(const n of ['openCapitalForm','addRoute','assignCollector','openUserForm','saveUser','toggleUser','saveSettings','saveProfile']){const f=window[n];if(typeof f==='function')window[n]=(...a)=>manager.includes(role())?f(...a):toast('Acceso restringido a administración')}const payment=window.registerPayment;if(typeof payment==='function')window.registerPayment=(id,...a)=>{const cr=(window.db?.credits||[]).find(x=>String(x.id)===String(id)),u=window.currentUser?.(),ids=Array.isArray(u?.routeIds)?u.routeIds:[];return manager.includes(u?.role)||!cr||ids.includes(cr.routeId)||ids.includes(String(cr.routeId))?payment(id,...a):toast('No autorizado para esta ruta')}};guards();
   const bridge=()=>{
     if(typeof window.cloudSyncNow!=='function')return setTimeout(bridge,500);
     if(!window.__prestamoYaCloudWrapped){
       const raw=window.cloudSyncNow;
       window.cloudSyncNow=async()=>{
         if(!navigator.onLine){toast('Sin internet: la información sigue guardada localmente.');return false;}
         // 1) Cloud Core ejecuta el push/pull principal.
         const ok=await raw();
         if(!ok)return false;
         // 2) La cola local procesa operaciones que necesitan ACK explícito.
         let q={};
         if(typeof window.syncQueueV3==='function')q=await window.syncQueueV3();
         // 3) Espera nuevamente cualquier write emitido por Cloud Core.
         const confirmed=typeof window.waitForCloudWrites==='function'?await window.waitForCloudWrites():true;
         if(typeof window.updateSyncUI==='function')window.updateSyncUI();
         return ok && confirmed && q?.ok!==false;
       };
       window.__prestamoYaCloudWrapped=true;
     }
     window.syncNow=async()=>navigator.onLine?window.cloudSyncNow():toast('Sin internet: la información sigue guardada localmente.');
     if(!window.__prestamoYaAutoSync){window.__prestamoYaAutoSync=true;window.addEventListener('online',()=>setTimeout(()=>window.syncNow().catch(()=>{}),900))}
     updateSyncUI?.();
   };
   bridge();
 }catch(e){console.error('Préstamo Ya:',e);try{toast('La aplicación continúa en modo local.')}catch(_){} }})();
}catch(e){console.error('Préstamo Ya loader:',e)}})();
