// Exercise the real durable collection path with fictional local/Cloud boundaries.
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
async function setup(unit=25,term=24,start=5){
  const h=await boot({fullShell:true}),d=h.get(),paid=(start-1)*unit;
  d.clients[0].name='Cliente FICTICIO';
  d.credits=[{id:'cr-allocation',clientId:'c1',capital:unit*term,total:unit*term,rate:0,term,freq:'daily',status:'ACTIVO',principalPaid:paid,interestPaid:0,penaltyPaid:0,version:1,schedule:Array.from({length:term},(_,i)=>({number:i+1,date:'2026-10-'+String(i+1).padStart(2,'0'),amount:unit,paid:i<start-1?unit:0,balance:i<start-1?0:unit,status:i<start-1?'PAGADA':'PENDIENTE'}))}];
  d.payments=[];d.cashMovements=[];d.audit=[];h.set(d);h.w.MiCarteraV2Dates.today=()=> '2026-10-07';return h;
}
async function collect(h,amount){h.w.prompt=()=>String(amount);await h.w.V2UI.collect('cr-allocation');const d=h.get(),p=d.payments.at(-1);a.ok(p,h.alerts.join('\n'));return {d,p};}
function application(number,amount,balanceBefore,balanceAfter){return {number,amount,balanceBefore,balanceAfter,status:balanceAfter===0?'PAGADA':'PARCIAL'};}
function debt(cr){return cr.schedule.reduce((n,q)=>n+q.balance,0);}

test('D/E actual single and three-quota collections persist the exact applied quotas, without amount/quote inference',async()=>{
  for(const amount of [25,75]){const h=await setup();try{const before=h.get(),{d,p}=await collect(h,amount),expected=amount===25?[application(5,25,25,0)]:[application(5,25,25,0),application(6,25,25,0),application(7,25,25,0)];
    a.deepEqual(p.installmentApplications,expected);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),amount===25?'CUOTA 5 DE 24':'CUOTAS 5–7 DE 24');
    a.deepEqual(clone(h.commits[0].entities.find(x=>x.collection==='payments').data.installmentApplications),expected);a.equal(p.balanceAfterPayment,debt(d.credits[0]));a.equal(debt(d.credits[0]),debt(before.credits[0])-amount);a.equal(d.credits[0].principalPaid,before.credits[0].principalPaid+amount);a.equal(d.credits[0].interestPaid,0);a.equal(h.commits.length,1);
    await h.w.MiCarteraV2PaymentReceipt.image(p,d.clients[0],d.credits[0]);a.ok(h.drawn.includes(amount===25?'CUOTA 5 DE 24':'CUOTAS 5–7 DE 24'));
  }finally{await h.close();}}
});

test('F/G actual S/60 and free S/57 keep the complete S/40 and real partial allocation in text and PNG',async()=>{
  for(const amount of [60,57]){const h=await setup(40);try{const {d,p}=await collect(h,amount),partial=amount-40,left=40-partial;
    a.deepEqual(p.installmentApplications,[application(5,40,40,0),application(6,partial,40,left)]);
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),'CUOTAS 5–6 DE 24 · PARCIAL');
    const details=h.w.MiCarteraV2ShareCard.receiptInstallmentDetails(p,d.credits[0]);a.match(details,/Cuota 5: S\/ 40\.00 · COMPLETADA/);a.ok(details.includes('Cuota 6: S/ '+partial.toFixed(2)+' · PARCIAL (pendiente S/ '+left.toFixed(2)+')'));
    const text=h.w.MiCarteraV2PaymentReceipt.text(p,d.clients[0],d.credits[0]);a.ok(text.includes(details));a.match(text,/Fecha de pago: 7\/10\/2026/);a.ok(!text.includes('\\n'));
    await h.w.MiCarteraV2PaymentReceipt.image(p,d.clients[0],d.credits[0]);for(const line of details.split('\n'))a.ok(h.drawn.includes(line),'missing PNG allocation '+line);
    a.equal(d.credits[0].schedule[5].balance,left);a.equal(p.capitalAmount,amount);a.equal(p.interestAmount,0);
  }finally{await h.close();}}
});

test('H historical payments never infer missing quota or complete/partial status from current credit balances',async()=>{
  const h=await setup();try{const d=h.get(),snapshot=clone(d),legacy={id:'old',creditId:'cr-allocation',concept:'CUOTA',amount:75,date:'2026-10-01'};
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(legacy,d.credits[0]),'CUOTA SIN IDENTIFICAR');
    d.credits[0].schedule.forEach(q=>{q.balance=0;q.paid=q.amount;});
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(legacy,d.credits[0]),'CUOTA SIN IDENTIFICAR');
    const identified={...legacy,installmentFrom:5,installmentTo:7,totalInstallments:24};
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(identified,d.credits[0]),'CUOTA SIN IDENTIFICAR');
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentDetails(identified,d.credits[0]),'');
    const invalid={...identified,installmentApplications:[application(5,25,25,0)]};
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(invalid,d.credits[0]),'CUOTA SIN IDENTIFICAR');
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel({...invalid,installmentTo:5},d.credits[0]),'CUOTA SIN IDENTIFICAR');
    a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel({...legacy,installmentNumber:24,totalInstallments:24},d.credits[0]),'CUOTA 24 DE 24');a.deepEqual(h.get(),snapshot);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('real application skips an already paid intermediate quota without adding it to text or PNG',async()=>{
  const h=await setup();try{
    const initial=h.get(),q=initial.credits[0].schedule[5];q.paid=25;q.balance=0;q.status='PAGADA';initial.credits[0].principalPaid+=25;h.set(initial);
    const {d,p}=await collect(h,50),rows=[application(5,25,25,0),application(7,25,25,0)];
    a.deepEqual(p.installmentApplications,rows);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),'CUOTAS 5, 7 DE 24');
    const details=h.w.MiCarteraV2ShareCard.receiptInstallmentDetails(p,d.credits[0]);a.ok(!details.includes('Cuota 6:'));a.ok(details.includes('Cuota 5:'));a.ok(details.includes('Cuota 7:'));
    await h.w.MiCarteraV2PaymentReceipt.image(p,d.clients[0],d.credits[0]);a.ok(h.drawn.includes('CUOTAS 5, 7 DE 24'));a.equal(h.commits.length,1);
  }finally{await h.close();}
});

test('I/J pending double taps commit one payment, one balance update and one cash movement; receipt preview is read-only',async()=>{
  const h=await setup(40);try{const before=h.get();let release;h.w.MiCarteraV2SyncBridge.submit=async op=>{h.commits.push(clone(op));return new Promise(resolve=>release=()=>resolve({status:'COMMITTED'}));};
    h.w.prompt=()=> '60';const first=h.w.V2UI.collect('cr-allocation');await new Promise(resolve=>setImmediate(resolve));await h.w.V2UI.collect('cr-allocation');a.equal(h.commits.length,1);release();await first;
    const d=h.get(),p=d.payments[0];a.equal(d.payments.length,1);a.equal(d.cashMovements.length,1);a.equal(d.cashMovements[0].amount,60);a.equal(debt(d.credits[0]),debt(before.credits[0])-60);a.equal(d.credits[0].version,before.credits[0].version+1);a.equal(d.credits[0].principalPaid,before.credits[0].principalPaid+60);
    const recorded=clone(d);h.w.MiCarteraV2SharePreview.close();const pending=h.w.MiCarteraV2SharePreview.previewPayment(p.id);await new Promise(resolve=>setImmediate(resolve));h.w.document.querySelector('.v2-share-preview-actions button:nth-child(2)').click();await pending;a.deepEqual(h.get(),recorded);a.equal(h.commits.length,1);
  }finally{await h.close();}
});

test('K exact first-payment allocation survives subsequent payments, final settlement and closing/reopening',async()=>{
  const h=await setup(40,7);let reopened;try{const {d,p}=await collect(h,60),first=clone(p),label=h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),details=h.w.MiCarteraV2ShareCard.receiptInstallmentDetails(p,d.credits[0]);h.w.MiCarteraV2SharePreview.close();await collect(h,60);const after=h.get();a.equal(debt(after.credits[0]),0);a.deepEqual(after.payments[0],first);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(after.payments[0],after.credits[0]),label);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentDetails(after.payments[0],after.credits[0]),details);
    const text=h.w.MiCarteraV2PaymentReceipt.text(after.payments[0],after.clients[0],after.credits[0]);a.match(text,/Saldo posterior: S\/ 60\.00/);
    reopened=await boot({fullShell:true,state:after});const persisted=reopened.get();a.deepEqual(persisted.payments[0],first);a.equal(reopened.w.MiCarteraV2ShareCard.receiptInstallmentLabel(persisted.payments[0],persisted.credits[0]),label);a.equal(reopened.w.MiCarteraV2ShareCard.receiptInstallmentDetails(persisted.payments[0],persisted.credits[0]),details);a.match(reopened.w.MiCarteraV2PaymentReceipt.text(persisted.payments[0],persisted.clients[0],persisted.credits[0]),/Saldo posterior: S\/ 60\.00/);a.equal(h.commits.length,2);a.equal(reopened.commits.length,0);
  }finally{await h.close();if(reopened)await reopened.close();}
});

test('selected old-payment preview and shared PNG retain its real partial application and posterior balance',async()=>{
  const h=await setup(40,7);try{
    const {p}=await collect(h,60);h.w.MiCarteraV2SharePreview.close();await collect(h,60);h.w.MiCarteraV2SharePreview.close();
    let outgoing;Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(h.w.navigator,'share',{value:data=>{outgoing=data;return Promise.resolve();},configurable:true});
    const state=clone(h.get()),pending=h.w.MiCarteraV2SharePreview.previewPayment(p.id);await new Promise(resolve=>setImmediate(resolve));
    const modal=h.w.document.getElementById('v2SharePreview');a.match(modal.innerHTML,/<b>Saldo posterior:<\/b> S\/ 60\.00/);
    const message=modal.querySelector('#v2SharePreviewMessage');a.match(message.value,/Cuota 5: S\/ 40\.00 · COMPLETADA/);a.match(message.value,/Cuota 6: S\/ 20\.00 · PARCIAL \(pendiente S\/ 20\.00\)/);a.ok(!message.value.includes('\\n'));
    message.value='Gracias por tu pago, te envío el comprobante.';await modal.querySelectorAll('.v2-share-preview-actions button')[2].onclick();a.equal(await pending,'file-share');a.equal(outgoing.text,message.value);a.equal(outgoing.files[0].type,'image/png');a.ok(outgoing.files[0].size>0);a.deepEqual(h.get(),state);a.equal(h.commits.length,2);
  }finally{await h.close()}
});
