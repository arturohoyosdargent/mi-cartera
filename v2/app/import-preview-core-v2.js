// Mi Cartera PRO V2 - análisis local de archivos de clientes.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MiCarteraV2ImportPreviewCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_ROWS = 5000;
  const MAX_COLUMNS = 100;
  const ROW_LIMIT = 'El archivo supera el límite de 5000 filas de datos.';
  const COLUMN_LIMIT = 'El archivo supera el límite de 100 columnas.';
  const fields = [
    ['name', 'Nombre', ['name', 'nombre', 'nombres', 'nombre completo', 'nombres y apellidos', 'apellidos y nombres', 'cliente', 'nombre cliente', 'nombre del cliente', 'client name', 'customer name']],
    ['dni', 'DNI / Documento', ['dni', 'document', 'documento', 'documento de identidad', 'numero de documento', 'nro documento', 'nro de documento', 'n documento', 'numero de dni', 'nro dni', 'nro de dni', 'n dni']],
    ['phone', 'Teléfono', ['phone', 'telefono', 'numero de telefono', 'celular', 'movil', 'telefono celular', 'whatsapp', 'telefono cliente', 'telefono del cliente']],
    ['address', 'Dirección', ['address', 'direccion', 'domicilio', 'direccion cliente', 'direccion del cliente']],
    ['guarantor', 'Fiador', ['guarantor', 'fiador', 'aval', 'nombre fiador', 'nombre del fiador', 'nombre aval', 'nombre del aval']],
    ['guarantorPhone', 'Teléfono del fiador', ['guarantor phone', 'telefono fiador', 'telefono del fiador', 'telefono aval', 'telefono del aval', 'celular fiador']],
    ['reference', 'Referencia', ['reference', 'referencia', 'referencias', 'referencia de domicilio']],
    ['route', 'Ruta', ['route', 'route id', 'ruta', 'ruta id', 'id ruta']],
    ['location', 'Ubicación', ['location', 'ubicacion']],
    ['sourceId', 'ID de origen', ['id', 'source id', 'id origen', 'id de origen', 'id cliente', 'id del cliente', 'client id', 'customer id', 'codigo cliente', 'codigo del cliente', 'external id']]
  ];
  const fieldByHeading = new Map();
  for (const [key, label, aliases] of fields) {
    for (const alias of aliases) fieldByHeading.set(alias, { key, label });
  }
  const financial = /\b(?:abonos?|amortizacion|amount|balances?|capital|cash|cobranzas?|cobros?|credits?|creditos?|cronogramas?|cuotas?|debt|desembolsos?|deudas?|financiamientos?|importes?|installments?|interes(?:es|t)?|loans?|montos?|mor[ao]|pagad[oa]s?|pagos?|payments?|penalt(?:y|ies)|prestamos?|principal|saldos?|schedule|tasas?|vencimientos?)\b/;
  const text = value => String(value ?? '');
  const nonblank = cells => cells.some(cell => text(cell).trim() !== '');
  const fold = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalizeHeading = value => fold(text(value).normalize('NFKC')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2'))
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function* csvRows(source, delimiter) {
    let cells = [];
    let value = '';
    let line = 1;
    let number = 1;
    let quoted = false;
    let closedQuote = false;
    const quoteError = () => new Error('Fila ' + number + ': revisa las comillas del CSV.');

    for (let i = 0; i < source.length; i++) {
      const character = source[i];
      if (character === '\n' || character === '\r') {
        const ending = character === '\r' && source[i + 1] === '\n' ? '\r\n' : character;
        i += ending.length - 1;
        line++;
        if (quoted) {
          value += ending;
          continue;
        }
        cells.push(value);
        if (nonblank(cells)) yield { number, cells };
        cells = [];
        value = '';
        closedQuote = false;
        number = line;
      } else if (quoted) {
        if (character !== '"') value += character;
        else if (source[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else if (character === delimiter) {
        cells.push(value);
        value = '';
        closedQuote = false;
      } else if (closedQuote) {
        throw quoteError();
      } else if (character === '"') {
        if (value !== '') throw quoteError();
        quoted = true;
      } else {
        value += character;
      }
    }

    if (quoted) throw quoteError();
    cells.push(value);
    if (nonblank(cells)) yield { number, cells };
  }

  function csvDelimiter(source) {
    let selected = ',';
    let bestKnown = -1;
    let bestWidth = 0;
    for (const delimiter of [',', ';', '\t']) {
      let header;
      try {
        header = csvRows(source, delimiter).next().value?.cells;
      } catch {
        continue;
      }
      if (!header) continue;
      const known = header.filter(cell => fieldByHeading.has(normalizeHeading(cell))).length;
      if (known < bestKnown || (known === bestKnown && header.length <= bestWidth)) continue;
      selected = delimiter;
      bestKnown = known;
      bestWidth = header.length;
    }
    return selected;
  }

  function parseCsv(input) {
    if (typeof input !== 'string' || input.includes('\0')) throw new Error('No se pudo leer el contenido del CSV.');
    const source = input.replace(/^\uFEFF/, '');
    const rows = [];
    for (const row of csvRows(source, csvDelimiter(source))) {
      if (row.cells.length > MAX_COLUMNS) throw new Error(COLUMN_LIMIT);
      if (rows.length > MAX_ROWS) throw new Error(ROW_LIMIT);
      rows.push(row);
    }
    return rows;
  }

  function documentIdentity(value) {
    const key = text(value).normalize('NFKC').trim().toUpperCase();
    return /^[0-9\s.-]+$/.test(key) ? key.replace(/\D/g, '') : key;
  }

  function identity(client) {
    const name = fold(client.name || client.nombre).trim().replace(/\s+/g, ' ');
    const rawPhone = text(client.phone || client.telefono).normalize('NFKC').trim();
    const phone = /^[0-9+().\s-]+$/.test(rawPhone) ? rawPhone.replace(/\D/g, '') : '';
    return {
      document: documentIdentity(client.dni || client.document || client.documento),
      sourceId: text(client.sourceId).normalize('NFKC').trim(),
      contact: name && phone ? JSON.stringify([name, phone]) : ''
    };
  }

  function recordMatch(index, key, record) {
    if (!key) return;
    const matches = index.get(key);
    if (!matches) index.set(key, [record]);
    else if (matches.length < 2) matches.push(record);
  }

  function matchIndex(records) {
    const documents = new Map();
    const sourceIds = new Map();
    const contacts = new Map();
    const contactsWithoutDocument = new Map();
    for (const record of records) {
      recordMatch(documents, record.document, record);
      recordMatch(sourceIds, record.sourceId, record);
      recordMatch(contacts, record.contact, record);
      if (!record.document) recordMatch(contactsWithoutDocument, record.contact, record);
    }
    return { documents, sourceIds, contacts, contactsWithoutDocument };
  }

  function otherRow(index, key, record) {
    return index.get(key)?.find(candidate => candidate !== record)?.row.number;
  }

  function duplicateErrors(records, existingClients) {
    const file = matchIndex(records);
    const current = matchIndex(existingClients.filter(Boolean).map(identity));
    for (const record of records) {
      const { row, document, sourceId, contact } = record;
      const documentRow = otherRow(file.documents, document, record);
      const sourceRow = otherRow(file.sourceIds, sourceId, record);
      const contactRow = otherRow(document ? file.contactsWithoutDocument : file.contacts, contact, record);
      const currentContacts = document ? current.contactsWithoutDocument : current.contacts;
      if (documentRow) row.errors.push('DNI o documento repetido en la fila ' + documentRow + ' del archivo.');
      if (current.documents.has(document)) row.errors.push('El DNI o documento coincide con la cartera actual.');
      if (sourceRow) row.errors.push('ID de origen repetido en la fila ' + sourceRow + ' del archivo.');
      if (contactRow) row.errors.push('Posible duplicado por nombre y teléfono en la fila ' + contactRow + ' del archivo.');
      if (currentContacts.has(contact)) row.errors.push('Posible duplicado por nombre y teléfono en la cartera actual.');
      row.duplicate = row.errors.length > 0;
    }
  }

  function validate(input, { existingClients = [] } = {}) {
    const source = Array.isArray(input) ? input.filter(row => Array.isArray(row?.cells) && nonblank(row.cells)) : [];
    const result = { columns: [], rows: [], errors: [], warnings: [], total: 0, valid: 0, duplicates: 0, invalid: 0 };
    if (!source.length) {
      result.errors.push('El archivo está vacío.');
      return result;
    }
    const [header, ...data] = source;
    result.total = data.length;
    if (data.length > MAX_ROWS) result.errors.push(ROW_LIMIT);
    if (source.some(row => row.cells.length > MAX_COLUMNS)) result.errors.push(COLUMN_LIMIT);
    if (result.errors.length) {
      result.invalid = result.total;
      return result;
    }

    const seen = new Set();
    const unsupported = [];
    const unknown = [];
    for (let index = 0; index < header.cells.length; index++) {
      const label = text(header.cells[index]).trim();
      const heading = normalizeHeading(label);
      const field = fieldByHeading.get(heading);
      const identity = field ? 'field:' + field.key : 'heading:' + heading;
      if (!heading) {
        result.errors.push('Falta el encabezado de la columna ' + (index + 1) + '.');
      } else if (seen.has(identity)) {
        result.errors.push('Columna repetida: ' + label + '.');
      } else if (field) {
        result.columns.push({ ...field, index });
      } else if (financial.test(heading)) {
        unsupported.push(label);
      } else {
        unknown.push(label);
      }
      seen.add(identity);
    }
    if (!seen.has('field:name')) result.errors.push('Falta la columna obligatoria Nombre.');
    if (unsupported.length) result.errors.push('La vista previa de clientes no admite columnas financieras: ' + unsupported.join(', ') + '.');
    if (unknown.length) result.warnings.push('Columnas sin validar: ' + unknown.join(', ') + '.');
    if (!data.length) result.errors.push('El archivo no contiene filas de clientes.');
    if (result.errors.length) {
      result.invalid = result.total;
      return result;
    }

    const records = [];
    for (const { number, cells } of data) {
      const values = Object.fromEntries(result.columns.map(column => [column.key, text(cells[column.index])]));
      const row = { number, values, errors: [], duplicate: false };
      if (cells.length !== header.cells.length) {
        row.errors.push('Se esperaban ' + header.cells.length + ' columnas y se encontraron ' + cells.length + '.');
      }
      if (!values.name.trim()) row.errors.push('El nombre es obligatorio.');
      result.rows.push(row);
      if (row.errors.length) result.invalid++;
      else records.push({ ...identity(values), row });
    }
    duplicateErrors(records, Array.isArray(existingClients) ? existingClients : []);
    result.duplicates = records.filter(record => record.row.duplicate).length;
    result.valid = records.length - result.duplicates;
    return result;
  }

  return { parseCsv, validate };
});
