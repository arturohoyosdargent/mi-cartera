const {test} = require('node:test');
const assert = require('node:assert/strict');
const {boot, KEY} = require('./dom-harness.cjs');

function fixture(reserved = false) {
  return {
    clients:[],
    credits:[{id:'fictional-credit',date:'2026-10-01',capital:900,principalPaid:0,status:'ACTIVO'}],
    payments:[],
    cashMovements:[
      {id:'fictional-funding',date:'2026-10-01',type:'INGRESO',amount:reserved ? 1200 : 1000,category:'APORTE_CAPITAL'},
      {id:'fictional-disbursement',date:'2026-10-01',type:'EGRESO',amount:900,concept:'DESEMBOLSO_CREDITO',ref:'fictional-credit'},
      {id:'fictional-cost',date:'2026-10-02',type:'EGRESO',amount:200,category:'GASTO_OPERATIVO'},
      ...(reserved ? [{id:'fictional-reservation',date:'2026-11-01',type:'EGRESO',amount:200,category:'SERVICIOS'}] : [])
    ],
    audit:[],
    session:{actorId:'test-admin',role:'ADMIN'}
  };
}

test('native sign-out hides Balance, partner obligations and available capital before the cached grant refreshes', async () => {
  const harness = await boot({state:fixture()});
  try {
    harness.w.MiCarteraV2Dates.today = () => '2026-10-21';
    harness.load('core/partner-loans.js');
    harness.load('app/partner-loans-ui.js');
    harness.load('app/dashboard-parity-v2.js');
    harness.api = harness.w.MiCarteraV2CashMenu;
    harness.api.renderSummary();
    harness.api.renderHistory();
    assert.equal(harness.api.canRead(),true);
    assert.ok(harness.w.document.getElementById('cashSimRate'));
    const before = harness.w.localStorage.getItem(KEY);
    harness.w.firebaseAuthV2.auth.currentUser = null;
    harness.api.renderSummary();
    harness.api.renderHistory();
    harness.w.MiCarteraV2DashboardParity.render();
    harness.w.MiCarteraPartners.renderBalance();
    assert.equal(harness.api.canRead(),false);
    assert.equal(harness.w.document.getElementById('cashBalance').textContent,'—');
    assert.equal(harness.w.document.getElementById('mCapitalAvailable').textContent,'—');
    assert.equal(harness.w.document.getElementById('cashProfitability').hidden,true);
    assert.ok(!harness.w.document.getElementById('cashSimRate'));
    assert.equal(harness.w.document.getElementById('partnerBalanceSummary').hidden,true);
    assert.doesNotMatch(harness.w.document.getElementById('cashHistory').textContent,/DESEMBOLSO|APORTE|GASTO/);
    assert.equal(harness.w.localStorage.getItem(KEY),before);
    assert.equal(harness.commits.length,0);
    harness.w.firebaseAuthV2.auth.currentUser = {uid:'test-admin'};
    harness.api.renderSummary();
    assert.equal(harness.api.canRead(),true);
    assert.equal(harness.w.document.getElementById('cashSimRate').value,'');
    assert.match(harness.w.document.getElementById('cashBalance').textContent,/-100\.00/);
  } finally { harness.close(); }
});

test('additional financing covers both a cash deficit and a shortfall from reserved future expenses', async () => {
  for (const reserved of [false,true]) {
    const harness = await boot({state:fixture(reserved)});
    try {
      harness.w.MiCarteraV2Dates.today = () => '2026-10-21';
      const before = harness.w.localStorage.getItem(KEY);
      const api = harness.w.MiCarteraV2CashMenu;
      const balance = api.analyze(harness.get(),{asOf:'2026-10-21'});
      assert.equal(balance.cash.physical,reserved ? 100 : -100);
      assert.equal(balance.cash.available,-100);
      assert.equal(balance.portfolio.principal,900);
      const result = api.simulate({operatingCosts:200,partnerCosts:0,averageCredit:500,
        monthlyRate:10,collectionPercent:100,lossPercent:0,variableCost:0,targetProfit:100},balance);
      assert.equal(result.valid,true);
      assert.equal(result.targetCredits,6);
      assert.equal(result.targetCapital,3000);
      assert.equal(result.expectedProfit,100);
      assert.equal(result.additionalFunding,2200);
      assert.equal(harness.w.localStorage.getItem(KEY),before);
      assert.equal(harness.commits.length,0);
    } finally { harness.close(); }
  }
});
