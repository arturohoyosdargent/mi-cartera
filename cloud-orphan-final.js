// Préstamo Ya — recuperación DEFINITIVA del cliente original.
// No elimina datos. No selecciona clientes alternativos.
(()=>{
  'use strict';
  if(window.__prestamoYaCloudOrphanFinal)return;
  window.__prestamoYaCloudOrphanFinal=true;
  const findCredit=id=>{
    const list=window.db?.credits||[];
    return list.find(c=>String(c?.id)===String(id))||null;
  };
  const mergeClient=c=>{
    if(!c||!window.db)return;
    if(!Array.isArray(window.db.clients))window.db.clients=[];
    const i=window.db.clients.findIndex(x=>String(x?.id)===String(c.id));
    if(i>=0)window.db.clients[i]={...window.db.clients[i],...c};
    else window.db.clients.push(c);
    try{if(typeof window.persist==='function')window.persist();}catch(e){console.warn('Préstamo Ya · persistir cliente recuperado',e);}
  };
  const getOriginalClient=async cr=>{
    const cid=cr?.clientId;
    if(cid==null||cid==='')return null;
    const cfg=window.MI_CARTERA_FIREBASE||{};
    const org=window.MI_CARTERA_CLOUD?.orgId||'mi-cartera';
    if(!cfg.projectId)return null;
    try{
      const [{getApp},{getFirestore,doc,getDoc,collection,query,where,getDocs}]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
      ]);
      const fs=getFirestore(getApp());
      try{
        const ref=doc(fs,`orgs/${org}/clients/${String(cid)}`);
        const snap=await getDoc(ref);
        if(snap.exists())return{id:snap.id,...snap.data()};
      }catch(e){console.warn('Préstamo Ya · búsqueda por document ID',e);}
      try{
        const q=query(collection(fs,`orgs/${org}/clients`),where('id','==',cid));
        const result=await getDocs(q);
        if(!result.empty){
          const snap=result.docs[0];
          const c={id:snap.id,...snap.data()};
          if(c.id!==cid)c.id=cid;
          return c;
        }
      }catch(e){console.warn('Préstamo Ya · búsqueda por campo id',e);}
      try{
        if(navigator.onLine&&typeof window.cloudSyncNow==='function'){
          await window.cloudSyncNow();
          const local=(window.db?.clients||[]).find(c=>String(c?.id)===String(cid));
          if(local)return local;
        }
      }catch(e){console.warn('Préstamo Ya · sincronización final',e);}
    }catch(e){console.error('Préstamo Ya · recuperación definitiva',e);}
    return null;
  };
  const repair=async id=>{
    const cr=findCredit(id);
    if(!cr){if(typeof window.toast==='function')window.toast('Crédito no encontrado.');return false;}
    const c=await getOriginalClient(cr);
    if(!c){if(typeof window.toast==='function')window.toast('No se encontró el cliente original en Firebase. No se vinculó otro cliente.');return false;}
    cr.clientId=c.id;
    if(!cr.routeId&&c.routeId)cr.routeId=c.routeId;
    mergeClient(c);
    try{
      if(typeof window.persist==='function')window.persist();
      if(typeof window.enqueueSync==='function')window.enqueueSync('CREDITO_MODIFICADO',{...cr,id:cr.id,clientId:c.id});
      if(typeof window.audit==='function')window.audit('CREDITO_CLIENTE_RECUPERADO','#'+cr.id+' → '+(c.name||c.id));
    }catch(e){console.warn('Préstamo Ya · guardar vínculo',e);}
    if(typeof window.renderAll==='function')window.renderAll();
    if(typeof window.toast==='function')window.toast('✅ Cliente original recuperado: '+(c.name||c.id));
    setTimeout(()=>{try{if(typeof window.showCredit==='function')window.showCredit(cr.id);}catch(e){console.warn('Préstamo Ya · mostrar crédito',e);}},500);
    return true;
  };
  window.__prestamoYaRepairOrphan=repair;
  window.__prestamoYaRecoverCredit=repair;
})();
