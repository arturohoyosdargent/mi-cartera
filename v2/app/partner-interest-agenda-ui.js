(function(root){
'use strict';
const K='mi-cartera-v2-validation-state',A=root.MiCarteraPartnerAgenda,$=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>'S/ '+Number(x).toFixed(2),today=()=>root.MiCarteraV2Dates.today();
const fmt=d=>new Date(d+'T12:00:00Z').toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const monthLabel=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
let selectedMonth='',selectedDay='';
function loans(){try{return (JSON.parse(localStorage.getItem(K)||'{}').cashMovements||[]).filter(x=>x.partnerLoan&&!x.tombstone).map(x=>x.partnerLoan)}catch{return []}}
function authorized(){if(root.MiCarteraPartners?.canView)return root.MiCarteraPartners.canView();const auth=root.MiCarteraV2AuthCloudGate?.state?.();return auth?.ready===true&&['admin','supervisor'].includes(auth.role)}
function row(r){return '<article class="partner-interest-row" data-interest-status="'+r.status+'"><div><b>'+esc(r.partner)+' · '+money(r.amount)+'</b><div>'+esc(fmt(r.date))+' <span class="partner-interest-status '+r.status.toLowerCase()+'">'+({PAGADO:'Pagado',VENCIDO:'Atrasado',HOY:'Vence hoy',PROGRAMADO:'Programado'}[r.status])+'</span></div><small>Entrega del '+esc(fmt(r.disbursedAt))+' · Capital recibido '+money(r.principal)+'</small></div><button type="button" class="btn" data-partner-open="'+esc(r.loanId)+'">Ver entrega</button></article>'}
function bindRows(el){el.querySelectorAll('[data-partner-open]').forEach(b=>b.onclick=()=>root.MiCarteraPartners.showLoan(b.dataset.partnerOpen))}
function show(date){if(!authorized())return;selectedMonth=(date||today()).slice(0,7);selectedDay=date||'';root.MiCarteraPartners.show();render();$('partnerInterestCalendar')?.scrollIntoView({behavior:'smooth',block:'start'})}
function renderHome(model){
  let el=$('partnerInterestNotice');
  if(!el){el=document.createElement('section');el.id='partnerInterestNotice';el.className='card partner-interest-notice';el.setAttribute('aria-label','Avisos de intereses de socios');const home=$('home');if(!home)return;const title=home.querySelector('h2');if(title)title.after(el);else home.prepend(el)}
  el.hidden=false;
  const pending=[...model.overdue,...model.today,...model.upcoming],anchor=pending[0]?.date||model.next?.date||today();
  const nextToShow=pending[0]||model.next;
  el.innerHTML='<h3>Intereses por pagar a socios</h3><div class="partner-interest-totals">'+[['overdue','Atrasados',model.overdueTotal],['today','Hoy',model.todayTotal],['upcoming','Próximos 7 días',model.upcomingTotal]].map(([key,label,value])=>'<div class="partner-interest-total '+key+'"><span>'+label+'</span><b data-partner-total="'+key+'">'+money(value)+'</b></div>').join('')+'</div>'+(pending.length?'<p>'+pending.length+' interés(es) pendiente(s) hasta el '+esc(fmt(A.addDays(today(),7)))+'.':'')+(nextToShow?'<p>Próximo pago: <b>'+esc(fmt(nextToShow.date))+'</b><br>'+esc(nextToShow.partner)+' · '+money(nextToShow.amount)+'</p>':'<p>Sin intereses pendientes programados.</p>')+'<div class="partner-home-actions"><button type="button" class="btn blue" data-partner-open-page>Socios · Capital y pagos</button><button type="button" class="btn" data-partner-calendar>Calendario de intereses</button></div><p class="metric">El detalle y los pagos están dentro de Socios · Capital y pagos. Los avisos se actualizan con tus pagos y la sincronización.</p>';
  el.querySelector('[data-partner-calendar]').onclick=()=>show(anchor);
  el.querySelector('[data-partner-open-page]').onclick=()=>{if(!authorized())return;selectedMonth='';selectedDay='';root.MiCarteraPartners.show();render()};
}
function moveMonth(delta){const [y,m]=(selectedMonth||today().slice(0,7)).split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1,12));selectedMonth=d.toISOString().slice(0,7);selectedDay='';render()}
function renderCalendar(model){
  const partners=$('partners');if(!partners)return;
  let el=$('partnerInterestCalendar');if(!el){el=document.createElement('section');el.id='partnerInterestCalendar';el.className='card';partners.insertBefore(el,$('partnerList'))}
  el.hidden=false;
  const month=model.month,days=Number(A.monthEnd(month).slice(-2)),offset=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7;
  let grid='<div class="partner-month-grid">'+['L','M','X','J','V','S','D'].map(x=>'<span class="partner-weekday">'+x+'</span>').join('')+'<span aria-hidden="true" style="grid-column:span '+(offset||1)+';'+(!offset?'display:none':'')+'"></span>';
  for(let n=1;n<=days;n++){
    const date=month+'-'+String(n).padStart(2,'0'),items=model.monthRows.filter(x=>x.date===date),unpaid=items.filter(x=>!x.paid),state=unpaid.some(x=>x.status==='VENCIDO')?'overdue':unpaid.some(x=>x.status==='HOY')?'due':unpaid.length?'scheduled':items.length?'paid':'';
    grid+='<button type="button" data-partner-day="'+date+'" class="partner-calendar-day '+state+(date===today()?' is-today':'')+'" aria-pressed="'+(selectedDay===date)+'" aria-label="'+esc(fmt(date))+', '+items.length+' intereses, '+money(unpaid.reduce((s,x)=>s+x.amount,0))+' pendientes"><span>'+n+'</span>'+(items.length?'<b class="partner-day-count">'+(unpaid.length?items.length:'✓')+'</b>':'')+'</button>';
  }
  grid+='</div>';
  const rows=selectedDay?model.monthRows.filter(x=>x.date===selectedDay):model.monthRows;
  el.innerHTML='<h3>Calendario de intereses</h3><p>Selecciona un día para ver qué entrega debes pagar.</p><div class="partner-month-nav"><button type="button" class="btn" data-partner-prev aria-label="Mes anterior">‹</button><label><span class="metric">Mes</span><input class="input" type="month" id="partnerInterestMonth" value="'+month+'" aria-label="Mes del calendario"></label><button type="button" class="btn" data-partner-next aria-label="Mes siguiente">›</button></div><h4>'+esc(monthLabel(month))+'</h4>'+grid+'<p class="metric">Rojo: atrasado · Amarillo: hoy · Azul: programado · ✓: pagado. El número indica cuántos intereses hay ese día.</p><p>Pendiente de este mes: <b>'+money(model.monthPending)+'</b></p><div class="row"><button class="btn" type="button" data-partner-all>Todo el mes</button><button class="btn" type="button" data-partner-current>Mes actual</button></div><h4>'+(selectedDay?esc(fmt(selectedDay)):'Intereses de '+esc(monthLabel(month)))+'</h4><div id="partnerInterestDayList">'+(rows.length?rows.map(row).join(''):'<p>No hay intereses programados para '+(selectedDay?'este día.':'este mes.')+'</p>')+'</div>';
  el.querySelector('[data-partner-prev]').onclick=()=>moveMonth(-1);el.querySelector('[data-partner-next]').onclick=()=>moveMonth(1);
  el.querySelector('#partnerInterestMonth').onchange=e=>{try{A.monthEnd(e.target.value);selectedMonth=e.target.value;selectedDay='';render()}catch{e.target.value=month}};
  el.querySelectorAll('[data-partner-day]').forEach(b=>b.onclick=()=>{selectedDay=b.dataset.partnerDay;render()});
  el.querySelector('[data-partner-all]').onclick=()=>{selectedDay='';render()};el.querySelector('[data-partner-current]').onclick=()=>{selectedMonth='';selectedDay='';render()};bindRows(el);
}
function render(){
  if(!authorized()){for(const id of ['partnerInterestNotice','partnerInterestCalendar'])if($(id)){$(id).hidden=true;$(id).innerHTML=''}return}
  const model=A.build(loans(),today(),selectedMonth||today().slice(0,7));renderHome(model);renderCalendar(model);
}
function install(){
  if(!$('partnerAgendaStyles')){const style=document.createElement('style');style.id='partnerAgendaStyles';style.textContent=`
  #partnerInterestCalendar,#partnerInterestNotice{scroll-margin-top:130px}#partnerInterestNotice{border-left:5px solid #2487b8}
  .partner-interest-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.partner-interest-total{padding:10px 8px;background:#eff6fb;border-radius:9px}.partner-interest-total span{display:block;font-size:12px}.partner-interest-total b{display:block;margin-top:6px;font-size:18px}.partner-interest-total.overdue{background:#fff0f0}.partner-interest-total.today{background:#fff7df}.partner-home-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.partner-home-actions .btn{flex:1;min-width:145px}
  .partner-interest-row{display:flex;align-items:center;gap:12px;justify-content:space-between;border-top:1px solid #d4d9dd;padding:12px 0}.partner-interest-row>div{min-width:0;overflow-wrap:anywhere}.partner-interest-row small{display:block;color:#616972;margin-top:6px}.partner-interest-row .btn{flex:0 0 auto}.partner-interest-status{font-size:12px;border-radius:5px;padding:2px 5px;display:inline-block;margin-top:5px;background:#edf4fb}.partner-interest-status.vencido{background:#ffe8e8;color:#9e2424}.partner-interest-status.hoy{background:#fff2c9;color:#755600}.partner-interest-status.pagado{background:#e6f5e9;color:#226638}
  .partner-month-nav{display:flex;gap:8px;align-items:center}.partner-month-nav label{flex:1;min-width:0}.partner-month-nav .input{margin:4px 0}.partner-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.partner-weekday{text-align:center;font-size:12px;padding:6px}.partner-calendar-day{border:1px solid #d4d9dd;border-radius:8px;background:white;min-height:56px;padding:5px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:15px;color:#30343a;cursor:pointer}.partner-calendar-day.scheduled{background:#e8f5ff}.partner-calendar-day.overdue{background:#ffeded;color:#9e2424}.partner-calendar-day.due{background:#fff2c9;color:#755600}.partner-calendar-day.paid{background:#e6f5e9}.partner-calendar-day.is-today{border:2px solid #2477a8}.partner-calendar-day[aria-pressed=true]{outline:2px solid #163247;outline-offset:1px}.partner-day-count{font-size:11px}.partner-loan-focus{outline:3px solid #2487b8;scroll-margin-top:130px}
  @media(max-width:420px){.partner-interest-total b{font-size:16px}.partner-interest-total{padding:8px 5px}.partner-interest-row{align-items:flex-start;flex-direction:column}.partner-interest-row .btn{align-self:flex-end}.partner-month-grid{gap:3px}}
  `;document.head.appendChild(style)}render();
}
root.MiCarteraPartnerAgendaUI={install,render,show};
document.addEventListener('DOMContentLoaded',install);for(const event of ['v2-auth-cloud-state','mi-cartera-v2-rehydrated','storage','focus'])root.addEventListener(event,render);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')render()});
setInterval(()=>{if(document.visibilityState!=='hidden')render()},60000);
})(window);
