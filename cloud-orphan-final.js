// Préstamo Ya — recuperación DEFINITIVA del cliente original v2.
// No elimina datos. No selecciona clientes alternativos.
(()=>{
  'use strict';
  if(window.__prestamoYaCloudOrphanFinalV2)return;
  window.__prestamoYaCloudOrphanFinalV2=true;
  const findCredit=id=>(window.db?.credits||[]).find(c=>String(c?.id)===String(id))||null;
  const mergeClient=c=>{
    if(!c||!window.db)return;
    if(!Array.isArray(window.db.clients))window.db.clients=[];
    const i=window.db.clients.findIndex(x=>String(x?.id)===String(c.id));
    if(i>=0)window.db.clients[i]={...window.db.clients[i],...c};
    else window.db.clients.push(c);
    try{window.persist?.()}catch(e){console.warn('Préstamo Ya · persistir cliente recuperado',e)}
  };
  const getOriginalClient=async cr=>{
    const cid=cr?.clientId;
    if(cid==null||cid==='')return null;
    const cfg=window.MI_CARTERA_FIREBASE||{};
    const org=window.MI_CARTERA_CLOUD?.orgId||'mi-cartera';
    if(!cfg.projectId)return null;
    try{
      const appMod=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
      const fsMod=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
      const fs=fsMod.getFirestore(appMod.getApp());
      const clientsRef=fsMod.collection(fs,`orgs/${org}/clients`);
      const asNumber=/^\d+$/.test(String(cid))?Number(cid):null;
      const variants=[String(cid)];
      if(asNumber!==null&&Number.isSafeInteger(asNumber))variants.push(asNumber);
      for(const key of variants){
        try{
          const snap=await fsMod.getDoc(fsMod.doc(fs,`orgs/${org}/clients/${String(key)}`));
          if(snap.exists())return{id:snap.id,...snap.data()};
        }catch(e){console.warn('Préstamo Ya · documento cliente '+String(key),e)}
      }
      for(const key of variants){
        try{
          const result=await fsMod.getDocs(fsMod.query(clientsRef,fsMod.where('id','==',key)));
          if(!result.empty){const snap=result.docs[0];return{id:snap.id,...snap.data()};}
        }catch(e){console.warn('Préstamo Ya · campo id '+String(key),e)}
      }
      // Último recurso: buscar por datos que estén guardados EN EL MISMO CRÉDITO.
      // Solo acepta una coincidencia inequívoca; jamás selecciona un cliente al azar.
      const norm=v=>String(v??'').trim().toLowerCase();
      const digits=v=>String(v??'').replace(/\D/g,'');
      const name=norm(cr.clientName||cr.customerName||cr.client?.name);
      const phone=digits(cr.clientPhone||cr.customerPhone||cr.phone||cr.client?.phone);
      const dni=digits(cr.clientDni||cr.customerDni||cr.dni||cr.client?.dni);
      if(name||phone||dni){
        try{
          const snap=await fsMod.getDocs(clientsRef);
          const matches=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>{
            const cn=norm(c.name),cp=digits(c.phone),cd=digits(c.dni);
            return (dni&&cd&&dni===cd)||(phone&&cp&&phone===cp)||(name&&cn&&name===cn);
          });
          if(matches.length===1)return matches[0];
        }catch(e){console.warn('Préstamo Ya · búsqueda inequívoca del cliente',e)}
      }
      try{
        if(navigator.onLine&&typeof window.cloudSyncNow==='function'){
          await window.cloudSyncNow();
          return (window.db?.clients||[]).find(c=>String(c?.id)===String(cid))||null;
        }
      }catch(e){console.warn('Préstamo Ya · sincronización final',e)}
    }catch(e){console.error('Préstamo Ya · recuperación definitiva',e)}
    return null;
  };
  const repair=async id=>{
    const cr=findCredit(id);
    if(!cr){window.toast?.('Crédito no encontrado.');return false;}
    try{
      window.toast?.('🔎 Buscando el cliente original en Cloud…');
      const c=await getOriginalClient(cr);
      if(!c){window.toast?.('❌ No se encontró el cliente original en Firebase. No se vinculó otro cliente.');return false;}
      cr.clientId=c.id;
      if(!cr.routeId&&c.routeId)cr.routeId=c.routeId;
      mergeClient(c);
      try{window.persist?.();window.enqueueSync?.('CREDITO_MODIFICADO',{...cr,id:cr.id,clientId:c.id});window.audit?.('CREDITO_CLIENTE_RECUPERADO','#'+cr.id+' → '+(c.name||c.id));}catch(e){console.warn('Préstamo Ya · guardar vínculo',e)}
      window.renderAll?.();
      window.toast?.('✅ Cliente original recuperado: '+(c.name||c.id));
      setTimeout(()=>{try{window.showCredit?.(cr.id)}catch(e){console.warn('Préstamo Ya · mostrar crédito',e)}},500);
      return true;
    }catch(e){console.error('Préstamo Ya · reparación del crédito',e);window.toast?.('❌ Error al recuperar el cliente original: '+(e?.code||e?.message||'error desconocido'));return false;}
  };
  window.__prestamoYaRepairOrphan=repair;
  window.__prestamoYaRecoverCredit=repair;
  window.__prestamoYaCloudOrphanRepairV2=repair;
})();