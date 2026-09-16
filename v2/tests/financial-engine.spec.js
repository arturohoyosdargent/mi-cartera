const assert=require('assert');
const F=require('../core/financial-engine.js');
function credit(id,capital,total=capital){return {id,clientId:'client-1',capital,total,principalPaid:0,interestPaid:0,penaltyPaid:0,rate:20,status:F.STATUS.ACTIVE,version:1,freq:'monthly',term:1};}
// Alfredo: S/120 solo interés jamás amortiza S/600.
{
 const r=F.interestRenewal(credit('old',600,720),{newCreditId:'new',paymentId:'pay',interestAmount:120,date:'2026-09-15',maturity:'2026-10-14',rate:20,method:'YAPE'});
 assert.equal(r.oldCredit.status,F.STATUS.RENEWED);assert.equal(r.oldCredit.principalPaid,0);assert.equal(r.oldCredit.interestPaid,120);assert.equal(r.payment.capitalAmount,0);assert.equal(r.payment.interestAmount,120);assert.equal(r.newCredit.capital,600);assert.equal(r.newCredit.total,720);assert.equal(F.principalBalance(r.newCredit),600);
 assert.throws(()=>F.interestRenewal(r.oldCredit,{newCreditId:'third',paymentId:'pay2',interestAmount:120,date:'2026-09-16'}),/CREDIT_NOT_ACTIVE|CREDIT_ALREADY_RENEWED/);
}
// Elías: saldo principal anterior S/60 + nuevo capital S/200 => entrega S/140.
{
 const old={...credit('elias-old',200,240),principalPaid:140,rate:20};
 const r=F.refinance(old,{newCreditId:'elias-new',newCapital:200,rate:20,date:'2026-09-16',maturity:'2026-10-16',freq:'weekly',term:4});
 assert.equal(r.previousBalance,60);assert.equal(r.cashDisbursed,140);assert.equal(r.newCredit.total,240);assert.equal(r.oldCredit.status,F.STATUS.RENEWED);
}
// Pago normal de capital: solo capital reduce principal.
{
 const r=F.allocatePayment(credit('c',200,240),{id:'p',amount:50,concept:F.CONCEPT.CAPITAL});assert.equal(r.credit.principalPaid,50);assert.equal(F.principalBalance(r.credit),150);
}
console.log('V2 financial acceptance: PASS');
