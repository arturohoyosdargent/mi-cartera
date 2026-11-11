(function () {
  'use strict';

  const MAX_FILE = 5 * 1024 * 1024;
  const MAX_XML = 8 * 1024 * 1024;
  const MAX_ENTRIES = 1024;
  const MAX_ROWS = 5000;
  const MAX_COLUMNS = 100;
  const BAD_FILE = 'El archivo .xlsx está dañado o tiene un formato no compatible.';
  const REL_TYPES = [
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'http://purl.oclc.org/ooxml/officeDocument/relationships'
  ];

  function fail(message = BAD_FILE) {
    const error = new Error(message);
    error.name = 'XlsxPreviewError';
    throw error;
  }

  const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return crc;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipReader(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const u16 = offset => view.getUint16(offset, true);
    const u32 = offset => view.getUint32(offset, true);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const nameAt = (offset, length) => decoder.decode(bytes.subarray(offset, offset + length));
    const entries = new Map();
    let remaining = MAX_XML;

    if (bytes.length >= 8 && u32(0) === 0xe011cfd0 && u32(4) === 0xe11ab1a1) {
      fail('El libro está protegido o es un archivo antiguo .xls. Guarda una copia .xlsx sin contraseña.');
    }

    // A ZIP comment of up to 65535 bytes can follow the end record's fixed fields.
    let end = bytes.length - 22;
    const earliestEnd = Math.max(0, end - 65535);
    while (end >= earliestEnd && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) {
      end--;
    }
    if (end < earliestEnd) fail();
    const count = u16(end + 10);
    const directory = u32(end + 16);
    if (!count || u16(end + 4) || u16(end + 6) || u16(end + 8) !== count ||
        directory + u32(end + 12) !== end) fail();
    if (count > MAX_ENTRIES) fail('El libro de Excel contiene demasiadas partes para la vista previa.');

    let cursor = directory;
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || u32(cursor) !== 0x02014b50 || u16(cursor + 34)) fail();
      const flags = u16(cursor + 8);
      if (flags & 0x2041) fail('El archivo .xlsx está protegido. Guarda una copia sin contraseña.');
      const nameLength = u16(cursor + 28);
      const next = cursor + 46 + nameLength + u16(cursor + 30) + u16(cursor + 32);
      if (!nameLength || next > end) fail();
      const path = nameAt(cursor + 46, nameLength);
      if (entries.has(path)) fail();
      entries.set(path, {
        flags,
        method: u16(cursor + 10),
        crc: u32(cursor + 16),
        compressedSize: u32(cursor + 20),
        size: u32(cursor + 24),
        offset: u32(cursor + 42)
      });
      cursor = next;
    }
    if (cursor !== end) fail();

    return async function readPart(path) {
      const entry = entries.get(path);
      if (!entry) fail();
      const { flags, method, crc, compressedSize, size, offset } = entry;
      if (size > remaining) fail('El libro de Excel descomprimido supera el límite para la vista previa.');
      remaining -= size;
      if (offset + 30 > directory || u32(offset) !== 0x04034b50 ||
          u16(offset + 6) !== flags || u16(offset + 8) !== method) fail();
      const nameLength = u16(offset + 26);
      const start = offset + 30 + nameLength + u16(offset + 28);
      if (start + compressedSize > directory || nameAt(offset + 30, nameLength) !== path) fail();
      if (!(flags & 8) && (u32(offset + 14) !== crc ||
          u32(offset + 18) !== compressedSize || u32(offset + 22) !== size)) fail();

      const compressed = bytes.subarray(start, start + compressedSize);
      let plain;
      if (method === 0) {
        plain = compressed;
      } else if (method === 8) {
        let stream;
        try {
          stream = new DecompressionStream('deflate-raw');
        } catch (error) {
          fail('Este navegador no puede abrir libros .xlsx. Usa un archivo CSV.');
        }
        const reader = new Blob([compressed]).stream().pipeThrough(stream).getReader();
        plain = new Uint8Array(size);
        let written = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (written + value.length > size) {
            await reader.cancel().catch(() => {});
            fail();
          }
          plain.set(value, written);
          written += value.length;
        }
        if (written !== size) fail();
      } else {
        fail();
      }
      if (plain.length !== size || crc32(plain) !== crc) fail();
      return plain;
    };
  }

  function elements(node, name) {
    return Array.from(node?.children || []).filter(child => child.localName === name);
  }

  function element(node, name) {
    for (const child of node?.children || []) {
      if (child.localName === name) return child;
    }
  }

  async function xmlPart(readPart, path, rootName) {
    const bytes = await readPart(path);
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    const source = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) fail();
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (document.documentElement?.localName !== rootName ||
        document.getElementsByTagNameNS('*', 'parsererror').length) fail();
    return document.documentElement;
  }

  function relsPath(path) {
    const slash = path.lastIndexOf('/') + 1;
    return path.slice(0, slash) + '_rels/' + path.slice(slash) + '.rels';
  }

  function relIs(relation, type) {
    return REL_TYPES.some(namespace => relation?.getAttribute('Type') === namespace + '/' + type);
  }

  function targetPath(relation, sourcePath) {
    const raw = relation?.getAttribute('Target');
    if (!raw) fail();
    if (relation.getAttribute('TargetMode') === 'External' ||
        /^([a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) {
      fail('El archivo .xlsx contiene un vínculo externo en lugar de datos locales.');
    }
    if (/[\\?#]/.test(raw)) fail();
    const base = sourcePath.split('/');
    base.pop();
    const target = raw.startsWith('/') ? [] : base;
    for (const part of raw.replace(/^\//, '').split('/')) {
      const segment = decodeURIComponent(part);
      if (!segment || /[\\/:?#\u0000-\u001f]/.test(segment)) fail();
      if (segment === '..') {
        if (!target.length) fail();
        target.pop();
      } else if (segment !== '.') {
        target.push(segment);
      }
    }
    if (!target.length) fail();
    return target.join('/');
  }

  function spreadsheetText(node) {
    let value = '';
    for (const child of node?.children || []) {
      if (child.localName === 't') value += child.textContent;
      if (child.localName === 'r') value += element(child, 't')?.textContent || '';
    }
    return value.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function cellValue(cell, sharedStrings, type) {
    if (type === 'inlineStr') return spreadsheetText(element(cell, 'is'));
    const value = element(cell, 'v')?.textContent || '';
    if (type !== 's') return value;
    const index = Number(value);
    if (!/^\d+$/.test(value) || index >= sharedStrings.length) fail();
    return sharedStrings[index];
  }

  function sheetRows(sheet, sharedStrings) {
    const rows = [];
    let omittedCells = 0;
    let rowNumber = 0;
    const sheetData = element(sheet, 'sheetData');
    if (!sheetData) fail();
    for (const row of elements(sheetData, 'row')) {
      const declaredRow = row.getAttribute('r');
      const number = declaredRow === null ? rowNumber + 1 : Number(declaredRow);
      if (!Number.isInteger(number) || number <= rowNumber || number > 1048576) fail();
      rowNumber = number;
      const cells = [];
      let column = -1;
      for (const cell of elements(row, 'c')) {
        const reference = cell.getAttribute('r');
        let nextColumn = column + 1;
        if (reference !== null) {
          const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(reference);
          if (!match || Number(match[2]) !== number) fail();
          nextColumn = 0;
          for (const letter of match[1]) nextColumn = nextColumn * 26 + letter.charCodeAt(0) - 64;
          nextColumn--;
          if (nextColumn <= column) fail();
        }
        column = nextColumn;
        const type = cell.getAttribute('t');
        if (type === 'e' || element(cell, 'f')) {
          omittedCells++;
          continue;
        }
        const value = cellValue(cell, sharedStrings, type);
        if (!value.trim()) continue;
        if (column >= MAX_COLUMNS) fail('La hoja de Excel supera el límite de 100 columnas.');
        while (cells.length < column) cells.push('');
        cells.push(value);
      }
      if (!cells.length) continue;
      if (rows.length > MAX_ROWS) fail('La hoja de Excel supera el límite de 5000 filas de datos.');
      while (rows.length && cells.length < rows[0].cells.length) cells.push('');
      rows.push({ number, cells });
    }
    return { rows, omittedCells };
  }

  async function read(buffer) {
    try {
      if (!(buffer instanceof ArrayBuffer)) fail();
      if (buffer.byteLength > MAX_FILE) fail('El archivo de Excel supera el límite de 5 MB.');
      const readPart = zipReader(buffer);
      const packageRels = await xmlPart(readPart, '_rels/.rels', 'Relationships');
      const workbookRel = elements(packageRels, 'Relationship').find(relation => relIs(relation, 'officeDocument'));
      const workbookPath = targetPath(workbookRel, '');
      const types = await xmlPart(readPart, '[Content_Types].xml', 'Types');
      const workbookType = elements(types, 'Override').find(part => part.getAttribute('PartName') === '/' + workbookPath);
      if (workbookType?.getAttribute('ContentType') !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml') fail();
      const workbook = await xmlPart(readPart, workbookPath, 'workbook');
      const rels = await xmlPart(readPart, relsPath(workbookPath), 'Relationships');
      const relationships = elements(rels, 'Relationship');
      const sheets = elements(element(workbook, 'sheets'), 'sheet').filter(sheet => {
        const state = sheet.getAttribute('state');
        return !state || state === 'visible';
      }).map(sheet => {
        const id = REL_TYPES.map(namespace => sheet.getAttributeNS(namespace, 'id')).find(Boolean);
        const relation = id && relationships.find(item => item.getAttribute('Id') === id);
        if (!relation) fail();
        return { name: sheet.getAttribute('name'), relation };
      }).filter(sheet => relIs(sheet.relation, 'worksheet'));
      const stringsRel = relationships.find(relation => relIs(relation, 'sharedStrings'));
      const sharedStrings = stringsRel
        ? elements(await xmlPart(readPart, targetPath(stringsRel, workbookPath), 'sst'), 'si').map(spreadsheetText)
        : [];

      for (const sheet of sheets) {
        const xml = await xmlPart(readPart, targetPath(sheet.relation, workbookPath), 'worksheet');
        const { rows, omittedCells } = sheetRows(xml, sharedStrings);
        if (rows.length) return { sheetName: sheet.name, rows, otherVisibleSheets: sheets.length - 1, omittedCells };
      }
      fail('El libro de Excel no contiene una hoja visible con datos de lectura directa.');
    } catch (error) {
      if (error.name === 'XlsxPreviewError') throw error;
      fail();
    }
  }

  window.MiCarteraV2ImportXlsx = { read };
})();
