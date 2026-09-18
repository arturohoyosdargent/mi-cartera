const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const code=fs.readFileSync(require('path').join(__dirname,'../app/date-utils-v2.js'),'utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(code,context);
const D=context.window.MiCarteraV2Dates;

assert.strictEqual(D.normalize('18/09/2026'),'2026-09-18');
assert.strictEqual(D.normalize('2026/09/18'),'2026-09-18');
assert.strictEqual(D.fromInstallment({dueDate:'18-09-2026'}),'2026-09-18');
assert.strictEqual(D.balance({amount:300,paid:120}),180);
assert.strictEqual(D.balance({amount:300,balance:0}),0);
assert.strictEqual(D.isOverdue({date:'18/09/2026',amount:100},'2026-09-19'),true);
assert.strictEqual(D.isToday({dueDate:'2026-09-18',amount:100},'2026-09-18'),true);
assert.strictEqual(D.isPaid({amount:100,balance:0}),true);

console.log('V2 date and installment normalization: PASS');
