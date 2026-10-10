// Mi Cartera PRO V2 — in-app support center for incidents and improvement requests.
(function(root){'use strict';
const KEY='mi-cartera-v2-support-tickets',OWNER='mi-cartera-v2-local-owner';
const VALID_TYPES=['ERROR','MEJORA'], VALID_STATUS=['NUEVO','EN_REVISION','EN_PROCESO','RESUELTO'];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function stored(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows));}
function build(){try{const published=root.MiCarteraV2VersionGuard?.state?.().publishedBuild;if(typeof published==='string'&&/^v2-[a-z0-9][a-z0-9._-]*$/i.test(published))return published}catch{}return document.getElementById('versionGuard')?.textContent?.replace(/^.*—\s*/,'').trim()||'NO_VERIFICADA'}
function liveIdentity(){
 try{const gate=root.MiCarteraV2AuthCloudGate,s=gate?.state?.()||{},uid=String(s.uid||'').trim(),orgId=String(gate?.ORG||'').trim(),role=String(s.role||'').toLowerCase();
  if(s.ready!==true||s.authenticated===false||s.member===false||!uid||!orgId||!['admin','owner','supervisor','cobrador'].includes(role))return null;
  const firebaseUid=root.firebaseAuthV2?.auth?.currentUser?.uid,owner=localStorage.getItem(OWNER);
  if(!firebaseUid||String(firebaseUid)!==uid||owner!==uid)return null;
  return {orgId,uid,email:s.email||'',role};
 }catch{return null}
}
// The gate's ORG getter can change before a new membership check finishes.
// Retain only the scope captured at boot or a matching ready auth event.
let verifiedScope=liveIdentity();
function identity(){const who=liveIdentity();if(!who||!verifiedScope||who.orgId!==verifiedScope.orgId||who.uid!==verifiedScope.uid||who.role!==verifiedScope.role){verifiedScope=null;return null}return who}
function requireIdentity(){const who=identity();if(!who)throw new Error('SUPPORT_AUTH_REQUIRED');return who}
function admin(who){return !!who&&['admin','owner'].includes(who.role)}
function organizationRows(who){return who?stored().filter(t=>t&&typeof t==='object'&&t.orgId===who.orgId):[]}
function all(){const who=identity();return organizationRows(who).filter(t=>admin(who)||t.uid===who.uid)}
function create(type,description){
 const who=requireIdentity();
 type=String(type||'').toUpperCase();description=String(description||'').trim();
 if(!VALID_TYPES.includes(type))throw new Error('TIPO_INVALIDO');if(description.length<5)throw new Error('DESCRIPCION_REQUERIDA');
 const now=new Date().toISOString(), id='SOP-'+now.replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
 const ticket={id,type,status:'NUEVO',description,createdAt:now,updatedAt:now,build:build(),screen:document.querySelector('.page.active')?.id||'',...who};
 const rows=stored();rows.unshift(ticket);save(rows);render();return ticket;
}
function setStatus(id,status){const who=requireIdentity();if(!admin(who))throw new Error('SUPPORT_PERMISO_REQUERIDO');status=String(status||'').toUpperCase();if(!VALID_STATUS.includes(status))throw new Error('ESTADO_INVALIDO');const rows=stored(),t=rows.find(x=>x?.id===id&&x.orgId===who.orgId);if(!t)throw new Error('REPORTE_NO_ENCONTRADO');t.status=status;t.updatedAt=new Date().toISOString();save(rows);render();return t}
function submit(){const type=document.getElementById('supportType')?.value,description=document.getElementById('supportDescription')?.value;try{const t=create(type,description);document.getElementById('supportDescription').value='';alert('Reporte '+t.id+' registrado. Puedes revisar su estado aquí mismo.')}catch(e){alert(e.message==='DESCRIPCION_REQUERIDA'?'Describe el problema o mejora con un poco más de detalle.':'No se pudo registrar: '+e.message)}}
const statusLabel={NUEVO:'Nuevo',EN_REVISION:'En revisión',EN_PROCESO:'En proceso',RESUELTO:'Resuelto'};
function cards(rows){return rows.map(t=>`<div class="card" data-support-ticket="${esc(t.id)}"><b>${esc(t.type==='ERROR'?'⚠️ Falla':'💡 Mejora')} · ${esc(t.id)}</b><p>${esc(t.description)}</p><p class="metric">Estado: <b>${esc(statusLabel[t.status]||t.status)}</b> · Versión: ${esc(t.build)}<br>Organización: ${esc(t.orgId)} · ${esc(new Date(t.createdAt).toLocaleString())}</p></div>`).join('')}
function styles(){if(document.getElementById('v2SupportStyles'))return;const style=document.createElement('style');style.id='v2SupportStyles';style.textContent='.v2-support-alert{display:block;width:100%;text-align:left;background:#edf7fc;border-color:#b6dbea;font-weight:600}.v2-support-status{display:block;margin-top:8px}.v2-support-status select{display:block;width:100%;margin-top:5px;min-height:44px}';document.head.appendChild(style)}
function homeAlert(who,rows){
 const count=admin(who)?rows.filter(t=>t.status==='NUEVO').length:0,old=document.getElementById('v2SupportHomeAlert');
 if(!count){old?.remove();return}
 const home=document.getElementById('home');if(!home)return;
 let button=old;if(!button){button=document.createElement('button');button.id='v2SupportHomeAlert';button.type='button';button.className='card btn v2-support-alert';button.onclick=openInbox;const title=home.querySelector('h2');if(title)title.insertAdjacentElement('afterend',button);else home.prepend(button)}
 button.textContent=`${count} reporte${count===1?' nuevo':'s nuevos'} · Revisar soporte`;
}
function inbox(who,rows){
 let host=document.getElementById('v2SupportInbox');if(!admin(who)){host?.remove();return}
 const list=document.getElementById('supportList');if(!list)return;
 if(!host){host=document.createElement('details');host.id='v2SupportInbox';host.className='card';host.innerHTML='<summary>Bandeja de reportes de la organización</summary><p class="metric">Reportes guardados en este dispositivo. Revisa y actualiza su estado.</p><div id="v2SupportInboxList"></div>';list.insertAdjacentElement('afterend',host)}
 const box=document.getElementById('v2SupportInboxList');box.innerHTML=rows.length?cards(rows):'<p>Todavía no hay reportes en esta organización.</p>';
 for(const card of box.querySelectorAll('[data-support-ticket]')){
  const id=card.dataset.supportTicket,t=rows.find(row=>row.id===id),label=document.createElement('label');label.className='v2-support-status';label.textContent='Actualizar estado';
  const select=document.createElement('select');select.className='select';select.setAttribute('aria-label','Estado de '+id);
  select.innerHTML=VALID_STATUS.filter(s=>s!=='EN_PROCESO'||t.status==='EN_PROCESO').map(s=>`<option value="${s}">${esc(statusLabel[s])}</option>`).join('');select.value=t.status;
  select.onchange=()=>{try{setStatus(id,select.value)}catch(e){alert('No se pudo actualizar: '+e.message);render()}};label.appendChild(select);card.appendChild(label);
 }
}
function openInbox(){const who=identity();if(!admin(who))return false;root.show?.('support');render();const host=document.getElementById('v2SupportInbox');if(host){host.open=true;host.scrollIntoView?.({behavior:'smooth',block:'start'})}return !!host}
function render(){
 const who=identity(),rows=organizationRows(who);styles();homeAlert(who,rows);
 const box=document.getElementById('supportList');if(box){const mine=rows.filter(t=>t.uid===who.uid);box.innerHTML=mine.length?cards(mine):`<div class="card">${who?'Todavía no hay reportes.':'Inicia sesión con una cuenta autorizada para consultar o enviar reportes.'}</div>`}
 inbox(who,rows);root.MiCarteraV2HistoryList?.render?.();
}
document.addEventListener('DOMContentLoaded',render);
root.addEventListener?.('v2-auth-cloud-state',event=>{const s=event.detail||{},who=liveIdentity();verifiedScope=s.ready===true&&s.authenticated!==false&&s.member!==false&&who&&String(s.uid||'').trim()===who.uid&&String(s.role||'').toLowerCase()===who.role?who:null;render()});
root.addEventListener?.('v2-local-owner-ready',()=>{const proof=root.MiCarteraV2LocalOwnershipBootstrap?.state?.(),who=liveIdentity();verifiedScope=proof?.ready===true&&who&&proof.uid===who.uid&&proof.role===who.role&&proof.orgId===who.orgId?who:null;render()});
root.addEventListener?.('storage',e=>{if(!e.key||e.key===KEY)render()});
root.MiCarteraV2Support={all,create,setStatus,submit,render,openInbox};
})(window);
