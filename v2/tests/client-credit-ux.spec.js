const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = path.join(__dirname, '../app');
const creditSource = fs.readFileSync(path.join(app, 'credit-form-parity-v2.js'), 'utf8');
const customerSource = fs.readFileSync(path.join(app, 'customer-experience-v2.js'), 'utf8');
const durableSource = fs.readFileSync(path.join(app, 'durable-actions-v2.js'), 'utf8');

const elements = new Map();
const document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById(id) { return elements.get(id) || null; },
  querySelectorAll() { return []; }
};
const window = { addEventListener() {} };
const context = {
  window,
  document,
  navigator: {},
  localStorage: { getItem() { return JSON.stringify({ clients: [] }); } },
  console,
  setTimeout,
  clearTimeout,
  alert() {}
};
vm.createContext(context);
vm.runInContext(creditSource, context);

const api = window.MiCarteraV2CreditFormParity;
const clients = [
  { id: 'cli-1', name: 'Carmen Rosa Ayala Tinco', phone: '959453730', dni: '42416606', reference: 'TELÉFONO PARA LLAMADAS' },
  { id: 'cli-2', name: 'Teresa Milagros Ayala Tinco', phone: '960838165', reference: 'SAN ANTONIO' }
];
assert.strictEqual(api.resolveClient('cli-1', clients).name, 'Carmen Rosa Ayala Tinco');
assert.strictEqual(api.resolveClient('CARMEN', clients).id, 'cli-1');
assert.strictEqual(api.resolveClient('ayala tinco', clients), null, 'ambiguous partial names must require a choice');
assert.strictEqual(api.resolveClient('42416606', clients).id, 'cli-1');

assert.ok(creditSource.includes("o.value=String(c.name||c.id||'')"), 'the visible autocomplete value must be the client name');
assert.ok(creditSource.includes("label=[c.phone,c.dni,c.reference]"), 'autocomplete metadata must not expose the internal ID as the primary label');
assert.ok(durableSource.includes('MiCarteraV2CreditFormParity?.resolveClient?.(q,d.clients)'), 'credit save must resolve partial names');
assert.ok(creditSource.includes("mi-cartera-v2-sync"), 'client options must refresh after Cloud rehydration');
assert.ok(durableSource.includes('refreshClientOptions?.()'), 'client options must refresh after a same-device client save');
assert.ok(customerSource.includes('resetClientForm'), 'new client form must have an explicit reset');

const fields = ['fName', 'fPhone', 'fDni', 'fAddress', 'fGuarantor', 'fGuarantorPhone', 'fReference', 'fRoute', 'fLocation'];
for (const id of fields) elements.set(id, { value: 'dato anterior', dataset: { clientId: 'old' } });
const customerContext = {
  window: { addEventListener() {}, show() {} },
  document,
  navigator: {},
  console,
  setTimeout,
  clearTimeout,
  alert() {}
};
vm.createContext(customerContext);
vm.runInContext(customerSource, customerContext);
customerContext.window.MiCarteraV2CustomerExperience.resetClientForm();
for (const id of fields) {
  assert.strictEqual(elements.get(id).value, '', `${id} must be cleared when creating a new client`);
  assert.strictEqual(Object.hasOwn(elements.get(id).dataset, 'clientId'), false, `${id} must not retain a prior selection`);
}

console.log('V2 client/credit UX: PASS');
