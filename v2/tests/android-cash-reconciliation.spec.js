'use strict';
// Targeted Android cash audit. All data is fictional and confined to Happy DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');

const raw = value => JSON.parse(JSON.stringify(value));
const fixture = (date, cashMovements, extra = {}) => ({
  clients: [], credits: [], payments: [], audit: [], cashMovements,
  session: {actorId: 'test-admin', role: 'ADMIN'}, ...extra
});
const cash = (id, date, type, amount, extra = {}) => ({id, date, type, amount, version: 1, ...extra});

test('Android cash audit: one disbursement, net refinancing and one collection reconcile without counting portfolio twice', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    const payment = {id: 'fictional-pay', operationId: 'fictional-payment-op', creditId: 'fictional-credit',
      date, amount: 70, capitalAmount: 60, interestAmount: 10, penaltyAmount: 0, concept: 'CUOTA', version: 1};
    const state = fixture(date, [
      cash('fictional-capital', date, 'INGRESO', 1000, {category: 'APORTE_CAPITAL'}),
      cash('fictional-disbursement', date, 'EGRESO', 300, {concept: 'DESEMBOLSO_CREDITO', ref: 'fictional-credit'}),
      cash('fictional-refinance', date, 'EGRESO', 50, {concept: 'DESEMBOLSO_REFINANCIAMIENTO', ref: 'fictional-refinanced'}),
      cash('fictional-receipt', date, 'INGRESO', 70, {concept: 'COBRO_CUOTA', ref: payment.id}),
      cash('fictional-receipt-copy', date, 'INGRESO', 70, {concept: 'COBRO_CUOTA', ref: 'fictional-pay-copy'})
    ], {
      payments: [payment, {...payment, id: 'fictional-pay-copy'}],
      credits: [{id: 'fictional-credit', clientId: 'fictional-client', date, capital: 300,
        principalPaid: 60, status: 'ACTIVO', version: 2, schedule: []}]
    });
    const before = JSON.stringify(state);
    const result = h.w.MiCarteraV2CashMenu.analyze(state, {asOf: date});
    assert.equal(result.cash.physical, 720);
    assert.equal(result.cash.available, 720);
    assert.equal(result.cash.valid, true);
    assert.equal(result.period.income, 1070);
    assert.equal(result.period.expense, 350);
    assert.equal(result.period.activity.disbursed, 350);
    assert.equal(result.period.activity.principalRecovered, 60);
    assert.equal(result.period.activity.interestCollected, 10);
    assert.equal(result.portfolio.principal, 240);
    assert.equal(JSON.stringify(state), before);
  } finally { await h.close(); }
});

test('Android cash audit: an actual deficit remains negative and future collections cannot fund it', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    const state = fixture(date, [
      cash('fictional-funding', date, 'INGRESO', 100, {category: 'APORTE_CAPITAL'}),
      cash('fictional-paid-loan', date, 'EGRESO', 150, {concept: 'DESEMBOLSO_CREDITO'}),
      cash('fictional-reserve', '2099-01-01', 'EGRESO', 30, {category: 'GASTO_OPERATIVO'}),
      cash('fictional-future-receipt', '2099-01-01', 'INGRESO', 900, {category: 'OTRO_INGRESO'})
    ]);
    const result = h.w.MiCarteraV2CashMenu.analyze(state, {asOf: date});
    assert.equal(result.cash.valid, true);
    assert.equal(result.cash.physical, -50);
    assert.equal(result.cash.futureExpenses, 30);
    assert.equal(result.cash.available, -80);
    assert.equal(result.period.closing, -50);
  } finally { await h.close(); }
});

test('Android cash audit: connection events preserve physical cash instead of subtracting future expenses', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    h.set(fixture(date, [
      cash('fictional-real-funding', date, 'INGRESO', 100, {category: 'APORTE_CAPITAL'}),
      cash('fictional-future-expense', '2099-01-01', 'EGRESO', 200, {category: 'GASTO_OPERATIVO'})
    ]));
    h.w.MiCarteraV2CashMenu.renderSummary();
    const before = h.w.document.getElementById('cashBalance').textContent;
    assert.equal(h.w.MiCarteraV2CashMenu.analyze(h.get()).cash.physical, 100);
    assert.equal(h.w.MiCarteraV2CashMenu.analyze(h.get()).cash.available, -100);
    h.w.dispatchEvent(new h.w.Event('offline'));
    assert.equal(h.w.document.getElementById('cashBalance').textContent, before,
      'Offline must not replace physical S/ 100 by the S/ -100 balance including a future expense');
    h.w.dispatchEvent(new h.w.Event('online'));
    assert.equal(h.w.document.getElementById('cashBalance').textContent, before);
  } finally { await h.close(); }
});

test('Android cash audit: controller reports the same central, current, non-deleted cash as reconciliation', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    h.set(fixture(date, [
      cash('fictional-current-funding', date, 'INGRESO', 100, {category: 'APORTE_CAPITAL'}),
      cash('fictional-worker-expense', date, 'EGRESO', 200, {category: 'GASTO_OPERATIVO', cashAccountId: 'fictional-worker'}),
      cash('fictional-deleted-expense', date, 'EGRESO', 300, {category: 'GASTO_OPERATIVO', tombstone: true}),
      cash('fictional-future-cost', '2099-01-01', 'EGRESO', 400, {category: 'GASTO_OPERATIVO'})
    ]));
    const before = JSON.stringify(h.get());
    h.w.V2UI.render();
    assert.equal(h.w.MiCarteraV2CashMenu.analyze(h.get()).cash.physical, 100);
    assert.equal(h.w.V2UI.report().cash, 100);
    assert.equal(JSON.stringify(h.get()), before);
  } finally { await h.close(); }
});

test('Android cash audit: connection events hide cash when the active identity does not own the displayed session', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    h.set(fixture(date, [cash('fictional-private-funding', date, 'INGRESO', 100, {category: 'APORTE_CAPITAL'})]));
    h.w.MiCarteraV2CashMenu.renderSummary();
    h.setAuth({uid: 'fictional-other-admin', role: 'admin', ready: true, authenticated: true, member: true, routeIds: []});
    assert.equal(h.w.MiCarteraV2CashMenu.canRead(), false);
    h.w.dispatchEvent(new h.w.Event('offline'));
    assert.equal(h.w.document.getElementById('cashBalance').textContent, '—');
    assert.equal(h.w.V2UI.report().cash, null);
  } finally { await h.close(); }
});

test('Android cash audit: connection events keep invalid cash blocked instead of turning it into zero', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    h.set(fixture(date, [cash('fictional-corrupt-expense', date, 'EGRESO', 'invalid', {category: 'GASTO_OPERATIVO'})]));
    assert.equal(h.w.MiCarteraV2CashMenu.analyze(h.get()).cash.valid, false);
    h.w.dispatchEvent(new h.w.Event('offline'));
    assert.equal(h.w.document.getElementById('cashBalance').textContent, 'Revisar datos');
    assert.equal(h.w.V2UI.report().cash, null);
  } finally { await h.close(); }
});

test('Android cash audit: cash account filtering follows the latest record version', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    const state = fixture(date, [
      cash('fictional-funding-revision', date, 'INGRESO', 100, {category: 'APORTE_CAPITAL'}),
      cash('fictional-reassigned-expense', date, 'EGRESO', 100, {cashAccountId: 'leader', category: 'GASTO_OPERATIVO'}),
      cash('fictional-reassigned-expense', date, 'EGRESO', 100, {cashAccountId: 'fictional-worker', category: 'GASTO_OPERATIVO', version: 2})
    ]);
    const before = JSON.stringify(state);
    const result = h.w.MiCarteraV2CashMenu.analyze(state, {asOf: date});
    assert.equal(result.cash.physical, 100, 'An older leader version must not revive after the newer worker version is filtered out');
    assert.equal(result.period.expense, 0);
    assert.equal(JSON.stringify(state), before);
  } finally { await h.close(); }
});

test('Android cash audit: newly accepted credit has a dated capital position', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    const state = h.get();
    state.cashMovements = [cash('fictional-start-capital', date, 'INGRESO', 1000, {category: 'APORTE_CAPITAL'})];
    h.set(state);
    for (const [id, value] of Object.entries({cClient: 'c1', cCapital: '100', cRate: '10', cTerm: '1', cFreq: 'daily', cFirst: '2099-01-01', cDate: date})) {
      h.w.document.getElementById(id).value = value;
    }
    h.w.document.getElementById('cAccepted').checked = true;
    await h.w.MiCarteraV2DurableActions.addCredit();
    assert.equal(h.alerts.length, 0, JSON.stringify(h.alerts));
    const accepted = h.get();
    assert.equal(accepted.credits.length, 1);
    const result = h.w.MiCarteraV2CashMenu.analyze(accepted, {asOf: date});
    assert.equal(result.cash.physical, 900);
    assert.equal(result.portfolio.valid, true, JSON.stringify(raw(result.warnings)));
    assert.equal(result.portfolio.principal, 100);
  } finally { await h.close(); }
});

test('Android cash audit: an undated credit remains invalid without an unambiguous matching disbursement', async () => {
  const h = await boot();
  try {
    const date = h.w.MiCarteraV2Dates.today();
    const credit = {id: 'fictional-undated-credit', clientId: 'fictional-undated-client', capital: 100,
      principalPaid: 0, status: 'ACTIVO', version: 1, schedule: []};
    const disbursement = (id, day, amount) => cash(id, day, 'EGRESO', amount,
      {concept: 'DESEMBOLSO_CREDITO', ref: credit.id});
    for (const rows of [[], [disbursement('fictional-wrong-amount', date, 50)],
      [disbursement('fictional-ambiguous-first', '2000-01-01', 100), disbursement('fictional-ambiguous-second', date, 100)]]) {
      const result = h.w.MiCarteraV2CashMenu.analyze(fixture(date, rows, {credits: [credit]}), {asOf: date});
      assert.equal(result.portfolio.valid, false);
      assert.equal(result.portfolio.principal, 0);
      assert.match(result.warnings.join(' '), /Capital de crédito inválido/);
    }
  } finally { await h.close(); }
});
