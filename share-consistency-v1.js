// Préstamo Ya — Compartir consistente v1
// Unifica la mecánica de compartir en todas las pantallas que entregan información al cliente.
// Cargar ESTE archivo después de los scripts actuales de crédito, pagos, agenda y renovación.
// No modifica datos, créditos, pagos ni IndexedDB/localStorage.

(()=> {
  'use strict';
  if (window.__prestamoYaShareConsistencyV1) return;
  window.__prestamoYaShareConsistencyV1 = true;

  const money = v => 'S/ ' + Number(v || 0).toLocaleString('es-PE',{
    minimumFractionDigits:2, maximumFractionDigits:2
  });

  const clean = s => String(s ?? '').replace(/\s+/g,' ').trim();

  function db(){
    return window.db || {clients:[],credits:[],payments:[]};
  }

  function getClientById(id){
    return (db().clients || []).find(
      c => String(c.id) === String(id)
    ) || null;
  }

  function getCredit(id){
    return (db().credits || []).find(
      c => String(c.id) === String(id)
    ) || null;
  }

  function clientOfCredit(id){
    const cr = getCredit(id);
    return cr ? getClientById(cr.clientId) : null;
  }

  function normalizePhone(c){
    let p = String(c?.phone || '').replace(/\D/g,'');

    if (p.startsWith('00'))
      p = p.slice(2);

    if (p.length === 9)
      p = '51' + p;

    return p;
  }

  function openWhatsApp(client,text){
    const p = normalizePhone(client);

    if (!p) {
      if (typeof window.toast === 'function')
        window.toast('Este cliente no tiene teléfono válido.');

      return false;
    }

    const url =
      'https://wa.me/' +
      p +
      '?text=' +
      encodeURIComponent(String(text || ''));

    window.open(url,'_blank','noopener');

    return true;
  }

  async function shareNative(title,text){
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || 'Préstamo Ya',
          text: String(text || '')
        });

        return true;
      }
    } catch(e) {
      if (e?.name === 'AbortError')
        return false;
    }

    try {
      await navigator.clipboard.writeText(String(text || ''));

      if (typeof window.toast === 'function')
        window.toast('Información copiada para compartir.');

      return true;

    } catch(e) {

      if (typeof window.toast === 'function')
        window.toast('No fue posible abrir el compartir.');

      return false;
    }
  }

  function addButton(bar,id,label,cls,fn){

    if (!bar || document.getElementById(id))
      return;

    const b = document.createElement('button');

    b.id = id;
    b.type = 'button';
    b.className = 'btn ' + (cls || '');
    b.textContent = label;

    b.addEventListener('click',fn);

    bar.appendChild(b);
  }

  function addSharePair(bar,opts){

    if (!bar)
      return;

    addButton(
      bar,
      opts.shareId,
      opts.shareLabel || '📤 Compartir',
      opts.shareClass || 'blue',
      ()=>shareNative(
        opts.title,
        opts.text()
      )
    );

    addButton(
      bar,
      opts.waId,
      opts.waLabel || '💬 Enviar por WhatsApp',
      opts.waClass || 'green',
      ()=>openWhatsApp(
        opts.client(),
        opts.text()
      )
    );
  }

  // =========================================================
  // CRÉDITO — DETALLE
  // =========================================================

  function installCreditDetail(){

    const page =
      document.getElementById('creditDetail');

    const body =
      document.getElementById('creditDetailBody');

    if (!page || !body)
      return;

    const id =
      window.selectedCredit ||
      window.__selectedCreditForProposal ||
      window.__prestamoYaPlannerSelectedCredit;

    const cr = getCredit(id);

    if (!cr)
      return;

    const c =
      getClientById(cr.clientId);

    if (!c)
      return;

    const bar =
      body.querySelector('.actionbar');

    if (!bar)
      return;

    const shareText = ()=>{

      const schedule =
        (cr.schedule || []).map(q =>
          `${q.n}. ${q.date || '-'} · ` +
          `${q.extra ? 'Pago adicional' : 'Cuota'} · ` +
          `${money(q.amount)} · ` +
          `Saldo ${money(
            Math.max(
              0,
              Number(q.amount || 0) -
              Number(q.paid || 0)
            )
          )}`
        );

      return [
        'PRÉSTAMO YA — DETALLE DEL CRÉDITO',
        `Cliente: ${c.name || '-'}`,
        `Teléfono: ${c.phone || '-'}`,
        `Capital: ${money(cr.capital)}`,
        `Interés: ${Number(cr.rate || 0)}%`,
        `Total: ${money(cr.total)}`,
        `Pagado: ${money(cr.paid)}`,
        `Saldo: ${money(
          Math.max(
            0,
            Number(cr.total || 0) -
            Number(cr.paid || 0)
          )
        )}`,
        `Vencimiento: ${cr.maturity || '-'}`,
        '',
        'CRONOGRAMA',
        ...schedule
      ].join('\n');
    };

    addSharePair(bar,{
      shareId:'shareConsistencyCredit',
      waId:'shareConsistencyCreditWA',
      shareLabel:'📤 Compartir detalle',
      waLabel:'💬 Enviar por WhatsApp',
      title:'Detalle del crédito · Préstamo Ya',
      client:()=>c,
      text:shareText
    });
  }

  // =========================================================
  // PAGO REGISTRADO
  // =========================================================

  function installPaymentConfirmation(){

    const x =
      window.__prestamoYaLastPaymentShare;

    if (!x)
      return;

    if (
      Date.now() -
      Number(x.at || 0) >
      86400000
    )
      return;

    const cr =
      getCredit(x.creditId);

    const c =
      cr ?
      getClientById(cr.clientId) :
      null;

    if (!cr || !c)
      return;

    const page =
      document.getElementById('collect');

    const body =
      document.getElementById('collectBody');

    if (!page || !body)
      return;

    const bar =
      body.querySelector('.actionbar');

    if (!bar)
      return;

    const paymentText = ()=>{

      const q =
        x.paidQuotas?.length
          ? `cuota${
              x.paidQuotas.length > 1 ? 's' : ''
            } ${x.paidQuotas.join(', ')}`
          : (
              x.partialQuotas?.length
                ? `abono a cuota ${
                    x.partialQuotas.join(', ')
                  }`
                : 'pago registrado'
            );

      const remain =
        Math.max(
          0,
          Number(cr.total || 0) -
          Number(cr.paid || 0)
        );

      return [
        'PRÉSTAMO YA — CONFIRMACIÓN DE PAGO',
        `Cliente: ${c.name || '-'}`,
        `Pago recibido: ${money(x.paidAmount)}`,
        `Concepto: ${q}`,
        remain > 0
          ? `Saldo pendiente: ${money(remain)}`
          : 'El crédito queda totalmente pagado.',
        'Gracias por tu pago.'
      ].join('\n');
    };

    addSharePair(bar,{
      shareId:'shareConsistencyPayment',
      waId:'shareConsistencyPaymentWA',
      shareLabel:'📤 Compartir comprobante',
      waLabel:'💬 Confirmar por WhatsApp',
      title:'Confirmación de pago · Préstamo Ya',
      client:()=>c,
      text:paymentText
    });
  }

  // =========================================================
  // NUEVA PROPUESTA DE CRÉDITO
  // =========================================================

  function proposalText(modal){

    const formClient =
      document.getElementById('creditClientBox');

    const clientText =
      clean(formClient?.innerText || '');

    const cards =
      [...modal.querySelectorAll('.card')]
        .map(x => clean(x.innerText))
        .filter(Boolean);

    let text = [
      'PRÉSTAMO YA',
      'PROPUESTA DE PRÉSTAMO',
      clientText,
      ...cards,
      '',
      'Esta propuesta es informativa y el crédito NO queda registrado hasta la aceptación del cliente.'
    ]
    .filter(Boolean)
    .join('\n');

    text = text
      .replace(/📤 Enviar al cliente/g,'')
      .replace(/💬 Enviar por WhatsApp/g,'')
      .replace(/✅ Cliente acepta y guardar/g,'')
      .replace(/Volver/g,'')
      .replace(/\n{3,}/g,'\n\n');

    return text.trim();
  }

  function findProposalClient(){

    const box =
      document.getElementById('creditClientBox');

    const t =
      clean(box?.innerText || '');

    const clients =
      db().clients || [];

    return clients.find(c =>
      c.name &&
      t.toLowerCase().includes(
        String(c.name).toLowerCase()
      )
    ) || null;
  }

  function installProposal(){

    const modal =
      document.getElementById('creditWorkflowModal');

    if (!modal)
      return;

    const oldSend =
      document.getElementById('v4Send');

    const bar =
      oldSend?.closest('.actionbar') ||
      modal.querySelector('.actionbar');

    if (!bar)
      return;

    if (oldSend)
      oldSend.textContent =
        '📤 Compartir propuesta';

    const c =
      findProposalClient();

    if (!c)
      return;

    addButton(
      bar,
      'v4WhatsAppConsistency',
      '💬 Enviar por WhatsApp',
      'green',
      ()=>openWhatsApp(
        c,
        proposalText(modal)
      )
    );
  }

  // =========================================================
  // RENOVACIÓN
  // =========================================================

  function renewalText(modal){

    const values =
      [...modal.querySelectorAll('.card')]
        .map(x => clean(x.innerText))
        .filter(Boolean);

    return [
      'PRÉSTAMO YA',
      'PROPUESTA DE RENOVACIÓN',
      ...values,
      '',
      'La renovación queda registrada únicamente al confirmar y guardar.'
    ].join('\n');
  }

  function installRenewal(){

    const modal =
      document.getElementById('renewalModal');

    if (!modal)
      return;

    const bar =
      modal.querySelector('.actionbar');

    if (!bar)
      return;

    const oldCreditId =
      window.__renewingCreditId;

    const c =
      clientOfCredit(oldCreditId);

    if (!c)
      return;

    addButton(
      bar,
      'renewalWhatsAppConsistency',
      '💬 Enviar propuesta por WhatsApp',
      'green',
      ()=>openWhatsApp(
        c,
        renewalText(modal)
      )
    );

    addButton(
      bar,
      'renewalShareConsistency',
      '📤 Compartir propuesta',
      'blue',
      ()=>shareNative(
        'Propuesta de renovación · Préstamo Ya',
        renewalText(modal)
      )
    );
  }

  // =========================================================
  // HISTORIAL DEL CLIENTE
  // =========================================================

  function installHistory(){

    const reportBox =
      document.getElementById('reportBox');

    if (!reportBox)
      return;

    const cards =
      [...reportBox.querySelectorAll('.card')];

    const historyHeader =
      cards.find(x =>
        /Historial completo/i.test(
          x.innerText || ''
        )
      );

    if (historyHeader){

      const m =
        clean(historyHeader.innerText);

      const c =
        (db().clients || []).find(x =>
          x.name &&
          m.toLowerCase().includes(
            String(x.name).toLowerCase()
          )
        );

      if (c){

        const bar =
          historyHeader.querySelector('.actionbar') ||
          (() => {
            const d =
              document.createElement('div');

            d.className =
              'actionbar';

            historyHeader.appendChild(d);

            return d;
          })();

        addButton(
          bar,
          'historyShareConsistency',
          '📤 Compartir historial',
          'blue',
          ()=>shareNative(
            'Historial del cliente · Préstamo Ya',
            clean(historyHeader.innerText)
          )
        );

        addButton(
          bar,
          'historyWhatsAppConsistency',
          '💬 Enviar historial por WhatsApp',
          'green',
          ()=>openWhatsApp(
            c,
            clean(historyHeader.innerText)
          )
        );
      }
    }

    cards
      .filter(x =>
        /💳 Crédito #/i.test(
          x.innerText || ''
        )
      )
      .forEach((card,i)=>{

        if (
          card.querySelector(
            '[id^="historyCreditWAConsistency"]'
          )
        )
          return;

        const m =
          card.innerText.match(
            /Crédito #([A-Za-z0-9_-]+)/i
          );

        if (!m)
          return;

        const cr =
          getCredit(m[1]);

        if (!cr)
          return;

        const c =
          getClientById(cr.clientId);

        if (!c)
          return;

        const bar =
          card.querySelector('.actionbar') ||
          (() => {

            const d =
              document.createElement('div');

            d.className =
              'actionbar';

            card.appendChild(d);

            return d;

          })();

        addButton(
          bar,
          `historyCreditShareConsistency${i}`,
          '📤 Compartir crédito',
          'blue',
          ()=>shareNative(
            'Detalle del crédito · Préstamo Ya',
            clean(card.innerText)
          )
        );

        addButton(
          bar,
          `historyCreditWAConsistency${i}`,
          '💬 WhatsApp',
          'green',
          ()=>openWhatsApp(
            c,
            clean(card.innerText)
          )
        );
      });
  }

  // =========================================================
  // EJECUCIÓN
  // =========================================================

  function run(){

    installCreditDetail();

    installPaymentConfirmation();

    installProposal();

    installRenewal();

    installHistory();
  }

  // Ejecutar después de renderAll
  const oldRenderAll =
    window.renderAll;

  if (
    typeof oldRenderAll === 'function' &&
    !oldRenderAll.__pyShareConsistency
  ){

    const wrapped =
      function(...args){

        const r =
          oldRenderAll.apply(
            this,
            args
          );

        setTimeout(run,0);
        setTimeout(run,250);

        return r;
      };

    wrapped.__pyShareConsistency =
      true;

    window.renderAll =
      wrapped;
  }

  // Ejecutar después de cambiar de pantalla
  const oldGo =
    window.go;

  if (
    typeof oldGo === 'function' &&
    !oldGo.__pyShareConsistency
  ){

    const wrapped =
      function(...args){

        const r =
          oldGo.apply(
            this,
            args
          );

        setTimeout(run,0);
        setTimeout(run,150);

        return r;
      };

    wrapped.__pyShareConsistency =
      true;

    window.go =
      wrapped;
  }

  // Detectar renderizados dinámicos
  const observer =
    new MutationObserver(()=>{

      clearTimeout(
        window.__prestamoYaShareConsistencyTimer
      );

      window.__prestamoYaShareConsistencyTimer =
        setTimeout(
          run,
          80
        );
    });

  function start(){

    run();

    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    setTimeout(run,500);
    setTimeout(run,1500);
  }

  if (
    document.readyState === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once:true}
    );

  } else {

    start();
  }

  window.PrestamoYaShareCenter = {

    version:'v1',

    whatsapp:openWhatsApp,

    share:shareNative

  };

})();
