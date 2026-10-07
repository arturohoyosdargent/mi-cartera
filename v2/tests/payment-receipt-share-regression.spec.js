const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Verify the current approved graphical transport, without reintroducing the
// obsolete text-only WhatsApp/clipboard fallbacks required by the old test.
async function run() {
  const source = fs.readFileSync(path.join(__dirname,'../app/payment-receipt-v2.js'),'utf8');
  const payment = {id:'p',date:'2026-10-07',amount:60,concept:'CUOTA'};
  const client = {name:'Cliente de prueba',phone:'999999999'};
  const credit = {id:'c',total:240};
  const original = JSON.stringify({payment,client,credit});
  let writes = 0, outgoing;
  const navigator = {canShare:()=>true,share:async data=>{outgoing=data;}};
  const window = {navigator,
    MiCarteraV2ShareCard:{receipt:async()=>new Blob(['png'],{type:'image/png'})}};
  const context = {window,navigator,Blob,File,console:{warn(){}},
    localStorage:{setItem(){writes++;}}};
  vm.createContext(context);
  vm.runInContext(source,context);
  const api = window.MiCarteraV2PaymentReceipt;
  assert.equal(await api.share(payment,client,credit,'Mensaje editado'), 'file-share');
  assert.equal(outgoing.text,'Mensaje editado');
  assert.equal(outgoing.files.length,1);
  assert.equal(outgoing.files[0].type,'image/png');
  assert.equal(outgoing.files[0].name,'prestamo-ya-comprobante-pago.png');
  navigator.share = async()=>{throw Object.assign(new Error('Cancelado'),{name:'AbortError'});};
  assert.equal(await api.share(payment,client,credit),'cancelled');
  navigator.canShare = ()=>false;
  await assert.rejects(api.share(payment,client,credit), /no permite adjuntar automáticamente/);
  delete navigator.share;
  await assert.rejects(api.share(payment,client,credit), /no permite adjuntar automáticamente/);
  await assert.rejects(api.share(null,client,credit), /PAYMENT_REQUIRED/);
  window.MiCarteraV2ShareCard.receipt = async()=>{throw new Error('CANVAS_UNAVAILABLE');};
  await assert.rejects(api.share(payment,client,credit), /No se pudo generar el comprobante gráfico/);
  assert.equal(writes,0);
  assert.equal(JSON.stringify({payment,client,credit}),original);
  console.log('V2 payment receipt share regression: PASS');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
