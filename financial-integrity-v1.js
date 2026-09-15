/* Mi Cartera PRO — diagnóstico NO destructivo de integridad financiera */
(function(){
'use strict';
function n(v){v=Number(v);return Number.isFinite(v)?v:0}
function key(v){return String(v??'')}
function runFinancialIntegrityAudit(source){
 const db=source||window.db||{};
 const clients=Array.isArray(db.clients)?db.clients:[];
 const credits=Array.isArray(db.credits)?db.credits:[];
 const payments=Array.isArray(db.payments)?db.payments:[];
 const clientIds=new Set(clients.map(x=>key(x.id)).filter(Boolean));
 const creditIds=new Set(credits.map(x=>key(x.id)).filter(Boolean));
 const duplicatePaymentIds=[]; const seenPayments=new Set();
 const duplicateCreditIds=[]; const seenCredits=new Set();
 const orphanPayments=[]; const orphanCredits=[]; const balanceMismatches=[];
 for(const c of credits){const id=key(c.id);if(id&&seenCredits.has(id))duplicateCreditIds.push(id);seenCredits.add(id);if(!clientIds.has(key(c.clientId)))orphanCredits.push({creditId:c.id,clientId:c.clientId});}
 for(const p of payments){const id=key(p.id);if(id&&seenPayments.has(id))duplicatePaymentIds.push(id);seenPayments.add(id);if(!creditIds.has(key(p.creditId)))orphanPayments.push({paymentId:p.id,creditId:p.creditId,amount:n(p.amount)});}
 const byCredit=new Map();
 for(const p of payments){const id=key(p.creditId);byCredit.set(id,n(byCredit.get(id))+n(p.amount));}
 for(const c of credits){const id=key(c.id),paymentsTotal=n(byCredit.get(id)),creditPaid=n(c.paid);const schedulePaid=(Array.isArray(c.schedule)?c.schedule:[]).reduce((s,q)=>s+n(q.paid),0);if(Math.abs(paymentsTotal-creditPaid)>0.01||Math.abs(schedulePaid-creditPaid)>0.01)balanceMismatches.push({creditId:c.id,creditPaid,paymentsTotal,schedulePaid,total:n(c.total),computedRemain:Math.max(0,n(c.total)-creditPaid)});}
 const report={at:new Date().toISOString(),counts:{clients:clients.length,credits:credits.length,payments:payments.length},duplicatePaymentIds:[...new Set(duplicatePaymentIds)],duplicateCreditIds:[...new Set(duplicateCreditIds)],orphanPayments,orphanCredits,balanceMismatches,destructiveChanges:false};
 try{console.table(balanceMismatches);console.info('[Mi Cartera PRO] Auditoría financiera',report)}catch(_){}
 return report;
}
window.runFinancialIntegrityAudit=runFinancialIntegrityAudit;
})();
