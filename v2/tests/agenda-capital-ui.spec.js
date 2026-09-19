const assert = require('assert');
const fs = require('fs');
const path = require('path');

(() => {
  const app = path.join(__dirname, '../app');
  const shell = fs.readFileSync(path.join(app, 'operational-shell.html'), 'utf8');
  const agenda = fs.readFileSync(path.join(app, 'agenda-grouped-v2.js'), 'utf8');
  const cash = fs.readFileSync(path.join(app, 'cash-menu-v2.js'), 'utf8');
  const sw = fs.readFileSync(path.join(app, 'service-worker.js'), 'utf8');
  const release = JSON.parse(fs.readFileSync(path.join(app, 'release.json'), 'utf8'));

  assert.ok(shell.includes('<script src="agenda-grouped-v2.js"></script>'));
  assert.ok(shell.includes('<script src="cash-menu-v2.js"></script>'));
  assert.ok(agenda.includes('groupByClient'));
  assert.ok(agenda.includes('v2-agenda-overdue-card'));
  assert.ok(agenda.includes('VENCIDO'));
  assert.ok(cash.includes('Ingresar capital / ingreso'));
  assert.ok(cash.includes('Registrar egreso / gasto'));
  assert.ok(cash.includes("manualCash"));
  assert.ok(cash.includes('v2-more-menu'));
  assert.ok(sw.includes("'./agenda-grouped-v2.js'"));
  assert.ok(sw.includes("'./cash-menu-v2.js'"));
  assert.ok(sw.includes(`const BUILD='${release.build}'`));
  console.log('V2 agenda and capital UI: PASS');
})();
