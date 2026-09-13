// Préstamo Ya — Agenda automática de cobranza
(()=>{
'use strict';
if(window.__prestamoYaAgendaCobranza)return;
window.__prestamoYaAgendaCobranza=true;

const pad=n=>String(n).padStart(2,'0');
const iso=d=>{const x=new Date(d);return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`};
const today=()=>{const n=new Date();return iso(n)};
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const fmtDate=s=>{if(!s)return '-';const [y,m,d]=String(s).split('-');return d&&m&&y?`${d}/${m}/${y}`:String(s)};
const money=v=>'S/ '+Number(v||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const dbx=()=>window.db||null;
const clientOf=cr=>(dbx()?.clients||[]).find(c=>String(c.id)===String(cr.clientId));
const routeName=id=>{const r=(dbx()?.routes||[]).find(x=>String(x.id)===String(id));return r?.name||r?.code||'Sin ruta'};

function fallbackSchedule(cr){
  const out=[]; const n=Number(cr.term||0); if(!n)return out;
  let date=cr.first||cr.date||today(); const freq=cr.freq||'daily'; const rest=cr.restDay||'none';
  const amount=Number(cr.installment||0);
  for(let i=1;i<=n;i++){
    if(i>1){
      const step=freq==='weekly'?7:freq==='biweekly'?14:freq==='monthly'?30:1;
      date=addDays(date,step);
    }
    if(freq==='daily'&&rest!=='none'){
      let guard=0; while(new Date(date+'T12:00:00').getDay()===Number(rest)&&guard++<8)date=addDays(date,1);
    }
    out.push({n:i,date,amount,paid:0,extra:false});
  }
  return out;
}

function obligations(){
  const db=dbx(); if(!db)return [];
  const out=[];
  for(const cr of (db.credits||[])){
    if(String(cr.status||'Activo').toLowerCase()!=='activo')continue;
    const c=clientOf(cr); if(!c)continue;
    const schedule=Array.isArray(cr.schedule)&&cr.schedule.length?cr.schedule:fallbackSchedule(cr);
    for(const q of schedule){
      const amount=Number(q.amount||0), paid=Number(q.paid||0);
      if(amount<=0||paid>=amount)continue;
      out.push({id:`${cr.id}:${q.n||q.date}:${q.extra?'A':'R'}`,creditId:cr.id,clientId:c.id,client:c,credit:cr,date:String(q.date||''),amount,paid,remaining:Math.max(0,amount-paid),extra:!!q.extra,n:q.n||'',routeId:cr.routeId||c.routeId||null});
    }
  }
  return out.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.client.name).localeCompare(String(b.client.name)));
}

function phone(c){
  let p=String(c?.phone||'').replace(/\D/g,'');
  if(p.startsWith('00'))p=p.slice(2);
  if(p.length===9)p='51'+p;
  return p;
}

function whatsapp(o){
  const p=phone(o.client);
  if(!p)return toast('Este cliente no tiene teléfono válido.');
  const due=fmtDate(o.date);
  const text=`Hola ${o.client.name||''}, te recordamos que hoy corresponde realizar tu pago de ${money(o.remaining)} de tu préstamo. Fecha de pago: ${due}. Gracias.`;
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function icsDate(date){return String(date).replace(/-/g,'')}
function exportICS(list){
  if(!list.length)return toast('No hay pagos pendientes para exportar.');
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Prestamo Ya//Agenda Cobranza//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  list.forEach(o=>{
    rows.push('BEGIN:VEVENT');
    rows.push(`UID:prestamoya-${o.id}@local`);
    rows.push(`DTSTAMP:${stamp}`);
    rows.push(`DTSTART;VALUE=DATE:${icsDate(o.date)}`);
    rows.push(`SUMMARY:${icsEscape('Pago '+money(o.remaining)+' · '+o.client.name)}`);
    rows.push(`DESCRIPTION:${icsEscape('Préstamo Ya · Crédito #'+o.creditId+' · Cuota '+(o.extra?'adicional':'regular')+' · '+money(o.remaining)+' · '+o.client.phone)}`);
    rows.push('END:VEVENT');
  });
  rows.push('END:VCALENDAR');
  const blob=new Blob([rows.join('\r\n')],'text/calendar;charset=utf-8');
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='prestamo-ya-agenda-cobranza.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Agenda exportada. Puedes importarla en Google Calendar.');
}

function ensurePage(){
  if(document.getElementById('agendaCobranza'))return;
  const main=document.querySelector('main.main'); if(!main)return;
  const s=document.createElement('section');s.id='agendaCobranza';s.className='page';
  s.innerHTML=`<div class="sectionTitle">📅 Agenda automática de cobranza</div>
  <div class="card kpiGood"><b>No vuelvas a registrar pagos día por día.</b><div class="small muted">La agenda se genera directamente desde los créditos: fecha inicial, frecuencia, cuotas, pagos realizados y pagos adicionales.</div></div>
  <div class="grid3">
    <button class="btn" id="agendaTodayBtn" onclick="window.__prestamoYaAgendaFilter('today')">HOY</button>
    <button class="btn" onclick="window.__prestamoYaAgendaFilter('overdue')">🔴 VENCIDOS</button>
    <button class="btn" onclick="window.__prestamoYaAgendaFilter('week')">📆 7 DÍAS</button>
  </div>
  <div class="twocol"><div class="field"><label>Desde</label><input class="input" id="agendaFrom" type="date" onchange="window.__prestamoYaRenderAgenda()"></div><div class="field"><label>Hasta</label><input class="input" id="agendaTo" type="date" onchange="window.__prestamoYaRenderAgenda()"></div></div>
  <div class="twocol"><div class="field"><label>Ruta</label><select class="select" id="agendaRoute" onchange="window.__prestamoYaRenderAgenda()"><option value="all">Todas las rutas</option></select></div><div class="field"><label>Buscar cliente</label><input class="input" id="agendaSearch" placeholder="Nombre o teléfono" oninput="window.__prestamoYaRenderAgenda()"></div></div>
  <div class="actionbar"><button class="btn blue" onclick="window.__prestamoYaAgendaFilter('today')">🔔 Cobranza de hoy</button><button class="btn" onclick="window.__prestamoYaExportICS()">📅 Exportar a calendario</button></div>
  <div class="card" id="agendaSummary"></div><div id="agendaList"></div>`;
  main.appendChild(s);
  const from=document.getElementById('agendaFrom'),to=document.getElementById('agendaTo');if(from)from.value=today();if(to)to.value=today();
}

function injectEntry(){
  const home=document.getElementById('home');
  if(home&&!document.getElementById('agendaEntry')){
    const btn=document.createElement('button');btn.id='agendaEntry';btn.className='btn blue';btn.textContent='📅 Agenda automática';btn.onclick=()=>go('agendaCobranza');
    const bar=home.querySelector('.actionbar');if(bar)bar.insertBefore(btn,bar.firstChild);
  }
  const collections=document.getElementById('collections');
  if(collections&&!document.getElementById('agendaFromCollections')){
    const btn=document.createElement('button');btn.id='agendaFromCollections';btn.className='btn';btn.textContent='📅 Agenda automática';btn.onclick=()=>go('agendaCobranza');
    const bar=collections.querySelector('.sectionTitle');if(bar)bar.insertAdjacentElement('afterend',btn);
  }
}

function filterRange(mode){
  const f=document.getElementById('agendaFrom'),t=document.getElementById('agendaTo');const d=today();
  if(mode==='overdue'){f.value='2000-01-01';t.value=addDays(d,-1)}
  else if(mode==='week'){f.value=d;t.value=addDays(d,6)}
  else {f.value=d;t.value=d}
  render();
}

function render(){
  ensurePage();injectEntry();
  const db=dbx();if(!db)return;
  const route=document.getElementById('agendaRoute');
  if(route&&route.options.length===1)route.innerHTML='<option value="all">Todas las rutas</option>'+(db.routes||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.code||r.id)}</option>`).join('');
  const f=document.getElementById('agendaFrom')?.value||today(),t=document.getElementById('agendaTo')?.value||today(),rid=document.getElementById('agendaRoute')?.value||'all',search=String(document.getElementById('agendaSearch')?.value||'').trim().toLowerCase();
  let list=obligations().filter(o=>o.date>=f&&o.date<=t&&(rid==='all'||String(o.routeId)===String(rid))&&(!search||String(o.client.name||'').toLowerCase().includes(search)||String(o.client.phone||'').includes(search)));
  const overdue=list.filter(o=>o.date<today()).reduce((s,o)=>s+o.remaining,0),total=list.reduce((s,o)=>s+o.remaining,0),count=list.length;
  const sum=document.getElementById('agendaSummary');if(sum)sum.innerHTML=`<div class="grid"><div class="metric">Pendientes<b>${count}</b></div><div class="metric">Por cobrar<b>${money(total)}</b></div><div class="metric">Vencido en vista<b>${money(overdue)}</b></div><div class="metric">Clientes<b>${new Set(list.map(o=>o.clientId)).size}</b></div></div>`;
  const box=document.getElementById('agendaList');if(!box)return;
  if(!list.length){box.innerHTML='<div class="card">No hay cuotas pendientes en este periodo.</div>';return;}
  const groups={};list.forEach(o=>(groups[o.date]??=[]).push(o));
  box.innerHTML=Object.keys(groups).sort().map(date=>{
    const day=groups[date],sum=day.reduce((s,o)=>s+o.remaining,0),isOld=date<today(),isToday=date===today();
    return `<div class="card"><div class="actionbar" style="justify-content:space-between"><b>${isToday?'🔔 HOY':isOld?'🔴 VENCIDO':'📅 '+fmtDate(date)}</b><b>${money(sum)}</b></div>${day.map(o=>`<div class="info"><b>${esc(o.client.name)}</b> · ${money(o.remaining)} · ${o.extra?'Pago adicional':'Cuota '+esc(o.n)}<br><span class="small muted">${routeName(o.routeId)} · Crédito #${esc(o.creditId)} · ${esc(o.client.phone||'Sin teléfono')}</span><div class="actionbar"><button class="btn green" onclick="window.__prestamoYaAgendaWhatsApp('${esc(o.id)}')">💬 Recordar por WhatsApp</button><button class="btn" onclick="showCredit('${esc(o.creditId)}')">Ver crédito</button></div></div>`).join('')}</div>`;
  }).join('');
  window.__prestamoYaAgendaCurrent=list;
}

window.__prestamoYaAgendaFilter=filterRange;
window.__prestamoYaRenderAgenda=render;
window.__prestamoYaAgendaWhatsApp=id=>{const o=(window.__prestamoYaAgendaCurrent||[]).find(x=>String(x.id)===String(id))||obligations().find(x=>String(x.id)===String(id));if(o)whatsapp(o)};
window.__prestamoYaExportICS=()=>exportICS(window.__prestamoYaAgendaCurrent||obligations());

const boot=()=>{ensurePage();injectEntry();render();setTimeout(render,800);setTimeout(render,2000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

const oldRenderAll=window.renderAll;
if(typeof oldRenderAll==='function')window.renderAll=(...a)=>{const r=oldRenderAll(...a);setTimeout(render,0);return r};

const oldGo=window.go;
if(typeof oldGo==='function')window.go=(id,...a)=>{const r=oldGo(id,...a);if(id==='agendaCobranza')setTimeout(render,0);return r};

})();
