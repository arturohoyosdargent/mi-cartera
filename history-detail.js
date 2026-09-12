// Historial completo del cliente: detalle financiero, cuotas, recaudos, renovaciones y auditoría.
(()=>{
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const money=v=>typeof window.money==='function'?window.money(v):'S/ '+Number(v||0).toFixed(2);
  const fmt=v=>typeof window.fmt==='function'?window.fmt(v):(v||'-');
  const route=v=>typeof window.routeName==='function'?window.routeName(v):'-';
  const getStatus=v=>typeof window.status==='function'?window.status(v):{paid:0,remain:Number(v?.total||0),overdue:0};
  const getState=v=>typeof window.state==='function'?window.state(v):'-';
  const badge=v=>typeof window.badge==='function'?window.badge(v):`<span class="status">${esc(getState(v))}</span>`;
  const wait=()=>{if(!window.db||typeof window.go!=='function'||typeof window.toast!=='function')return setTimeout(wait,250);install()};
  function install(){
    if(window.__prestamoYaHistoryDetail)return;
    window.__prestamoYaHistoryDetail=true;
    window.clientHistory=renderHistory;
  }
  function renderHistory(id){
    const c=(db.clients||[]).find(x=>String(x.id)===String(id));
    if(!c)return toast('Cliente no encontrado');
    const credits=(db.credits||[]).filter(x=>String(x.clientId)===String(id)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.id)-Number(a.id));
    const ids=new Set(credits.map(x=>String(x.id)));
    const payments=(db.payments||[]).filter(x=>ids.has(String(x.creditId))).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||Number(a.id)-Number(b.id));
    const totalCapital=credits.reduce((s,x)=>s+Number(x.capital||0),0);
    const totalPactado=credits.reduce((s,x)=>s+Number(x.total||0),0);
    const totalPaid=payments.reduce((s,x)=>s+Number(x.amount||0),0);
    const totalRemain=credits.reduce((s,x)=>s+Number(getStatus(x).remain||0),0);
    const totalOverdue=credits.reduce((s,x)=>s+Number(getStatus(x).overdue||0),0);
    const active=credits.filter(x=>Number(getStatus(x).remain)>0).length;
    let h=`<div class="card"><h3>📋 Historial completo · ${esc(c.name)}</h3>`+
      `<div class="info"><b>Cliente:</b> ${esc(c.name)} · <b>Teléfono:</b> ${esc(c.phone||'-')} · <b>DNI:</b> ${esc(c.dni||'-')}<br><b>Dirección:</b> ${esc(c.address||'-')} · <b>Ruta:</b> ${esc(route(c.routeId))}<br><b>Referencia:</b> ${esc(c.reference||'-')}</div>`+
      `<div class="grid"><div class="card metric">Créditos<b>${credits.length}</b></div><div class="card metric">Activos<b>${active}</b></div><div class="card metric">Capital colocado<b>${money(totalCapital)}</b></div><div class="card metric">Total pactado<b>${money(totalPactado)}</b></div><div class="card metric">Total pagado<b>${money(totalPaid)}</b></div><div class="card metric">Saldo actual<b>${money(totalRemain)}</b></div><div class="card metric">Mora actual<b>${money(totalOverdue)}</b></div></div></div>`;
    if(!credits.length)h+=`<div class="card">Este cliente todavía no tiene créditos ni movimientos financieros.</div>`;
    credits.forEach(cr=>{
      const s=getStatus(cr), cp=payments.filter(p=>String(p.creditId)===String(cr.id));
      const extra=Array.isArray(cr.extraPayments)?cr.extraPayments:[];
      const parent=cr.renewedFromId||cr.renewalOf||cr.parentCreditId;
      const children=credits.filter(x=>String(x.renewedFromId||x.renewalOf||x.parentCreditId||'')===String(cr.id));
      h+=`<div class="card"><h3>💳 Crédito #${esc(cr.id)} ${badge(cr)}</h3>`+
        `<div class="info"><b>Fecha:</b> ${fmt(cr.date)} · <b>1ra cuota:</b> ${fmt(cr.first)} · <b>Vencimiento:</b> ${fmt(s.maturity)}<br><b>Capital:</b> ${money(cr.capital)} · <b>Interés:</b> ${esc(cr.rate)}% · <b>Plazo:</b> ${esc(cr.term)} cuotas · <b>Frecuencia:</b> ${esc(cr.freq)}<br><b>Total:</b> ${money(cr.total)} · <b>Pagado:</b> ${money(s.paid)} · <b>Saldo:</b> ${money(s.remain)} · <b>Mora:</b> ${money(s.overdue)}</div>`;
      if(parent)h+=`<div class="info">🔄 <b>Renovación:</b> este crédito deriva del crédito #${esc(parent)}.</div>`;
      if(children.length)h+=`<div class="info">🔄 <b>Renovado hacia:</b> ${children.map(x=>'#'+esc(x.id)).join(', ')}.</div>`;
      h+='<h4>📅 Cronograma y estado de cuotas</h4><table class="table"><tr><th>#</th><th>Vencimiento</th><th>Tipo</th><th>Cuota</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr>';
      (cr.schedule||[]).forEach(q=>{const left=Math.max(0,Number(q.amount||0)-Number(q.paid||0));const st=left<=0?'PAGADA':q.date<today()?'VENCIDA':q.date===today()?'HOY':'PENDIENTE';h+=`<tr><td>${esc(q.n)}</td><td>${fmt(q.date)}</td><td>${q.extra?'ADICIONAL':'CUOTA'}</td><td>${money(q.amount)}</td><td>${money(q.paid)}</td><td>${money(left)}</td><td>${st}</td></tr>`});
      h+='</table>';
      if(extra.length)h+='<h4>➕ Pagos adicionales programados</h4>'+extra.map((x,i)=>`<div class="info"><b>Adicional ${i+1}</b> · ${fmt(x.date)} · ${money(x.amount)}</div>`).join('');
      h+='<h4>💵 Recaudos registrados</h4>';
      if(cp.length){let acum=0;cp.forEach(p=>{acum+=Number(p.amount||0);h+=`<div class="info"><b>${fmt(p.date)}</b> · <b>${money(p.amount)}</b> · ${esc(p.type||'Recaudo')} · ${esc(p.method||'-')}<br>Usuario: ${esc(p.user||'-')} · Observación: ${esc(p.note||'-')}<br><span class="muted">Acumulado: ${money(acum)} · Saldo después del movimiento: ${money(Math.max(0,Number(cr.total||0)-acum))}</span></div>`})}else h+='<div class="info">Sin recaudos registrados.</div>';
      h+=`<div class="actionbar"><button class="btn green" onclick="openCollect(${Number(cr.id)})">💵 Recaudar</button><button class="btn blue" onclick="showCredit(${Number(cr.id)})">Ver crédito</button></div></div>`;
    });
    const events=[];
    credits.forEach(cr=>events.push({date:cr.date,type:'CRÉDITO',detail:'#'+cr.id+' · '+money(cr.capital)+' · '+getState(cr)}));
    payments.forEach(p=>events.push({date:p.date,type:'RECAUDO',detail:'#'+p.creditId+' · '+money(p.amount)+' · '+(p.method||'-')}));
    (db.audit||[]).filter(a=>String(a.detail||'').includes(String(c.name||''))||credits.some(cr=>String(a.detail||'').includes('#'+cr.id))).forEach(a=>events.push({date:String(a.date||'').slice(0,10),type:a.action,detail:a.detail||'-'}));
    events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    h+='<div class="card"><h3>🕘 Línea de tiempo</h3>'+(events.length?events.slice(0,150).map(e=>`<div class="info"><b>${fmt(e.date)}</b> · <span class="status sGray">${esc(e.type)}</span> · ${esc(e.detail)}</div>`).join(''):'<div class="info">Sin movimientos.</div>')+'</div>';
    h+='<div class="actionbar"><button class="btn" onclick="go(\'clients\')">← Volver a clientes</button><button class="btn blue" onclick="report(\'clients\')">Reporte de clientes</button></div>';
    const box=$('reportBox');if(box)box.innerHTML=h;go('reports');
  }
  wait();
})();
