const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

async function form({date='2027-01-31',capital='100',rate='10',term='3'}={}){
  const h=await boot({fullShell:true});
  const el=id=>h.w.document.getElementById(id);
  const set=(id,value)=>{
    el(id).value=value;
    el(id).dispatchEvent(new h.w.Event('change',{bubbles:true}));
  };
  for(const [id,value] of Object.entries({cClient:'c1',cDate:date,cCapital:capital,cRate:rate,cTerm:term,cFreq:'monthly'}))set(id,value);
  el('cAccepted').checked=true;
  return {...h,el,set,setState:h.set,plan:()=>h.w.MiCarteraV2CreditFormParity.plan(),save:()=>h.w.MiCarteraV2DurableActions.addCredit()};
}

test('monthly creation defaults to the next calendar month and saves the accepted preview and disbursement date',async()=>{
  const h=await form();
  try{
    assert.equal(h.el('cFirst').value,'2027-02-28');
    const preview=h.plan();
    assert.equal(preview.error,'');
    assert.equal(preview.total,110);
    assert.equal(preview.regularInstallment,36.66);
    assert.match(h.el('cInstallmentPreview').textContent,/36\.66/);
    assert.deepEqual(Array.from(preview.schedule,q=>q.date),['2027-02-28','2027-03-28','2027-04-28']);
    assert.deepEqual(Array.from(preview.schedule,q=>q.amount),[36.66,36.66,36.68]);
    assert.equal(h.commits.length,0);
    await h.save();
    assert.equal(h.commits.length,1,h.alerts.join('\n'));
    const op=h.commits[0],saved=h.get();
    const credit=saved.credits[0],movement=saved.cashMovements[0];
    assert.equal(op.type,'CREDIT_CREATE');
    assert.equal(credit.date,'2027-01-31');
    assert.equal(credit.firstPaymentDate,'2027-02-28');
    assert.equal(credit.requestedFirstPaymentDate,'2027-02-28');
    assert.equal(credit.maturity,'2027-04-28');
    assert.deepEqual(credit.schedule,JSON.parse(JSON.stringify(preview.schedule)));
    assert.equal(movement.date,'2027-01-31');
    assert.equal(movement.amount,100);
    assert.equal(movement.ref,credit.id);
    assert.equal(op.audit.detail.date,'2027-01-31');
    assert.equal(saved.payments.length,0);
  }finally{await h.close();}
});

test('the monthly suggestion clamps leap years and does not overwrite a first date explicitly selected by the user',async()=>{
  const h=await form({date:'2028-01-31'});
  try{
    assert.equal(h.el('cFirst').value,'2028-02-29');
    h.set('cDate','2028-01-25');
    assert.equal(h.el('cFirst').value,'2028-02-25');
    h.set('cFirst','2028-02-25');
    h.set('cDate','2028-01-27');
    assert.equal(h.el('cFirst').value,'2028-02-25');
    assert.equal(h.plan().schedule[0].date,'2028-02-25');
    h.set('cFirst','');
    h.set('cDate','2028-01-31');
    assert.equal(h.el('cFirst').value,'2028-02-29');
  }finally{await h.close();}
});

test('a first monthly installment on or before disbursement cannot create a credit, cash movement or audit event',async()=>{
  const h=await form();
  try{
    const initial=h.get();
    for(const invalid of ['2027-01-31','2027-01-30']){
      h.set('cFirst',invalid);
      assert.notEqual(h.plan().error,'');
      assert.equal(h.plan().schedule.length,0);
      await h.save();
      assert.equal(h.commits.length,0);
      assert.deepEqual(h.get(),initial);
    }
  }finally{await h.close();}
});

test('a same-day additional payment does not replace the first regular installment after a rest-day shift',async()=>{
  const h=await form({date:'2026-06-01',capital:'100.01',rate:'0'});
  try{
    h.set('cFirst','2026-07-05');
    h.set('cRestDay','0');
    h.w.MiCarteraV2CreditFormParity.addExtraRow({date:'2026-06-01',amount:10.01});
    const preview=h.plan();
    assert.equal(preview.first,'2026-07-06');
    assert.deepEqual(Array.from(preview.schedule,q=>q.date),['2026-06-01','2026-07-06','2026-08-05','2026-09-05']);
    assert.deepEqual(Array.from(preview.schedule,q=>q.amount),[10.01,30,30,30]);
    await h.save();
    assert.equal(h.commits.length,1,h.alerts.join('\n'));
    const credit=h.get().credits[0];
    assert.equal(credit.firstPaymentDate,'2026-07-06');
    assert.equal(credit.requestedFirstPaymentDate,'2026-07-05');
    assert.equal(credit.total,100.01);
  }finally{await h.close();}
});

test('monthly installment amounts divide integer cents evenly in both copies of the scheduler',()=>{
  for(const engine of [require('../core/schedule-engine'),require('../app/core/schedule-engine')]){
    const schedule=engine.generate({total:0.58,term:2,freq:'monthly',firstPaymentDate:'2027-02-28'});
    assert.deepEqual(schedule.map(q=>q.amount),[0.29,0.29]);
    assert.deepEqual(schedule.map(q=>q.balance),[0.29,0.29]);
  }
});

test('monthly preview rounds the capital to cents before calculating the saved total',async()=>{
  const h=await form({capital:'100.004',rate:'30'});
  try{
    const preview=h.plan();
    assert.equal(preview.total,130);
    assert.equal(preview.capital,100);
    assert.deepEqual(Array.from(preview.schedule,q=>q.amount),[43.33,43.33,43.34]);
    await h.save();
    assert.equal(h.commits.length,1,h.alerts.join('\n'));
    assert.equal(h.get().credits[0].total,preview.total);
    assert.equal(h.get().cashMovements[0].amount,preview.capital);
  }finally{await h.close();}
});

// Identical terms belong to the form; the operation ID identifies a single save.
test('multiple-credit creation accepts three identical active loans with independent collection and cash',async()=>{
  const h=await form();
  try{
    const {collect}=require('./collection-form-driver.cjs');
    h.w.MiCarteraV2Dates.today=()=> '2027-02-28';
    await h.save();
    const first=h.get().credits[0];
    assert.ok(first,h.alerts.join(' | '));
    await h.save();
    assert.equal(h.commits.length,1,'a completed click needs a new acceptance');
    for(let index=0;index<2;index++){
      h.el('cAccepted').checked=true;
      await h.save();
    }
    const saved=h.get();
    assert.equal(saved.credits.length,3,h.alerts.join(' | '));
    assert.equal(new Set(saved.credits.map(c=>c.id)).size,3);
    assert.equal(new Set(h.commits.map(op=>op.operationId)).size,3);
    assert.deepEqual(saved.credits[0],first);
    for(const credit of saved.credits){
      assert.equal(credit.clientId,first.clientId);
      assert.equal(credit.status,first.status);
      assert.equal(credit.capital,first.capital);
      assert.equal(credit.rate,first.rate);
      assert.equal(credit.maturity,first.maturity);
      assert.deepEqual(credit.schedule,first.schedule);
      assert.deepEqual(saved.cashMovements.filter(m=>m.ref===credit.id).map(m=>m.amount),[100]);
      assert.equal(saved.audit.filter(a=>a.entityId===credit.id).length,1);
    }
    await collect(h,saved.credits[1].id,'20');
    const after=h.get();
    assert.equal(after.payments.length,1,h.alerts.join(' | '));
    assert.equal(after.payments[0].creditId,saved.credits[1].id);
    assert.equal(after.credits[1].schedule[0].balance,16.66);
    assert.deepEqual(after.credits[0],saved.credits[0]);
    assert.deepEqual(after.credits[2],saved.credits[2]);
  }finally{await h.close();}
});

test('multiple-credit creation uses one durable operation for a double click and an uncertain retry',async()=>{
  const h=await form();
  try{
    let rejectFirst;
    h.w.MiCarteraV2SyncBridge.submit=op=>{
      h.commits.push(op);
      return new Promise((resolve,reject)=>{rejectFirst=reject});
    };
    const pending=h.save();
    await h.save();
    assert.equal(h.commits.length,1);
    rejectFirst(Object.assign(new Error('Network timeout'),{code:'unavailable'}));
    await pending;
    assert.equal(h.get().credits.length,0);
    const first=h.commits[0];
    h.w.MiCarteraV2SyncBridge.submit=async op=>{
      h.commits.push(op);
      return {status:'ALREADY_APPLIED',operation:{id:op.operationId}};
    };
    const hydrated=h.get(),meta={updatedAt:'fictional-time'};
    hydrated.credits=[{...first.entities[0].data,...meta}];
    hydrated.cashMovements=[{...first.entities[1].data,...meta}];
    hydrated.audit=[{...first.audit,version:1,...meta}];
    h.setState(hydrated);
    await h.save();
    assert.equal(h.commits.length,2,h.alerts.join(' | '));
    assert.deepEqual(h.commits[1],first,'retry uses original entity IDs and audit');
    assert.equal(h.el('cAccepted').checked,false,'accepted retry consumes this acceptance');
    assert.deepEqual(h.get(),JSON.parse(JSON.stringify(hydrated)));
  }finally{await h.close();}
});
