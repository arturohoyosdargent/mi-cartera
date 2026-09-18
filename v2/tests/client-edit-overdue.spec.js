const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const app=path.join(__dirname,'../app');
const shell=fs.readFileSync(path.join(app,'operational-shell.html'),'utf8');
const sw=fs.readFileSync(path.join(app,'service-worker.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(app,'release.json'),'utf8'));
const cards=fs.readFileSync(path.join(app,'operational-cards-v2.js'),'utf8');
const editor=fs.readFileSync(path.join(app,'client-edit-v2.js'),'utf8');
const overdue=fs.readFileSync(path.join(app,'credit-overdue-v2.js'),'utf8');
const preview=fs.readFileSync(path.join(app,'share-preview-v2.js'),'utf8');
const durable=fs.readFileSync(path.join(app,'durable-actions-v2.js'),'utf8');

assert.ok(shell.includes('<script src="client-edit-v2.js"></script>'),'client edit module must load in the shell');
assert.ok(shell.includes('<script src="credit-overdue-v2.js"></script>'),'overdue module must load in the shell');
assert.ok(sw.includes("'./client-edit-v2.js'")&&sw.includes("'./credit-overdue-v2.js'"),'new modules must be cached by the PWA');
assert.ok(sw.includes(`const BUILD='${release.build}'`),'service worker and release build must match');
assert.ok(cards.includes('data-client-card')&&cards.includes('data-credit-card'),'cards must expose stable client and credit identifiers');
assert.ok(editor.includes('CLIENT_UPDATED')&&editor.includes("type:'CLIENT_UPDATE'")&&editor.includes('Guardar cambios'),'editing must be an auditable durable client update');
assert.ok(editor.includes('address')&&editor.includes('phone')&&editor.includes('routeId'),'editing must preserve/update contact and routing fields');
assert.ok(overdue.includes('q.date')&&overdue.includes("'OVERDUE'")&&overdue.includes('v2-overdue-label'),'overdue state must derive from schedule dates and be visible');
assert.ok(overdue.includes('api.filter=filter'),'credit filter must use the schedule-derived status');
assert.ok(preview.includes('Estado de cuotas')&&preview.includes('vencida'),'credit preview must show payment state before sharing');
assert.ok(durable.includes('MiCarteraV2SharePreview?.previewPayment'),'recording a payment must offer a preview before sharing its receipt');

const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelectorAll(){return[]},createElement(){return {style:{},appendChild(){}}}};
const window={addEventListener(){},localStorage:{getItem(){return '{}'}}};
const context={window,document,localStorage:window.localStorage,setTimeout,clearTimeout,console};
vm.createContext(context);
vm.runInContext(overdue,context);
const result=window.MiCarteraV2CreditOverdue.overdueFor({schedule:[
  {date:'2026-09-10',amount:100,balance:100},
  {date:'2026-09-12',amount:80,balance:20},
  {date:'2099-01-01',amount:50,balance:50},
  {date:'2026-09-01',amount:40,balance:0}
]},'2026-09-18');
assert.strictEqual(result.count,2,'only unpaid installments before the reference date are overdue');
assert.strictEqual(result.amount,120,'overdue amount must use remaining installment balances');

console.log('V2 client edit and overdue credit status: PASS');
