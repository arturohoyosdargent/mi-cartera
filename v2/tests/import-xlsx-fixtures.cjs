const { crc32, deflateRawSync } = require('node:zlib');

const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const documentRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships';

function zip(parts, options = {}) {
  const bodies = [];
  const directory = [];
  let offset = 0;
  for (const [name, xml] of Object.entries(parts)) {
    const path = Buffer.from(name);
    const bytes = Buffer.from(xml);
    const method = options.stored ? 0 : 8;
    const payload = method ? deflateRawSync(bytes) : bytes;
    const flags = options.encrypted === name ? 1 : 0;
    const checksum = options.badCrc === name ? 0 : crc32(bytes);
    const size = options.badSize === name ? 1 : bytes.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(path.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt32LE(offset, 42);
    bodies.push(local, path, payload);
    directory.push(central, path);
    offset += local.length + path.length + payload.length;
  }
  const entries = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(entries.length, 12);
  end.writeUInt32LE(offset, 16);
  return Uint8Array.from(Buffer.concat([...bodies, entries, end])).buffer;
}

function worksheet(rows) {
  return '<worksheet xmlns="' + spreadsheet + '"><sheetData>' + rows + '</sheetData></worksheet>';
}

function workbook(rows, extra = {}) {
  const parts = {
    '_rels/.rels': '<Relationships xmlns="' + packageRel + '"><Relationship Id="root" Type="' + documentRel + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="' + spreadsheet + '" xmlns:r="' + documentRel + '"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + packageRel + '"><Relationship Id="rId1" Type="' + documentRel + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': worksheet(rows),
    ...extra
  };
  const worksheetTypes = Object.keys(parts)
    .filter(path => path.startsWith('xl/worksheets/'))
    .map(path => '<Override PartName="/' + path + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
    .join('');
  const sharedStringsType = parts['xl/sharedStrings.xml']
    ? '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    : '';
  return {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + worksheetTypes + sharedStringsType + '</Types>',
    ...parts
  };
}

// happy-dom leaves custom prefixed XML attributes in the null namespace.
function workbookDOMParser(window) {
  return class extends window.DOMParser {
    parseFromString(source, type) {
      const document = super.parseFromString(source, type);
      const namespace = document.documentElement?.getAttribute('xmlns:r');
      if (namespace) {
        for (const sheet of document.getElementsByTagName('sheet')) {
          const id = sheet.getAttribute('r:id');
          if (id !== null) sheet.setAttributeNS(namespace, 'r:id', id);
        }
      }
      return document;
    }
  };
}

module.exports = { zip, worksheet, workbook, spreadsheet, documentRel, packageRel, workbookDOMParser };
