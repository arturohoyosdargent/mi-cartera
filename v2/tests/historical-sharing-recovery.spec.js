const {collect:collectViaForm}=require('./collection-form-driver.cjs');
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
async function setup(amount=40,term=3){const h=await boot({fullShell:true});const d=h.get();d.clients[0].name='Alexander CLIENTE FICTICIO';d.credits=[{id:'cr',clientId:'c1',capital:amount*term,total:amount*term,rate:0,term,freq:'weekly',status:'ACTIVO',principalPaid:0,interestPaid:0,version:1,schedule:Array.from({length:term},(_,i)=>({n:i+1,date:'2026-10-'+String(8+i*7).padStart(2,'0'),amount,balance:amount,paid:0}))}];h.set(d);h.w.MiCarteraV2Dates.today=()=> '2026-10-07';return h;}
test('free S/60 touches exactly 40+20; recorded span persists after another payment with a short message and matching PNG/preview evidence',async()=>{const h=await setup();try{await collectViaForm(h,'cr','60');const d=h.get(),p=d.payments[0];a.ok(p,h.alerts.join('\n'));a.deepEqual(d.credits[0].schedule.map(x=>x.balance),[0,20,40]);a.equal(p.installmentFrom,1);a.equal(p.installmentTo,2);a.equal(p.totalInstallments,3);a.equal(p.amount,60);
 const applications=[{number:1,amount:40,balanceBefore:40,balanceAfter:0,status:'PAGADA'},{number:2,amount:20,balanceBefore:40,balanceAfter:20,status:'PARCIAL'}],message='¡Gracias, Alexander CLIENTE FICTICIO! 🙌\nRegistré tu pago de S/ 60.00.\nTu puntualidad nos ayuda a mantener tu crédito disponible y seguir creciendo juntos. 🌱';a.deepEqual(p.installmentApplications,applications);a.equal(h.w.MiCarteraV2PaymentReceipt.text(p,d.clients[0],d.credits[0]),message);
 await h.w.MiCarteraV2PaymentReceipt.image(p,d.clients[0],d.credits[0]);a.ok(h.drawn.includes('CUOTAS 1–2 DE 3 · PARCIAL'));a.ok(h.drawn.includes('Cuota 1: S/ 40.00 · COMPLETADA'));a.ok(h.drawn.includes('Cuota 2: S/ 20.00 · PARCIAL (pendiente S/ 20.00)'));const preview=h.w.document.querySelector('#v2SharePreview');a.match(preview.textContent,/CUOTAS 1–2 DE 3 · PARCIAL/);a.match(preview.textContent,/Cuota 1: S\/ 40\.00 · COMPLETADA/);a.match(preview.textContent,/Cuota 2: S\/ 20\.00 · PARCIAL \(pendiente S\/ 20\.00\)/);a.equal(preview.querySelector('#v2SharePreviewMessage').value,message);
 h.w.MiCarteraV2SharePreview.close();await collectViaForm(h,'cr','20');const after=h.get();a.equal(after.payments[1].installmentFrom,2);a.equal(after.payments[1].installmentTo,2);a.deepEqual(after.payments[0].installmentApplications,applications);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(after.payments[0],after.credits[0]),'CUOTAS 1–2 DE 3 · PARCIAL');a.equal(h.w.MiCarteraV2PaymentReceipt.text(after.payments[0],after.clients[0],after.credits[0]),message);a.deepEqual(after.credits[0].schedule.map(x=>x.balance),[0,0,40]);a.equal(after.cashMovements.reduce((n,m)=>n+m.amount,0),80);a.equal(h.commits.length,2);}finally{await h.close();}});
test('S/60 matching one installment and a partial S/20 retain exact singular identity',async()=>{for(const paid of [60,20]){const h=await setup(60,4);try{await collectViaForm(h,'cr',paid);const d=h.get(),p=d.payments[0];a.equal(p.installmentFrom,1);a.equal(p.installmentTo,1);a.equal(p.totalInstallments,4);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),'CUOTA 1 DE 4'+(paid<60?' · PARCIAL':''));a.equal(d.credits[0].schedule[0].balance,60-paid);}finally{await h.close();}}});
test('legacy payment without allocation metadata never guesses a quota from current balances',async()=>{const h=await setup();try{const d=h.get(),p={id:'legacy',amount:60,concept:'CUOTA',date:'2026-10-01'};const before=JSON.stringify(d);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),'CUOTA SIN IDENTIFICAR');d.credits[0].schedule.forEach(q=>q.balance=0);a.equal(h.w.MiCarteraV2ShareCard.receiptInstallmentLabel(p,d.credits[0]),'CUOTA SIN IDENTIFICAR');a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);}finally{await h.close();}});
function review(h,method){const pending=h.w.V2UI[method]('cr'),doc=h.w.document;doc.getElementById('v2RenewDate').value='2026-10-07';doc.getElementById('v2RenewFirstDate').value='2026-10-08';doc.getElementById('v2RenewReview').click();doc.getElementById('v2ShareRenewal').click();return pending;}
test('a proposal created in one account refuses sharing after an account switch before the Share click',async()=>{const h=await setup();try{const before=h.get(),pending=h.w.V2UI.refinance('cr'),doc=h.w.document;doc.getElementById('v2RenewReview').click();h.w.MiCarteraV2AuthCloudGate.state=()=>({uid:'other',ready:true,role:'admin'});doc.getElementById('v2ShareRenewal').click();a.equal(doc.getElementById('v2SharePreview'),null);a.equal(doc.getElementById('v2ClientShare'),null);a.match(h.alerts.at(-1),/sesión/);a.deepEqual(h.get(),before);doc.getElementById('v2ReviewBack').click();doc.getElementById('v2RenewCancel').click();await pending;}finally{await h.close();}});
test('both renewal proposals keep the short greeting, complete graphical schedule and edited real newlines without financial writes',async()=>{
  // Hand-checked fixtures: refinancing 120 into 180 delivers 60; interest-only
  // renewal keeps capital 120 and delivers zero. Both remain proposals only.
  for(const expected of [
    {method:'refinance',capital:'180',total:'S/ 180.00',net:'S/ 60.00',quota:'S/ 60.00',balances:['S/ 120.00','S/ 60.00','S/ 0.00']},
    {method:'renewInterest',capital:'120',total:'S/ 120.00',net:'S/ 0.00',quota:'S/ 40.00',balances:['S/ 80.00','S/ 40.00','S/ 0.00']}
  ]){
    const h=await setup();try{
      const before=h.get(),pending=h.w.V2UI[expected.method]('cr'),doc=h.w.document;
      doc.getElementById('v2RenewDate').value='2026-10-07';
      doc.getElementById('v2RenewFirstDate').value='2026-10-08';
      doc.getElementById('v2RenewCapital').value=expected.capital;
      doc.getElementById('v2RenewReview').click();doc.getElementById('v2ShareRenewal').click();
      const preview=doc.getElementById('v2SharePreview'),message=doc.getElementById('v2SharePreviewMessage');
      a.ok(message,'graphical preview required');
      a.equal(message.value,'Hola Alexander, te comparto tu propuesta de renovación. ¿Me confirmas si estás de acuerdo?');
      a.ok(!message.value.includes('\\n'));
      a.doesNotMatch(message.value,/S\/|Capital:|Total:|Cuotas:|CRONOGRAMA/);
      a.match(preview.textContent,/Saldo anterior: S\/ 120\.00/);
      a.ok(preview.textContent.includes('Nuevo capital: '+expected.total));
      a.ok(preview.textContent.includes('Neto a desembolsar: '+expected.net));
      a.ok(preview.textContent.includes('Total nuevo: '+expected.total));
      a.match(preview.textContent,/CRONOGRAMA · 3 pagos/);
      a.deepEqual([...preview.querySelectorAll('tbody tr')].map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent)),[
        ['1','2026-10-08','CUOTA',expected.quota,expected.quota],
        ['2','2026-10-15','CUOTA',expected.quota,expected.quota],
        ['3','2026-10-22','CUOTA',expected.quota,expected.quota]
      ]);
      const edited='Mensaje EDITADO\nSegunda línea';message.value=edited;h.drawn.length=0;
      await doc.querySelector('.v2-share-preview-actions button:last-child').onclick();
      a.ok(doc.getElementById('v2ClientShare'));
      a.equal(doc.querySelector('#v2ClientShare textarea').value,edited);
      a.ok(!doc.querySelector('#v2ClientShare textarea').value.includes('\\n'));
      let outgoing;Object.defineProperty(h.w.navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(h.w.navigator,'share',{configurable:true,value:async x=>outgoing=x});
      await doc.querySelector('#v2ClientShare [data-receipt]').onclick();
      a.equal(outgoing.files[0].type,'image/png');a.equal(outgoing.files[0].name,'prestamo-ya-propuesta-renovacion.png');
      a.ok(outgoing.files[0].size>0);a.equal(outgoing.text,edited);
      a.ok(h.drawn.includes('8/10/2026'));
      a.equal(h.drawn[h.drawn.indexOf('Nuevo capital')+1],expected.total);
      a.equal(h.drawn[h.drawn.indexOf('Saldo anterior')+1],'S/ 120.00');
      a.equal(h.drawn[h.drawn.indexOf('Neto a desembolsar')+1],expected.net);
      a.ok(h.drawn.includes('Cronograma completo'));
      const scheduleStart=h.drawn.indexOf('Saldo')+1;
      a.deepEqual(h.drawn.slice(scheduleStart,scheduleStart+15),[
        '1','CUOTA','8/10/2026',expected.quota,expected.balances[0],
        '2','CUOTA','15/10/2026',expected.quota,expected.balances[1],
        '3','CUOTA','22/10/2026',expected.quota,expected.balances[2]
      ]);
      a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
      h.w.MiCarteraV2ClientShare.close();doc.getElementById('v2ReviewBack').click();doc.getElementById('v2RenewCancel').click();await pending;
    }finally{await h.close();}
  }
});
test('renewal share blocks a changed owner before send or during PNG preparation; going back cancels late preparation',async()=>{for(const change of ['before','during','back']){const h=await setup();try{const before=h.get(),pending=review(h,'refinance'),doc=h.w.document;let auth={ready:true,uid:'test-admin',role:'admin'};h.w.MiCarteraV2AuthCloudGate.state=()=>auth;let finish;if(change==='before')auth={...auth,uid:'other'};else h.w.MiCarteraV2ShareCard.proposal=()=>new Promise(r=>finish=r);const send=doc.querySelector('.v2-share-preview-actions button:last-child').onclick();await new Promise(r=>setImmediate(r));if(change==='during'){auth={...auth,uid:'other'};h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:auth}));}if(change==='back')doc.getElementById('v2ReviewBack').click();if(finish)finish(new h.w.Blob(['fictional-png'],{type:'image/png'}));await send;a.equal(doc.getElementById('v2ClientShare'),null);a.equal(h.commits.length,0);if(change==='during'){const key='mi-cartera-v2-scoped-state:'+encodeURIComponent(JSON.stringify(['demo-mi-cartera-v2','v2-mi-cartera-pilot','test-admin']));a.deepEqual(JSON.parse(JSON.parse(h.w.localStorage.getItem(key)).raw),before);a.deepEqual(h.get().credits,[]);}else a.deepEqual(h.get(),before);if(doc.getElementById('v2ReviewBack'))doc.getElementById('v2ReviewBack').click();doc.getElementById('v2RenewCancel').click();await pending;}finally{await h.close();}}});
test('existing WhatsApp reminder only changes the customer date presentation, with the same amount and recipient',async()=>{const h=await setup();try{let opened;h.w.open=(...args)=>opened=args;for(const date of ['2026-10-08','08/10/2026']){h.w.MiCarteraV2CustomerExperience.reminder(h.get().clients[0],60,date);const url=new URL(opened[0]),msg=url.searchParams.get('text');a.equal(url.pathname,'/51999111222');a.match(msg,/Alexander CLIENTE FICTICIO.*S\/ 60\.00.*8\/10\/2026/);a.ok(!msg.includes('2026-10-08'));}a.equal(h.commits.length,0);}finally{await h.close();}});
