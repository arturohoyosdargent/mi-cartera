const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { zip, worksheet, workbook, spreadsheet, documentRel, packageRel, workbookDOMParser } = require('./import-xlsx-fixtures.cjs');

async function loadReader() {
  const { Window } = await import('happy-dom');
  const window = new Window();
  const script = readFileSync(join(__dirname, '../app/import-xlsx-v2.js'), 'utf8');
  runInNewContext(script, { window, DOMParser: workbookDOMParser(window), ArrayBuffer, Blob, DecompressionStream, TextDecoder });
  return window.MiCarteraV2ImportXlsx.read;
}


test('reads a deflated workbook with exact strings, sparse columns and row numbers', async () => {
  const read = await loadReader();
  const workbookFile = workbook(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>DNI</t></is></c></row>' +
    '<row r="4"><c r="A4" t="inlineStr"><is><r><t>Ana </t></r><r><t>Muñoz</t></r></is></c><c r="C4" t="s"><v>1</v></c><c r="D4"><v>120.50</v></c></row>' +
    '<row r="8"><c r="A8" t="inlineStr"><is><t>Rosa</t></is></c></row>',
    {
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + packageRel + '"><Relationship Id="rId1" Type="' + documentRel + '/worksheet" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + documentRel + '/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst xmlns="' + spreadsheet + '"><si><t>Nombre</t></si><si><t>00123456</t></si></sst>'
    }
  );

  const result = await read(zip(workbookFile));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    sheetName: 'Clientes',
    rows: [
      { number: 1, cells: ['Nombre', '', 'DNI'] },
      { number: 4, cells: ['Ana Muñoz', '', '00123456', '120.50'] },
      { number: 8, cells: ['Rosa', '', ''] }
    ],
    otherVisibleSheets: 0,
    omittedCells: 0
  });
});

test('uses the first populated visible worksheet and omits cells with formulas', async () => {
  const read = await loadReader();
  const rels = [
    '<Relationship Id="rId1" Type="' + documentRel + '/worksheet" Target="worksheets/oculta.xml"/>',
    '<Relationship Id="rId2" Type="' + documentRel + '/worksheet" Target="worksheets/vacia.xml"/>',
    '<Relationship Id="rId3" Type="' + documentRel + '/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId4" Type="' + documentRel + '/worksheet" Target="worksheets/sheet2.xml"/>'
  ].join('');
  const result = await read(zip(workbook(
    '<row r="2"><c r="A2"><f>1+2</f><v>3</v></c><c r="B2" t="inlineStr"><is><t>Dato</t></is></c><c r="C2" t="e"><v>#DIV/0!</v></c></row>',
    {
      'xl/workbook.xml': '<workbook xmlns="' + spreadsheet + '" xmlns:r="' + documentRel + '"><sheets><sheet name="Oculta" sheetId="1" state="hidden" r:id="rId1"/><sheet name="Vacía" sheetId="2" r:id="rId2"/><sheet name="Primera con datos" sheetId="3" r:id="rId3"/><sheet name="Posterior" sheetId="4" r:id="rId4"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + packageRel + '">' + rels + '</Relationships>',
      'xl/worksheets/oculta.xml': worksheet('<row><c><v>42</v></c></row>'),
      'xl/worksheets/vacia.xml': worksheet('<row><c/></row>'),
      'xl/worksheets/sheet2.xml': worksheet('<row><c><v>19</v></c></row>')
    }
  ), { stored: true }));
  assert.equal(result.sheetName, 'Primera con datos');
  assert.equal(result.otherVisibleSheets, 2);
  assert.equal(result.omittedCells, 2);
  assert.deepEqual(Array.from(result.rows[0].cells), ['', 'Dato']);
});

test('rejects protected, corrupt and externally linked worksheets', async () => {
  const read = await loadReader();
  const sheet = 'xl/worksheets/sheet1.xml';
  const parts = workbook('<row><c><v>1</v></c></row>');
  await assert.rejects(read(zip(parts, { encrypted: sheet })), /protegido/i);
  await assert.rejects(read(zip(parts, { badCrc: sheet })), /dañado/i);
  await assert.rejects(read(zip(parts, { badSize: sheet })), /dañado/i);
  await assert.rejects(read(new Uint8Array([1, 2, 3]).buffer), /xlsx/i);
  await assert.rejects(read(zip({
    ...parts,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + packageRel + '"><Relationship Id="rId1" Type="' + documentRel + '/worksheet" Target="https://example.invalid/xl/sheet.xml" TargetMode="External"/></Relationships>'
  })), /externo/i);
});

test('rejects oversized input and worksheets without readable data', async () => {
  const read = await loadReader();
  await assert.rejects(read(new ArrayBuffer(5 * 1024 * 1024 + 1)), /5 MB/);
  await assert.rejects(read(zip(workbook('<row><c r="CW1"><v>1</v></c></row>'))), /100 columnas/);
  await assert.rejects(read(zip(workbook('<row><c><v>1</v></c></row>'.repeat(5002)))), /5000 filas/);
  await assert.rejects(read(zip(workbook(' '.repeat(8 * 1024 * 1024)))), /descomprimido/i);
  await assert.rejects(read(zip(workbook('<row><c><f>1+2</f><v>3</v></c></row>'))), /datos/i);
});

test('accepts a header plus exactly 5000 data rows', async () => {
  const read = await loadReader();
  const result = await read(zip(workbook(
    '<row><c t="inlineStr"><is><t>Nombre</t></is></c></row>' +
    '<row><c t="inlineStr"><is><t>Cliente</t></is></c></row>'.repeat(5000)
  )));
  assert.equal(result.rows.length, 5001);
  assert.equal(result.rows.at(-1).number, 5001);
});
