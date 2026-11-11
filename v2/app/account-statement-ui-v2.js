// Mi Cartera PRO V2 — consolidated statement preview and sharing.
(function(root){
  'use strict';

  const money = amount => amount == null ? 'Por revisar' :
    'S/ ' + amount.toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});
  const dateLabel = date => String(date || '').split('-').reverse().join('/');
  const filename = 'prestamo-ya-estado-de-cuenta.png';
  let current;

  function styles() {
    if (document.getElementById('v2AccountStatementStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2AccountStatementStyles';
    style.textContent = `
      .v2-account-statement {box-sizing:border-box;width:min(720px,calc(100% - 24px));max-height:92vh;overflow:auto;border:1px solid #a6c8df;border-radius:14px;padding:16px;background:#fff;color:#17345f}
      .v2-account-statement::backdrop {background:rgba(16,18,23,.58)}
      .v2-account-statement .statement-heading,.v2-account-statement .statement-actions {display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .v2-account-statement .statement-actions .btn {flex:1 1 155px;min-height:44px;text-align:center}
      .v2-account-statement .statement-totals {display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0}
      .v2-account-statement img {width:100%;height:auto;border-radius:8px;margin:10px 0;display:block}
      .v2-account-statement [hidden] {display:none!important}
    `;
    document.head.appendChild(style);
  }

  function state(context) {
    const scope = root.MiCarteraV2SessionStorage;
    if (scope.state().ready !== true) throw Error('Inicia sesión y sincroniza la cartera para consultar el estado de cuenta.');
    const clients = scope.readCurrentClients(context.token);
    const client = clients.find(row => String(row.id) === context.clientId && !row.tombstone && !row.deletedAt);
    if (!client) throw Error('Este cliente ya no está disponible en tu cartera.');
    const data = JSON.parse(root.localStorage.getItem(scope.KEY) || '{}');
    scope.assertCurrent(context.token);
    return root.MiCarteraV2AccountStatement.build({
      client, credits:data.credits, payments:data.payments, filter:context.filter
    });
  }

  function clearImage(context) {
    if (context.url) root.URL.revokeObjectURL(context.url);
    context.url = null;
    context.file = null;
    context.panel.querySelector('[data-image]').removeAttribute('src');
    context.panel.querySelector('[data-image]').hidden = true;
    context.panel.querySelector('[data-actions]').hidden = true;
    for (const link of context.panel.querySelectorAll('[data-actions] a')) link.removeAttribute('href');
  }

  function close(restoreFocus = true) {
    const context = current;
    if (!context) return;
    current = null;
    clearImage(context);
    if (context.panel.open && typeof context.panel.close === 'function') context.panel.close();
    context.panel.remove();
    if (restoreFocus && context.trigger?.isConnected) context.trigger.focus();
  }

  function refresh() {
    const context = current;
    if (!context) return;
    let statement;
    try { statement = state(context); }
    catch { close(false); return; }
    const key = JSON.stringify(statement);
    if (key === context.key) return context.pending;
    context.key = key;
    context.statement = statement;
    clearImage(context);
    const field = selector => context.panel.querySelector(selector);
    field('[data-client]').textContent = statement.client.name || 'Cliente';
    field('[data-as-of]').textContent = 'Fecha de corte: ' + dateLabel(statement.asOf);
    field('[data-debt]').textContent = money(statement.totalDebt);
    field('[data-due]').textContent = money(statement.amountDue);
    field('[data-count]').textContent = statement.rows.length + ' de ' + statement.activeCount + ' créditos activos';
    const status = field('[data-status]');
    if (!statement.rows.length) {
      status.textContent = context.filter === 'upcoming' ? 'No hay vencimientos en los próximos 7 días.' : 'El cliente no tiene créditos activos.';
      context.pending = null;
      return;
    }
    status.textContent = 'Preparando imagen…';
    const active = () => current === context && context.key === key;
    context.pending = Promise.resolve().then(() => root.MiCarteraV2AccountStatement.render(statement)).then(blob => {
      if (!active()) return;
      const scope = root.MiCarteraV2SessionStorage;
      try { scope.assertCurrent(context.token); }
      catch { close(false); return; }
      context.file = new root.File([blob], filename, {type:'image/png'});
      context.url = root.URL.createObjectURL(context.file);
      const img = field('[data-image]');
      img.src = context.url;
      img.hidden = false;
      field('[data-download]').href = context.url;
      const share = root.MiCarteraV2ClientShare;
      const name = String(statement.client.name || '').trim().split(/\s+/)[0];
      context.message = (name ? 'Hola ' + name : 'Hola') + ', te comparto tu estado de cuenta.';
      const wa = field('[data-whatsapp]'), url = share.link(statement.client, context.message);
      if (url) wa.href = url;
      wa.hidden = !url;
      field('[data-file-share]').hidden = !root.navigator.share ||
        (typeof root.navigator.canShare === 'function' && !root.navigator.canShare({files:[context.file]}));
      field('[data-actions]').hidden = false;
      status.textContent = url ?
        'WhatsApp abre el número registrado. Adjunta el PNG en ese chat o usa el selector para compartir la imagen.' :
        'El cliente no tiene un teléfono válido registrado. Puedes descargar la imagen.';
    }).catch(() => {
      if (!active()) return;
      clearImage(context);
      status.textContent = 'No se pudo preparar la imagen del estado de cuenta.';
    });
    return context.pending;
  }

  function prepared(context) {
    try {
      if (current !== context || !context.file) return false;
      if (JSON.stringify(state(context)) === context.key) return true;
      refresh();
    } catch { close(false); }
    return false;
  }

  function open(clientId, trigger = document.activeElement) {
    try {
      if (!root.MiCarteraV2AccountStatement || !root.MiCarteraV2ClientShare) throw Error('Actualiza la app para abrir el estado de cuenta.');
      const scope = root.MiCarteraV2SessionStorage;
      if (scope?.state()?.ready !== true) throw Error('Inicia sesión y sincroniza la cartera para consultar el estado de cuenta.');
      const context = {clientId:String(clientId),token:scope.capture(),trigger,filter:'all'};
      state(context);
      close(false);
      styles();
      const panel = document.createElement('dialog');
      panel.id = 'v2AccountStatement';
      panel.className = 'v2-account-statement';
      panel.setAttribute('aria-labelledby','v2AccountStatementTitle');
      panel.innerHTML = `
        <div class="statement-heading"><h2 id="v2AccountStatementTitle">Estado de cuenta</h2><button type="button" class="btn" data-close>Cerrar</button></div>
        <b data-client></b><p class="metric" data-as-of></p>
        <div class="statement-totals"><div class="card">Deuda total acumulada<br><strong data-debt></strong></div><div class="card">Exigible a la fecha<br><strong data-due></strong></div></div>
        <label for="v2StatementFilter">Créditos a mostrar</label><select class="input" id="v2StatementFilter" data-filter><option value="all">Todos los créditos activos</option><option value="upcoming">Próximos vencimientos (7 días)</option></select>
        <p class="metric" data-count></p><p class="metric" role="status" data-status></p>
        <img alt="Estado de cuenta consolidado con detalle de créditos y cuotas" data-image hidden>
        <div class="statement-actions" data-actions hidden>
          <a class="btn green" data-whatsapp target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
          <button type="button" class="btn blue" data-file-share>Compartir imagen</button>
          <a class="btn" data-download download="${filename}">Descargar PNG</a>
        </div>
      `;
      context.panel = panel;
      current = context;
      panel.querySelector('[data-close]').onclick = () => close();
      panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
      panel.querySelector('[data-filter]').onchange = event => {
        context.filter = event.target.value;
        refresh();
      };
      for (const anchor of panel.querySelectorAll('[data-actions] a')) anchor.onclick = event => {
        if (!prepared(context)) event.preventDefault();
      };
      panel.querySelector('[data-file-share]').onclick = async () => {
        if (!prepared(context)) return;
        try {
          await root.MiCarteraV2SharePreview.fileShare(context.file, 'Préstamo Ya · Estado de cuenta', context.message);
        } catch (error) {
          if (current === context) panel.querySelector('[data-status]').textContent = error.message;
        }
      };
      document.body.appendChild(panel);
      if (typeof panel.showModal === 'function') panel.showModal();
      else panel.setAttribute('open','');
      panel.querySelector('[data-close]').focus();
      return refresh();
    } catch (error) {
      root.alert(error.message);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-account-statement]');
    if (button) open(button.dataset.accountStatement, button);
  });
  for (const event of ['mi-cartera-v2-payment-recorded','mi-cartera-v2-sync','mi-cartera-v2-rehydrated','v2-auth-cloud-state','v2-session-storage-state','storage','focus']) {
    root.addEventListener(event, refresh);
  }
  root.MiCarteraV2AccountStatementUI = {open, refresh, close};
})(window);
