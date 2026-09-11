// Diagnóstico seguro de integridad de Préstamo Ya.
// Solo analiza y reporta inconsistencias; no elimina ni mueve datos.
(async()=>{
  try{
    const wait=()=>new Promise(resolve=>{
      const started=Date.now();
      const tick=()=>{
        if(window.db&&typeof window.currentUser==='function')return resolve();
        if(Date.now()-started>15000)return resolve();
        setTimeout(tick,250);
      };
      tick();
    });
    await wait();
    const run=()=>{
      const u=typeof window.currentUser==='function'?window.currentUser():null;
      if(!u||!['admin','supervisor'].includes(u.role)||!window.db)return {ok:true,issues:[]};
      const routes=Array.isArray(db.routes)?db.routes:[];
      const clients=Array.isArray(db.clients)?db.clients:[];
      const credits=Array.isArray(db.credits)?db.credits:[];
      const payments=Array.isArray(db.payments)?db.payments:[];
      const issues=[];
      const byId=new Map(routes.map(r=>[String(r.id),r]));
      const clientById=new Map(clients.map(c=>[String(c.id),c]));
      const creditById=new Map(credits.map(c=>[String(c.id),c]));
      const byName=new Map();
      for(const r of routes){
        const n=String(r.name||'').trim().toLowerCase();
        if(!n)continue;
        const list=byName.get(n)||[];list.push(r);byName.set(n,list);
      }
      for(const [name,list] of byName){if(list.length>1)issues.push({type:'RUTAS_DUPLICADAS',name,count:list.length,ids:list.map(r=>String(r.id))});}
      for(const c of clients){if(c.routeId!=null&&c.routeId!==''&&!byId.has(String(c.routeId)))issues.push({type:'CLIENTE_SIN_RUTA_VALIDA',id:c.id,name:c.name,routeId:c.routeId});}
      for(const c of credits){
        if(c.routeId!=null&&c.routeId!==''&&!byId.has(String(c.routeId)))issues.push({type:'CREDITO_SIN_RUTA_VALIDA',id:c.id,routeId:c.routeId});
        if(c.clientId!=null&&c.clientId!==''&&!clientById.has(String(c.clientId)))issues.push({type:'CREDITO_SIN_CLIENTE',id:c.id,clientId:c.clientId});
        const client=c.clientId!=null&&c.clientId!==''?clientById.get(String(c.clientId)):null;
        if(client&&c.routeId!=null&&c.routeId!==''&&client.routeId!=null&&client.routeId!==''&&String(c.routeId)!==String(client.routeId))issues.push({type:'CREDITO_RUTA_DIFERENTE_CLIENTE',id:c.id,creditRouteId:c.routeId,clientRouteId:client.routeId});
      }
      for(const p of payments){
        if(p.creditId!=null&&p.creditId!==''&&!creditById.has(String(p.creditId)))issues.push({type:'PAGO_SIN_CREDITO',id:p.id,creditId:p.creditId});
        const credit=p.creditId!=null&&p.creditId!==''?creditById.get(String(p.creditId)):null;
        if(credit&&p.routeId!=null&&p.routeId!==''&&credit.routeId!=null&&credit.routeId!==''&&String(p.routeId)!==String(credit.routeId))issues.push({type:'PAGO_RUTA_DIFERENTE_CREDITO',id:p.id,paymentRouteId:p.routeId,creditRouteId:credit.routeId});
      }
      // Una ruta vacía y sin cobrador puede ser intencional; solo alertamos si ya contiene cartera.
      const collectorless=routes.filter(r=>!r.collectorId&&String(r.name||'').trim()&&(
        clients.some(c=>String(c.routeId)===String(r.id))||credits.some(c=>String(c.routeId)===String(r.id))
      ));
      if(collectorless.length)issues.push({type:'RUTAS_SIN_COBRADOR',count:collectorless.length,ids:collectorless.map(r=>String(r.id))});
      window.__prestamoYaIntegrity={checkedAt:new Date().toISOString(),ok:issues.length===0,issues};
      if(issues.length){
        console.warn('Préstamo Ya · diagnóstico de integridad',issues);
        if(typeof window.toast==='function'&&!window.__prestamoYaIntegrityToast){window.__prestamoYaIntegrityToast=true;window.toast('⚠️ Se detectaron '+issues.length+' observación(es) de integridad. Revisar Rutas/Usuarios.');}
      }else console.log('Préstamo Ya · integridad: OK');
      return window.__prestamoYaIntegrity;
    };
    window.checkRouteIntegrity=run;
    setTimeout(run,1200);
  }catch(e){console.warn('Préstamo Ya · diagnóstico de integridad no disponible',e);}
})();
