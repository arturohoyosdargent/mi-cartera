const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const calls = [];
  const canvases = [];
  const canvas = {
    fillRect() {}, beginPath() {}, roundRect() {}, closePath() {}, fill() {},
    fillText(value) { calls.push(value); }
  };
  const window = {
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        const element = {
          getContext: () => canvas,
          toBlob(callback, type) { callback(new Blob(['fixture'], { type })); }
        };
        canvases.push(element);
        return element;
      }
    }
  };
  const context = vm.createContext({ window, document: window.document, Blob });
  for (const name of ['date-utils-v2.js','share-card-renderer-v2.js','account-statement-v2.js']) {
    const src = fs.readFileSync(path.join(__dirname, '../app', name), 'utf8');
    vm.runInContext(src, context, { filename: name });
  }
  return { statement: window.MiCarteraV2AccountStatement, calls, canvases };
}

const client = {id:'same-client',name:'Cliente de prueba',phone:'900000001'};
const asOf = '2026-11-10';
const installment = (date, amount, extra={}) => ({date,amount,balance:amount,...extra});
const credit = (id, schedule, extra={}) => ({id,clientId:client.id,status:'ACTIVO',schedule,...extra});
const duplicateTerms = () => [
  installment('2026-11-09',50,{paid:30,balance:20,status:'PARCIAL'}),
  installment('2026-11-10',30),
  installment('2026-11-16',50),
  installment('2026-12-10',99,{balance:0,status:'PAGADA'})
];

test('estado de cuenta: consolida créditos iguales por ID y separa deuda, mora y exigible', () => {
  const {statement} = setup();
  const credits = [
    credit('cre-a',duplicateTerms()), credit('cre-b',duplicateTerms(),{status:'ACTIVE'}),
    credit('cre-lejano',[installment('2026-11-17',35)]),
    credit('cre-renovado',duplicateTerms(),{renewedTo:'cre-a'}),
    credit('cre-borrado',duplicateTerms(),{tombstone:true}),
    credit('cre-pagado',duplicateTerms(),{status:'PAGADO'}),
    credit('cre-ajeno',duplicateTerms(),{clientId:'other-client'})
  ];
  const all = statement.build({client,credits,asOf});
  assert.deepEqual(Array.from(all.rows,x=>x.id), ['cre-a','cre-b','cre-lejano']);
  assert.equal(all.activeCount,3);
  assert.equal(all.totalDebt,235);
  assert.equal(all.amountDue,100);
  assert.equal(all.rows[0].installmentDate,'2026-11-09');
  assert.equal(all.rows[0].installmentAmount,20);
  assert.equal(all.rows[0].arrears,20);
  assert.equal(all.rows[0].amountDue,50);
  assert.equal(all.rows[0].maturity,'2026-12-10');
  const upcoming = statement.build({client,credits,asOf,filter:'upcoming'});
  assert.deepEqual(Array.from(upcoming.rows,x=>x.id), ['cre-a','cre-b']);
  assert.equal(upcoming.through,'2026-11-16');
  assert.equal(upcoming.rows[0].installmentDate,'2026-11-10');
  assert.equal(upcoming.rows[0].installmentAmount,30);
  assert.equal(upcoming.amountDue,all.amountDue);
  assert.equal(upcoming.totalDebt,all.totalDebt);
});

test('estado de cuenta: un pago confirmado baja el saldo del crédito correspondiente una sola vez', () => {
  const {statement} = setup();
  const credits = [credit('cre-a',duplicateTerms()),credit('cre-b',duplicateTerms())];
  const before = JSON.stringify(credits);
  assert.equal(statement.build({client,credits,asOf}).amountDue,100);
  assert.equal(JSON.stringify(credits),before);
  const confirmed = credits.map((item,i) => !i ? {...item,schedule:[
    {...item.schedule[0],balance:0,paid:50,status:'PAGADA'},...item.schedule.slice(1)
  ]} : item);
  const current = statement.build({client,credits:confirmed,asOf,
    payments:[{creditId:'cre-a',amount:20}]});
  assert.equal(current.totalDebt,180);
  assert.equal(current.amountDue,80);
  const paidCredit=current.rows.find(row=>row.id==='cre-a');
  const otherCredit=current.rows.find(row=>row.id==='cre-b');
  assert.equal(paidCredit.balance,80);
  assert.equal(paidCredit.arrears,0);
  assert.equal(otherCredit.balance,100);
  assert.equal(otherCredit.arrears,20);
});

test('estado de cuenta: los datos históricos incompletos no se convierten en exigible cero', () => {
  const {statement} = setup();
  const credits = [
    credit('cre-legacy',[],{total:100,principalPaid:25,maturity:'2026-12-01'}),
    credit('cre-unknown',[installment('sin fecha',18)])
  ];
  const result = statement.build({client,credits,asOf});
  assert.equal(result.rows.length,2);
  assert.equal(result.totalDebt,93);
  assert.equal(result.amountDue,null);
  assert.equal(result.rows[0].arrears,null);
  assert.equal(result.rows[0].installmentDate,'');
  assert.equal(result.rows[0].maturity,'2026-12-01');
  assert.equal(statement.build({client,credits,asOf,filter:'upcoming'}).rows.length,0);
});

test('estado de cuenta: genera una sola imagen con totales y todos los créditos visibles', async () => {
  const {statement,calls,canvases} = setup();
  const credits = Array.from({length:8},(_,index)=>credit('cre-'+index,[installment('2026-11-10',12.50)]));
  const result = statement.build({client,credits,asOf});
  const png = await statement.render(result);
  assert.equal(png.type,'image/png');
  assert.equal(canvases.length,1);
  for (const item of credits) assert.ok(calls.some(text=>text.includes(item.id)),item.id);
  assert.ok(calls.includes('Deuda total acumulada'));
  assert.ok(calls.includes('Exigible a la fecha'));
  assert.ok(calls.includes('Mora'));
});
