const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const S=require('../core/schedule-engine.js');

const celso=S.generateWithExtras({
  total:720,
  term:4,
  freq:'weekly',
  firstPaymentDate:'2026-09-04',
  extraPayments:[{date:'2026-09-30',amount:320}]
});
assert.deepEqual(celso.map(x=>x.number),[1,2,3,4,'A1']);
assert.deepEqual(celso.map(x=>x.date),['2026-09-04','2026-09-11','2026-09-18','2026-09-25','2026-09-30']);
assert.deepEqual(celso.map(x=>x.amount),[100,100,100,100,320]);
assert.strictEqual(celso.filter(x=>x.extra).length,1);
assert.strictEqual(celso.find(x=>x.number==='A1').type,'ADICIONAL');
assert.strictEqual(celso.reduce((sum,x)=>Math.round((sum+x.amount)*100)/100,0),720);

const rounded=S.generateWithExtras({
  total:100,
  term:3,
  freq:'weekly',
  firstPaymentDate:'2026-09-20',
  extraPayments:[{date:'2026-10-15',amount:20}]
});
assert.deepEqual(rounded.map(x=>x.amount),[26.66,26.66,26.68,20]);
assert.strictEqual(rounded.reduce((sum,x)=>Math.round((sum+x.amount)*100)/100,0),100);

assert.throws(()=>S.generateWithExtras({total:720,term:4,freq:'weekly',firstPaymentDate:'2026-09-04',extraPayments:[{date:'2026-09-30',amount:720}]}),/EXTRA_PAYMENTS_EXCEED_TOTAL/);
assert.throws(()=>S.generateWithExtras({total:720,term:4,freq:'weekly',firstPaymentDate:'2026-09-04',extraPayments:[{date:'2026-09-11',amount:320}]}),/EXTRA_PAYMENT_DATE_COLLISION/);

const values=new Map([
  ['cCapital',{value:'600'}],['cRate',{value:'20'}],['cTerm',{value:'4'}],['cFreq',{value:'weekly'}],['cFirst',{value:'2026-09-04'}],['cRestDay',{value:''}]
]);
const document={readyState:'loading',getElementById:id=>values.get(id)||null,querySelectorAll:()=>[],addEventListener(){}};
const window={MiCarteraV2Schedule:S,addEventListener(){}};
const context={window,document,navigator:{},localStorage:{getItem(){return '{}'}},console,setTimeout,clearTimeout,alert(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/credit-form-parity-v2.js'),'utf8'),context);
const planned=window.MiCarteraV2CreditFormParity.plan({extraPayments:[{date:'2026-09-30',amount:320}]});
assert.strictEqual(planned.total,720);
assert.strictEqual(planned.regularTotal,400);
assert.strictEqual(planned.regularInstallment,100);
assert.deepEqual(planned.schedule.map(x=>x.number),[1,2,3,4,'A1']);
assert.strictEqual(planned.maturity,'2026-09-30');
console.log('V2 extra installment schedule: PASS');
