const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv, validate } = require('../app/import-preview-core-v2.js');

test('reads semicolon CSV without losing leading zeros, quotes or physical row numbers', () => {
  const csv = '\uFEFFNombre;DNI;Dirección\r\n"Ana; María";00123456;"Piso 1\r\nDpto. ""A"""\r\n\r\nLuis;00000007;';
  assert.deepEqual(parseCsv(csv), [
    { number: 1, cells: ['Nombre', 'DNI', 'Dirección'] },
    { number: 2, cells: ['Ana; María', '00123456', 'Piso 1\r\nDpto. "A"'] },
    { number: 5, cells: ['Luis', '00000007', ''] }
  ]);
});

test('reads comma and tab delimited files', () => {
  assert.deepEqual(parseCsv('Nombre,DNI\n"Paz, Ana",00008')[1].cells, ['Paz, Ana', '00008']);
  assert.deepEqual(parseCsv('\r\nNombre\tDNI\rAna\t00008')[1], { number: 3, cells: ['Ana', '00008'] });
});

test('reports malformed CSV quotes at their source line', () => {
  assert.throws(() => parseCsv('Nombre,DNI\nAna,123\n"Paz,00008'), /Fila 3.*comillas/i);
  assert.throws(() => parseCsv('Nombre,DNI\nAn"a,123'), /Fila 2.*comillas/i);
  assert.throws(() => parseCsv('Nombre,DNI\n"Ana"Paz,123'), /Fila 2.*comillas/i);
  assert.throws(() => parseCsv('Nombre\u0000DNI'), /CSV/i);
});

test('maps V2 client fields and preserves the file text', () => {
  const result = validate(parseCsv('  NOMBRE COMPLETO ;Documento;Teléfono;Dirección;Aval;Teléfono fiador;Referencia;Ruta;Ubicación;Extra\n  Ana Pérez  ;00123456;+51 900 123 456;Lima;Eva;01002003;Casa;R-3;Mapa;Valor'));
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings[0], /Extra/i);
  assert.deepEqual(result.columns.map(column => column.key), [
    'name', 'dni', 'phone', 'address', 'guarantor', 'guarantorPhone', 'reference', 'route', 'location'
  ]);
  assert.deepEqual(result.rows[0].values, {
    name: '  Ana Pérez  ', dni: '00123456', phone: '+51 900 123 456', address: 'Lima',
    guarantor: 'Eva', guarantorPhone: '01002003', reference: 'Casa', route: 'R-3', location: 'Mapa'
  });
  assert.equal(result.valid, 1);
});

test('reports empty input and missing, repeated or blank column headers', () => {
  assert.match(validate(parseCsv('\ufeff\n  \n')).errors[0], /vacío/i);
  assert.match(validate(parseCsv('Nombre,DNI')).errors[0], /filas de clientes/i);
  assert.ok(validate(parseCsv('DNI\n00008')).errors.some(error => /falta.*nombre/i.test(error)));
  assert.ok(validate(parseCsv('Nombre,DNI,Documento\nAna,00008,00008')).errors.some(error => /repetida.*Documento/i.test(error)));
  assert.ok(validate(parseCsv('Nombre, Extra ,extra\nAna,X,Y')).errors.some(error => /repetida.*extra/i.test(error)));
  assert.ok(validate(parseCsv('Nombre,,DNI\nAna,X,00008')).errors.some(error => /encabezado/i.test(error)));
});

test('rejects obvious financial layouts even when a client name is present', () => {
  for (const header of ['Capital pendiente', 'Crédito ID', 'fechaPago', 'Monto desembolsado', 'Balance']) {
    const result = validate(parseCsv(`Nombre,DNI,${header}\nAna,00008,123`));
    assert.ok(result.errors.some(error => /financier/i.test(error) && error.includes(header)), header);
    assert.equal(result.valid, 0, header);
    assert.equal(result.invalid, 1, header);
  }
});

test('reports short and long records alongside rows without a name', () => {
  const result = validate(parseCsv('Nombre,DNI\nAna\nLuis,00008,Otro\n   ,00009\nEva,'));
  assert.deepEqual(result.rows.map(row => row.number), [2, 3, 4, 5]);
  assert.match(result.rows[0].errors[0], /columnas/i);
  assert.match(result.rows[1].errors[0], /columnas/i);
  assert.match(result.rows[2].errors[0], /nombre/i);
  assert.deepEqual(result.rows[3].errors, []);
  assert.deepEqual([result.total, result.valid, result.duplicates, result.invalid], [4, 1, 0, 3]);
});

test('flags every occurrence of a document within the file and against current clients', () => {
  const existingClients = Object.freeze([Object.freeze({ document: '0007', name: 'Cliente actual' })]);
  const result = validate(parseCsv('Nombre,DNI\nAna,00 123456\nLuis,00123456\nSol,0007\nEva,123456'), { existingClients });
  assert.deepEqual(result.rows.map(row => row.duplicate), [true, true, true, false]);
  assert.match(result.rows[0].errors[0], /fila 3/i);
  assert.match(result.rows[1].errors[0], /fila 2/i);
  assert.match(result.rows[2].errors[0], /cartera actual/i);
  assert.deepEqual([result.total, result.valid, result.duplicates, result.invalid], [4, 1, 3, 0]);
});

test('checks source IDs within the file without comparing unrelated system IDs', () => {
  const result = validate(parseCsv('Nombre,ID Cliente\nAna,00001\nLuis,00001\nEva,00002'), {
    existingClients: [{ id: '00002', name: 'Eva' }]
  });
  assert.deepEqual(result.rows.map(row => row.duplicate), [true, true, false]);
  assert.deepEqual(result.rows.map(row => row.values.sourceId), ['00001', '00001', '00002']);
});

test('only uses name with phone as a possible match when a document is missing', () => {
  const existingClients = [{ nombre: 'Ana Pérez', telefono: '900 123 456', dni: '00008' }];
  const csv = 'Nombre,Teléfono,DNI\nANA PEREZ,900-123-456,\nLuis,900 123 456,\nAna Pérez,900123456,00009\nEva,333,\nEva,333,';
  const result = validate(parseCsv(csv), { existingClients });
  assert.match(result.rows[0].errors.join(' '), /posible.*cartera actual/i);
  assert.deepEqual(result.rows.map(row => row.duplicate), [true, false, true, true, true]);
  const differentDocument = validate(parseCsv('Nombre,Teléfono,DNI\nAna Perez,900123456,00009'), { existingClients });
  assert.equal(differentDocument.rows[0].duplicate, false);
});

test('enforces the same size limits for CSV and worksheet rows', () => {
  const header = { number: 1, cells: ['Nombre'] };
  const rows = Array.from({ length: 5000 }, (_, i) => ({ number: i + 2, cells: ['Ana'] }));
  assert.equal(validate([header, ...rows]).valid, 5000);
  assert.match(validate([header, ...rows, { number: 5002, cells: ['Eva'] }]).errors[0], /5000 filas/i);
  assert.throws(() => parseCsv('Nombre\n' + 'Ana\n'.repeat(5001)), /5000 filas/i);
  assert.match(validate([{ number: 1, cells: Array(101).fill('Nombre') }]).errors[0], /100 columnas/i);
  assert.throws(() => parseCsv(Array(101).fill('Nombre').join(',')), /100 columnas/i);
});
