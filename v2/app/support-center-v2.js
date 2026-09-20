// Mi Cartera PRO V2 — in-app support center for incidents and improvement requests.
(function(root){'use strict';
const KEY='mi-cartera-v2-support-tickets';
const VALID_TYPES=['ERROR','MEJORA'], VALID_STATUS=['NUEVO','EN_REVISION','EN_PROCESO','RESUELTO'];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function all(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows));}
function build(){return document.getElementById('versionGuard')?.textContent?.replace(/^.*—\s*/,'').trim()||'NO_VERIFICADA'}
function identity(){const s=root.MiCarteraV2AuthCloudGate?.state?.()||{};return {orgId:root.MiCarteraV2AuthCloudGate?.ORG||'',uid:s.uid||'',email:s.email||'',role:s.role||''}}
function create(type,description){
 type=String(type||'').toUpperCase();description=String(description||'').trim();
 if(!VALID_TYPES.includes(type))throw new Error('TIPO_INVALIDO');if(description.length<5)throw new Error('DESCRIPCION_REQUERIDA');
 const now=new Date().toISOString(), id='SOP-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
 const ticket={id,type,status:'NUEVO',description,createdAt:now,updatedAt:now,build:build(),screen:document.querySelector('.page.active')?.id||'',...identity()};
 const rows=all();rows.unshift(ticket);save(rows);render();return ticket;
}
function setStatus(id,status){status=String(status||'').toUpperCase();if(!VALID_STATUS.includes(status))throw new Error('ESTADO_INVALIDO');const rows=all(),t=rows.find(x=>x.id===id);if(!t)throw new Error('REPORTE_NO_ENCONTRADO');t.status=status;t.updatedAt=new Date().toISOString();save(rows);render();return t}
function submit(){const type=document.getElementById('supportType')?.value,description=document.getElementById('supportDescription')?.value;try{const t=create(type,description);document.getElementById('supportDescription').value='';alert('Reporte '+t.id+' registrado. Puedes revisar su estado aquí mismo.')}catch(e){alert(e.message==='DESCRIPCION_REQUERIDA'?'Describe el problema o mejora con un poco más de detalle.':'No se pudo registrar: '+e.message)}}
function render(){
 const box=document.getElementById('supportList');if(!box)return;const rows=all();if(!rows.length){box.innerHTML='<div class="card">Todavía no hay reportes.</div>';return}
 box.innerHTML=rows.map(t=>`<div class="card"><b>${esc(t.type==='ERROR'?'⚠️ Falla':'💡 Mejora')} · ${esc(t.id)}</b><p>${esc(t.description)}</p><p class="metric">Estado: <b>${esc(t.status)}</b> · Versión: ${esc(t.build)}<br>Organización: ${esc(t.orgId||'sin identificar')} · ${esc(new Date(t.createdAt).toLocaleString())}</p></div>`).join('');
}
document.addEventListener('DOMContentLoaded',render);
root.MiCarteraV2Support={all,create,setStatus,submit,render};
})(window);