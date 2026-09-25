const assert=require('assert');
const F=require('../core/financial-engine.js');

function applySchedule(schedule,amount){
  schedule=JSON.parse(JSON.stringify(schedule));
  let left=F.money(amount);
  for(const q of schedule){
    if(left<=0)break;
    const bal=F.money(q.balance??q.amount);
    if(bal<=0)continue;
    const used=F.money(Math.min(left,bal));
    q.paid=F.money((q.paid||0)+used);
    q.balance=F.money(bal-used);
    q.status=q.balance===0?'PAGADA':'PARCIAL';
    left=F.money(left-used);
  }
  return schedule;
}

function credit(){return {id:'cre-1',clientId:'cli-1',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:F.STATUS.ACTIVE,version:1,schedule:[
  {number:1,date:'2026-09-18',amount:40,paid:0,balance:40,status:'PENDIENTE'},
  {number:2,date:'2026-09-19',amount:40,paid:0,balance:40,status:'PENDIENTE'},
  {number:3,date:'2026-09-20',amount:40,paid:0,balance:40,status:'PENDIENTE'}
]};}

// Un pago parcial debe afectar solo la primera cuota pendiente.
{
 const c=credit();
 const r=F.allocatePayment(c,{id:'pay-1',amount:25,concept:F.CONCEPT.CAPITAL,date:'2026-09-18'});
 const s=applySchedule(c.schedule,25);
 assert.equal(r.credit.principalPaid,25);
 assert.deepEqual(s.map(q=>[q.paid,q.balance,q.status]),[[25,15,'PARCIAL'],[0,40,'PENDIENTE'],[0,40,'PENDIENTE']]);
}

// Un pago que cruza cuotas debe cerrar la primera y dejar parcial la siguiente.
{
 const c=credit();
 const r=F.allocatePayment(c,{id:'pay-2',amount:55,concept:F.CONCEPT.CAPITAL,date:'2026-09-18'});
 const s=applySchedule(c.schedule,55);
 assert.equal(r.credit.principalPaid,55);
 assert.deepEqual(s.map(q=>[q.paid,q.balance,q.status]),[[40,0,'PAGADA'],[15,25,'PARCIAL'],[0,40,'PENDIENTE']]);
}

// El pago completo del principal debe cerrar el crédito y no dejar saldo principal.
{
 const c=credit();
 const r=F.allocatePayment(c,{id:'pay-3',amount:100,concept:F.CONCEPT.CAPITAL,date:'2026-09-18'});
 assert.equal(r.credit.status,F.STATUS.PAID);
 assert.equal(F.principalBalance(r.credit),0);
 const s=applySchedule(c.schedule,100);
 assert.deepEqual(s.map(q=>[q.paid,q.balance,q.status]),[[40,0,'PAGADA'],[40,0,'PAGADA'],[20,20,'PARCIAL']]);
}

// Nunca se puede cobrar capital por encima del saldo principal.
{
 assert.throws(()=>F.allocatePayment(credit(),{id:'pay-over',amount:101,concept:F.CONCEPT.CAPITAL,date:'2026-09-18'}),/CAPITAL_EXCEEDS_PRINCIPAL/);
}

console.log('V2 payment/installment consistency: PASS');
