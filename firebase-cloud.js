// Arranque seguro de Préstamo Ya.
(async()=>{
  try{
    const cleanKey='prestamo_ya_cache_clean_v23';
    if(!sessionStorage.getItem(cleanKey)){
      sessionStorage.setItem(cleanKey,'1');
      if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister().catch(()=>false)));}
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}
      location.reload();return;
    }
    const loadScript=(src,type='text/javascript')=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.type=type;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
    await loadScript('./backup.js?v=13');
    const core=document.createElement('script');core.type='module';core.src='./firebase-cloud-core.js?v=45';document.head.appendChild(core);
    await new Promise(resolve=>{const started=Date.now();const tick=()=>{try{const ready=typeof window.cloudSyncNow==='function'&&!!window.db?.currentUserId;if(ready||Date.now()-started>15000)return resolve()}catch(_){}setTimeout(tick,200)};tick()});
    await loadScript('./cloud-repair-v2.js?v=2','module');
    await loadScript('./ownership-model.js?v=1','module');
    await loadScript('./session-switch.js?v=1');
    await loadScript('./data-integrity.js?v=2');
    await loadScript('./field-collection-sync.js?v=1','module');
    const installGuards=()=>{
      if(typeof window.currentUser!=='function'||typeof window.go!=='function'){setTimeout(installGuards,300);return;}
      if(window.__prestamoYaGuards)return;window.__prestamoYaGuards=true;
      const restricted=['users','investors','settings','audit','profile'];
      const originalGo=window.go;window.go=(id)=>{const role=window.currentUser()?.role||'consulta';if(!['admin','supervisor'].includes(role)&&restricted.includes(id))return toast('Acceso restringido a administración');return originalGo(id)};
      const manager=['admin','supervisor'];
      for(const name of ['openCapitalForm','addRoute','assignCollector','openUserForm','saveUser','toggleUser','saveSettings','saveProfile']){const fn=window[name];if(typeof fn==='function')window[name]=(...args)=>{if(!manager.includes(window.currentUser()?.role))return toast('Acceso restringido a administración');return fn(...args)}}
      const payment=window.registerPayment;if(typeof payment==='function')window.registerPayment=(id,...args)=>{const cr=(db.credits||[]).find(x=>String(x.id)===String(id));const u=window.currentUser?.();const ids=Array.isArray(u?.routeIds)?u.routeIds:[];if(!manager.includes(u?.role)&&cr&&!ids.includes(cr.routeId)&&!ids.includes(String(cr.routeId)))return toast('No autorizado para esta ruta');return payment(id,...args)};
    };
    installGuards();
    const getPushable=()=>{const pending=(db.syncQueue||[]).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');const role=(typeof currentUser==='function'?currentUser()?.role:'consulta')||'consulta';const manager=['admin','supervisor'].includes(role);const types=manager?['CLIENTE_CREADO','CLIENTE_MODIFICADO','CREDITO_CREADO','CREDITO_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION','AUTORIZACION_APROBADA','AUTORIZACION_RECHAZADA','CLIENTE_ELIMINADO']:['CLIENTE_CREADO','CLIENTE_MODIFICADO','RECAUDO','CIERRE_CAJA','SOLICITUD_AUTORIZACION'];return pending.filter(x=>types.includes(x.type));};
    const markSynced=(items)=>{const stamp=new Date().toISOString();if(Array.isArray(items))items.forEach(x=>{x.status='SINCRONIZADO';x.syncedAt=stamp;x.error='';});db.settings=db.settings||{};db.settings.lastOnline=stamp;try{persist();updateSyncUI();renderAll()}catch(e){console.warn(e)}};
    const bridge=()=>{if(typeof window.cloudSyncNow==='function'){if(!window.__prestamoYaCloudWrapped){const rawSync=window.cloudSyncNow;window.cloudSyncNow=async()=>{const handled=getPushable();const ok=await rawSync();if(ok===true)markSynced(handled);return ok;};window.__prestamoYaCloudWrapped=true;}window.syncNow=async()=>{if(!navigator.onLine)return toast('Sin internet: la información sigue guardada localmente.');return window.cloudSyncNow();};if(!window.__prestamoYaAutoSync){window.__prestamoYaAutoSync=true;window.addEventListener('online',()=>setTimeout(()=>window.syncNow().catch(()=>{}),900));}return;}setTimeout(bridge,300)};
    bridge();

    // Módulo de ubicación para clientes: búsqueda automática de dirección + mapa + Waze.
    const installLocationModule=()=>{
      if(typeof window.getLocation!=='function'||!document.getElementById('fAddress')){setTimeout(installLocationModule,250);return;}
      if(window.__moviaLocationModule)return;window.__moviaLocationModule=true;

      const style=document.createElement('style');
      style.textContent=`
        #locationSearchBox{margin-top:8px;border:1px solid #d4d9dd;border-radius:10px;background:#fff;box-shadow:0 3px 10px #0002;display:none;overflow:hidden;position:relative;z-index:80}
        #locationSearchBox .locItem{padding:10px 12px;border-bottom:1px solid #eee;cursor:pointer;font-size:13px;line-height:1.35}
        #locationSearchBox .locItem:hover{background:#eef8fd}
        #locationSearchBox .locEmpty{padding:10px 12px;color:#6b737b;font-size:12px}
        #locationMapPanel{margin-top:9px;border:1px solid #d4d9dd;border-radius:10px;overflow:hidden;background:#fff;display:none}
        #locationMapPanel iframe{display:block;width:100%;height:260px;border:0}
        .locationTools{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}
        .locationTools .btn{flex:1;min-width:145px}
        #locationResolved{font-size:12px;color:#187536;padding:8px 10px;background:#eef9f1;border-top:1px solid #d8eddc}
      `;
      document.head.appendChild(style);

      const address=document.getElementById('fAddress');
      const location=document.getElementById('fLocation');
      const originalButton=document.querySelector('button[onclick="getLocation()"]');
      if(!address||!location)return;
      if(originalButton){originalButton.textContent='📍 Buscar dirección en el mapa';originalButton.onclick=()=>window.searchClientAddress(true);}

      let timer=null, lastQuery='', results=[];
      const ensureUI=()=>{
        let box=document.getElementById('locationSearchBox');
        if(!box){box=document.createElement('div');box.id='locationSearchBox';address.parentElement.appendChild(box)}
        let panel=document.getElementById('locationMapPanel');
        if(!panel){
          panel=document.createElement('div');panel.id='locationMapPanel';
          address.parentElement.appendChild(panel);
        }
        let tools=document.getElementById('locationTools');
        if(!tools){
          tools=document.createElement('div');tools.id='locationTools';tools.className='locationTools';
          tools.innerHTML='<button type="button" class="btn" id="openMapBtn">🗺️ Abrir mapa</button><button type="button" class="btn" id="openWazeBtn">🚗 Abrir Waze</button>';
          address.parentElement.appendChild(tools);
          document.getElementById('openMapBtn').onclick=()=>openResolvedMap();
          document.getElementById('openWazeBtn').onclick=()=>openWaze();
        }
        return {box,panel,tools};
      };
      const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const parseLocation=()=>{
        const raw=String(location.value||'').trim().replace(/[\[\]]/g,'');
        const m=raw.split(',').map(Number);
        return m.length===2&&Number.isFinite(m[0])&&Number.isFinite(m[1])&&Math.abs(m[0])<=90&&Math.abs(m[1])<=180?{lat:m[0],lon:m[1]}:null;
      };
      const renderMap=(lat,lon,label)=>{
        const {panel}=ensureUI();
        const d=0.0035;
        const bbox=[lon-d,lat-d,lon+d,lat+d].join('%2C');
        panel.innerHTML='<iframe loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&layer=mapnik&marker='+encodeURIComponent(lat)+','+encodeURIComponent(lon)+'" title="Mapa de ubicación del cliente"></iframe><div id="locationResolved">📍 '+esc(label||('Ubicación: '+lat.toFixed(6)+', '+lon.toFixed(6)))+'</div>';
        panel.style.display='block';
      };
      const renderResults=(items)=>{
        const {box}=ensureUI();results=items||[];
        if(!results.length){box.innerHTML='<div class="locEmpty">No encontré esa dirección. Prueba agregando distrito, provincia o referencia.</div>';box.style.display='block';return;}
        box.innerHTML=results.slice(0,5).map((x,i)=>'<div class="locItem" data-i="'+i+'"><b>'+esc(x.display_name?.split(',').slice(0,2).join(', ')||'Ubicación')+'</b><br><span class="muted">'+esc(x.display_name||'')+'</span></div>').join('');
        box.style.display='block';
        box.querySelectorAll('.locItem').forEach(el=>el.addEventListener('click',()=>selectResult(Number(el.dataset.i))));
      };
      const selectResult=(i)=>{
        const x=results[i];if(!x)return;
        const lat=Number(x.lat),lon=Number(x.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
        address.value=x.display_name||address.value;
        location.value='['+lat.toFixed(6)+','+lon.toFixed(6)+']';
        const {box}=ensureUI();box.style.display='none';
        renderMap(lat,lon,x.display_name);
        toast('Ubicación encontrada y guardada');
      };
      const search=async(force=false)=>{
        const q=address.value.trim();
        if(q.length<4){const {box}=ensureUI();box.style.display='none';return;}
        if(!force&&q===lastQuery)return;
        lastQuery=q;
        const {box}=ensureUI();box.innerHTML='<div class="locEmpty">🔎 Buscando dirección...</div>';box.style.display='block';
        try{
          // Nominatim/OpenStreetMap: geocodificación sin API key. Se limita la frecuencia para respetar el servicio público.
          const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=pe&accept-language=es&q='+encodeURIComponent(q);
          const r=await fetch(url,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);
          const data=await r.json();renderResults(data);
          if(data.length===1)selectResult(0);
        }catch(e){console.warn('Geocodificación:',e);box.innerHTML='<div class="locEmpty">No se pudo consultar el mapa. Puedes abrir Waze con la dirección escrita.</div>';box.style.display='block';}
      };
      window.searchClientAddress=search;
      window.openResolvedMap=()=>{
        const p=parseLocation(),q=address.value.trim();
        if(p){window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.lat+','+p.lon),'_blank','noopener');return;}
        if(q)window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener');else toast('Ingrese primero una dirección');
      };
      window.openWaze=()=>{
        const p=parseLocation(),q=address.value.trim();
        if(!p&&!q)return toast('Ingrese primero una dirección');
        const url=p?'https://waze.com/ul?ll='+encodeURIComponent(p.lat+','+p.lon)+'&navigate=yes':'https://waze.com/ul?q='+encodeURIComponent(q)+'&navigate=yes';
        window.open(url,'_blank','noopener');
      };
      window.getLocation=()=>search(true);

      address.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(false),1000)});
      address.addEventListener('blur',()=>{clearTimeout(timer);timer=setTimeout(()=>search(false),250)});
      location.addEventListener('change',()=>{const p=parseLocation();if(p)renderMap(p.lat,p.lon,address.value||'Ubicación del cliente')});

      // Si el cliente ya tenía coordenadas, se muestra el mapa al abrir/modificar.
      const oldEdit=window.editClient;
      if(typeof oldEdit==='function'&&!window.__moviaEditWrapped){window.editClient=(...args)=>{const r=oldEdit(...args);setTimeout(()=>{const p=parseLocation();if(p)renderMap(p.lat,p.lon,address.value||'Ubicación del cliente')},100);return r};window.__moviaEditWrapped=true;}
      const oldNew=window.newClient;
      if(typeof oldNew==='function'&&!window.__moviaNewWrapped){window.newClient=(...args)=>{const r=oldNew(...args);setTimeout(()=>{const {panel,box}=ensureUI();panel.style.display='none';box.style.display='none'},100);return r};window.__moviaNewWrapped=true;}
    };
    installLocationModule();
    console.log('Préstamo Ya: integración Cloud + ubicación/Waze cargada correctamente');
  }catch(e){console.error('Préstamo Ya: no se pudo cargar la integración Cloud',e);try{window.toast&&window.toast('Error de carga de Cloud. Recargue la página.')}catch(_){} }
})();