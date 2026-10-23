const {test} = require('node:test');
const assert = require('node:assert/strict');
const {boot, KEY} = require('./dom-harness.cjs');
const Financial = require('../core/financial-engine.js');

function fixture(){
  return {clients:[{id:'client-fictional',name:'Cliente <ficticio>'}],
    credits:[{id:'old-fictional',clientId:'client-fictional',date:'2026-10-01',capital:1000,principalPaid:200,status:'RENOVADO',renewedTo:'active-fictional'},
      {id:'active-fictional',clientId:'client-fictional',date:'2026-10-20',capital:800,principalPaid:50,status:'ACTIVO',renewedFrom:'old-fictional',schedule:[
        {id:'due-fictional',date:'2026-10-20',balance:50,amount:100,status:'PENDIENTE'},
        {id:'next-fictional',date:'2026-10-22',balance:775,amount:775,status:'PENDIENTE'}]}],
    payments:[{id:'payment-fictional',operationId:'payment-op-fictional',creditId:'old-fictional',date:'2026-10-19',amount:240,capitalAmount:200,interestAmount:40,penaltyAmount:0},
      {id:'renewal-fictional',operationId:'renewal-op-fictional',creditId:'old-fictional',date:'2026-10-20',amount:60,capitalAmount:0,interestAmount:60,penaltyAmount:0},
      {id:'today-fictional',operationId:'today-op-fictional',creditId:'active-fictional',date:'2026-10-21',amount:55,capitalAmount:50,interestAmount:5,penaltyAmount:0}],
    cashMovements:[
      {id:'cash-c-capital',date:'2026-10-21',type:'INGRESO',amount:300,category:'APORTE_CAPITAL',concept:'Aporte ficticio'},
      {id:'opening-fictional',date:'2026-09-30',type:'INGRESO',amount:2000,category:'APORTE_CAPITAL'},
      {id:'disbursement-fictional',date:'2026-10-01',type:'EGRESO',amount:1000,concept:'DESEMBOLSO_CREDITO',ref:'old-fictional'},
      {id:'receipt-fictional',date:'2026-10-19',type:'INGRESO',amount:240,concept:'COBRO_CUOTA',ref:'payment-fictional'},
      {id:'renewal-receipt-fictional',date:'2026-10-20',type:'INGRESO',amount:60,concept:'COBRO_INTERES',ref:'renewal-fictional'},
      {id:'cash-b-expense',date:'2026-10-21',type:'EGRESO',amount:20,category:'GASTO_OPERATIVO'},
      {id:'cash-a-payment',date:'2026-10-21',type:'INGRESO',amount:55,concept:'COBRO_CUOTA',ref:'today-fictional'},
      {id:'future-expense-fictional',date:'2026-10-22',type:'EGRESO',amount:75,category:'SERVICIOS'},
      {id:'future-income-fictional',date:'2026-10-22',type:'INGRESO',amount:999,category:'OTRO_INGRESO'}],
    audit:[{id:'audit-capital-fictional',entityType:'CASH',entityId:'cash-c-capital',operationId:'capital-op-fictional',actorId:'test-admin',at:'2026-10-21T10:00:00Z'}],
    session:{actorId:'test-admin',role:'ADMIN'}};
}

async function environment(state=fixture()){
  const harness = await boot({state});
  harness.load('core/partner-loans.js');
  harness.w.MiCarteraV2Dates.today = () => '2026-10-21';
  harness.api = harness.w.MiCarteraV2CashMenu;
  harness.analyze = options => harness.api.analyze(harness.get(),{asOf:'2026-10-21',from:'2026-10-19',to:'2026-10-25',...options});
  return harness;
}

test('operational totals reconcile the selected week, the day, open receivables and daily liquidity',async()=>{
  const harness = await environment();
  try{
    const before = harness.w.localStorage.getItem(KEY), result = harness.analyze();
    assert.ok(result.period.activity,'Selected-period financial activity is missing');
    assert.equal(result.period.activity.collections,355);
    assert.equal(result.period.activity.principalRecovered,250);
    assert.equal(result.period.activity.interestCollected,105);
    assert.equal(result.period.activity.capitalContributions,300);
    assert.equal(result.period.activity.operatingExpenses,20);
    assert.equal(result.today.activity.collections,55);
    assert.equal(result.today.income,355);
    assert.equal(result.today.expense,20);
    assert.equal(result.cash.physical,1635);
    assert.equal(result.cash.available,1560);
    assert.equal(result.portfolio.principal,750);
    assert.equal(result.receivables.total,825);
    assert.equal(result.receivables.overdue,50);
    assert.deepEqual(Array.from(result.evolution,item=>[item.date,item.opening,item.income,item.expense,item.closing]),[
      ['2026-10-19',1000,240,0,1240],['2026-10-20',1240,60,0,1300],['2026-10-21',1300,355,20,1635]]);
    assert.equal(harness.w.localStorage.getItem(KEY),before);
    assert.equal(harness.commits.length,0);
  } finally {harness.close();}
});

test('movement audit resolves client and credit references with absolute balances unaffected by display filters',async()=>{
  const harness = await environment();
  try{
    const result = harness.analyze({from:'2026-10-21',to:'2026-10-21'});
    assert.ok(result.movements,'Chronological audit movements are missing');
    const receipt = result.movements.find(item=>item.id==='cash-a-payment');
    assert.equal(receipt.clientName,'Cliente <ficticio>');
    assert.equal(receipt.creditId,'active-fictional');
    assert.equal(receipt.paymentId,'today-fictional');
    const capital = result.movements.find(item=>item.id==='cash-c-capital');
    assert.equal(capital.balanceAfter,1635);
    assert.equal(capital.actorId,'test-admin');
    assert.equal(capital.operationId,'capital-op-fictional');
    assert.equal(result.movements.find(item=>item.id==='future-income-fictional').balanceAfter,null);
    const document = harness.w.document;
    document.getElementById('cashHistoryPeriod').value='TODAY';
    document.getElementById('cashHistoryType').value='INGRESO';
    harness.api.renderHistory();
    assert.equal(document.querySelectorAll('#cashHistory [data-movement-id]').length,2);
    const row = document.querySelector('[data-movement-id="cash-c-capital"]');
    assert.match(row.textContent,/1,635\.00/);
    assert.match(row.textContent,/test-admin.*capital-op-fictional/);
    assert.match(document.getElementById('cashHistory').textContent,/Cliente <ficticio>/);
    assert.ok(!document.querySelector('#cashHistory ficticio'));
  } finally {harness.close();}
});

test('daily, Monday-based weekly, monthly and custom filters update the same financial panel',async()=>{
  const harness = await environment();
  try{
    const document = harness.w.document, period = document.getElementById('cashHistoryPeriod');
    assert.ok(period.querySelector('option[value="WEEK"]'),'Weekly filter is missing');
    for(const [mode,interest] of [['TODAY','5.00'],['WEEK','105.00'],['MONTH','105.00']]){
      period.value=mode;period.dispatchEvent(new harness.w.Event('change'));
      assert.match(document.getElementById('cashPeriodInterest').textContent,new RegExp(interest.replace('.','\\.')));
    }
    period.value='RANGE';document.getElementById('cashHistoryFrom').value='2026-10-19';document.getElementById('cashHistoryTo').value='2026-10-20';
    period.dispatchEvent(new harness.w.Event('change'));
    assert.match(document.getElementById('cashClosingBalance').textContent,/1,300\.00/);
    assert.match(document.getElementById('cashPeriodInterest').textContent,/100\.00/);
    document.getElementById('cashHistoryFrom').value='2026-10-22';period.dispatchEvent(new harness.w.Event('change'));
    assert.match(document.getElementById('cashPeriodInterest').textContent,/Rango inválido/);
  } finally {harness.close();}
});

test('the primary screen is operational and keeps the approved simulator inside a closed internal analysis section',async()=>{
  const harness = await environment();
  try{
    harness.api.renderSummary();
    const document = harness.w.document;
    assert.ok(document.getElementById('cashOperations'),'The operational panel is missing');
    assert.match(document.getElementById('cashTodayCollections').textContent,/55\.00/);
    assert.match(document.getElementById('cashPendingTotal').textContent,/825\.00/);
    assert.match(document.getElementById('cashLiquidityEvolution').textContent,/Saldo inicial|Apertura/);
    assert.equal(document.getElementById('cashProfitability').tagName,'DETAILS');
    assert.equal(document.getElementById('cashProfitability').open,false);
    assert.equal(document.getElementById('cashSimCalculate').closest('details').id,'cashProfitability');
  } finally {harness.close();}
});

test('the dedicated capital action reuses durable cash recording once, appends an audited contribution and preserves historical finance',async()=>{
  const harness = await environment();
  try{
    const document = harness.w.document, button = document.querySelector('[data-v2-cash-capital]');
    assert.ok(button,'Dedicated capital action is missing');
    const before = harness.get();
    button.click();
    assert.equal(document.getElementById('v2CashCategory').value,'APORTE_CAPITAL');
    assert.equal(document.getElementById('v2CashCategory').disabled,true);
    document.getElementById('v2CashAmount').value='100';
    document.getElementById('v2CashConcept').value='Aportante ficticio A';
    document.getElementById('v2CashForm').querySelector('[data-save]').click();
    document.getElementById('v2CashForm')?.querySelector('[data-save]').click();
    for(let attempt=0;attempt<20&&document.getElementById('v2CashForm');attempt++)await new Promise(setImmediate);
    const after = harness.get();
    assert.equal(harness.commits.length,1);
    assert.deepEqual(after.clients,before.clients);assert.deepEqual(after.credits,before.credits);assert.deepEqual(after.payments,before.payments);
    assert.deepEqual(after.cashMovements.slice(0,before.cashMovements.length),before.cashMovements);
    const movement = after.cashMovements.at(-1), audit = after.audit.at(-1);
    assert.equal(movement.category,'APORTE_CAPITAL');assert.equal(movement.concept,'Aportante ficticio A');
    assert.equal(audit.entityId,movement.id);assert.equal(audit.actorId,'test-admin');assert.ok(audit.operationId);
    assert.match(document.querySelector('[data-movement-id="'+movement.id+'"]').textContent,/Aportante ficticio A/);
  } finally {harness.close();}
});

test('new period metrics, receivables and audit details disappear when the account identity changes',async()=>{
  const harness = await environment();
  try{
    harness.api.renderSummary();harness.api.renderHistory();
    assert.ok(harness.w.document.getElementById('cashOperations'),'Operational section is missing');
    harness.setAuth({uid:'other-fictional-user',role:'admin',ready:true},true);
    const panel = harness.w.document.getElementById('cashOperations');
    assert.ok(panel.hidden||!panel.textContent.trim());
    assert.doesNotMatch(harness.w.document.getElementById('cashHistory').textContent,/Cliente|Aporte ficticio|1,635/);
  } finally {harness.close();}
});

test('period analysis consumes actual payment and renewal engine results without treating rolled principal as new cash',async()=>{
  const original = {id:'engine-original',clientId:'client-fictional',date:'2026-10-21',capital:500,total:600,principalPaid:0,interestPaid:0,rate:20,status:Financial.STATUS.ACTIVE,version:1};
  const paid = Financial.allocateInstallment(original,{id:'engine-payment',date:'2026-10-21',amount:120,operationId:'engine-pay-op'},600);
  const renewed = Financial.interestRenewal(paid.credit,{newCreditId:'engine-renewed',paymentId:'engine-renewal-payment',interestAmount:80,date:'2026-10-21',rate:20,operationId:'engine-renew-op'});
  const refinanced = Financial.refinance(renewed.newCredit,{newCreditId:'engine-refinanced',newCapital:500,rate:20,date:'2026-10-21',operationId:'engine-refinance-op'});
  const state = {...fixture(),credits:[renewed.oldCredit,refinanced.oldCredit,refinanced.newCredit],payments:[paid.payment,renewed.payment],cashMovements:[
    {id:'engine-opening',date:'2026-10-20',type:'INGRESO',amount:1000,category:'APORTE_CAPITAL'},
    {id:'engine-out',date:'2026-10-21',type:'EGRESO',amount:500,concept:'DESEMBOLSO_CREDITO',ref:'engine-original'},
    {id:'engine-receipt',date:'2026-10-21',type:'INGRESO',amount:120,concept:'COBRO_CUOTA',ref:paid.payment.id},
    {id:'engine-renewal-receipt',date:'2026-10-21',type:'INGRESO',amount:80,concept:'COBRO_INTERES',ref:renewed.payment.id},
    {id:'engine-refinance-out',date:'2026-10-21',type:'EGRESO',amount:refinanced.cashDisbursed,concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:'engine-refinanced'}]};
  const harness = await environment(state);
  try{
    const result = harness.analyze();assert.ok(result.period.activity,'Period integration is missing');
    assert.equal(result.period.activity.disbursed,600);assert.equal(result.period.activity.principalRecovered,100);
    assert.equal(result.period.activity.interestCollected,100);assert.equal(result.cash.physical,600);assert.equal(result.portfolio.principal,500);
  } finally {harness.close();}
});

test('period totals and running balances share deduplication, while missing calendars never certify zero pending debt',async()=>{
  const state = fixture();
  state.payments.push({...state.payments[2],id:'replayed-fictional'});
  state.cashMovements.push({...state.cashMovements[6],id:'cash-replayed-fictional',ref:'replayed-fictional'});
  delete state.credits[1].schedule;
  const harness = await environment(state);
  try{
    const result=harness.analyze();assert.ok(result.period.activity,'Period deduplication is missing');
    assert.equal(result.period.activity.collections,355);assert.equal(result.today.activity.collections,55);
    assert.equal(result.movements.filter(item=>item.paymentId==='today-fictional').length,1);
    assert.equal(result.receivables.valid,false);assert.equal(result.receivables.total,null);
    assert.equal(result.cash.physical,1635);
  } finally {harness.close();}
});

test('operational synchronization status and new real-shaped receipts refresh without resetting the period or writing operations',async()=>{
  const harness = await environment();
  try{
    let status={configured:true,online:false,pending:1};
    harness.w.MiCarteraV2SyncBridge.status=()=>status;
    harness.api.renderSummary();
    const document=harness.w.document, indicator=document.getElementById('cashOperationsSync');
    assert.ok(indicator,'Operational synchronization disclosure is missing');
    assert.match(indicator.textContent,/Sin conexión.*1 pendiente/);
    const actions=document.querySelector('[data-v2-cash-actions]');
    assert.ok(actions.compareDocumentPosition(document.getElementById('cashOperations'))&4,'Capital actions must precede the metrics');
    document.getElementById('cashHistoryPeriod').value='WEEK';
    const next=harness.get();
    next.payments.push({id:'arrived-fictional',operationId:'arrived-op-fictional',creditId:'active-fictional',date:'2026-10-21',amount:30,capitalAmount:20,interestAmount:10,penaltyAmount:0});
    next.cashMovements.push({id:'arrived-cash-fictional',date:'2026-10-21',type:'INGRESO',amount:30,concept:'COBRO_CUOTA',ref:'arrived-fictional'});
    next.credits[1].principalPaid=70;next.credits[1].schedule[1].balance=745;
    harness.set(next);const before=harness.w.localStorage.getItem(KEY);
    status={configured:true,online:true,pending:0};
    harness.w.dispatchEvent(new harness.w.Event('mi-cartera-v2-rehydrated'));
    assert.match(indicator.textContent,/^Conectado$/);
    assert.doesNotMatch(indicator.textContent,/pendiente/);
    assert.match(document.getElementById('cashTodayCollections').textContent,/85\.00/);
    assert.match(document.getElementById('cashPeriodInterest').textContent,/115\.00/);
    assert.match(document.getElementById('cashPendingTotal').textContent,/795\.00/);
    assert.equal(document.getElementById('cashHistoryPeriod').value,'WEEK');
    assert.equal(harness.w.localStorage.getItem(KEY),before);assert.equal(harness.commits.length,0);
  } finally {harness.close();}
});

test('the complete application shell exposes the operational panel and preserves a negative available balance',async()=>{
  const state=fixture();state.cashMovements.find(row=>row.id==='opening-fictional').amount=300;
  const harness=await boot({fullShell:true,state});
  try{
    harness.w.MiCarteraV2Dates.today=()=> '2026-10-21';
    const before=harness.w.localStorage.getItem(KEY),document=harness.w.document;
    harness.w.show('cash');
    assert.ok(document.getElementById('cashOperationsSync'),'The full shell must expose the operational snapshot status');
    assert.match(document.getElementById('cashOpPhysical').textContent,/-65\.00/);
    assert.match(document.getElementById('cashOpAvailable').textContent,/-140\.00/);
    harness.w.show('home');
    assert.match(document.getElementById('mCapitalAvailable').textContent,/-140\.00/);
    assert.equal(harness.w.localStorage.getItem(KEY),before);assert.equal(harness.commits.length,0);
  } finally {harness.close();}
});
