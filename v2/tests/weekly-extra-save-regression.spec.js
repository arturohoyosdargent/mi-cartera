const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

// Historical rule reproduced only with fictional records: total720 = 4x100 + extra320.
const fixture=()=>({clients:[{id:'qa-weekly-extra-client',name:'Cliente semanal ficticio',routeId:'qa-route'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}});
function fill(h){
  const get=id=>h.w.document.getElementById(id);
  for(const [id,value] of Object.entries({cClient:'qa-weekly-extra-client',cCapital:'600',cRate:'20',cTerm:'4',cFreq:'weekly',cFirst:'2026-10-16',cDate:'2026-10-12',cRestDay:''}))get(id).value=value;
  get('cAccepted').checked=true;
  h.w.MiCarteraV2CreditFormParity.addExtraRow({date:'2026-11-11',amount:320});
  h.w.MiCarteraV2CreditFormParity.calc();return get;
}

test('saving through the reinstated actual form handler preserves the fifth weekly extra atomically',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    const get=fill(h);
    assert.match(get('v2SchedulePreview').textContent,/ADICIONAL/);
    h.w.MiCarteraV2DurableActions.install();
    await get('saveCredit').onclick();
    const d=h.get(),credit=d.credits[0];
    assert.equal(d.credits.length,1,JSON.stringify(h.alerts));
    assert.deepEqual(credit.schedule.map(q=>q.number),[1,2,3,4,'A1']);
    assert.deepEqual(credit.schedule.map(q=>q.amount),[100,100,100,100,320]);
    assert.equal(credit.total,720);assert.equal(credit.schedule.reduce((sum,q)=>sum+q.balance,0),720);
    assert.equal(credit.schedule.at(-1).date,'2026-11-11');assert.equal(credit.schedule.at(-1).extra,true);
    assert.equal(h.commits.length,1);assert.equal(d.cashMovements.length,1);assert.equal(d.cashMovements[0].amount,600);
    assert.equal(h.commits[0].entities.find(e=>e.collection==='credits').data.schedule.length,5);
    await h.w.MiCarteraV2CreditShare.image(credit,d.clients[0]);
    assert.ok(h.drawn.includes('A1'));assert.ok(h.drawn.some(s=>s.includes('320.00')));
    const reloaded=JSON.parse(h.w.localStorage.getItem('mi-cartera-v2-validation-state'));
    assert.equal(reloaded.credits[0].schedule.length,5);
  }finally{await h.close();}
});

test('a pending extra-credit ACK does not inject the fifth row into another ordinary plan',async()=>{
  const h=await boot({fullShell:true,state:fixture()});let acknowledge,pending;
  try{
    fill(h);h.w.MiCarteraV2CreditFormParity.installDurableScheduleOverride();
    h.w.MiCarteraV2SyncBridge.submit=()=>new Promise(resolve=>{acknowledge=resolve;});
    pending=h.w.V2UI.addCredit();await new Promise(resolve=>setImmediate(resolve));
    assert.ok(acknowledge,'the real save must reach its fictional transport boundary');
    const ordinary=h.w.MiCarteraV2CreditFormParity.plan({capital:600,rate:20,term:4,freq:'weekly',firstPaymentDate:'2026-10-16',extraPayments:[]});
    assert.equal(ordinary.schedule.length,4,'another preview must not inherit the pending credit extra');
    assert.deepEqual(Array.from(ordinary.schedule,q=>q.amount),[180,180,180,180]);
    h.w.document.getElementById('cCapital').value='900';
    h.w.document.querySelector('[data-v2-extra-amount]').value='10';
    h.w.MiCarteraV2CreditFormParity.calc();
    acknowledge({status:'COMMITTED'});acknowledge=null;await pending;pending=null;
    const saved=h.get().credits[0];
    assert.equal(saved.capital,600);assert.equal(saved.total,720);
    assert.deepEqual(saved.schedule.map(q=>q.amount),[100,100,100,100,320]);
  }finally{acknowledge?.({status:'COMMITTED'});if(pending)await pending;await h.close();}
});

test('the restored fifth row can be collected after the four normal weekly installments',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    const get=fill(h);h.w.MiCarteraV2DurableActions.install();await get('saveCredit').onclick();
    const creditId=h.get().credits[0].id;h.w.MiCarteraV2SharePreview.previewPayment=()=>{};
    h.w.prompt=()=> '400';await h.w.MiCarteraV2DurableActions.collect(creditId);
    const intermediate=h.get().credits[0];
    assert.deepEqual(intermediate.schedule.map(q=>q.balance),[0,0,0,0,320]);
    h.w.prompt=()=> '320';await h.w.MiCarteraV2DurableActions.collect(creditId);
    const d=h.get(),credit=d.credits[0],payment=d.payments.at(-1);
    assert.equal(d.payments.length,2,JSON.stringify(h.alerts));
    assert.deepEqual(credit.schedule.map(q=>q.balance),[0,0,0,0,0]);
    assert.equal(payment.amount,320);assert.equal(payment.totalInstallments,5);
    assert.equal(payment.installmentApplications[0].number,5);assert.equal(payment.balanceAfterPayment,0);
    assert.equal(d.cashMovements.filter(m=>m.type==='INGRESO').reduce((sum,m)=>sum+m.amount,0),720);
    assert.equal(h.commits.length,3,'one credit plus two payments, without duplicate operations');
  }finally{await h.close();}
});

test('invalid extra date collision rejects the actual save without financial writes',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    const get=fill(h),before=JSON.stringify(h.get());
    h.w.document.querySelector('[data-v2-extra-date]').value='2026-10-23';
    h.w.MiCarteraV2DurableActions.install();await get('saveCredit').onclick();
    assert.equal(h.commits.length,0);assert.equal(JSON.stringify(h.get()),before);
    assert.ok(h.alerts.some(s=>/COLLISION|cronograma/i.test(s)));
  }finally{await h.close();}
});
