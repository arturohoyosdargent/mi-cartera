// Préstamo Ya — reparación controlada de pagos duplicados confirmados 2026-09-16.
// Caso documentado: crédito 1789432343734, un único pago real de interés S/120.
(()=>{'use strict';
  if(window.__prestamoYaPaymentRepair20260916)return;
  window.__prestamoYaPaymentRepair20260916=true;
  const CREDIT_ID='1789432343734';
  const KEEP_PAYMENT_ID='1789511824927';
  const DUPLICATE_IDS=new Set(['1789511821118','1789511822463','1789511823195','1789511823866','1789511824412']);
  const sid=v=>String(v??'');
  const n=v=>Number(v||0);
  const addMonth=date=>{const d=new Date(String(date||'2026-09-14')+'T12:00:00');d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)};
  const run=()=>{
    const db=window.db;
    if(!db||!Array.isArray(db.payments)||!Array.isArray(db.credits))return setTimeout(run,300);
    if(db.settings?.paymentRepair20260916==='done')return;
    const payment=db.payments.find(p=>sid(p.id)===KEEP_PAYMENT_ID&&sid(p.creditId)===CREDIT_ID);
    const credit=db.credits.find(c=>sid(c.id)===CREDIT_ID);
    if(!payment||!credit)return setTimeout(run,500);
    const before=db.payments.length;
    db.payments=db.payments.filter(p=>!(sid(p.creditId)===CREDIT_ID&&DUPLICATE_IDS.has(sid(p.id))));
    payment.type='interest_renewal';payment.concept='INTERES';payment.capitalAmount=0;payment.interestAmount=n(payment.amount);payment.repairTag='confirmed-interest-20260916';
    const renewalId=Number(KEEP_PAYMENT_ID)+1;
    const due=addMonth(credit.maturity||credit.first||credit.date);
    credit.status='Renovado';credit.paid=0;credit.interestPaid=n(payment.amount);credit.renewedAt=payment.date||'2026-09-15';credit.renewedTo=renewalId;credit.repairTag='confirmed-interest-20260916';
    if(Array.isArray(credit.schedule))credit.schedule=credit.schedule.map(q=>({...q,paid:0}));
    let next=db.credits.find(c=>sid(c.id)===sid(renewalId));
    if(!next){
      const interest=Math.max(0,n(credit.capital)*n(credit.rate)/100);
      next={...credit,id:renewalId,date:payment.date||'2026-09-15',first:due,maturity:due,total:n(credit.capital)+interest,installment:n(credit.capital)+interest,paid:0,interestPaid:0,status:'Activo',renewedFrom:credit.id,renewedAt:null,renewedTo:null,repairTag:'confirmed-interest-20260916',schedule:[{n:1,date:due,amount:n(credit.capital)+interest,paid:0,postponed:false}]};
      db.credits.push(next);
    }
    payment.renewalId=renewalId;
    db.settings=db.settings||{};db.settings.paymentRepair20260916='done';db.settings.paymentRepair20260916Removed=before-db.payments.length;
    try{window.audit?.('REPARACION_PAGO_INTERES','Crédito #'+CREDIT_ID+' · se conserva pago #'+KEEP_PAYMENT_ID+' S/120 como interés; duplicados locales retirados; capital renovado.')}catch(_){}
    try{window.persist?.()}catch(_){}
    try{window.enqueueSync?.('PAGO_MODIFICADO',payment);window.enqueueSync?.('CREDITO_MODIFICADO',credit);window.enqueueSync?.('CREDITO_CREADO',next)}catch(_){}
    try{window.renderAll?.()}catch(_){}
    console.info('Préstamo Ya: reparación de pago/renovación aplicada', {creditId:CREDIT_ID,paymentId:KEEP_PAYMENT_ID,removed:before-db.payments.length,renewalId});
  };
  run();
})();
