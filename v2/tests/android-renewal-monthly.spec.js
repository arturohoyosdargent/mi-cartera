const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

// Isolated fictional predecessor: paid 400, remaining debt 320, principal 300.
// Only external cloud/PNG/share boundaries use the existing harness fixtures.
const fixture=(freq='monthly')=>({
  clients:[{id:'android-date-client',name:'Prueba Mensual',phone:'999000000',routeId:'fixture-route'}],
  credits:[{id:'android-date-old',clientId:'android-date-client',routeId:'fixture-route',
    capital:600,total:720,rate:20,term:4,freq,restDay:'',date:'2026-06-01',
    principalPaid:300,interestPaid:100,penaltyPaid:0,status:'ACTIVO',version:1,
    schedule:[
      {number:1,date:'2026-07-01',amount:200,paid:200,balance:0,status:'PAGADA'},
      {number:2,date:'2026-08-01',amount:200,paid:200,balance:0,status:'PAGADA'},
      {number:3,date:'2026-09-01',amount:320,paid:0,balance:320,status:'PENDIENTE'}]}],
  payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}
});

async function start({date='2026-10-23',method='refinance',freq='monthly',fullShell=false}={}){
  const h=await boot({state:fixture(freq),fullShell});
  h.w.MiCarteraV2Dates.today=()=>date;
  const get=id=>h.w.document.getElementById(id);
  const pending=h.w.MiCarteraV2DurableActions[method]('android-date-old');
  assert.ok(get('v2RenewalForm'),JSON.stringify(h.alerts));
  const set=(id,value,event='change')=>{get(id).value=value;get(id).dispatchEvent(new h.w.Event(event));};
  const close=async()=>{get('v2ReviewBack')?.click();get('v2RenewCancel')?.click();await pending;await h.close();};
  return {...h,get:id=>id===undefined?h.get():get(id),set,pending,close};
}

function review(h){h.get('v2RenewReview').click();assert.ok(h.get('v2RenewalReview'),JSON.stringify(h.alerts));}
function confirm(h){h.get('v2RenewAccepted').checked=true;h.get('v2RenewAccepted').onchange();h.get('v2ConfirmRenewal').click();}
function addExtra(h,date,amount){
  h.get('v2RenewAddExtra').click();
  const row=h.w.document.querySelector('[data-v2-renew-extra-row]');
  row.querySelector('[data-v2-renew-extra-date]').value=date;
  row.querySelector('[data-v2-renew-extra-amount]').value=amount;
  row.querySelector('[data-v2-renew-extra-amount]').dispatchEvent(new h.w.Event('input'));
}
function previewDates(h){return Array.from(h.get('v2RenewSchedule').querySelectorAll('tbody tr'),row=>row.children[1].textContent);}

// Catches initial same-day defaults and fixed-day arithmetic across month ends.
for(const [date,first] of [
  ['2026-10-23','2026-11-23'],['2026-01-31','2026-02-28'],
  ['2028-01-31','2028-02-29'],['2028-02-29','2028-03-29'],
  ['2026-12-31','2027-01-31']
])test(`monthly renewal defaults ${date} to calendar anniversary ${first}`,async()=>{
  const h=await start({date});
  try{
    assert.equal(h.get('v2RenewDate').value,date);
    assert.equal(h.get('v2RenewFirstDate').value,first);
    assert.equal(previewDates(h)[0],first);
    assert.ok(h.get('v2RenewFirstDate').min>date,'date picker excludes the credit day');
    assert.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('automatic first date follows credit date edits and switching into monthly',async()=>{
  const h=await start({freq:'weekly'});
  try{
    assert.equal(h.get('v2RenewFirstDate').value,'2026-10-23','existing weekly default is retained');
    h.set('v2RenewFreq','monthly','input');
    assert.equal(h.get('v2RenewFirstDate').value,'2026-11-23');
    h.set('v2RenewDate','2028-01-31','input');
    assert.equal(h.get('v2RenewFirstDate').value,'2028-02-29');
    h.set('v2RenewDate','2028-02-29');
    assert.equal(h.get('v2RenewFirstDate').value,'2028-03-29');
    assert.equal(previewDates(h)[0],'2028-03-29');
    assert.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('explicit future first date survives credit date and frequency edits',async()=>{
  const h=await start();
  try{
    h.set('v2RenewFirstDate','2027-03-15','input');
    h.set('v2RenewDate','2026-11-30');
    h.set('v2RenewFreq','weekly');h.set('v2RenewFreq','monthly');
    assert.equal(h.get('v2RenewFirstDate').value,'2027-03-15');
    assert.deepEqual(previewDates(h),['2027-03-15','2027-04-15','2027-05-15','2027-06-15']);
    review(h);assert.match(h.get('v2RenewalReview').textContent,/Primera cuota:\s*2027-03-15/);
    assert.equal(h.commits.length,0);
  }finally{await h.close();}
});

// A chosen date equal to the old automatic default is still an explicit choice.
test('explicit selection of a future default remains selected after credit date changes',async()=>{
  const h=await start();
  try{
    h.set('v2RenewFirstDate','2026-11-23');
    h.set('v2RenewDate','2026-10-25');
    assert.equal(h.get('v2RenewFirstDate').value,'2026-11-23');
    assert.equal(previewDates(h)[0],'2026-11-23');
  }finally{await h.close();}
});

for(const method of ['renewInterest','refinance']){
  test(`${method}: monthly same-day first NORMAL installment blocks review and all writes`,async()=>{
    const h=await start({method});
    try{
      const before=JSON.stringify(h.get());
      h.set('v2RenewFirstDate','2026-10-23');h.get('v2RenewReview').click();
      assert.equal(h.get('v2RenewalReview'),null);
      assert.ok(h.alerts.some(message=>/primera cuota.*posterior|primera cuota.*mismo día/i.test(message)));
      assert.equal(h.get('v2RenewMaturity').value,'');
      assert.equal(h.commits.length,0);assert.equal(JSON.stringify(h.get()),before);
      h.set('v2RenewFirstDate','2026-10-22');h.get('v2RenewReview').click();
      assert.equal(h.get('v2RenewalReview'),null);
      assert.equal(h.commits.length,0);assert.equal(JSON.stringify(h.get()),before);
    }finally{await h.close();}
  });

  test(`${method}: monthly accepted dates preserve totals, accumulated payments, optional extra and WhatsApp`,async()=>{
    const h=await start({method,fullShell:true});
    try{
      const before=JSON.stringify(h.get()),interest=method==='renewInterest';let config,outgoing;
      h.w.MiCarteraV2SharePreview.open=value=>{config=value;};
      h.w.MiCarteraV2SharePreview.previewCredit=()=>{};
      h.w.MiCarteraV2ClientShare.send=async value=>{outgoing=value;};
      h.set('v2RenewDate','2026-01-31');
      addExtra(h,'2026-06-01',interest?'60':'120');
      review(h);
      const dates=['2026-02-28','2026-03-28','2026-04-28','2026-05-28','2026-06-01'];
      const amounts=interest?[75,75,75,75,60]:[150,150,150,150,120];
      assert.deepEqual(Array.from(h.get('v2RenewalReview').querySelectorAll('tbody tr'),row=>row.children[1].textContent),dates);
      h.get('v2ShareRenewal').click();assert.ok(config);
      assert.equal(config.message,'Hola Prueba, te comparto tu propuesta de renovación. ¿Me confirmas si estás de acuerdo?');
      for(const date of dates)assert.ok(config.summary.includes(date));
      await config.send(config.message);
      assert.equal(outgoing.text,config.message);assert.equal(outgoing.file.type,'image/png');
      assert.ok(h.drawn.includes('A1'));assert.ok(h.drawn.includes(interest?'S/ 360.00':'S/ 720.00'));
      assert.equal(JSON.stringify(h.get()),before,'review and sharing never register the renewal');
      assert.equal(h.commits.length,0);
      confirm(h);await h.pending;
      const d=h.get(),old=d.credits[0],credit=d.credits[1];
      assert.equal(d.credits.length,2,JSON.stringify(h.alerts));assert.equal(h.commits.length,1);
      assert.equal(old.status,'RENOVADO');assert.equal(old.principalPaid,300);
      assert.equal(old.interestPaid,interest?160:100);assert.equal(old.penaltyPaid,0);
      assert.deepEqual(old.schedule,JSON.parse(before).credits[0].schedule,'predecessor paid rows and accumulated balances remain intact');
      assert.equal(old.renewedTo,credit.id);assert.equal(credit.renewedFrom,old.id);
      assert.equal(credit.capital,interest?300:600);assert.equal(credit.total,interest?360:720);
      assert.equal(credit.previousBalance,320);assert.equal(credit.netDisbursement,interest?0:280);
      assert.equal(credit.principalPaid,0);assert.equal(credit.interestPaid,0);assert.equal(credit.penaltyPaid,0);
      assert.equal(credit.firstPaymentDate,'2026-02-28');assert.equal(credit.requestedFirstPaymentDate,'2026-02-28');
      assert.equal(credit.maturity,'2026-06-01');
      assert.deepEqual(credit.schedule.map(row=>row.date),dates);assert.deepEqual(credit.schedule.map(row=>row.amount),amounts);
      assert.deepEqual(credit.schedule.map(row=>row.balance),amounts);
      assert.equal(credit.schedule.reduce((sum,row)=>sum+row.amount,0),interest?360:720);
      assert.equal(credit.schedule.reduce((sum,row)=>sum+row.paid,0),0);
      assert.equal(d.payments.length,interest?1:0);
      if(interest){assert.equal(d.payments[0].amount,60);assert.equal(d.payments[0].capitalAmount,0);assert.equal(d.payments[0].interestAmount,60);}
      assert.equal(d.cashMovements.length,1);assert.equal(d.cashMovements[0].amount,interest?60:280);
      assert.deepEqual(Array.from(h.w.MiCarteraV2Financial.validateChain(d.credits)),[]);
    }finally{await h.close();}
  });
}

test('switching to monthly preserves an explicit later first date while same-day optional extra remains supported',async()=>{
  const h=await start({freq:'weekly'});
  try{
    h.set('v2RenewFirstDate','2026-12-15');h.set('v2RenewFreq','monthly');
    addExtra(h,'2026-10-23','120');
    assert.equal(h.get('v2RenewFirstDate').value,'2026-12-15');review(h);
    const rows=h.get('v2RenewalReview').querySelectorAll('tbody tr');
    assert.match(rows[0].textContent,/A1.*2026-10-23.*ADICIONAL/);
    assert.match(rows[1].textContent,/1.*2026-12-15.*CUOTA/);
    assert.equal(h.commits.length,0);
  }finally{await h.close();}
});
