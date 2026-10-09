const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A receipt must identify the installment, while retaining the actual payment
// date, amount and current balance. Rendering or opening a preview writes nothing.
async function run() {
  const drawn = [], elements = new Map();
  const context2d = new Proxy({}, {get: (_, key) => key === 'fillText'
    ? (...args) => drawn.push(args) : () => {}});
  function element() {
    const controls = [{}, {}, {}], message = {};
    return {style: {}, dataset: {}, controls, message,
      setAttribute() {}, addEventListener() {}, remove() {elements.delete(this.id);},
      querySelector(selector) {return selector === '#v2SharePreviewMessage' ? message : {};},
      querySelectorAll() {return controls;}};
  }
  const document = {readyState: 'complete', scripts: [],
    getElementById: id => elements.get(id),
    createElement: tag => tag === 'canvas'
      ? {getContext: () => context2d, toBlob: cb => cb(new Blob(['png'], {type:'image/png'}))}
      : element(),
    head: {appendChild: el => elements.set(el.id, el)},
    body: {appendChild: el => elements.set(el.id, el)}};
  let writes = 0, shares = 0;
  const client = {id:'client', name:'Cliente de prueba'};
  const credit = {id:'credit', clientId:'client', capital:200, total:240,
    schedule:[1,2,3,4].map((n) => ({n, date:`2026-01-0${n}`, amount:60, balance:n===1?20:60}))};
  const payment = {id:'payment', creditId:'credit', date:'2026-10-07', amount:40, concept:'CUOTA',installmentNumber:1,totalInstallments:4};
  const window = {document, navigator:{share:async()=>{shares++;}},
    localStorage:{getItem:()=>JSON.stringify({clients:[client], credits:[credit], payments:[payment]}),
      setItem:()=>{writes++;}}};
  const sandbox = {window, document, navigator:window.navigator,
    localStorage:window.localStorage, Blob, File, console, setTimeout:()=>{},
    alert:message=>{throw new Error(message);}};
  vm.createContext(sandbox);
  for (const file of ['date-utils-v2.js','share-card-renderer-v2.js','payment-receipt-v2.js','share-preview-v2.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../app',file),'utf8'), sandbox);
  }
  const original = JSON.stringify({payment,credit});
  const receipt = window.MiCarteraV2PaymentReceipt;
  const text = receipt.text(payment,client,credit);
  assert.ok(text.includes('Cuota correspondiente a: CUOTA 1 DE 4'), text);
  assert.ok(text.includes('Fecha de pago: 7/10/2026'), text);
  assert.ok(text.includes('Monto recibido: S/ 40.00'), text);
  assert.ok(text.includes('Saldo actual: S/ 200.00'), text);
  await receipt.image(payment,client,credit);
  assert.equal(drawn.find(x=>x[1]===390&&x[2]===539)?.[0], 'CUOTA 1 DE 4');
  const pending = window.MiCarteraV2SharePreview.previewPayment(payment.id);
  await new Promise(resolve=>setImmediate(resolve));
  const modal = elements.get('v2SharePreview');
  assert.ok(modal.innerHTML.includes('<b>Cuota correspondiente a:</b> CUOTA 1 DE 4'));
  assert.ok(modal.message.value.includes('correspondiente a CUOTA 1 DE 4'));
  modal.controls[1].onclick();
  assert.equal(await pending, 'cancelled');
  assert.equal(shares,0);
  assert.equal(writes,0);
  assert.equal(JSON.stringify({payment,credit}),original);
  assert.ok(receipt.text({...payment,installmentNumber:2},client,credit).includes('Cuota correspondiente a: CUOTA 2 DE 4'));
  const paid = {...credit,schedule:credit.schedule.map(q=>({...q,balance:0}))};
  // Settling the credit later must not retrospectively mark this older receipt cancelled.
  const historical = receipt.text({...payment,amount:60,installmentNumber:4},client,paid);
  assert.ok(historical.includes('Cuota correspondiente a: CUOTA 4 DE 4'));
  assert.ok(!historical.includes('CANCELADO'));
  assert.ok(!receipt.text({...payment,concept:'INTERES'},client,credit).includes('Cuota correspondiente a:'));
  console.log('receipt-installment-identity.spec.js PASS');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
