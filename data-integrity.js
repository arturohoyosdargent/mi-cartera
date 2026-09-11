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
      const issues=[];
      const byId=new Map(routes.map(r=>[String(r.id),r]));
      const byName=new Map();
      for(const r of routes){
        const n=String(r.name||'').trim().toLowerCase();
        if(!n)continue;
        const list=byName.get(n)||[];list.push(r);byName.set(n,list);
      }
      for(const [name,list] of byName){if(list.length>1)issues.push({type:'RUTAS_DUPLICADAS',name,count:list.length,ids:list.map(r=>String(r.id))});}
      for(const c of clients){if(c.routeId!=null&&c.routeId!==''&&!byId.has(String(c.routeId)))issues.push({type:'CLIENTE_SIN_RUTA_VALIDA',id:c.id,name:c.name,routeId:c.routeId});}
      for(const c of credits){if(c.routeId!=null&&c.routeId!==''&&!byId.has(String(c.routeId)))issues.push({type:'CREDITO_SIN_RUTA_VALIDA',id:c.id,routeId:c.routeId});}
      const collectorless=routes.filter(r=>!r.collectorId&&String(r.name||'').trim());
      if(collectorless.length)issues.push({type:'RUTAS_SIN_COBRADOR',count:collectorless.length});
      window.__prestamoYaIntegrity={checkedAt:new Date().toISOString(),ok:issues.length===0,issues};
      if(issues.length){console.warn('Préstamo Ya · diagnóstico de integridad',issues);if(typeof window.toast==='function'&&!window.__prestamoYaIntegrityToast){window.__prestamoYaIntegrityToast=true;window.toast('⚠️ Se detectaron '+issues.length+' observación(es) de integridad. Revisar Rutas/Usuarios.');}}
      else console.log('Préstamo Ya · integridad: OK');
      return window.__prestamoYaIntegrity;
    };
    window.checkRouteIntegrity=run;
    setTimeout(run,1200);
  }catch(e){console.warn('Préstamo Ya · diagnóstico de integridad no disponible',e);}
})();
