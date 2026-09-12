/* Préstamo Ya — Panel maestro comercial v1
 * No modifica ni migra la base operativa. Este módulo trabaja únicamente
 * sobre la organización comercial y deja la integración de cobros/licencias
 * para la siguiente fase.
 */
(function(){
  'use strict';
  const KEY='prestamo_ya_commercial_orgs_v1';
  const PLAN={basico:{name:'Básico',monthly:149,maxUsers:3},profesional:{name:'Profesional',monthly:249,maxUsers:10},empresarial:{name:'Empresarial',monthly:399,maxUsers:50}};
  const clean=v=>String(v==null?'':v).trim();
  const id=v=>clean(v).replace(/[^A-Za-z0-9_-]/g,'-').slice(0,80);
  const now=()=>new Date().toISOString();
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function write(x){localStorage.setItem(KEY,JSON.stringify(x));}
  function get(idv){return read().find(x=>x.id===idv)||null;}
  function assertOrg(o){if(!o||!o.id||!o.name)throw new Error('COMMERCIAL_ORG_INVALID');if(!PLAN[o.plan])throw new Error('COMMERCIAL_PLAN_INVALID');return o;}
  function create(input){
    const name=clean(input?.name), ownerEmail=clean(input?.ownerEmail).toLowerCase(), plan=clean(input?.plan||'basico');
    if(name.length<2||!/^\S+@\S+\.\S+$/.test(ownerEmail))throw new Error('COMMERCIAL_ORG_FIELDS_INVALID');
    if(!PLAN[plan])throw new Error('COMMERCIAL_PLAN_INVALID');
    const org={id:id(input?.id||('org-'+Date.now())),name,ownerEmail,plan,status:'trial',trialEndsAt:new Date(Date.now()+14*86400000).toISOString(),createdAt:now(),updatedAt:now(),users:1};
    const list=read();if(list.some(x=>x.id===org.id||x.ownerEmail===ownerEmail))throw new Error('COMMERCIAL_ORG_EXISTS');list.push(assertOrg(org));write(list);return org;
  }
  function update(idv,patch){const list=read(),i=list.findIndex(x=>x.id===idv);if(i<0)throw new Error('COMMERCIAL_ORG_NOT_FOUND');const next={...list[i],...patch,updatedAt:now()};assertOrg(next);list[i]=next;write(list);return next;}
  function setStatus(idv,status){if(!['trial','active','suspended','cancelled'].includes(status))throw new Error('COMMERCIAL_STATUS_INVALID');return update(idv,{status});}
  function setPlan(idv,plan){return update(idv,{plan});}
  function summary(){const list=read();return {companies:list.length,active:list.filter(x=>x.status==='active').length,trial:list.filter(x=>x.status==='trial').length,suspended:list.filter(x=>x.status==='suspended').length,mrr:list.filter(x=>['active','trial'].includes(x.status)).reduce((s,x)=>s+(PLAN[x.plan]?.monthly||0),0)};}
  function mount(root){
    if(!root)return;
    root.innerHTML='<div class="commercial-admin"><div class="sectionTitle">Administración comercial</div><div id="commercialKpis" class="grid"></div><div class="card"><b>Empresas clientes</b><div id="commercialCompanies"></div></div></div>';
    render(root);
  }
  function render(root){
    const k=root.querySelector('#commercialKpis'),c=root.querySelector('#commercialCompanies'),s=summary();
    k.innerHTML=[['Empresas',s.companies],['Activas',s.active],['En prueba',s.trial],['MRR estimado','S/'+s.mrr.toFixed(2)]].map(x=>'<div class="card metric">'+x[0]+'<b>'+x[1]+'</b></div>').join('');
    const list=read();
    c.innerHTML=list.length?'<table class="table"><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Usuarios</th><th>Acciones</th></tr></thead><tbody>'+list.map(o=>'<tr><td>'+esc(o.name)+'<br><span class="small muted">'+esc(o.ownerEmail)+'</span></td><td>'+esc(PLAN[o.plan]?.name||o.plan)+'</td><td>'+esc(o.status)+'</td><td>'+o.users+'/'+PLAN[o.plan].maxUsers+'</td><td><button class="btn" data-a="active" data-id="'+esc(o.id)+'">Activar</button> <button class="btn" data-a="suspended" data-id="'+esc(o.id)+'">Suspender</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">Aún no hay empresas comerciales registradas.</p>';
    c.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>{setStatus(b.dataset.id,b.dataset.a);render(root);});
  }
  function esc(v){return clean(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  window.PrestamoYaCommercialAdmin=Object.freeze({PLAN,read,get,create,update,setStatus,setPlan,summary,mount,version:'commercial-v1'});
})();
