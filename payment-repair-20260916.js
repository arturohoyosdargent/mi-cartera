// Préstamo Ya — reparación controlada de Alfredo 2026-09-16 v2.
// Un único pago real: S/120 de interés. Capital S/600 se renueva, no se amortiza.
(()=>{'use strict';
if(window.__prestamoYaPaymentRepair20260916V2)return;window.__prestamoYaPaymentRepair20260916V2=true;
const CREDIT_ID='1789432343734',KEEP_PAYMENT_ID='1789511824927',RENEWAL_ID='1789511824928',CLIENT_ID='1789413557030';
const DUP=new Set(['1789511821118','1789511822463','1789511823195','1789511823866','1789511824412']);
const sid=v=>String(v??''),n=v=>Number(v||0),due='2026-10-14';
const run=()=>{const db=window.db;if(!db||!Array.isArray(db.payments)||!Array.isArray(db.credits))return setTimeout(run,300);
const payment=db.payments.find(p=>sid(p.id)===KEEP_PAYMENT_ID&&sid(p.creditId)===CREDIT_ID),old=db.credits.find(c=>sid(c.id)===CREDIT_ID);if(!payment||!old)return setTimeout(run,500);
// Siempre reconciliar: no depender del flag v1, porque Cloud pudo rehidratar datos antiguos.
db.payments=db.payments.filter(p=>!(sid(p.creditId)===CREDIT_ID&&DUP.has(sid(p.id))));
payment.clientId=CLIENT_ID;payment.type='interest_renewal';payment.concept='INTERES';payment.capitalAmount=0;payment.interestAmount=120;payment.amount=120;payment.method=payment.method||'Yape';payment.renewalId=Number(RENEWAL_ID);payment.repairTag='confirmed-interest-20260916-v2';
old.clientId=CLIENT_ID;old.status='Renovado';old.paid=0;old.interestPaid=120;old.renewedAt=payment.date||'2026-09-15';old.renewedTo=Number(RENEWAL_ID);old.repairTag='confirmed-interest-20260916-v2';if(Array.isArray(old.schedule))old.schedule=old.schedule.map(q=>({...q,paid:0}));
let next=db.credits.find(c=>sid(c.id)===RENEWAL_ID);const interest=120;if(!next){next={...old,id:Number(RENEWAL_ID)};db.credits.push(next)}
Object.assign(next,{clientId:CLIENT_ID,date:'2026-09-15',first:due,maturity:due,capital:600,rate:20,total:720,installment:720,paid:0,interestPaid:0,status:'Activo',renewedFrom:Number(CREDIT_ID),renewedAt:null,renewedTo:null,repairTag:'confirmed-interest-20260916-v2',schedule:[{n:1,date:due,amount:720,paid:0,postponed:false}]});
db.settings=db.settings||{};db.settings.paymentRepair20260916='done-v2';
try{window.persist?.()}catch(_){}try{window.enqueueSync?.('PAGO_MODIFICADO',payment);window.enqueueSync?.('CREDITO_MODIFICADO',old);window.enqueueSync?.('CREDITO_MODIFICADO',next)}catch(_){}
// No mostrar el crédito renovado como vencido/exigible. Se conserva para historial.
const patchRender=()=>{document.querySelectorAll('[data-credit-id]').forEach(el=>{if(sid(el.dataset.creditId)===CREDIT_ID){const card=el.closest('.card,.credit-card,[class*="credit"]');if(card)card.style.display='none'}})};patchRender();setTimeout(patchRender,100);setTimeout(patchRender,800);
try{window.renderAll?.()}catch(_){}console.info('Préstamo Ya: Alfredo conciliado v2',{old:CREDIT_ID,payment:KEEP_PAYMENT_ID,renewal:RENEWAL_ID,client:CLIENT_ID});};run();
})();
