const assert=require('assert'),fs=require('fs'),path=require('path');
const cards=fs.readFileSync(path.join(__dirname,'../app/operational-cards-v2.js'),'utf8');

// Operational cards must derive visible installment status and balances from the schedule.
assert.ok(cards.includes('function installmentState(cr)'), 'installmentState helper missing');
assert.ok(cards.includes("status:balance<=0?'PAGADA':paid>0?'PARCIAL':'PENDIENTE'"), 'installment-derived status missing');
assert.ok(cards.includes('collectible:active&&balance>0'), 'collectible must require an active credit with installment balance');

// Credit actions and the collection list must share the same active + outstanding-balance rule.
assert.ok(cards.includes('const c=client(d,cr.clientId),s=installmentState(cr);'), 'credit cards must use installmentState');
assert.ok(cards.includes("${s.collectible?button('💵 Cobrar'"), 'collect action must follow installment collectible state');
assert.ok(cards.includes('if(!installmentState(cr).collectible)continue'), 'collection list must use installment collectible state');

// Visible credit and payment history must expose the same schedule-derived status/balance.
assert.ok(cards.includes('${esc(s.status)} · Capital ${money(cr.capital)} · Total ${money(s.total)} · Pagado ${money(s.paid)} · Saldo ${money(s.balance)}'), 'credit card totals/status missing');
assert.ok(cards.includes('Estado actual: ${esc(s.status)} · Saldo ${money(s.balance)}'), 'payment history current status/balance missing');

console.log('V2 operational installment state: PASS');
