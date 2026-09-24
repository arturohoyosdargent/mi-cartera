const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const durable=read('v2/app/durable-actions-stable6.js'),writes=read('v2/app/write-actions-stable12.js'),promise=read('v2/app/promise-actions-stable11.js'),cards=read('v2/app/operational-cards-v2.js'),guard=read('v2/app/version-guard.js'),gate=read('v2/app/operation-commit-gate.js'),shell=read('v2/app/operational-shell.html');
assert.match(promise,/async function setPromise\(creditId\)/);
assert.match(promise,/PAYMENT_PROMISE_CREATED/);
assert.match(promise,/PAYMENT_PROMISE_CANCELLED/);
assert.match(cards,/MiCarteraV2Cards\.setPromise/);
assert.match(cards,/MiCarteraV2Cards=\{setPromise,cancelPromise,promiseState,reversePayment/);
assert.match(writes,/async function reversePayment\(paymentId\)/);
assert.match(writes,/PAYMENT_REVERSED/);
assert.match(gate,/await versionGuard\.ensureReady\(\)/);
assert.match(gate,/await authGate\.refreshMembership\(\)/);
assert.match(guard,/const wasReady=state\.ready/);
assert(!/state\.ready=false;state\.reason='VERSION_CHECK_RUNNING'/.test(guard),'routine verify must not drop a valid ready state');
assert.match(shell,/operational-cards-v2\.js\?v=v2-pilot-/);
assert.match(shell,/durable-actions-stable6\.js\?v=v2-pilot-/);
console.log('payment promise/reversal/write-gate regression: OK');

(()=>{const fs=require('fs'),assert=require('assert');const a=fs.readFileSync('v2/app/durable-actions-stable6.js','utf8'),cards=fs.readFileSync('v2/app/operational-cards-v2.js','utf8'),shell=fs.readFileSync('v2/app/operational-shell.html','utf8');assert.ok(a.includes('root.MiCarteraV2DurableActions={')&&a.includes('renewInterest,refinance'),'renewal runtime exports must exist');assert.ok(cards.includes("renewalFn('renewInterest')")&&cards.includes("renewalFn('refinance')"),'renewal buttons must resolve or recover durable runtime');assert.ok(shell.indexOf('durable-actions-stable6.js')<shell.indexOf('operational-cards-v2.js'),'durable actions must be registered before cards become interactive');console.log('V2 renewal runtime exports: PASS')})();

assert.ok(writes.includes('addClient')&&writes.includes('addCredit')&&writes.includes('collect')&&writes.includes('manualCash'),'stable-12 isolated write runtime must expose client, credit, payment and cash actions');
assert.ok(cards.includes('MiCarteraV2WriteActions?.reversePayment'),'payment reversal card must use isolated write runtime');

const agendaPromise=read('v2/app/agenda-v2.js');assert.ok(agendaPromise.includes("kind:'PROMISE'")&&agendaPromise.includes('COMPROMISO DE PAGO'),'agenda must surface promises separately from contractual debt');assert.ok(agendaPromise.includes("dues=list.filter(x=>x.kind!=='PROMISE')"),'promise amounts must not inflate contractual collection totals');

// Android runtime regression: critical writes must never depend directly on V2UI durable bootstrap.
assert.ok(cards.includes("MiCarteraV2Cards.collect")&&cards.includes("writeFn('collect')")&&cards.includes("writeFn('reversePayment')"),'collect and reversal must use self-healing write runtime');
