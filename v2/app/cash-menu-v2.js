// Mi Cartera PRO V2 — explicit capital/income and expense actions.
(function(root){
  'use strict';

  const KEY = 'mi-cartera-v2-validation-state';
  const $ = id => document.getElementById(id);
  const money = value => `S/ ${Number(value || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const localDate = date => { const d=date||new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

  function data(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  function renderSummary(){
    const movements = Array.isArray(data().cashMovements) ? data().cashMovements : [];
    const income = movements.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = movements.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthly = movements.filter(item => String(item.date || '').slice(0, 7) === ym);
    const monthlyIncome = monthly.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyExpense = monthly.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if ($('cashIncomeTotal')) $('cashIncomeTotal').textContent = money(income);
    if ($('cashExpenseTotal')) $('cashExpenseTotal').textContent = money(expense);
    if ($('cashMonthlyIncome')) $('cashMonthlyIncome').textContent = money(monthlyIncome);
    if ($('cashMonthlyExpense')) $('cashMonthlyExpense').textContent = money(monthlyExpense);
    if ($('cashMonthlyResult')) $('cashMonthlyResult').textContent = money(monthlyIncome - monthlyExpense);
  }

  function renderHistory(){
    const el=$('cashHistory'); if(!el)return;
    let movements=[...(Array.isArray(data().cashMovements)?data().cashMovements:[])];const period=String($('cashHistoryPeriod')?.value||'ALL'),now=new Date(),today=localDate(now),ym=today.slice(0,7);if(period==='TODAY')movements=movements.filter(x=>String(x.date||'')===today);else if(period==='MONTH')movements=movements.filter(x=>String(x.date||'').slice(0,7)===ym);
    if(!movements.length){el.textContent='Sin movimientos de caja V2.';return;}
    const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const groups=new Map();
    movements.forEach(item=>{const cat=String(item.category||item.concept||'SIN_CATEGORIA'),key=[item.type||'MOVIMIENTO',cat].join('|');if(!groups.has(key))groups.set(key,{type:item.type||'MOVIMIENTO',category:cat,count:0,total:0});const g=groups.get(key);g.count++;g.total+=Number(item.amount||0)});
    const rows=[...groups.values()].sort((a,b)=>a.type.localeCompare(b.type)||b.total-a.total);
    el.innerHTML='<div class="card"><b>Historial de caja</b><div style="margin-top:8px"><select id="cashHistoryPeriod" class="input"><option value="ALL" '+(period==='ALL'?'selected':'')+'>Todo</option><option value="TODAY" '+(period==='TODAY'?'selected':'')+'>Hoy</option><option value="MONTH" '+(period==='MONTH'?'selected':'')+'>Este mes</option></select></div><div class="metric">Agrupado por tipo y categoría. El detalle individual queda oculto para mantener esta pantalla compacta.</div></div>'+rows.map(g=>{const cls=g.type==='INGRESO'?'v2-cash-income':'v2-cash-expense';return `<div class="card ${cls} v2-cash-compact"><b>${esc(g.category.replaceAll('_',' '))}</b><span>${g.count} movimiento${g.count===1?'':'s'} · ${money(g.total)}</span></div>`}).join('');$('cashHistoryPeriod')?.addEventListener('change',renderHistory);
  }

  function openForm(type){
    const old=$('v2CashForm'); if(old) old.remove();
    const income=type==='INGRESO';
    const panel=document.createElement('div'); panel.id='v2CashForm'; panel.className='card v2-cash-form';
    const cats=income?['APORTE_CAPITAL','OTRO_INGRESO']:['COLEGIO','SERVICIO_MOVIL','SERVICIOS','ALIMENTACION','TRANSPORTE','SALUD','GASTO_OPERATIVO','OTROS_GASTOS'];
    panel.innerHTML='<div class="v2-form-head"><b>'+(income?'Registrar capital / ingreso':'Registrar egreso / gasto')+'</b><button type="button" class="btn" data-close>✕ Cerrar</button></div>'+
      '<label>Fecha<input id="v2CashDate" type="date"></label><label>Monto (S/)<input id="v2CashAmount" type="number" min="0.01" step="0.01" placeholder="0.00"></label>'+
      '<label>'+(income?'Tipo de ingreso':'Tipo de egreso')+'<select id="v2CashCategory">'+cats.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('')+'</select></label>'+
      '<label>Detalle<input id="v2CashConcept" placeholder="'+(income?'Ej. Inyección adicional de capital':'Ej. Mensualidad colegio / plan móvil')+'"></label>'+
      '<label>Observación<textarea id="v2CashObservation" rows="2" placeholder="Opcional"></textarea></label><button type="button" class="btn '+(income?'green':'')+'" data-save>Guardar movimiento</button>';
    panel.querySelector('#v2CashDate').value=localDate();
    panel.querySelector('[data-close]').onclick=()=>panel.remove();
    panel.querySelector('[data-save]').onclick=async()=>{
      const action=root.V2UI?.manualCash;if(typeof action!=='function')return alert('Las acciones de caja V2 todavía no están disponibles.');
      const payload={date:panel.querySelector('#v2CashDate').value,amount:panel.querySelector('#v2CashAmount').value,category:panel.querySelector('#v2CashCategory').value,concept:panel.querySelector('#v2CashConcept').value,observation:panel.querySelector('#v2CashObservation').value};
      if(!payload.amount)return alert('Ingresa el monto.'); if(!payload.concept)return alert('Ingresa el detalle.');
      try{await action(type,payload);panel.remove();renderSummary();renderHistory()}catch(e){}
    };
    const actions=document.querySelector('[data-v2-cash-actions]'); actions?.insertAdjacentElement('afterend',panel); panel.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function invoke(type){ openForm(type); }

  function addStyles(){
    if ($('v2CashMenuStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2CashMenuStyles';
    style.textContent = `
      .v2-cash-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v2-cash-summary .metric{margin:0}
      .v2-cash-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v2-cash-actions>b,.v2-cash-actions>span{grid-column:1/-1}
      .v2-cash-actions .btn{width:100%;text-align:left}
      .v2-cash-income{border-left:5px solid #2e9d58}
      .v2-cash-expense{border-left:5px solid #c62828}
      .v2-cash-compact{display:flex;justify-content:space-between;gap:12px;align-items:center}.v2-cash-compact span{font-weight:600;text-align:right}
      .v2-month-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v2-cash-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .v2-cash-form .v2-form-head,.v2-cash-form>button{grid-column:1/-1}.v2-form-head{display:flex;justify-content:space-between;align-items:center}
      .v2-cash-form label{display:flex;flex-direction:column;gap:5px;font-weight:600}.v2-cash-form input,.v2-cash-form select,.v2-cash-form textarea{padding:10px;border:1px solid #bbb;border-radius:8px;font:inherit}
      #more .v2-more-menu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #more .v2-more-menu .btn{width:100%;min-height:52px;text-align:center;margin:0;white-space:normal}
      @media(max-width:700px){#more .v2-more-menu{grid-template-columns:repeat(2,minmax(0,1fr))}.v2-month-summary{grid-template-columns:1fr}}
      @media(max-width:480px){.v2-cash-summary,.v2-cash-actions,.v2-cash-form{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    addStyles();
    const cash = $('cash');
    if (cash && !cash.querySelector('[data-v2-cash-actions]')) {
      const summary = document.createElement('div');
      summary.className = 'card v2-cash-summary';
      summary.innerHTML = '<div class="card metric v2-cash-income">Ingresos / capital<b id="cashIncomeTotal">S/ 0.00</b></div><div class="card metric v2-cash-expense">Egresos / gastos<b id="cashExpenseTotal">S/ 0.00</b></div>';
      const monthly = document.createElement('div');
      monthly.className = 'card v2-month-summary';
      monthly.innerHTML = '<div class="metric">Ingresos del mes<b id="cashMonthlyIncome">S/ 0.00</b></div><div class="metric">Egresos del mes<b id="cashMonthlyExpense">S/ 0.00</b></div><div class="metric">Resultado del mes<b id="cashMonthlyResult">S/ 0.00</b></div>';
      const actions = document.createElement('div');
      actions.className = 'card v2-cash-actions';
      actions.dataset.v2CashActions = '1';
      actions.innerHTML = '<b>Registrar movimiento</b><span>Los ingresos y egresos quedan reflejados en Balance / Caja.</span><button type="button" class="btn green" data-v2-cash-type="INGRESO">＋ Ingresar capital / ingreso</button><button type="button" class="btn v2-cash-expense" data-v2-cash-type="EGRESO">− Registrar egreso / gasto</button>';
      actions.querySelectorAll('[data-v2-cash-type]').forEach(button => button.addEventListener('click', () => invoke(button.dataset.v2CashType)));
      const metric = cash.querySelector('#cashBalance')?.closest('.card');
      if (metric) { metric.insertAdjacentElement('afterend', summary); summary.insertAdjacentElement('afterend', monthly); monthly.insertAdjacentElement('afterend', actions); }
      else { cash.insertBefore(summary, cash.firstChild); cash.insertBefore(monthly, summary.nextSibling); cash.insertBefore(actions, monthly.nextSibling); }
    }
    const moreCard = document.querySelector('#more .card');
    if (moreCard && !moreCard.querySelector('.v2-more-menu')) {
      const buttons = [...moreCard.children].filter(child => child.tagName === 'BUTTON');
      const menu = document.createElement('div');
      menu.className = 'v2-more-menu';
      buttons.forEach(button => menu.appendChild(button));
      moreCard.appendChild(menu);
    }
    renderSummary();
    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', install);
  root.addEventListener?.('storage', renderSummary);
  root.MiCarteraV2CashMenu = {install, renderSummary, renderHistory, localDate};
})(window);
