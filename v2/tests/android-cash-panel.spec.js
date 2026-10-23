const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot,KEY}=require('./dom-harness.cjs');

test('other income opens as operating income while the separate capital action stays capital',async()=>{
  const h=await boot();
  try{
    const d=h.w.document,before=h.w.localStorage.getItem(KEY);
    d.querySelector('[data-v2-cash-type="INGRESO"]:not([data-v2-cash-capital])').click();
    a.equal(d.getElementById('v2CashCategory').value,'OTRO_INGRESO');
    d.querySelector('#v2CashForm [data-close]').click();
    d.querySelector('[data-v2-cash-capital]').click();
    a.equal(d.getElementById('v2CashCategory').value,'APORTE_CAPITAL');
    a.equal(d.getElementById('v2CashCategory').disabled,true);
    a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('cash date inputs appear only for a custom range and keep the chosen range without writes',async()=>{
  const h=await boot();
  try{
    const d=h.w.document,before=h.w.localStorage.getItem(KEY),period=d.getElementById('cashHistoryPeriod');
    const from=d.getElementById('cashHistoryFrom'),to=d.getElementById('cashHistoryTo');
    a.equal(from.closest('label').hidden,true);a.equal(to.closest('label').hidden,true);
    period.value='RANGE';period.dispatchEvent(new h.w.Event('change'));
    a.equal(from.closest('label').hidden,false);a.equal(to.closest('label').hidden,false);
    from.value='2026-10-01';to.value='2026-10-20';
    period.value='TODAY';period.dispatchEvent(new h.w.Event('change'));
    a.equal(from.closest('label').hidden,true);
    period.value='RANGE';period.dispatchEvent(new h.w.Event('change'));
    a.equal(from.value,'2026-10-01');a.equal(to.value,'2026-10-20');
    a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('negative cash explains the shortfall and reserves without hiding or rewriting the recorded balance',async()=>{
  const h=await boot();
  try{
    h.w.MiCarteraV2Dates.today=()=> '2026-10-23';
    const state=h.get();state.cashMovements=[
      {id:'fictional-in',date:'2026-10-01',type:'INGRESO',category:'APORTE_CAPITAL',amount:100},
      {id:'fictional-out',date:'2026-10-02',type:'EGRESO',category:'GASTO_OPERATIVO',amount:170},
      {id:'fictional-reserve',date:'2026-10-30',type:'EGRESO',category:'SERVICIOS',amount:20}
    ];h.set(state);const before=h.w.localStorage.getItem(KEY);
    h.w.MiCarteraV2CashMenu.renderSummary();
    const d=h.w.document,notice=d.getElementById('cashBalanceNotice');
    a.ok(notice,'a negative balance needs an explanation beside the summary');
    a.equal(notice.hidden,false);a.match(notice.textContent,/70\.00/);
    a.match(d.getElementById('cashBalance').textContent,/-70\.00/);
    a.match(d.getElementById('cashOpAvailable').textContent,/-90\.00/);
    a.match(d.getElementById('cashOperationalScope').textContent,/23\/10\/2026/);
    a.equal(d.getElementById('cashLiquidityEvolution').closest('details').open,false);
    a.equal(d.getElementById('cashPeriodInterest').closest('details').open,false);
    a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});
