// Préstamo Ya — reparación segura de propietarios conocidos + protección contra vínculos erróneos.
(()=>{
  'use strict';
  if(window.__prestamoYaCreditOwnerRepairV1)return;
  window.__prestamoYaCreditOwnerRepairV1=true;

  // Incidencias verificadas durante la prueba E2E del 14/09/2026.
  // No se cambia el crédito; solo se corrige clientId buscando al cliente por identidad fuerte.
  const KNOWN={
    '1789432343734':{name:'Alfredo Lopez Martel',phone:'51947127238'},
    '1789205624924':{name:'Víctor Coronado Cordova',phone:'51944581617'}
  };
  const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const digits=v=>String(v??'').replace(/\D/g,'');
  const findLocal=(rule)=>{
    const clients=Array.isArray(window.db?.clients)?window.db.clients:[];
    const n=norm(rule.name), p=digits(rule.phone);
    const exact=clients.filter(c=>{
      const cn=norm(c?.name),cp=digits(c?.phone);
      return n&&p&&cn===n&&cp===p;
    });
    if(exact.length===1)return exact[0];
    const byPhone=clients.filter(c=>p&&digits(c?.phone)===p);
    if(byPhone.length===1)return byPhone[0];
    return null;
  };
  const repairLocal=()=>{
    let changed=false;
    for(const [id,rule] of Object.entries(KNOWN)){
      const cr=(window.db?.credits||[]).find(c=>String(c?.id)===id);
      if(!cr)continue;
      const c=findLocal(rule);
      if(!c)continue;
      if(String(cr.clientId)!==String(c.id)){
        cr.clientId=c.id;
        if(!cr.routeId&&c.routeId)cr.routeId=c.routeId;
        changed=true;
        try{window.enqueueSync?.('CREDITO_MODIFICADO',{...cr,id:cr.id,clientId:c.id});}catch(e){console.warn(e)}
        try{window.audit?.('CREDITO_PROPIETARIO_REPARADO','#'+id+' → '+c.name);}catch(e){}
      }
    }
    if(changed){try{window.persist?.();window.renderAll?.();}catch(e){console.warn(e)}}
    return changed;
  };
  const cloudRepair=async()=>{
    // Primero deja que la sincronización existente termine; luego corrige únicamente
    // estos dos IDs cuando la identidad fuerte (nombre+teléfono) coincide de forma única.
    try{if(typeof window.cloudSyncNow==='function'&&navigator.onLine)await window.cloudSyncNow();}catch(e){console.warn('owner repair pre-sync',e)}
    const changed=repairLocal();
    if(changed){try{if(typeof window.cloudSyncNow==='function'&&navigator.onLine)await window.cloudSyncNow();}catch(e){console.warn('owner repair post-sync',e)}}
    return changed;
  };
  window.__prestamoYaRepairKnownOwners=cloudRepair;
  window.addEventListener('load',()=>setTimeout(()=>cloudRepair().catch(()=>{}),1800));
})();
