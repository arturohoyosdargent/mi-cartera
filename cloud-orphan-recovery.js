// Préstamo Ya — recuperación cloud del cliente original de créditos huérfanos.
(()=>{
  'use strict';

  if(window.__prestamoYaCloudOrphanRecovery)return;

  const idOf=v=>{
    if(v==null||v==='')return null;
    if(typeof v==='object')return v.id??v.clientId??v.value??null;
    return v;
  };

  const find=(list,id)=>{
    const k=idOf(id);
    if(k==null)return null;
    return(list||[]).find(x=>x&&String(x.id)===String(k))||null;
  };

  const merge=c=>{
    if(!c||!window.db)return;

    if(!Array.isArray(window.db.clients))
      window.db.clients=[];

    const i=window.db.clients.findIndex(
      x=>String(x.id)===String(c.id)
    );

    if(i>=0)
      window.db.clients[i]={...window.db.clients[i],...c};
    else
      window.db.clients.push(c);

    try{
      if(typeof window.persist==='function')
        window.persist();
    }catch(e){
      console.warn('Préstamo Ya · persistencia cliente',e);
    }
  };

  const cloud=async cr=>{
    const cid=idOf(cr?.clientId);

    if(cid==null)return null;

    /*
      PRIMERA OPCIÓN:
      consultar exactamente el ID de cliente que tiene guardado
      el crédito. No se busca ni se elige otro cliente.
    */
    try{
      if(typeof window.cloudGetClientById==='function'){
        const c=await window.cloudGetClientById(cid);

        if(c){
          merge(c);
          return c;
        }
      }
    }catch(e){
      console.warn(
        'Préstamo Ya · cloudGetClientById',
        e
      );
    }

    /*
      SEGUNDA OPCIÓN:
      consulta directa a Firestore.
    */
    try{
      const cfg=window.MI_CARTERA_FIREBASE||{};
      const org=
        window.MI_CARTERA_CLOUD?.orgId||
        'mi-cartera';

      if(!cfg.projectId)return null;

      const [
        {getApp},
        {getFirestore,doc,getDoc}
      ]=await Promise.all([
        import(
          'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'
        ),
        import(
          'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'
        )
      ]);

      const fs=getFirestore(getApp());

      const ref=doc(
        fs,
        `orgs/${org}/clients/${cid}`
      );

      const snap=await getDoc(ref);

      if(snap.exists()){
        const c={
          id:snap.id,
          ...snap.data()
        };

        merge(c);
        return c;
      }

    }catch(e){
      console.warn(
        'Préstamo Ya · recuperación directa Firestore',
        e
      );
    }

    /*
      TERCERA OPCIÓN:
      sincronizar y volver a buscar el MISMO ID.
    */
    try{
      if(
        navigator.onLine &&
        typeof window.cloudSyncNow==='function'
      ){
        await window.cloudSyncNow();

        const c=find(
          window.db?.clients,
          cid
        );

        if(c)return c;
      }
    }catch(e){
      console.warn(
        'Préstamo Ya · reintento de sincronización',
        e
      );
    }

    return null;
  };

  const repair=async id=>{
    const cr=find(
      window.db?.credits,
      id
    );

    if(!cr){
      if(typeof window.toast==='function')
        window.toast('Crédito no encontrado.');

      return;
    }

    const c=await cloud(cr);

    if(c){

      /*
        Conservamos TODO el crédito.
        Solamente restauramos clientId.
      */
      cr.clientId=c.id;

      if(!cr.routeId&&c.routeId)
        cr.routeId=c.routeId;

      try{
        if(typeof window.persist==='function')
          window.persist();

        if(typeof window.enqueueSync==='function'){
          window.enqueueSync(
            'CREDITO_MODIFICADO',
            {
              ...cr,
              id:cr.id,
              clientId:c.id
            }
          );
        }

        if(typeof window.audit==='function'){
          window.audit(
            'CREDITO_CLIENTE_RECUPERADO',
            '#'+cr.id+' → '+(c.name||c.id)
          );
        }
      }catch(e){
        console.warn(
          'Préstamo Ya · guardar recuperación',
          e
        );
      }

      if(typeof window.renderAll==='function')
        window.renderAll();

      if(typeof window.toast==='function')
        window.toast(
          'Cliente original recuperado: '+
          (c.name||c.id)
        );

      /*
        Esperamos un instante para que la interfaz
        se actualice antes de mostrar el crédito.
      */
      setTimeout(()=>{
        try{
          if(typeof window.showCredit==='function')
            window.showCredit(cr.id);
        }catch(e){
          console.warn(
            'Préstamo Ya · mostrar crédito',
            e
          );
        }
      },300);

      return c;
    }

    /*
      MUY IMPORTANTE:
      si el ID original no existe en Firebase,
      NO vinculamos ningún cliente diferente.
    */
    if(typeof window.toast==='function')
      window.toast(
        'No se encontró el cliente original en Firebase. No se vinculó otro cliente.'
      );

    return null;
  };

  const wrap=name=>{
    const raw=window[name];

    if(
      typeof raw!=='function'||
      raw.__prestamoYaCloudOrphan
    )return;

    const fn=async function(id,...args){

      const cr=
        find(window.db?.credits,id)||
        find(window.db?.credits,window.selectedCredit);

      if(cr){

        const local=find(
          window.db?.clients,
          cr.clientId
        );

        /*
          Si el crédito tiene clientId pero el cliente
          no está localmente, recuperamos el mismo ID
          desde Firebase.
        */
        if(!local){

          const c=await cloud(cr);

          if(c){

            cr.clientId=c.id;

            if(!cr.routeId&&c.routeId)
              cr.routeId=c.routeId;

            try{
              if(typeof window.persist==='function')
                window.persist();

              if(typeof window.enqueueSync==='function'){
                window.enqueueSync(
                  'CREDITO_MODIFICADO',
                  {
                    ...cr,
                    id:cr.id,
                    clientId:c.id
                  }
                );
              }
            }catch(e){
              console.warn(
                'Préstamo Ya · persistir vínculo',
                e
              );
            }
          }
        }
      }

      return raw.call(
        this,
        cr?.id??id,
        ...args
      );
    };

    fn.__prestamoYaCloudOrphan=true;

    window[name]=fn;
  };

  /*
    Exponemos la reparación manual para el botón
    "Recuperar vínculo".
  */
  window.__prestamoYaRepairOrphan=repair;

  /*
    Protegemos las acciones principales.
  */
  [
    'showCredit',
    'openCollect',
    'editCredit',
    'refinance'
  ].forEach(wrap);

  window.__prestamoYaCloudOrphanRecovery=true;

})();
