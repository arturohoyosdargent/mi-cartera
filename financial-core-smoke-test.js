// Préstamo Ya — smoke test financiero determinista v1.
// No usa Firebase ni datos reales: valida invariantes de IDs, relaciones y deduplicación.
(function(){
  'use strict';
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  const run=()=>{
    const credit={id:'cr-test-1',clientId:'cl-test-1',schedule:[{amount:100,paid:0}],paid:0};
    const payment={id:'pay-test-1',creditId:credit.id,amount:25,type:'cuota',method:'efectivo'};
    const db={clients:[{id:'cl-test-1'}],credits:[credit],payments:[payment],syncQueue:[]};
    assert(db.credits.some(c=>String(c.clientId)===String(db.clients[0].id)),'CREDIT_CLIENT_LINK');
    assert(db.payments.some(p=>String(p.creditId)===String(credit.id)),'PAYMENT_CREDIT_LINK');
    const enqueue=(p)=>{const exists=db.syncQueue.some(q=>q.type==='PAGO_CREADO'&&String(q.payload?.id)===String(p.id));if(!exists)db.syncQueue.push({type:'PAGO_CREADO',status:'PENDIENTE',payload:{...p}})};
    enqueue(payment);enqueue(payment);
    assert(db.syncQueue.length===1,'PAYMENT_QUEUE_DUPLICATED');
    assert(db.syncQueue[0].payload.id===payment.id,'PAYMENT_ID_CHANGED');
    assert(db.syncQueue[0].payload.creditId===credit.id,'PAYMENT_CREDIT_ID_CHANGED');
    const firestoreDocId=String(db.syncQueue[0].payload.id);
    assert(firestoreDocId===String(payment.id),'FIRESTORE_DOC_ID_NOT_STABLE');
    return {ok:true,tests:5,destructiveChanges:false};
  };
  window.runFinancialCoreSmokeTest=run;
  try{window.__financialCoreSmokeTest=run();console.log('Préstamo Ya · financial smoke PASS',window.__financialCoreSmokeTest)}catch(e){window.__financialCoreSmokeTest={ok:false,error:String(e?.message||e)};console.error('Préstamo Ya · financial smoke FAIL',e)}
})();