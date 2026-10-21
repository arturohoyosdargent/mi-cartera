const {test} = require('node:test');
const assert = require('node:assert/strict');
const {boot, KEY} = require('./dom-harness.cjs');
const Partners = require('../core/partner-loans.js');

function fixture() {
  let loan = Partners.create({id:'fictional-partner', partner:'Socio ficticio', date:'2026-09-01', principal:1000, rate:10, firstDue:'2026-10-01'});
  loan = Partners.payInterest(loan, {id:'partner-interest', date:'2026-10-10', due:'2026-10-01', amount:100});
  loan = Partners.repay(loan, {id:'partner-return', date:'2026-10-15', amount:200, nextMonthlyInterest:80});
  return {clients:[], credits:[
    {id:'original', date:'2026-10-01', capital:1000, principalPaid:200, status:'RENOVADO', renewedTo:'renewed'},
    {id:'renewed', date:'2026-10-15', capital:800, principalPaid:0, status:'RENOVADO', renewedFrom:'original', renewedTo:'refinanced'},
    {id:'refinanced', date:'2026-10-16', capital:900, principalPaid:0, status:'ACTIVO', renewedFrom:'renewed'}],
  payments:[
    {id:'installment', operationId:'PAY|installment', creditId:'original', date:'2026-10-05', amount:240, capitalAmount:200, interestAmount:40, penaltyAmount:0, concept:'CUOTA'},
    {id:'renewal-interest', operationId:'RENEW|original', creditId:'original', date:'2026-10-15', amount:60, capitalAmount:0, interestAmount:60, penaltyAmount:0, concept:'INTERES'}],
  cashMovements:[
    {id:'opening', date:'2026-09-30', type:'INGRESO', amount:2000, category:'APORTE_CAPITAL'},
    {...Partners.entry(loan), date:'2026-10-01'},
    {id:'disbursement', date:'2026-10-01', type:'EGRESO', amount:1000, concept:'DESEMBOLSO_CREDITO', ref:'original'},
    {id:'receipt', date:'2026-10-05', type:'INGRESO', amount:240, concept:'COBRO_CUOTA', ref:'installment'},
    {id:'operating', date:'2026-10-06', type:'EGRESO', amount:50, category:'GASTO_OPERATIVO'},
    {id:'partner-interest', date:'2026-10-10', type:'EGRESO', amount:100, category:'INTERES_SOCIO', partnerLoanId:loan.id, interestDue:'2026-10-01'},
    {id:'partner-return', date:'2026-10-15', type:'EGRESO', amount:200, category:'DEVOLUCION_CAPITAL_SOCIO', partnerLoanId:loan.id},
    {id:'renewal-receipt', date:'2026-10-15', type:'INGRESO', amount:60, concept:'COBRO_INTERES_RENOVACION', ref:'renewal-interest'},
    {id:'extra-disbursement', date:'2026-10-16', type:'EGRESO', amount:100, concept:'DESEMBOLSO_REFINANCIAMIENTO', ref:'refinanced'},
    {id:'future-income', date:'2026-11-01', type:'INGRESO', amount:999, category:'OTRO_INGRESO'},
    {id:'future-expense', date:'2026-10-30', type:'EGRESO', amount:75, category:'SERVICIOS'}],
  audit:[], session:{actorId:'test-admin', role:'ADMIN'}};
}

async function environment(state=fixture()) {
  const harness = await boot({state});
  harness.load('core/partner-loans.js');
  harness.w.MiCarteraV2Dates.today = () => '2026-10-21';
  const api = harness.w.MiCarteraV2CashMenu;
  const analyze = (options={}) => {
    assert.equal(typeof api.analyze, 'function', 'Balance must expose a read-only reconciled analysis');
    return api.analyze(harness.get(), {asOf:'2026-10-21', month:'2026-10', from:'2026-10-01', to:'2026-10-31', ...options});
  };
  return {...harness, api, analyze};
}

test('real cash excludes future receipts, reserves future expenses and closes the selected date range', async () => {
  const harness = await environment();
  try {
    const result = harness.analyze();
    assert.equal(result.cash.physical,1850);
    assert.equal(result.cash.futureExpenses,75);
    assert.equal(result.cash.available,1775);
    assert.equal(result.period.opening,2000);
    assert.equal(result.period.income,1300);
    assert.equal(result.period.expense,1450);
    assert.equal(result.period.closing,1850);
    assert.equal(result.future.length,2);
    assert.equal(harness.analyze({from:'2026-10-22',to:'2026-11-01'}).period.income,0);
  } finally { harness.close(); }
});

test('renewals and partner funding never masquerade as profit or count principal twice', async () => {
  const harness = await environment();
  try {
    const result = harness.analyze();
    assert.equal(result.month.disbursed,1100);
    assert.equal(result.month.principalRecovered,200);
    assert.equal(result.month.interestCollected,100);
    assert.equal(result.month.operatingExpenses,50);
    assert.equal(result.month.partnerInterestPaid,100);
    assert.equal(result.month.partnerPrincipalReturned,200);
    assert.equal(result.month.netProfit,-50);
    assert.equal(result.month.complete,true);
    assert.equal(result.portfolio.principal,900);
    assert.equal(result.partners.principal,800);
    assert.equal(result.partners.interestDue,0);
    assert.equal(result.partners.nextMonthlyCost,80);
    assert.equal(result.netCapital,1950);
  } finally { harness.close(); }
});

test('cash IDs, payment receipts and retried payment operation IDs are deduplicated without merging separate expenses', async () => {
  const state = fixture();
  state.cashMovements.push({...state.cashMovements[3], id:'replayed-receipt'}, {...state.cashMovements[4]}, {...state.cashMovements[4],id:'independent-expense'});
  state.payments.push({...state.payments[0],id:'replayed-payment'});
  const harness = await environment(state);
  try {
    const result = harness.analyze();
    assert.equal(result.cash.physical,1800);
    assert.equal(result.month.interestCollected,100);
    assert.equal(result.month.operatingExpenses,100);
    assert.equal(result.month.netProfit,-100);
    assert.equal(result.month.complete,true);
  } finally { harness.close(); }
});

test('the newest tombstone suppresses the older cash row, while foreign cash accounts are excluded', async () => {
  const state = fixture();
  state.cashMovements.push({...state.cashMovements[4],version:2,tombstone:true}, {id:'worker-funds',date:'2026-10-01',type:'INGRESO',amount:9000,cashAccountId:'worker-other'});
  const harness = await environment(state);
  try { const result=harness.analyze(); assert.equal(result.cash.physical,1900); assert.equal(result.month.operatingExpenses,0); }
  finally { harness.close(); }
});

test('a scheduled payment of overdue partner interest is reserved only once', async () => {
  let loan=Partners.create({id:'fictitious-reserve',partner:'Socio ficticio',date:'2026-09-01',principal:1000,rate:10,firstDue:'2026-10-01'});
  loan=Partners.payInterest(loan,{id:'scheduled-interest',date:'2026-10-30',due:'2026-10-01',amount:100});
  const state={...fixture(),credits:[],payments:[],cashMovements:[Partners.entry(loan),{id:'scheduled-interest',date:'2026-10-30',type:'EGRESO',amount:100,category:'INTERES_SOCIO',partnerLoanId:loan.id,interestDue:'2026-10-01'}]};
  const harness=await environment(state);
  try { const result=harness.analyze(); assert.equal(result.partners.interestDue,100); assert.equal(result.cash.available,900); assert.equal(result.month.partnerInterestPaid,0); }
  finally { harness.close(); }
});

test('missing allocations and orphaned payment receipts stay unclassified instead of inventing interest', async () => {
  const state=fixture(); delete state.payments[0].capitalAmount; delete state.payments[0].interestAmount;
  state.cashMovements.push({id:'orphan',date:'2026-10-19',type:'INGRESO',amount:30,concept:'COBRO_CUOTA',ref:'missing-payment'});
  const harness=await environment(state);
  try { const result=harness.analyze(); assert.equal(result.month.interestCollected,60); assert.equal(result.month.unclassifiedCollections,270); assert.equal(result.month.complete,false); assert.ok(result.warnings.length); }
  finally { harness.close(); }
});

test('unrecognized expenses make the realized result provisional, not a fabricated operating expense', async () => {
  const state=fixture(); state.cashMovements.push({id:'unclear',date:'2026-10-19',type:'EGRESO',amount:60,category:'COLEGIO'});
  const harness=await environment(state);
  try { const result=harness.analyze(); assert.equal(result.month.operatingExpenses,50); assert.equal(result.month.unclassifiedExpense,60); assert.equal(result.month.complete,false); assert.equal(result.cash.physical,1790); }
  finally { harness.close(); }
});

test('conflicting duplicates, invalid amounts and impossible dates block an authoritative available balance', async () => {
  for (const invalid of [
    {id:'invalid',date:'2026-02-31',type:'INGRESO',amount:100},
    {id:'invalid',date:'2026-10-01',type:'INGRESO',amount:-100},
    {id:'invalid',date:'2026-10-01',type:'INGRESO',amount:'Infinity'},
    {id:'operating',date:'2026-10-06',type:'EGRESO',amount:500,category:'GASTO_OPERATIVO'}]) {
    const state=fixture(); state.cashMovements.push(invalid);
    const harness=await environment(state);
    try { const result=harness.analyze(); assert.equal(result.cash.valid,false); assert.equal(result.cash.available,null); assert.equal(result.month.complete,false); }
    finally { harness.close(); }
  }
});

test('legacy dates, decimal cents, reverse ranges and prior months use explicit calendar boundaries', async () => {
  const state=fixture(); state.cashMovements.push({id:'cents',date:'07/10/2026',type:'EGRESO',amount:0.1,category:'GASTO_OPERATIVO'},{id:'cents-2',date:'2026-10-07T12:00:00Z',type:'EGRESO',amount:0.2,category:'GASTO_OPERATIVO'});
  const harness=await environment(state);
  try { assert.equal(harness.analyze().month.operatingExpenses,50.3); const prior=harness.analyze({month:'2026-09'}); assert.equal(prior.month.netProfit,0); assert.equal(harness.analyze({from:'2026-10-22',to:'2026-10-01'}).period.valid,false); }
  finally { harness.close(); }
});

const scenario={operatingCosts:300,partnerCosts:100,averageCredit:500,monthlyRate:10,collectionPercent:80,lossPercent:1,variableCost:5,targetProfit:200};
test('break-even and target profit use collected interest contribution, not principal or the whole contract rate', async () => {
  const harness=await environment();
  try {
    assert.equal(typeof harness.api.simulate,'function');
    const result=harness.api.simulate(scenario,harness.analyze());
    assert.equal(result.valid,true); assert.equal(result.contributionPerCredit,30);
    assert.equal(result.breakEvenCredits,14); assert.equal(result.breakEvenCapital,7000);
    assert.equal(result.breakEvenIncome,533.34); assert.equal(result.targetCredits,20);
    assert.equal(result.targetCapital,10000); assert.equal(result.targetIncome,800);
    assert.equal(result.expectedProfit,200); assert.equal(result.additionalFunding,7325);
  } finally { harness.close(); }
});

test('whole-credit rounding always covers the goal and never returns infinity for zero or negative margins', async () => {
  const harness=await environment();
  try {
    assert.equal(typeof harness.api.simulate,'function');
    const rounded=harness.api.simulate({...scenario,targetProfit:201},harness.analyze());
    assert.equal(rounded.targetCredits,21); assert.equal(rounded.targetCapital,10500); assert.equal(rounded.expectedProfit,230);
    for(const changed of [{monthlyRate:''},{monthlyRate:0},{collectionPercent:0},{lossPercent:20},{averageCredit:0},{partnerCosts:-1},{operatingCosts:Infinity},{targetProfit:-1},{collectionPercent:101}]) {
      const result=harness.api.simulate({...scenario,...changed},harness.analyze()); assert.equal(result.valid,false); assert.ok(result.reason);
    }
  } finally { harness.close(); }
});

test('the actual Balance screen separates realized results from projections and retains filters and scenario drafts on refresh', async () => {
  const harness=await environment();
  try {
    const before=harness.w.localStorage.getItem(KEY);
    harness.api.renderSummary(); harness.api.renderHistory();
    const document=harness.w.document;
    assert.equal(document.getElementById('cashBalance').textContent,'S/ 1,850.00');
    assert.ok(document.getElementById('cashProfitability'));
    assert.match(document.getElementById('cashRealizedProfit').textContent,/-50\.00/);
    assert.match(document.getElementById('cashProfitability').textContent,/Proyecci[oó]n|SIMULACI[OÓ]N/i);
    const fields={cashSimOperating:300,cashSimPartner:100,cashSimTicket:500,cashSimRate:10,cashSimCollection:80,cashSimLoss:1,cashSimVariable:5,cashSimTarget:200};
    for(const [name,value] of Object.entries(fields)) document.getElementById(name).value=String(value);
    document.getElementById('cashSimCalculate').click();
    assert.match(document.getElementById('cashSimulationResult').textContent,/10,000\.00/);
    document.getElementById('cashHistoryType').value='EGRESO'; harness.api.renderHistory();
    assert.doesNotMatch(document.getElementById('cashHistory').textContent,/COBRO CUOTA/);
    harness.w.dispatchEvent(new harness.w.Event('storage'));
    assert.equal(document.getElementById('cashSimRate').value,'10');
    assert.equal(document.getElementById('cashHistoryType').value,'EGRESO');
    assert.equal(harness.w.localStorage.getItem(KEY),before); assert.equal(harness.commits.length,0);
  } finally { harness.close(); }
});

test('session changes remove financial projections and drafts, including stale native identities', async () => {
  const harness=await environment();
  try {
    harness.api.renderSummary();
    assert.ok(harness.w.document.getElementById('cashSimRate'));
    harness.w.document.getElementById('cashSimRate').value='99';
    harness.setAuth({uid:'another-fictional-user',role:'admin',ready:true},true);
    const panel=harness.w.document.getElementById('cashProfitability');
    assert.ok(!panel || panel.hidden || !panel.querySelector('#cashSimRate'));
    harness.setAuth({uid:'test-admin',role:'admin',ready:true},true); harness.api.renderSummary();
    assert.equal(harness.w.document.getElementById('cashSimRate').value,'');
    harness.w.firebaseAuthV2.auth.currentUser={uid:'stale-native-user'}; harness.api.renderSummary();
    assert.ok(!harness.w.document.getElementById('cashSimRate'));
  } finally { harness.close(); }
});

test('the existing partner Balance panel uses the same reconciled capital as the new financial control', async () => {
  const state=fixture(); state.cashMovements.push({...state.cashMovements[3],id:'duplicate-partner-view-receipt'});
  const harness=await environment(state);
  try {
    harness.load('app/partner-loans-ui.js'); harness.w.MiCarteraPartners.install(); harness.w.MiCarteraPartners.renderBalance();
    const panel=harness.w.document.getElementById('partnerBalanceSummary');
    assert.match(panel.textContent,/1,?950\.00/);
    assert.doesNotMatch(panel.textContent,/3,?114\.00/);
  } finally { harness.close(); }
});

test('a mismatched user cannot see the old cash total or movement details during the session transition', async () => {
  const harness=await environment();
  try {
    harness.api.renderSummary(); harness.api.renderHistory();
    harness.setAuth({uid:'different-fictional-owner',role:'admin',ready:true},true);
    assert.doesNotMatch(harness.w.document.getElementById('cashBalance').textContent,/1,850\.00/);
    assert.doesNotMatch(harness.w.document.getElementById('cashHistory').textContent,/COBRO CUOTA|2,000\.00/);
  } finally { harness.close(); }
});

test('malformed ledger shapes and aggregate overflow never certify a zero or imprecise available balance', async () => {
  for(const rows of [{invalid:true},[{id:'large-a',date:'2026-10-01',type:'INGRESO',amount:80000000000000,category:'APORTE_CAPITAL'},{id:'large-b',date:'2026-10-01',type:'INGRESO',amount:80000000000000,category:'APORTE_CAPITAL'}]]) {
    const harness=await environment({...fixture(),cashMovements:rows});
    try { const result=harness.analyze(); assert.equal(result.cash.valid,false); assert.equal(result.cash.available,null); }
    finally { harness.close(); }
  }
});

test('duplicate nested partner repayments cannot reduce the debt twice or mutate the original loan', async () => {
  const state=fixture(),loan=state.cashMovements[1].partnerLoan;
  loan.repayments.push({...loan.repayments[0]});
  const harness=await environment(state);
  try { const before=JSON.stringify(harness.get()); const result=harness.analyze(); assert.equal(result.partners.principal,800); assert.equal(result.partners.nextMonthlyCost,80); assert.equal(JSON.stringify(harness.get()),before); }
  finally { harness.close(); }
});

test('changing simulator assumptions invalidates stale results and nonnumeric booleans are rejected', async () => {
  const harness=await environment();
  try {
    assert.equal(typeof harness.api.simulate,'function');
    assert.equal(harness.api.simulate({...scenario,monthlyRate:true},harness.analyze()).valid,false);
    harness.api.renderSummary(); const document=harness.w.document;
    for(const [name,value] of Object.entries({cashSimOperating:300,cashSimPartner:100,cashSimTicket:500,cashSimRate:10,cashSimCollection:80,cashSimLoss:1,cashSimVariable:5,cashSimTarget:200})) document.getElementById(name).value=String(value);
    document.getElementById('cashSimCalculate').click();
    document.getElementById('cashSimTarget').value='900'; document.getElementById('cashSimTarget').dispatchEvent(new harness.w.Event('input'));
    assert.doesNotMatch(document.getElementById('cashSimulationResult').textContent,/Utilidad proyectada: S\/ 200\.00/);
  } finally { harness.close(); }
});

test('the external backend view consumes the same read-only Balance without runtime errors', async () => {
  const harness=await environment();
  try {
    const before=JSON.stringify(harness.get());
    harness.w.MI_CARTERA_V2_PILOT_CONFIG.backendMode='external';
    assert.doesNotThrow(()=>harness.api.renderSummary());
    assert.equal(harness.w.document.getElementById('cashBalance').textContent,'S/ 1,850.00');
    assert.match(harness.w.document.getElementById('sparkCashLiquidity').textContent,/1,775\.00/);
    assert.equal(JSON.stringify(harness.get()),before); assert.equal(harness.commits.length,0);
  } finally { harness.close(); }
});

test('the complete shell keeps home available capital consistent with Balance and refreshes only the active snapshot', async () => {
  const harness=await boot({fullShell:true,state:fixture()});
  try {
    harness.w.MiCarteraV2Dates.today=()=> '2026-10-21';
    const before=harness.w.localStorage.getItem(KEY);
    harness.w.show('cash');
    assert.equal(harness.w.document.getElementById('cashBalance').textContent,'S/ 1,850.00');
    harness.w.show('home');
    assert.equal(harness.w.document.getElementById('mCapitalAvailable').textContent,'S/1775.00');
    assert.equal(harness.w.localStorage.getItem(KEY),before); assert.equal(harness.commits.length,0);
  } finally { harness.close(); }
});

test('offline and pending synchronization are disclosed without changing the queue or resetting a scenario', async () => {
  const harness=await environment();
  try {
    const before=harness.w.localStorage.getItem(KEY);
    let status={configured:true,online:false,pending:2};
    harness.w.MiCarteraV2SyncBridge.status=()=>status;
    harness.api.renderSummary();
    const document=harness.w.document;
    assert.match(document.getElementById('cashDataStatus')?.textContent || '',/SIN INTERNET.*2 pendiente/);
    document.getElementById('cashSimRate').value='8';
    status={configured:true,online:true,pending:0}; harness.w.dispatchEvent(new harness.w.Event('mi-cartera-v2-sync'));
    assert.match(document.getElementById('cashDataStatus').textContent,/NUBE CONECTADA.*0 pendiente/);
    assert.equal(document.getElementById('cashSimRate').value,'8');
    assert.equal(harness.w.localStorage.getItem(KEY),before); assert.equal(harness.commits.length,0);
  } finally { harness.close(); }
});
