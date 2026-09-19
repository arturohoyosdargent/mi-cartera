// Mi Cartera PRO V2 — explicit capital/income and expense actions.
(function(root){
  'use strict';

  const KEY = 'mi-cartera-v2-validation-state';
  const $ = id => document.getElementById(id);
  const money = value => `S/ ${Number(value || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

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
    const el=$('cashHistory');
    if(!el)return;
    const movements=[...(Array.isArray(data().cashMovements)?data().cashMovements:[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
    if(!movements.length){el.textContent='Sin movimientos de caja V2.';return;}
    const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    el.innerHTML=movements.map(item=>{
      const category=String(item.category||item.concept||'SIN_CATEGORIA').replaceAll('_',' ');
      const observation=String(item.observation||'').trim();
      const cls=item.type==='INGRESO'?'v2-cash-income':'v2-cash-expense';
      return `<div class="card ${cls}"><b>${esc(item.type||'MOVIMIENTO')} · ${money(item.amount)}</b><div>${esc(item.date||'')} · ${esc(category)}</div><div class="metric">${esc(item.concept||'Sin detalle')}</div>${observation?`<div class="metric">Observación: ${esc(observation)}</div>`:''}</div>`;
    }).join('');
  }

  function invoke(type){
    const action = root.V2UI?.manualCash;
    if (typeof action !== 'function') return alert('Las acciones de caja V2 todavía no están disponibles. Recarga la aplicación e inténtalo nuevamente.');
    Promise.resolve(action(type)).then(()=>{renderSummary();renderHistory();});
  }

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
      .v2-month-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #more .v2-more-menu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #more .v2-more-menu .btn{width:100%;min-height:52px;text-align:center;margin:0;white-space:normal}
      @media(max-width:700px){#more .v2-more-menu{grid-template-columns:repeat(2,minmax(0,1fr))}.v2-month-summary{grid-template-columns:1fr}}
      @media(max-width:480px){.v2-cash-summary,.v2-cash-actions{grid-template-columns:1fr}}
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
  root.MiCarteraV2CashMenu = {install, renderSummary};
})(window);
