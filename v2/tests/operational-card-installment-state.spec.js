const assert=require('assert'),fs=require('fs'),path=require('path');
const cards=fs.readFileSync(path.join(__dirname,'../app/operational-cards-v2.js'),'utf8');

// Operational cards must use installment balances as the UI source of truth.
assert.ok(cards.includes('function creditState(cr)'), 'creditState helper missing');
assert.ok(cards.includes("status=balance<=0?'PAGADA':paid>0?'PARCIAL':'PENDIENTE'"), 'installment-derived status missing');
assert.ok(cards.includes('return {total,paid,balance,status,collectible:balance>0}'), 'collectible must follow installment balance');

// A credit with scheduled balance must remain collectible even if its financial status changed.
assert.ok(cards.includes('const s=creditState(cr),active=s.collectible'), 'credit actions must use installment collectible state');
assert.ok(cards.includes('if(!creditState(cr).collectible)continue'), 'collection list must use installment collectible state');

// Visible credit and payment history must expose the same schedule-derived status/balance.
assert.ok(cards.includes('${esc(s.status)} · Total ${money(s.total)} · Pagado ${money(s.paid)} · Saldo ${money(s.balance)}'), 'credit card totals/status missing');
assert.ok(cards.includes('Estado actual: ${esc(s.status)} · Saldo ${money(s.balance)}'), 'payment history current status/balance missing');

console.log('V2 operational installment state: PASS');
