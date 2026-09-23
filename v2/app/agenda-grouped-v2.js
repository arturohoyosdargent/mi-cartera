// Mi Cartera PRO V2 — agenda grouped by client with visible overdue detail.
(function(root){
  'use strict';

  const KEY = 'mi-cartera-v2-validation-state';
  const D = root.MiCarteraV2Dates || {};
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => D.today?.() || iso(new Date());
  const addDays = (value, amount) => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return iso(date);
  };
  const money = value => `S/ ${Number(value || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function db(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  function balance(installment){
    const value = D.balance?.(installment);
    if (value !== undefined) return Number(value || 0);
    return Number(installment?.balance ?? (Number(installment?.amount || 0) - Number(installment?.paid || 0)));
  }

  function rows(){
    const data = db();
    const clients = Array.isArray(data.clients) ? data.clients : [];
    const result = [];
    for (const credit of (Array.isArray(data.credits) ? data.credits : [])) {
      if (!['ACTIVE', 'ACTIVO'].includes(String(credit.status || '').toUpperCase())) continue;
      const client = clients.find(item => String(item.id) === String(credit.clientId));
      if (!client) continue;
      for (const [index, installment] of (Array.isArray(credit.schedule) ? credit.schedule : []).entries()) {
        const amount = balance(installment);
        const date = D.fromInstallment?.(installment) || String(installment.date || '');
        if (!(amount > 0)) continue;
        result.push({
          id: `${credit.id}:${installment.number ?? installment.n ?? (index + 1)}`,
          creditId: credit.id,
          client,
          date,
          amount,
          number: installment.number ?? installment.n ?? (index + 1),
          route: client.route || client.routeId || credit.routeId || ''
        });
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date) || String(a.client.name).localeCompare(String(b.client.name)));
  }

  function groupByClient(list){
    const groups = new Map();
    for (const row of list) {
      const key = String(row.client.id || `${row.client.name}|${row.client.phone || ''}`);
      if (!groups.has(key)) groups.set(key, {client: row.client, route: row.route, rows: []});
      groups.get(key).rows.push(row);
    }
    return [...groups.values()].sort((a, b) => String(a.client.name).localeCompare(String(b.client.name)));
  }

  function overdue(row){ return Boolean(row.date && row.date < today()); }

  function addStyles(){
    if ($('v2GroupedAgendaStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2GroupedAgendaStyles';
    style.textContent = `
      .v2-agenda-client-card{border-left:5px solid #78c7ef;margin-bottom:12px}
      .v2-agenda-client-card.v2-agenda-overdue-card{border-left-color:#c62828;background:#fff6f5;box-shadow:0 2px 8px #c6282826}
      .v2-agenda-client-head{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
      .v2-agenda-client-total{font-weight:700;color:#144b63}
      .v2-agenda-overdue-label{display:inline-block;color:#a61b1b;background:#ffe1de;border-radius:999px;padding:3px 8px;font-size:.78rem;font-weight:700}
      .v2-agenda-detail{border-top:1px solid #d4d9dd;margin-top:10px;padding-top:6px}.v2-agenda-detail summary{cursor:pointer;font-weight:700;padding:6px 0}
      .v2-agenda-detail-row{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:7px 0;border-bottom:1px solid #edf0f2;flex-wrap:wrap}
      .v2-agenda-detail-row:last-child{border-bottom:0}
      .v2-agenda-detail-row.is-overdue{color:#a61b1b;font-weight:600}
      .v2-agenda-detail-row .btn{margin-left:auto}
    `;
    document.head.appendChild(style);
  }

  function render(){
    if (!$('agendaList')) return;
    addStyles();
    const from = $('agendaFrom')?.value || today();
    const to = $('agendaTo')?.value || today();
    const route = $('agendaRoute')?.value || '';
    const query = String($('agendaSearch')?.value || '').toLowerCase().trim();
    const all = rows();
    const routes = [...new Set(all.map(row => row.route).filter(Boolean))].sort();
    const routeSelect = $('agendaRoute');
    if (routeSelect) {
      routeSelect.innerHTML = '<option value="">Todas las rutas</option>' + routes.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
      routeSelect.value = routes.includes(route) ? route : '';
    }
    const list = all.filter(row => row.date >= from && row.date <= to && (!route || row.route === route) && (!query || String(row.client.name || '').toLowerCase().includes(query) || String(row.client.phone || '').includes(query)));
    root.__v2Agenda = list;
    const groups = groupByClient(list);
    const total = list.reduce((sum, row) => sum + row.amount, 0);
    if ($('agendaSummary')) $('agendaSummary').textContent = `${list.length} cuotas pendientes · ${money(total)} por cobrar · ${groups.length} cliente${groups.length === 1 ? '' : 's'}`;
    $('agendaList').innerHTML = groups.length ? groups.map(group => {
      const hasOverdue = group.rows.some(overdue);
      const groupTotal = group.rows.reduce((sum, row) => sum + row.amount, 0);
      const detail = group.rows.map(row => {
        const late = overdue(row);
        return `<div class="v2-agenda-detail-row${late ? ' is-overdue' : ''}"><span>Cuota ${esc(row.number)} · ${esc(row.date || 'Sin fecha')} · ${money(row.amount)}${late ? ' · VENCIDA' : ''}</span><button type="button" class="btn green" onclick="MiCarteraV2Agenda.remind('${esc(row.id)}')">📤 Recordar</button></div>`;
      }).join('');
      return `<div class="card v2-agenda-client-card${hasOverdue ? ' v2-agenda-overdue-card' : ''}"><div class="v2-agenda-client-head"><div><b>${esc(group.client.name)}</b><br><span>${esc(group.route || 'Sin ruta')} · ${group.rows.length} cuota${group.rows.length === 1 ? '' : 's'}</span></div><div class="v2-agenda-client-total">${money(groupTotal)}${hasOverdue ? ' <span class="v2-agenda-overdue-label">🔴 VENCIDO</span>' : ''}</div></div><details class="v2-agenda-detail"><summary>Ver detalle de ${group.rows.length} cuota${group.rows.length===1?'':'s'}</summary>${detail}</details><div class="row"><button type="button" class="btn green" onclick="MiCarteraV2Agenda.remind('${esc(group.rows[0].id)}')">📤 Recordar próximo</button><button type="button" class="btn" onclick="show('credits');window.MiCarteraV2CreditOverdue?.focus?.('${esc(group.rows[0].creditId)}')">Ver crédito</button></div></div>`;
    }).join('') : '<div class="card">No hay cuotas pendientes en este periodo.</div>';
  }

  function filter(mode){
    const from = $('agendaFrom');
    const to = $('agendaTo');
    const date = today();
    if (mode === 'overdue') { if (from) from.value = '2000-01-01'; if (to) to.value = addDays(date, -1); }
    else if (mode === 'week') { if (from) from.value = date; if (to) to.value = addDays(date, 6); }
    else { if (from) from.value = date; if (to) to.value = date; }
    render();
  }

  const agenda = root.MiCarteraV2Agenda;
  if (!agenda || root.__v2GroupedAgendaInstalled) return;
  agenda.render = render;
  agenda.filter = filter;
  root.__v2GroupedAgendaInstalled = true;
  document.addEventListener('DOMContentLoaded', render);
})(window);
