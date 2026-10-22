const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

function fixture(){
  const schedule=Array.from({length:12},(_,index)=>({number:index+1,date:`2026-10-${String(index+1).padStart(2,'0')}`,amount:100,paid:index<3?100:index===3?40:0,balance:index<3?0:index===3?60:100,status:index<3?'PAGADA':'PENDIENTE'})).reverse();
  return {clients:[{id:'fictional-client',name:'  Ana María Pérez  ',phone:'999111222'}],credits:[{id:'fictional-credit',clientId:'fictional-client',capital:1000,total:1200,rate:20,term:12,freq:'daily',status:'ACTIVE',version:1,schedule}],payments:[{id:'fictional-payment',creditId:'fictional-credit',date:'2026-10-04',amount:40,concept:'CUOTA',totalInstallments:12,installmentNumber:4,balanceAfterPayment:860}],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}};
}
async function setup(){
  const harness=await boot({fullShell:true,state:fixture()});
  harness.load('app/collection-reminder-share-v2.js');
  const frames=[];
  const original=harness.w.HTMLCanvasElement.prototype.toBlob;
  harness.w.HTMLCanvasElement.prototype.toBlob=function(callback){frames.push({width:this.width,height:this.height,text:harness.drawn.splice(0)});original.call(this,callback);};
  const shares=[];
  Object.defineProperty(harness.w.navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(harness.w.navigator,'share',{configurable:true,value:async payload=>{shares.push(payload);}});
  harness.w.URL.createObjectURL=()=> 'blob:fictional-content-preview';
  harness.w.URL.revokeObjectURL=()=>{};
  return {...harness,frames,shares};
}
function scheduleNumbers(frame,startY){
  return frame.rows.filter(row=>row.x===52&&row.y>=startY&&row.y<startY+6*38).map(row=>Number(row.text));
}
function captureRows(harness){
  const rows=[];
  const original=harness.w.HTMLCanvasElement.prototype.getContext;
  harness.w.HTMLCanvasElement.prototype.getContext=function(){const context=original.call(this),fill=context.fillText;context.fillText=(text,x,y)=>{rows.push({text:String(text),x,y});fill(text,x,y);};return context;};
  return rows;
}
function brief(message){
  assert.ok(message.length<300,message);
  assert.doesNotMatch(message,/S\/|Cronograma|CRONOGRAMA|Capital:|Total:|Saldo:|fictional-/);
  assert.match(message,/Ana/);
  assert.doesNotMatch(message,/María|Pérez/);
}
async function preview(harness,open){
  const pending=open();
  await new Promise(resolve=>setImmediate(resolve));
  const modal=harness.w.document.getElementById('v2SharePreview');
  assert.ok(modal,'the existing confirmation must remain available');
  assert.equal(harness.shares.length,0,'content preparation must not send');
  return {pending,modal};
}

test('credit graphic shows oldest six positive balances and full paid summary without changing the schedule',async()=>{
  const harness=await setup();try{
    const state=harness.get(),credit=state.credits[0],before=JSON.stringify(state),rows=captureRows(harness);
    await harness.w.MiCarteraV2CreditShare.image(credit,state.clients[0]);
    const frame=harness.frames.at(-1);frame.rows=rows;
    assert.deepEqual(scheduleNumbers(frame,712),[4,5,6,7,8,9]);
    assert.ok(frame.text.includes('Cuotas pagadas: 3 de 12'));
    assert.ok(frame.text.includes('Total abonado'));
    assert.ok(frame.text.includes('S/ 340.00'));
    assert.ok(frame.text.includes('S/ 860.00'));
    assert.ok(frame.text.some(text=>text.includes('20%')));
    assert.ok(frame.text.includes('Próximas 6 de 9 cuotas pendientes'));
    assert.ok(!frame.text.includes('PAGADA'));
    assert.equal(JSON.stringify(state),before);
    assert.equal(JSON.stringify(harness.get()),before);assert.equal(harness.commits.length,0);
  }finally{await harness.close();}
});

test('paid and undated installments never resurrect paid rows or hide an older dated balance',async()=>{
  const harness=await setup();try{
    const state=harness.get(),credit=state.credits[0];
    credit.schedule.forEach(row=>{row.balance=0;row.paid=row.amount;});
    await harness.w.MiCarteraV2ShareCard.credit(credit,state.clients[0]);
    assert.ok(harness.frames.at(-1).text.includes('Sin cuotas pendientes'));
    assert.ok(harness.frames.at(-1).text.includes('Cuotas pagadas: 12 de 12'));
    credit.schedule=[{number:90,date:'',amount:100,balance:100},...fixture().credits[0].schedule];
    const rows=captureRows(harness);await harness.w.MiCarteraV2ShareCard.credit(credit,state.clients[0]);
    assert.deepEqual(scheduleNumbers({rows},712),[4,5,6,7,8,9]);
  }finally{await harness.close();}
});

test('proposal and renewal graphics limit pending rows while retaining full terms and net disbursement',async()=>{
  const harness=await setup();try{
    const state=harness.get(),credit=state.credits[0];
    for(const kind of ['credit','renewal']){
      const draft={...credit,kind,first:'2026-10-01',installment:100,previousBalance:650,netDisbursement:350,extraTotal:0},before=JSON.stringify(draft);
      await harness.w.MiCarteraV2ShareCard.proposal(draft,state.clients[0]);
      const frame=harness.frames.at(-1),dateRows=frame.text.filter(text=>/^\d{1,2}\/10\/2026$/.test(text));
      assert.equal(dateRows.length,7,'first due date plus exactly six pending installments');
      assert.ok(frame.text.includes('Próximas 6 de 9 cuotas pendientes'));
      assert.ok(frame.text.includes('Cuotas pagadas: 3 de 12'));
      assert.ok(frame.text.includes('S/ 340.00'));assert.ok(frame.text.includes('S/ 860.00'));
      assert.ok(frame.text.some(text=>text.includes('20%')));
      if(kind==='renewal'){assert.ok(frame.text.includes('Neto a desembolsar'));assert.ok(frame.text.includes('S/ 350.00'));assert.ok(frame.text.includes('S/ 650.00'));}
      assert.equal(JSON.stringify(draft),before);
    }
  }finally{await harness.close();}
});

test('generated texts are brief first-name content while receipt financial information stays in its graphic',async()=>{
  const harness=await setup();try{
    const state=harness.get(),credit=state.credits[0],client=state.clients[0],payment=state.payments[0],before=JSON.stringify(state);
    brief(harness.w.MiCarteraV2CreditShare.textSummary(credit,client));
    brief(harness.w.MiCarteraV2CollectionReminderShare.text(client,60,'2026-10-04'));
    brief(harness.w.MiCarteraV2PaymentReceipt.text(payment,client,credit));
    const proposal=harness.w.MiCarteraV2ProposalShare.message({...credit,client:client.id,clientRecord:client});
    brief(proposal);assert.match(proposal,/El crédito NO queda registrado/);
    await harness.w.MiCarteraV2PaymentReceipt.image(payment,client,credit);
    const frame=harness.frames.at(-1);
    assert.ok(frame.text.includes('S/ 40.00'));assert.ok(frame.text.includes('S/ 860.00'));
    assert.ok(frame.text.includes('Total abonado'));assert.ok(frame.text.includes('S/ 340.00'));
    assert.ok(frame.text.includes('Cuotas pagadas: 3 de 12'));
    assert.equal(JSON.stringify(harness.get()),before);assert.equal(harness.commits.length,0);
  }finally{await harness.close();}
});

test('Daily Agenda, Automatic Agenda and Cobranza reuse the short suggestion and pending-only graphic without changing preview or editing',async()=>{
  for(const entry of ['daily','automatic','collections']){
    const harness=await setup();try{
      const before=JSON.stringify(harness.get());
      if(entry!=='collections'){
        if(entry==='daily')harness.load('app/agenda-v2.js');
        harness.w.document.getElementById('agendaFrom').value='2026-10-04';harness.w.document.getElementById('agendaTo').value='2026-10-04';
        harness.w.MiCarteraV2Agenda.render();harness.w.MiCarteraV2SharePreview.wrap();
      }
      const {pending,modal}=await preview(harness,()=>entry==='collections'?harness.w.MiCarteraV2Cards.remind('fictional-credit'):harness.w.MiCarteraV2Agenda.remind('fictional-credit:4'));
      const field=modal.querySelector('#v2SharePreviewMessage');brief(field.value);assert.equal(field.readOnly,false);
      assert.ok(harness.frames.at(-1).text.includes('Próximas 6 de 9 cuotas pendientes'));
      field.value='Mensaje personal intacto · S/ 60';
      await [...modal.querySelectorAll('.v2-share-preview-actions button')].find(button=>button.textContent==='Confirmar y enviar').onclick();
      assert.equal(await pending,'file-share');assert.equal(harness.shares[0].text,field.value);assert.equal(harness.shares[0].files.length,1);
      assert.equal(JSON.stringify(harness.get()),before);assert.equal(harness.commits.length,0);
    }finally{await harness.close();}
  }
});

test('saved renewals keep historical net on the graphic, short edited text and the existing conflict guard',async()=>{
  const state=fixture(),credit=state.credits[0];
  Object.assign(credit,{renewedFrom:'fictional-old',operationId:'fictional-renewal',netDisbursement:350,previousBalance:650});
  const harness=await boot({fullShell:true,state});try{
    const before=JSON.stringify(harness.get()),shares=[];
    Object.defineProperty(harness.w.navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(harness.w.navigator,'share',{configurable:true,value:async payload=>{shares.push(payload);}});
    const pending=harness.w.MiCarteraV2SharePreview.previewCredit(credit.id);
    await new Promise(resolve=>setImmediate(resolve));
    const modal=harness.w.document.getElementById('v2SharePreview'),field=modal.querySelector('#v2SharePreviewMessage');brief(field.value);
    assert.ok(harness.drawn.includes('Neto a desembolsar'));assert.ok(harness.drawn.includes('S/ 350.00'));
    field.value='Renovación confirmada por Ana';await [...modal.querySelectorAll('.v2-share-preview-actions button')].find(button=>button.textContent==='Confirmar y enviar').onclick();
    assert.equal(await pending,'file-share');assert.equal(shares[0].text,field.value);
    assert.equal(JSON.stringify(harness.get()),before);assert.equal(harness.commits.length,0);
    const conflicting=harness.get();conflicting.cashMovements=[{type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:450}];harness.set(conflicting);
    assert.throws(()=>harness.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/desembolso.*revisión/i);
  }finally{await harness.close();}
});
