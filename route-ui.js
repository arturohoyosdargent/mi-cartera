(function(){
  const routeCode=r=>String(r?.code||'');
  const label=r=>routeCode(r)?routeCode(r)+' · '+String(r.name||'Sin nombre'):String(r?.name||'Sin ruta');
  function normalizeRouteUi(){
    if(!window.db||!Array.isArray(db.routes))return;
    const sorted=db.routes.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    let seq=1;
    for(const r of sorted){if(!r.code)r.code='R'+String(seq).padStart(3,'0');seq++;}
    for(const r of db.routes){
      const u=(db.users||[]).find(x=>x.id===r.collectorId||x.uid===r.collectorId||String(x.name||'').trim().toLowerCase()===String(r.collectorName||r.cobrador||'').trim().toLowerCase());
      if(u?.uid)r.collectorUid=u.uid;
    }
  }
  function routeName(id){const r=(window.db?.routes||[]).find(x=>String(x.id)===String(id));return r?label(r):'Sin ruta';}
  function renderRouteOptions(id,all=true){const e=document.getElementById(id);if(!e)return;normalizeRouteUi();e.innerHTML=(all?'<option value="all">Todas</option>':'')+(db.routes||[]).map(r=>`<option value="${String(r.id)}">${label(r)}</option>`).join('');}
  function addRoute(){openForm('Nueva ruta',`<div class="field"><label>Nombre de ruta</label><input class="input" id="xRouteName"></div><button class="btn blue wide" onclick="saveRoute()">Guardar</button>`)}
  function saveRoute(){const n=document.getElementById('xRouteName')?.value.trim();if(!n)return toast('Ingrese nombre');normalizeRouteUi();const used=new Set((db.routes||[]).map(r=>r.code));let i=1;while(used.has('R'+String(i).padStart(3,'0')))i++;const r={id:'r'+Date.now(),code:'R'+String(i).padStart(3,'0'),name:n,collectorId:null,collectorUid:null};db.routes.push(r);audit('RUTA_CREADA',r.code+' · '+n);closeForm();persist()}
  function assignCollector(rid){const users=db.users.filter(u=>u.active&&['cobrador','supervisor'].includes(u.role));openForm('Asignar cobrador',`<select class="select" id="xCollector">${users.map(u=>`<option value="${u.id}">${u.name} · ${u.role}</option>`).join('')}</select><br><button class="btn blue wide" onclick="saveAssignment('${rid}')">Guardar</button>`)}
  function saveAssignment(rid){const r=db.routes.find(x=>String(x.id)===String(rid)),u=db.users.find(x=>String(x.id)===String(document.getElementById('xCollector')?.value));if(!r||!u)return toast('No se encontró la ruta o el cobrador');r.collectorId=u.uid||u.id;r.collectorUid=u.uid||u.id;audit('COBRADOR_ASIGNADO',label(r)+' → '+u.name);closeForm();persist()}
  function renderRoutes(){normalizeRouteUi();document.getElementById('routesList').innerHTML=db.routes.map(r=>{const u=db.users.find(x=>String(x.uid||x.id)===String(r.collectorUid||r.collectorId)),cs=db.credits.filter(c=>String(c.routeId)===String(r.id)),cl=db.clients.filter(c=>String(c.routeId)===String(r.id)),due=cs.reduce((s,c)=>s+currentDue(c),0);return `<div class="card"><b>📍 ${label(r)}</b><br>Cobrador: ${u?.name||'Sin asignar'}<br>Clientes: ${cl.length} · Créditos: ${cs.length} · Por cobrar: ${money(due)}<div class="actionbar"><button class="btn blue" onclick="assignCollector('${r.id}')">Asignar</button><button class="btn" onclick="routeReport('${r.id}')">Ver ruta</button></div></div>`}).join('')}
  window.routeLabel=label;window.routeName=routeName;window.renderRouteOptions=renderRouteOptions;window.addRoute=addRoute;window.saveRoute=saveRoute;window.assignCollector=assignCollector;window.saveAssignment=saveAssignment;window.renderRoutes=renderRoutes;
  setTimeout(()=>{normalizeRouteUi();try{renderAll()}catch(e){console.warn(e)}},100);
})();