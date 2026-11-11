const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv } = require('../app/import-preview-core-v2.js');
const { prepare, assertNewClients, MAX_CLIENTS } = require('../app/client-import-core-v2.js');

function prepareCsv(csv, options) {
  return prepare(parseCsv(csv), options);
}

function storedClient(overrides = {}) {
  return {
    id: 'cli-test', version: 1, name: 'Ana Pérez', phone: '900123456', dni: '00000123',
    address: '', guarantor: '', guarantorPhone: '', reference: '', route: '', routeId: '', location: '',
    ...overrides
  };
}

test('maps only new client fields and leaves route assignment empty', () => {
  const result = prepareCsv(
    'Nombre,DNI,Teléfono,Dirección,Aval,Teléfono aval,Referencia,Ruta,Ubicación,ID Cliente,Extra\n' +
    ' Ana Pérez ,00000123, +51 900 123 456 , Lima , Eva ,001234567, Casa ,R1,"-12.046374,-77.042793",c-007,otro'
  );
  assert.deepEqual(result, {
    eligible: true,
    issues: [],
    clients: [{
      name: 'Ana Pérez', dni: '00000123', phone: '+51 900 123 456', address: 'Lima', guarantor: 'Eva',
      guarantorPhone: '001234567', reference: 'Casa', route: '', routeId: '', location: '-12.046374,-77.042793'
    }]
  });
});

test('blocks the entire import when any row has a missing or unusable phone', () => {
  const result = prepareCsv('Nombre,Teléfono\nAna,900123456\nEva,\nLuis,---');
  assert.equal(result.eligible, false);
  assert.deepEqual(result.clients, []);
  assert.match(result.issues.join(' '), /fila 3.*teléfono/i);
  assert.match(result.issues.join(' '), /fila 4.*teléfono/i);
  assert.equal(prepareCsv('Nombre\nAna').eligible, false);
});

test('blocks file errors and worksheet cells omitted because of a formula or error', () => {
  const financial = prepareCsv('Nombre,Teléfono,Saldo\nAna,900123456,55');
  assert.match(financial.issues.join(' '), /financier/i);
  assert.equal(financial.eligible, false);
  const omitted = prepareCsv('Nombre,Teléfono\nAna,900123456', { hasOmittedCells: true });
  assert.match(omitted.issues.join(' '), /fórmulas o errores/i);
  assert.equal(omitted.eligible, false);
  assert.deepEqual(omitted.clients, []);
});

test('blocks shared phones within the file or against historical clients', () => {
  const shared = prepareCsv('Nombre,Teléfono,DNI\nAna,900-123-456,00001\nEva,900 123 456,00002');
  assert.equal(shared.eligible, false);
  assert.deepEqual(shared.clients, []);
  assert.match(shared.issues.join(' '), /teléfono.*repetido/i);
  const current = prepareCsv('Nombre,Teléfono\nAna,900-123-456', {
    existingClients: [{ nombre: 'Luis', telefono: '900 123 456' }]
  });
  assert.equal(current.eligible, false);
  assert.match(current.issues.join(' '), /teléfono.*cartera actual/i);
});

test('blocks normalized document collisions and preserves significant leading zeros', () => {
  const result = prepareCsv('Nombre,Teléfono,DNI\nAna,900123456,000-123\nEva,900123457,000123');
  assert.equal(result.eligible, false);
  assert.match(result.issues.join(' '), /documento.*repetido/i);
  assert.equal(prepareCsv('Nombre,Teléfono,DNI\nAna,900123456,000123', {
    existingClients: [{ documento: '123', telefono: '900123457' }]
  }).eligible, true);
  assert.equal(prepareCsv('Nombre,Teléfono,DNI\nAna,900123456,000123', {
    existingClients: [{ document: '000 123', phone: '900123457' }]
  }).eligible, false);
});

test('enforces limits on client fields and rejects unusable locations', () => {
  const longAddress = prepareCsv('Nombre,Teléfono,Dirección\nAna,900123456,' + 'a'.repeat(1500));
  assert.equal(longAddress.eligible, false);
  assert.match(longAddress.issues.join(' '), /dirección/i);
  const malformed = prepareCsv('Nombre,Teléfono,Ubicación\nAna,900123456,"-91,-77"');
  assert.equal(malformed.eligible, false);
  assert.match(malformed.issues.join(' '), /ubicación/i);
});

test('enforces the limit of one hundred clients per confirmation', () => {
  assert.equal(MAX_CLIENTS, 100);
  const rows = Array.from({ length: 101 }, (_, i) => 'Ana,' + (900123456 + i));
  assert.equal(prepareCsv('Nombre,Teléfono\n' + rows.slice(0, 100).join('\n')).clients.length, 100);
  const result = prepareCsv('Nombre,Teléfono\n' + rows.join('\n'));
  assert.equal(result.eligible, false);
  assert.match(result.issues.join(' '), /100 clientes/i);
});

test('rechecks fresh create records and duplicate identities against latest clients', () => {
  const fresh = storedClient();
  assert.equal(assertNewClients([fresh], []), true);
  assert.throws(() => assertNewClients([fresh], [{ id: fresh.id }]), /identificador.*cartera actual/i);
  assert.throws(() => assertNewClients([fresh], [{ documento: '000 00123' }]), /documento.*cartera actual/i);
  assert.throws(() => assertNewClients([fresh], [{ telefono: '900 123 456' }]), /teléfono.*cartera actual/i);
  assert.throws(() => assertNewClients([fresh], [{ phone: ' ', telefono: '900 123 456' }]), /teléfono.*cartera actual/i);
  assert.throws(() => assertNewClients([fresh, storedClient({ id: 'cli-test-2', phone: '900123457' })], []), /documento.*repetido/i);
});

test('rejects assignment, financial fields, wrong version and incomplete create records', () => {
  for (const overrides of [
    { routeId: 'another-route' }, { workerId: 'worker-2' }, { saldo: 100 }, { version: 2 }, { id: 'existing/client' }, { phone: '---' }
  ]) {
    assert.throws(() => assertNewClients([storedClient(overrides)], []), Error, JSON.stringify(overrides));
  }
  const { address, ...incomplete } = storedClient();
  assert.throws(() => assertNewClients([incomplete], []), Error);
  assert.throws(() => assertNewClients([], []), Error);
  assert.throws(() => assertNewClients(Array(1), []), /alta de cliente/i);
});
