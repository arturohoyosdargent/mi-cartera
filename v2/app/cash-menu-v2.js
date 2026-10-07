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

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today = () => root.MiCarteraV2Dates?.today?.() || localDate();
  function ledger(){
    const seen = new Set();
    return (data().cashMovements || []).filter(item => {
      if (!item || item.tombstone || !['INGRESO','EGRESO'].includes(item.type)) return false;
      if (item.id && seen.has(item.id)) return false;
      if (item.id) seen.add(item.id);
      return Number.isFinite(Number(item.amount));
    });
  }
  function range(){
    const period = $('cashHistoryPeriod')?.value || 'ALL', date = today();
    if (period === 'TODAY') return {from:date, to:date};
    if (period === 'MONTH') return {from:date.slice(0,7)+'-01', to:date.slice(0,7)+'-31'};
    if (period !== 'RANGE') return {from:'', to:''};
    const from = $('cashHistoryFrom')?.value || '', to = $('cashHistoryTo')?.value || '';
    const normalize = root.MiCarteraV2Dates?.normalize;
    return {from,to,invalid:(!from || !to || (normalize && (normalize(from)!==from || normalize(to)!==to)) || from>to)};
  }
  const movementDate = item => root.MiCarteraV2Dates?.normalize?.(item.date) || String(item.date || '').slice(0,10);
  const signed = item => Number(item.amount || 0) * (item.type === 'INGRESO' ? 1 : -1);
  const inRange = (item, r) => !r.invalid && (!r.from || movementDate(item)>=r.from) && (!r.to || movementDate(item)<=r.to);
  function historyControls(){
    if ($('cashHistoryPeriod')) return;
    const filters = document.createElement('div');
    filters.className = 'card v2-cash-filters';
    filters.innerHTML = '<label>Periodo<select id="cashHistoryPeriod" class="input"><option value="ALL">Todo</option><option value="TODAY">Hoy</option><option value="MONTH">Este mes</option><option value="RANGE">Rango de fechas</option></select></label><label>Desde<input id="cashHistoryFrom" class="input" type="date"></label><label>Hasta<input id="cashHistoryTo" class="input" type="date"></label><label>Movimiento<select id="cashHistoryType" class="input"><option value="ALL">Ingresos y egresos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select></label><div class="metric">El filtro de tipo limita el detalle; los saldos incluyen ambos tipos.</div>';
    $('cashHistory')?.insertAdjacentElement('beforebegin',filters);
    $('cashHistoryFrom').value = today().slice(0,7)+'-01';
    $('cashHistoryTo').value = today();
    filters.querySelectorAll('input,select').forEach(input => input.addEventListener('change',()=>{renderSummary();renderHistory();}));
  }

  function renderSummary(){
    const movements = ledger(), r = range(), selected = movements.filter(item=>inRange(item,r));
    const income = selected.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = selected.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const opening = r.from ? movements.filter(item=>movementDate(item)<r.from).reduce((sum,item)=>sum+signed(item),0) : 0;
    const ym = today().slice(0,7);
    const monthly = movements.filter(item => movementDate(item).slice(0, 7) === ym);
    const monthlyIncome = monthly.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyExpense = monthly.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if ($('cashIncomeTotal')) $('cashIncomeTotal').textContent = money(income);
    if ($('cashExpenseTotal')) $('cashExpenseTotal').textContent = money(expense);
    if ($('cashBalance')) $('cashBalance').textContent = money(movements.reduce((sum,item)=>sum+signed(item),0));
    if ($('cashOpeningBalance')) $('cashOpeningBalance').textContent = r.invalid ? 'Rango inválido' : money(opening);
    if ($('cashClosingBalance')) $('cashClosingBalance').textContent = r.invalid ? 'Rango inválido' : money(opening+income-expense);
    if ($('cashMonthlyIncome')) $('cashMonthlyIncome').textContent = money(monthlyIncome);
    if ($('cashMonthlyExpense')) $('cashMonthlyExpense').textContent = money(monthlyExpense);
    if ($('cashMonthlyResult')) $('cashMonthlyResult').textContent = money(monthlyIncome - monthlyExpense);
    root.MiCarteraPartners?.renderBalance?.();
  }

  function renderHistory(){
    const el=$('cashHistory'); if(!el)return;
    historyControls();
    const r=range(), type=$('cashHistoryType')?.value || 'ALL';
    const movements=ledger().filter(item=>inRange(item,r) && (type==='ALL'||item.type===type));
    if(r.invalid){el.textContent='Selecciona un rango válido: Desde debe ser anterior o igual a Hasta.';return;}
    if(!movements.length){el.textContent='Sin movimientos de caja V2 en este periodo.';return;}
    const groups=new Map();
    movements.forEach(item=>{const cat=String(item.category||item.concept||'SIN_CATEGORIA'),key=[item.type||'MOVIMIENTO',cat].join('|');if(!groups.has(key))groups.set(key,{type:item.type||'MOVIMIENTO',category:cat,count:0,total:0,items:[]});const g=groups.get(key);g.count++;g.total+=Number(item.amount||0);g.items.push(item)});
    const rows=[...groups.values()].sort((a,b)=>String(a?.type || '').localeCompare(String(b?.type || ''))||b.total-a.total);
    el.innerHTML='<b>Historial de caja</b>'+rows.map(g=>{const cls=g.type==='INGRESO'?'v2-cash-income':'v2-cash-expense';return `<details class="card ${cls}"><summary class="v2-cash-compact"><b>${esc(g.type)} · ${esc(g.category.replaceAll('_',' '))}</b><span>${g.count} movimiento${g.count===1?'':'s'} · ${money(g.total)}</span></summary>${g.items.sort((a,b)=>movementDate(b).localeCompare(movementDate(a))).map(item=>`<div class="v2-cash-detail">${esc(item.date||'Sin fecha')} · ${money(item.amount)}<br>${esc(item.concept||'').replaceAll('_',' ')}${item.observation?'<br>'+esc(item.observation):''}</div>`).join('')}</details>`}).join('');
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
    panel.querySelector('#v2CashDate').value=today();
    let saving=false;
    panel.querySelector('[data-close]').onclick=()=>{if(!saving)panel.remove();};
    const saveButton=panel.querySelector('[data-save]');
    saveButton.onclick=async()=>{
      if(saving)return;
      const action=root.V2UI?.manualCash;if(typeof action!=='function')return alert('Las acciones de caja V2 todavía no están disponibles.');
      const payload={date:panel.querySelector('#v2CashDate').value,amount:panel.querySelector('#v2CashAmount').value,category:panel.querySelector('#v2CashCategory').value,concept:panel.querySelector('#v2CashConcept').value,observation:panel.querySelector('#v2CashObservation').value};
      if(!payload.amount)return alert('Ingresa el monto.'); if(!payload.concept)return alert('Ingresa el detalle.');
      saving=true;saveButton.disabled=true;
      try{const result=await action(type,payload);if(result){panel.remove();renderSummary();renderHistory()}}catch(e){}finally{saving=false;saveButton.disabled=false;}
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
      .v2-cash-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v2-cash-filters label{min-width:0}.v2-cash-filters .metric{grid-column:1/-1}.v2-cash-detail{padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere}
      .v2-month-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v2-cash-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .v2-cash-form .v2-form-head,.v2-cash-form>button{grid-column:1/-1}.v2-form-head{display:flex;justify-content:space-between;align-items:center}
      .v2-cash-form label{display:flex;flex-direction:column;gap:5px;font-weight:600}.v2-cash-form input,.v2-cash-form select,.v2-cash-form textarea{padding:10px;border:1px solid #bbb;border-radius:8px;font:inherit}
      #more .v2-more-menu{display:flex;flex-direction:column;gap:10px}
      #more .v2-more-menu .btn{width:100%;min-height:52px;text-align:left;margin:0;white-space:normal;display:block;color:#163247!important;font-weight:700}.v2-cash-actions .btn.blue,.v2-cash-actions .btn.green{color:#163247!important;font-weight:700}
      @media(max-width:700px){.v2-month-summary{grid-template-columns:1fr}}
      @media(max-width:480px){.v2-cash-summary,.v2-cash-actions,.v2-cash-form,.v2-cash-filters{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    addStyles();
    const cash = $('cash');
    if (cash && !cash.querySelector('[data-v2-cash-actions]')) {
      const summary = document.createElement('div');
      summary.className = 'card v2-cash-summary';
      summary.innerHTML = '<div class="card metric v2-cash-income">Ingresos del periodo<b id="cashIncomeTotal">S/ 0.00</b></div><div class="card metric v2-cash-expense">Egresos del periodo<b id="cashExpenseTotal">S/ 0.00</b></div><div class="card metric">Saldo inicial del periodo<b id="cashOpeningBalance">S/ 0.00</b></div><div class="card metric">Saldo al cierre del periodo<b id="cashClosingBalance">S/ 0.00</b></div>';
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
    renderHistory();
    renderSummary();
  }

  document.addEventListener('DOMContentLoaded', install);
  const refresh=()=>{renderSummary();renderHistory();};
  root.addEventListener?.('storage', refresh);
  root.addEventListener?.('mi-cartera-v2-rehydrated', refresh);
  root.MiCarteraV2CashMenu = {install, renderSummary, renderHistory, localDate};
})(window);
