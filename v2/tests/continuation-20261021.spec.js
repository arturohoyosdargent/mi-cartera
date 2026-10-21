'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SOURCE = path.resolve(__dirname, '..');
const {boot} = require('./dom-harness.cjs');
const Queue = require('../app/core/offline-operation-queue.js');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture(context) {
  const harness = await boot({fullShell:true});
  context.after(() => harness.close());
  harness.w.MiCarteraV2Dates.today = () => '2026-10-21';
  const data = harness.get();
  data.clients = [{id:'fictional-client',name:'José Álvarez FICTICIO',dni:'00000001',
    phone:'+51 999-000-111',reference:'Mercado Azul FICTICIO',routeId:'fictional-route'}];
  data.credits = [{id:'fictional-credit',clientId:'fictional-client',capital:100,total:120,
    principalPaid:0,interestPaid:0,penaltyPaid:0,rate:20,term:4,freq:'weekly',
    status:'ACTIVO',version:1,date:'2026-10-01',routeId:'fictional-route',
    workerId:'fictional-worker',beneficiaryReference:'Beneficiaria Rosa FICTICIA',
    schedule:[1,2,3,4].map(number => ({number,date:'2026-10-'+String(number*7).padStart(2,'0'),
      amount:30,paid:0,balance:30,status:'PENDIENTE'}))}];
  data.payments = [];
  data.audit = [];
  data.cashMovements = [{id:'fictional-disbursement',ref:'fictional-credit',type:'EGRESO',
    concept:'DESEMBOLSO_CREDITO',amount:100,date:'2026-10-01',version:1}];
  harness.set(data);
  return harness;
}

test('certified catalog restores the newly approved SHA and preserves the historical stable', async context => {
  const harness = await fixture(context);
  const catalog = harness.w.MiCarteraV2StableCatalog;
  assert.equal(catalog.current.sha, 'b22816b87eced0eb736e7a2e269d0d9194a25302');
  assert.equal(catalog.current.tag, 'stable-rollback-v2-20261021-b22816b');
  assert.equal(catalog.previous.sha, '43a7afa2ab629cdc7b4c7db9856dbd10eae61f71');
  assert.ok(Object.isFrozen(catalog.current));
  assert.equal(harness.commits.length, 0);
});

for (const method of ['renewInterest','refinance']) {
  test(method+': beneficiary and legacy route survive without moving predecessor commitments', async context => {
    const harness = await fixture(context), data = harness.get();
    delete data.credits[0].routeId;
    data.credits[0].route = 'fictional-legacy-route';
    data.credits[0].paymentPromise = {id:'fictional-previous-promise',date:'2026-10-25',status:'ACTIVE',amount:30};
    data.credits[0].schedule[0].paymentPromise = clone(data.credits[0].paymentPromise);
    harness.set(data);
    harness.w.MiCarteraV2SharePreview = {previewCredit(){}};
    const pending = harness.w.V2UI[method]('fictional-credit'), document = harness.w.document;
    document.getElementById('v2RenewDate').value = '2026-10-21';
    document.getElementById('v2RenewFirstDate').value = '2026-10-28';
    if (method === 'refinance') document.getElementById('v2RenewCapital').value = '150';
    document.getElementById('v2RenewReview').onclick();
    const accepted = document.getElementById('v2RenewAccepted');
    assert.ok(accepted, harness.alerts.join('\n'));
    accepted.checked = true;
    accepted.onchange();
    document.getElementById('v2ConfirmRenewal').onclick();
    await pending;
    const after = harness.get(), successor = after.credits.find(credit => credit.renewedFrom === 'fictional-credit');
    assert.ok(successor, harness.alerts.join('\n'));
    assert.equal(successor.beneficiaryReference, data.credits[0].beneficiaryReference);
    assert.equal(successor.routeId, 'fictional-legacy-route');
    assert.equal(successor.workerId, 'fictional-worker');
    assert.ok(!successor.paymentPromise);
    assert.ok(successor.schedule.every(installment => !installment.paymentPromise));
    assert.deepEqual(after.credits.find(credit => credit.id === 'fictional-credit').paymentPromise,
      data.credits[0].paymentPromise);
    assert.equal(harness.commits.length, 1);
    for (const entity of harness.commits[0].entities.filter(entity => ['payments','entries','expenses'].includes(entity.collection)))
      assert.equal(entity.data.routeId, 'fictional-legacy-route');
  });
}

test('every active installment commitment is visible, nearest promise leads and settled or renewed obligations disappear', async context => {
  const harness = await fixture(context), data = harness.get();
  data.credits[0].schedule[0].paymentPromise = {id:'fictional-promise-later',date:'2026-10-25',status:'ACTIVE',amount:30};
  data.credits[0].schedule[1].paymentPromise = {id:'fictional-promise-earlier',date:'2026-10-20',status:'ACTIVE',amount:30};
  harness.set(data);
  const document = harness.w.document;
  document.getElementById('agendaFrom').value = '2026-10-01';
  document.getElementById('agendaTo').value = '2026-10-31';
  harness.w.MiCarteraV2Agenda.render();
  const header = document.querySelector('.v2-agenda-client-total');
  assert.match(header.textContent, /2026-10-20/);
  const details = Array.from(document.querySelectorAll('.v2-agenda-detail-row'));
  assert.match(details[0].textContent, /COMPROMISO VIGENTE.*2026-10-25/);
  assert.match(details[1].textContent, /COMPROMISO INCUMPLIDO.*2026-10-20/);
  assert.deepEqual(harness.get(), data);
  data.credits[0].schedule[1].balance = 0;
  data.credits[0].schedule[1].paid = 30;
  harness.set(data);
  harness.w.MiCarteraV2Agenda.render();
  assert.ok(!Array.from(document.querySelectorAll('.v2-agenda-detail-row')).some(row => /2026-10-20/.test(row.textContent)));
  data.credits[0].status = 'RENOVADO';
  harness.set(data);
  harness.w.MiCarteraV2Agenda.render();
  assert.equal(document.querySelectorAll('.v2-agenda-promise-label').length, 0);
  assert.equal(harness.commits.length, 0);
});

test('nested contradictory operation identity cannot authorize credit deletion', async context => {
  const harness = await fixture(context), before = harness.get();
  harness.w.MiCarteraV2SyncBridge.submit = async operation => {
    harness.commits.push(clone(operation));
    return {status:'COMMITTED',operation:{operationId:'fictional-other-operation'}};
  };
  await harness.w.MiCarteraV2Cards.deleteCredit('fictional-credit');
  assert.deepEqual(harness.get(), before);
  assert.ok(harness.alerts.some(message => /otra operación/.test(message)));
});

test('unverifiable paid counters and contradictory installment balances block destructive deletion', async context => {
  const harness = await fixture(context), original = harness.get();
  for (const kind of ['invalid-counter','negative-paid','invalid-balance','excess-balance']) {
    const before = clone(original);
    if (kind === 'invalid-counter') before.credits[0].principalPaid = 'sin-confirmar';
    if (kind === 'negative-paid') before.credits[0].schedule[0].paid = -10;
    if (kind === 'invalid-balance') before.credits[0].schedule[0].balance = 'sin-confirmar';
    if (kind === 'excess-balance') before.credits[0].schedule[0].balance = 31;
    harness.set(before);
    const submitted = harness.commits.length;
    await harness.w.MiCarteraV2Cards.deleteCredit('fictional-credit');
    assert.equal(harness.commits.length, submitted, kind);
    assert.deepEqual(harness.get(), before, kind);
  }
});

function queueFixture() {
  const values = new Map(), key = 'fictional-queue';
  const storage = {getItem:name => values.get(name)||null,setItem:(name,value) => values.set(name,value)};
  return {storage,key,queue:Queue.createQueue(storage,key)};
}

for (const accepted of [true,false]) {
  test('offline queue retains an operation enqueued during '+(accepted?'acceptance':'retryable failure'), async () => {
    const {queue} = queueFixture();
    queue.enqueue({operationId:'fictional-first',type:'CREDIT_CREATE'});
    let settle;
    const pending = queue.flush(() => new Promise((resolve,reject) => {settle = accepted ? resolve : reject;}), 1000);
    queue.enqueue({operationId:'fictional-second',type:'PAYMENT_CREATE'});
    settle(accepted ? {status:'COMMITTED'} : Error('UNAVAILABLE'));
    await pending;
    assert.deepEqual(queue.inspect().map(item => item.id), ['fictional-first','fictional-second']);
    const submitted = [];
    await queue.flush(async operation => {submitted.push(operation.operationId);return {status:'ALREADY_APPLIED'};}, 500000);
    assert.deepEqual(submitted, accepted ? ['fictional-second'] : ['fictional-first','fictional-second']);
    assert.equal(queue.inspect().filter(item => item.status === 'SINCRONIZADO').length, 2);
  });
}

test('offline completion cannot erase administrative no-replay closure or another queued operation', async () => {
  const {queue,storage,key} = queueFixture();
  queue.enqueue({operationId:'fictional-closed',type:'INTEREST_RENEWAL'});
  let resolve;
  const pending = queue.flush(() => new Promise(settle => {resolve = settle;}), 1000);
  const latest = JSON.parse(storage.getItem(key));
  latest[0].status = 'CERRADO_ADMIN';
  latest[0].administrativeClosure = {noReplay:true,reason:'FICTICIO'};
  storage.setItem(key, JSON.stringify(latest));
  queue.enqueue({operationId:'fictional-preserved',type:'PAYMENT_CREATE'});
  resolve({status:'COMMITTED'});
  await pending;
  const result = JSON.parse(storage.getItem(key));
  assert.equal(result[0].status, 'CERRADO_ADMIN');
  assert.equal(result[0].administrativeClosure.noReplay, true);
  assert.equal(result[1].id, 'fictional-preserved');
  const submitted = [];
  await queue.flush(async operation => {submitted.push(operation.operationId);return {status:'APPLIED'};});
  assert.deepEqual(submitted, ['fictional-preserved']);
});

test('route administration rejects a stale gate when Firebase Auth belongs to another user or is signed out', async context => {
  const harness = await fixture(context), actions = harness.w.MiCarteraV2CommercialActions;
  for (const currentUser of [{uid:'fictional-other-user'},null]) {
    harness.w.firebaseAuthV2.auth.currentUser = currentUser;
    const before = harness.get();
    assert.equal(actions.canView(), false);
    await assert.rejects(() => actions.route({name:'Ruta FICTICIA no autorizada'}), /sesión|permisos/i);
    assert.deepEqual(harness.get(), before);
    assert.equal(harness.commits.length, 0);
  }
});

test('late route ACK cannot paint or merge another Firebase identity without an auth event', async context => {
  const harness = await fixture(context), before = harness.get();
  harness.w.MiCarteraV2SyncBridge.submit = async operation => {
    harness.commits.push(clone(operation));
    harness.w.firebaseAuthV2.auth.currentUser = {uid:'fictional-other-user'};
    return {status:'COMMITTED',operationId:operation.operationId};
  };
  await assert.rejects(() => harness.w.MiCarteraV2CommercialActions.route({name:'Ruta FICTICIA tardía'}), /sesión|permisos/i);
  assert.deepEqual(harness.get(), before);
});

test('a closed operation waiting behind an in-flight item must never reach the offline executor', async () => {
  const {queue,storage,key} = queueFixture();
  queue.enqueue({operationId:'fictional-in-flight',type:'PAYMENT_CREATE'});
  queue.enqueue({operationId:'fictional-closed-before-turn',type:'INTEREST_RENEWAL'});
  const submitted = [];
  let resolve;
  const pending = queue.flush(async operation => {
    submitted.push(operation.operationId);
    if (operation.operationId === 'fictional-in-flight') return new Promise(settle => {resolve = settle;});
    return {status:'COMMITTED'};
  });
  const latest = JSON.parse(storage.getItem(key));
  latest[1].status = 'CERRADO_ADMIN';
  latest[1].noReplay = true;
  storage.setItem(key, JSON.stringify(latest));
  resolve({status:'COMMITTED'});
  await pending;
  assert.deepEqual(submitted, ['fictional-in-flight']);
  assert.equal(queue.inspect()[1].status, 'CERRADO_ADMIN');
});

test('assignment never grants new route access through tombstoned clients or credits', async context => {
  const harness = await fixture(context), original = harness.get();
  original.commercial = [{id:'fictional-route',recordType:'ROUTE',active:true,version:1},
    {id:'fictional-target-worker',workerId:'fictional-target-worker',recordType:'WORKER',
      active:true,routeId:'fictional-route',version:1}];
  for (const kind of ['client','credit']) {
    const before = clone(original);
    if (kind === 'client') before.clients[0].tombstone = true;
    if (kind === 'credit') before.credits[0].tombstone = true;
    harness.set(before);
    const submitted = harness.commits.length;
    await assert.rejects(() => harness.w.MiCarteraV2CommercialActions.assign({
      clientId:'fictional-client',creditId:'fictional-credit',workerId:'fictional-target-worker'
    }), /no encontrado|eliminado/i);
    assert.equal(harness.commits.length, submitted);
    assert.deepEqual(harness.get(), before);
  }
});

test('assignment searches clients by normalized name, DNI, phone and reference without implicit reassignment', async context => {
  const harness = await fixture(context), data = harness.get();
  data.clients.push({id:'fictional-second-client',name:'María Peña FICTICIA',dni:'00000002',
    phone:'999 222 333',reference:'Taller Verde FICTICIO'});
  data.clients.push({id:'fictional-deleted-client',name:'María eliminada FICTICIA',tombstone:true});
  data.commercial = [{id:'fictional-route',recordType:'ROUTE',active:true,version:1},
    {id:'fictional-target-worker',workerId:'fictional-target-worker',recordType:'WORKER',
      active:true,routeId:'fictional-route',version:1}];
  harness.set(data);
  harness.w.MiCarteraV2CommercialUI.render();
  harness.w.MiCarteraV2CommercialUI.openForm('assign');
  const document = harness.w.document, search = document.getElementById('v2ComClientSearch');
  assert.ok(search, 'assignment has no client search control');
  const select = document.getElementById('v2ComClient');
  for (const query of ['maria pena','00000002','999222333','taller verde']) {
    search.value = query;
    search.oninput();
    const matching = Array.from(select.options).filter(option => option.value);
    assert.deepEqual(matching.map(option => option.value), ['fictional-second-client'], query);
  }
  assert.equal(select.value, '', 'a search must not silently assign the first matching client');
  select.value = 'fictional-second-client';
  select.onchange();
  document.getElementById('v2ComCreditDetails').textContent = 'FICTICIO previous choice';
  search.value = 'jose alvarez';
  search.oninput();
  assert.equal(select.value, '');
  assert.equal(document.getElementById('v2ComCredit').value, '');
  assert.equal(document.getElementById('v2ComCreditDetails').textContent, '');
  search.value = 'sin coincidencias FICTICIAS';
  search.oninput();
  assert.equal(Array.from(select.options).filter(option => option.value).length, 0);
  assert.deepEqual(harness.get(), data);
  assert.equal(harness.commits.length, 0);
  search.value = 'maria pena';
  search.oninput();
  select.value = 'fictional-second-client';
  select.onchange();
  document.getElementById('v2ComWorker').value = 'fictional-target-worker';
  const mode = document.getElementById('v2ComAssignScope');
  mode.value = 'CLIENT';
  mode.onchange();
  await document.getElementById('v2CommercialForm').onsubmit({preventDefault(){}});
  const assigned = harness.get();
  assert.equal(assigned.clients.find(client => client.id === 'fictional-second-client').workerId, 'fictional-target-worker');
  assert.deepEqual(assigned.credits, data.credits);
  assert.deepEqual(assigned.payments, data.payments);
  assert.deepEqual(assigned.cashMovements, data.cashMovements);
  assert.equal(harness.commits.length, 1);
});
