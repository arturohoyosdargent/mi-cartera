/* Mi Cartera PRO — diagnóstico NO destructivo de integridad financiera */
(function(){
'use strict';
function n(v){v=Number(v);return Number.isFinite(v)?v:0}
function key(v){return String(v??'')}
function cents(v){return Math.round(n(v)*100)}
function runFinancialIntegrityAudit(source){
 const db=source||window.db||{};
 const clients=Array.isArray(db.clients)?db.clients:[];
 const credits=Array.isArray(db.credits)?db.credits:[];
 const payments=Array.isArray(db.payments)?db.payments:[];
 const clientIds=new Set(clients.map(x=>key(x.id)).filter(Boolean));
 const creditIds=new Set(credits.map(x=>key(x.id)).filter(Boolean));
 const duplicatePaymentIds=[]; const seenPayments=new Set();
 const duplicateCreditIds=[]; const seenCredits=new Set();
 const orphanPayments=[]; const orphanCredits=[]; const invalidPayments=[]; const balanceMismatches=[];
 for(const c of credits){const id=key(c.id);if(id&&seenCredits.has(id))duplicateCreditIds.push(id);seenCredits.add(id);if(!clientIds.has(key(c.clientId)))orphanCredits.push({creditId:c.id,clientId:c.clientId});}
 for(const p of payments){
  const id=key(p.id),amount=n(p.amount);
  if(id&&seenPayments.has(id))duplicatePaymentIds.push(id);seenPayments.add(id);
  if(!creditIds.has(key(p.creditId)))orphanPayments.push({paymentId:p.id,creditId:p.creditId,amount});
  if(!id||!key(p.creditId)||!Number.isFinite(Number(p.amount))||amount<=0)invalidPayments.push({paymentId:p.id,creditId:p.creditId,amount:p.amount});
 }
 const byCredit=new Map();
 for(const p of payments){const id=key(p.creditId);if(!id)continue;byCredit.set(id,(byCredit.get(id)||0)+cents(p.amount));}
 for(const c of credits){
  const id=key(c.id),paymentsTotalCents=byCredit.get(id)||0,creditPaidCents=cents(c.paid);
  const schedulePaidCents=(Array.isArray(c.schedule)?c.schedule:[]).reduce((s,q)=>s+cents(q.paid),0);
  if(paymentsTotalCents!==creditPaidCents||schedulePaidCents!==creditPaidCents){
   balanceMismatches.push({creditId:c.id,creditPaid:creditPaidCents/100,paymentsTotal:paymentsTotalCents/100,schedulePaid:schedulePaidCents/100,total:n(c.total),ledgerRemain:Math.max(0,(cents(c.total)-paymentsTotalCents)/100),storedRemain:Math.max(0,(cents(c.total)-creditPaidCents)/100)});
  }
 }
 const report={at:new Date().toISOString(),sourceOfTruth:'db.payments',policy:'report-only',counts:{clients:clients.length,credits:credits.length,payments:payments.length},duplicatePaymentIds:[...new Set(duplicatePaymentIds)],duplicateCreditIds:[...new Set(duplicateCreditIds)],invalidPayments,orphanPayments,orphanCredits,balanceMismatches,destructiveChanges:false};
 try{console.table(balanceMismatches);console.info('[Mi Cartera PRO] Auditoría financiera',report)}catch(_){}
 return report;
}
window.runFinancialIntegrityAudit=runFinancialIntegrityAudit;
})();
