const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const durable=read('v2/app/durable-actions-stable6.js'),cards=read('v2/app/operational-cards-v2.js'),guard=read('v2/app/version-guard.js'),gate=read('v2/app/operation-commit-gate.js'),shell=read('v2/app/operational-shell.html');
assert.match(durable,/async function setPromise\(creditId\)/);
assert.match(durable,/PAYMENT_PROMISE_CREATED/);
assert.match(durable,/PAYMENT_PROMISE_CANCELLED/);
assert.match(cards,/MiCarteraV2Cards\.setPromise/);
assert.match(cards,/MiCarteraV2Cards=\{setPromise,cancelPromise,promiseState,reversePayment/);
assert.match(durable,/async function reversePayment\(paymentId\)/);
assert.match(durable,/PAYMENT_REVERSED/);
assert.match(gate,/await versionGuard\.ensureReady\(\)/);
assert.match(gate,/await authGate\.refreshMembership\(\)/);
assert.match(guard,/const wasReady=state\.ready/);
assert(!/state\.ready=false;state\.reason='VERSION_CHECK_RUNNING'/.test(guard),'routine verify must not drop a valid ready state');
assert.match(shell,/operational-cards-v2\.js\?v=v2-pilot-/);
assert.match(shell,/durable-actions-v2\.js\?v=v2-pilot-/);
console.log('payment promise/reversal/write-gate regression: OK');

(()=>{const fs=require('fs'),assert=require('assert');const a=fs.readFileSync('v2/app/durable-actions-stable6.js','utf8'),cards=fs.readFileSync('v2/app/operational-cards-v2.js','utf8'),shell=fs.readFileSync('v2/app/operational-shell.html','utf8');assert.ok(a.includes('root.MiCarteraV2DurableActions={')&&a.includes('renewInterest,refinance'),'renewal runtime exports must exist');assert.ok(cards.includes("MiCarteraV2DurableActions?.renewInterest")&&cards.includes("MiCarteraV2DurableActions?.refinance"),'renewal buttons must resolve durable runtime');assert.ok(shell.indexOf('durable-actions-stable6.js')<shell.indexOf('operational-cards-v2.js'),'durable actions must be registered before cards become interactive');console.log('V2 renewal runtime exports: PASS')})();
