const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

// Fictional predecessor: four paid S/100 installments, one unpaid S/320 extra.
// Debt = 320; new capital600 - debt320 = net280. New debt720 = 4x100 + extra320.
const fixture=()=>({clients:[{id:'qa-renew-extra-client',name:'Celso (prueba ficticia)',routeId:'qa-route'}],
  credits:[{id:'qa-renew-extra-old',clientId:'qa-renew-extra-client',capital:600,total:720,rate:20,
    term:4,freq:'weekly',principalPaid:300,interestPaid:100,penaltyPaid:0,status:'ACTIVO',version:1,
    schedule:[...['2026-09-11','2026-09-18','2026-09-25','2026-10-02'].map((date,i)=>({number:i+1,date,amount:100,paid:100,balance:0,status:'PAGADA'})),
      {number:'A1',date:'2026-10-09',amount:320,paid:0,balance:320,status:'PENDIENTE',extra:true,type:'ADICIONAL'}]}],
  payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}});
function form(h){
  const get=id=>h.w.document.getElementById(id);
  for(const [id,value] of Object.entries({v2RenewDate:'2026-10-12',v2RenewCapital:'600',v2RenewRate:'20',v2RenewTerm:'4',v2RenewFreq:'weekly',v2RenewFirstDate:'2026-10-16',v2RenewRest:''}))get(id).value=value;
  return get;
}
function addExtra(h,{date='2026-11-13',amount='320'}={}){
  const button=h.w.document.getElementById('v2RenewAddExtra');
  a.ok(button,'renewal must expose its own optional extra installment editor');button.click();
  const rows=h.w.document.querySelectorAll('[data-v2-renew-extra-row]'),row=rows[rows.length-1];
  row.querySelector('[data-v2-renew-extra-date]').value=date;
  row.querySelector('[data-v2-renew-extra-amount]').value=amount;
  row.querySelector('[data-v2-renew-extra-amount]').dispatchEvent(new h.w.Event('input'));
  return row;
}
function confirm(get){get('v2RenewAccepted').checked=true;get('v2RenewAccepted').onchange();get('v2ConfirmRenewal').click();}
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('weekly renewal keeps the complete fifth extra in review and PNG while WhatsApp requests confirmation without repeating amounts',async()=>{
  const h=await boot({fullShell:true,state:fixture()});let pending;
  try{
    const before=JSON.stringify(h.get());let config,outgoing;
    h.w.MiCarteraV2SharePreview.open=value=>{config=value;};
    h.w.MiCarteraV2ClientShare.send=async value=>{outgoing=value;};
    pending=h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');const get=form(h);addExtra(h);
    const previewRows=get('v2RenewSchedule').querySelectorAll('tbody tr');
    a.deepEqual(Array.from(previewRows,q=>q.children[3].textContent),['S/ 100.00','S/ 100.00','S/ 100.00','S/ 100.00','S/ 320.00']);
    a.equal(get('v2RenewTotal').textContent,'S/ 720.00');a.equal(get('v2RenewMaturity').value,'2026-11-13');
    get('v2RenewReview').click();
    const review=get('v2RenewalReview');a.ok(review,JSON.stringify(h.alerts));
    a.match(review.textContent,/4 cuotas normales\s*\+\s*1 adicional/);
    const rows=review.querySelectorAll('tbody tr');a.equal(rows.length,5);
    a.match(rows[4].textContent,/A1.*2026-11-13.*ADICIONAL.*320\.00/);
    a.match(review.textContent,/Total nuevo:\s*S\/ 720\.00/);a.match(review.textContent,/Neto a desembolsar:\s*S\/ 280\.00/);
    get('v2ShareRenewal').click();a.ok(config);a.match(config.message,/^Hola Celso,/);a.match(config.message,/confirmas.*acuerdo/);
    a.doesNotMatch(config.message,/S\/|Capital:|Total:|Cuotas:|CRONOGRAMA|2026-/);
    a.match(config.summary,/4 cuotas normales\s*\+\s*1 adicional/);
    for(const date of ['2026-10-16','2026-10-23','2026-10-30','2026-11-06','2026-11-13'])a.ok(config.summary.includes(date));
    await config.send(config.message);a.equal(outgoing.text,config.message);a.equal(outgoing.file.type,'image/png');
    a.ok(h.drawn.includes('A1'));a.ok(h.drawn.includes('ADICIONAL'));a.ok(h.drawn.includes('S/ 320.00'));
    a.ok(h.drawn.includes('Neto a desembolsar'));a.ok(h.drawn.includes('S/ 280.00'));
    a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0,'proposal and sharing must not register debt');
  }finally{h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
});

test('refinance persists the accepted fifth once and collecting four normal rows plus extra extinguishes only the new debt',async()=>{
  const h=await boot({fullShell:true,state:fixture()});let pending;
  try{
    h.w.MiCarteraV2SharePreview.previewCredit=()=>{};h.w.MiCarteraV2SharePreview.previewPayment=()=>{};
    pending=h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');const get=form(h);addExtra(h);get('v2RenewReview').click();confirm(get);await pending;pending=null;
    const d=h.get(),old=d.credits[0],credit=d.credits[1];a.equal(d.credits.length,2,JSON.stringify(h.alerts));
    a.equal(old.status,'RENOVADO');a.equal(old.renewedTo,credit.id);a.equal(credit.renewedFrom,old.id);
    a.equal(credit.previousBalance,320);a.equal(credit.netDisbursement,280);a.equal(credit.total,720);
    a.deepEqual(credit.schedule.map(q=>q.amount),[100,100,100,100,320]);a.equal(credit.schedule[4].extra,true);
    a.equal(credit.schedule[4].date,'2026-11-13');a.equal(credit.maturity,'2026-11-13');
    a.equal(credit.schedule.reduce((sum,q)=>sum+q.balance,0),720);
    a.equal(h.commits[0].entities.find(e=>e.kind==='create'&&e.collection==='credits').data.schedule.length,5);
    a.equal(d.cashMovements.length,1);a.equal(d.cashMovements[0].amount,280);
    const reload=JSON.parse(h.w.localStorage.getItem('mi-cartera-v2-validation-state'));a.equal(reload.credits[1].schedule.length,5);
    await h.w.MiCarteraV2DurableActions.refinance(old.id);a.equal(h.commits.length,1,'a renewed predecessor cannot create another debt');
    h.w.prompt=()=> '400';await h.w.MiCarteraV2DurableActions.collect(credit.id);
    a.deepEqual(h.get().credits[1].schedule.map(q=>q.balance),[0,0,0,0,320]);
    h.w.prompt=()=> '320';await h.w.MiCarteraV2DurableActions.collect(credit.id);
    const paid=h.get(),payment=paid.payments.at(-1);a.deepEqual(paid.credits[1].schedule.map(q=>q.balance),[0,0,0,0,0]);
    a.equal(payment.amount,320);a.equal(payment.totalInstallments,5);a.equal(payment.installmentApplications[0].number,5);a.equal(payment.balanceAfterPayment,0);
    a.equal(paid.payments.length,2);a.equal(paid.cashMovements.filter(m=>m.type==='INGRESO').reduce((sum,m)=>sum+m.amount,0),720);
    a.equal(h.commits.length,3);a.deepEqual(Array.from(h.w.MiCarteraV2Financial.validateChain(paid.credits)),[]);
  }finally{h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
});

test('interest-only weekly renewal also persists its accepted fifth without adding its amount to total',async()=>{
  const state=fixture();state.credits[0].principalPaid=0;state.credits[0].interestPaid=0;
  state.credits[0].schedule.forEach(q=>{q.paid=0;q.balance=q.amount;q.status='PENDIENTE';});
  const h=await boot({fullShell:true,state});let pending;
  try{
    h.w.MiCarteraV2SharePreview.previewCredit=()=>{};
    pending=h.w.MiCarteraV2DurableActions.renewInterest('qa-renew-extra-old');const get=form(h);addExtra(h);get('v2RenewReview').click();confirm(get);await pending;pending=null;
    const d=h.get(),credit=d.credits[1];a.equal(d.credits.length,2,JSON.stringify(h.alerts));
    a.equal(credit.capital,600);a.equal(credit.total,720);a.equal(credit.netDisbursement,0);
    a.deepEqual(credit.schedule.map(q=>q.amount),[100,100,100,100,320]);a.equal(credit.maturity,'2026-11-13');
    a.equal(d.payments.length,1);a.equal(d.payments[0].capitalAmount,0);a.equal(d.payments[0].interestAmount,120);
    a.equal(d.cashMovements.length,1);a.equal(d.cashMovements[0].amount,120);a.equal(h.commits.length,1);
  }finally{h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
});

test('renewal fifth stays isolated from the new-credit editor and a delayed ACK cannot duplicate or change its snapshot',async()=>{
  const h=await boot({fullShell:true,state:fixture()});let pending,release;
  try{
    h.w.MiCarteraV2SharePreview.previewCredit=()=>{};
    h.w.MiCarteraV2SyncBridge.submit=operation=>{h.commits.push(operation);return new Promise(resolve=>{release=()=>resolve({status:'COMMITTED',operationId:operation.operationId});});};
    pending=h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');const get=form(h),row=addExtra(h);get('v2RenewReview').click();confirm(get);await turn();
    a.ok(release);a.equal(h.get().credits.length,1,'local state must wait for ACK');
    row.querySelector('[data-v2-renew-extra-amount]').value='10';
    h.w.MiCarteraV2CreditFormParity.addExtraRow({date:'2026-11-20',amount:20});
    await h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');a.equal(h.commits.length,1);
    release();release=null;await pending;pending=null;
    a.deepEqual(h.get().credits[1].schedule.map(q=>q.amount),[100,100,100,100,320]);a.equal(h.get().credits.length,2);
  }finally{release?.();h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
});

test('invalid renewal extras block review and leave all fictional financial records untouched',async()=>{
  for(const extra of [{date:'2026-10-23',amount:'320'},{date:'2026-11-13',amount:'720'},{date:'',amount:'320'},{date:'2026-11-13',amount:'0'},{date:'2026-10-11',amount:'320'},{date:'2026-11-13',amount:'100',duplicate:true}]){
    const h=await boot({fullShell:true,state:fixture()});let pending;
    try{
      const before=JSON.stringify(h.get());pending=h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');const get=form(h);addExtra(h,extra);if(extra.duplicate)addExtra(h,extra);get('v2RenewReview').click();
      a.equal(get('v2RenewalReview'),null,JSON.stringify(extra));a.ok(h.alerts.length);a.equal(h.commits.length,0);a.equal(JSON.stringify(h.get()),before);
    }finally{h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
  }
});

test('removing the optional renewal extra restores four normal rows without borrowing another form extras',async()=>{
  const h=await boot({fullShell:true,state:fixture()});let pending;
  try{
    h.w.MiCarteraV2SharePreview.previewCredit=()=>{};
    h.w.MiCarteraV2CreditFormParity.addExtraRow({date:'2026-11-20',amount:10});
    pending=h.w.MiCarteraV2DurableActions.refinance('qa-renew-extra-old');const get=form(h),row=addExtra(h);
    row.querySelector('[data-v2-renew-extra-remove]').click();get('v2RenewReview').click();confirm(get);await pending;pending=null;
    a.deepEqual(h.get().credits[1].schedule.map(q=>q.amount),[180,180,180,180]);a.equal(h.get().credits[1].total,720);a.equal(h.commits.length,1);
  }finally{h.w.document.getElementById('v2RenewCancel')?.click();if(pending)await pending;await h.close();}
});
