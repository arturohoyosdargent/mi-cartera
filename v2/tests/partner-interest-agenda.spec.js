const assert = require('assert');
const Agenda = require('../core/partner-interest-agenda.js');

(() => {
  const valid = {
    id: 'loan-valid',
    partner: 'Ricardo Arboleda',
    date: '2026-06-05',
    principal: 1000,
    firstDue: '2026-07-05',
    closedAt: null,
    interestPayments: [],
    repayments: [],
    terms: [{from:'2026-07-05', amount:100}]
  };
  const missingPartner = {...valid, id:'loan-missing-partner', partner:undefined};
  const missingId = {...valid, id:undefined, partner:'Socio sin id'};

  assert.doesNotThrow(() => Agenda.build([valid, missingPartner, missingId], '2026-10-06', '2026-10'));
  const model = Agenda.build([valid, missingPartner, missingId], '2026-10-06', '2026-10');
  assert.strictEqual(model.monthRows.length, 3);
  assert.ok(model.monthRows.some(row => row.partner === undefined));
  assert.ok(model.monthRows.some(row => row.loanId === undefined));
  console.log('V2 partner interest agenda missing sort fields: PASS');
})();
