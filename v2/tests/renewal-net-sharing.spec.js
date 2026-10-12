const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

// Hand-checked reproduction only: 1,000 new capital - 650 outstanding = 350.
// The customer's name labels the reported case; IDs, balances and session are fictitious.
const fixture=()=>({clients:[{id:'fictitious-manuel',name:'Manuel Coronado (prueba ficticia)'}],
  credits:[{id:'fictitious-old',clientId:'fictitious-manuel',capital:1000,total:1200,
    principalPaid:500,interestPaid:50,penaltyPaid:0,rate:20,term:10,freq:'daily',
    status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-11',amount:1200,paid:550,balance:650}]}],
  payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}});

function review(h){
  const get=id=>h.w.document.getElementById(id);
  get('v2RenewDate').value='2026-10-11';get('v2RenewFirstDate').value='2026-10-12';
  get('v2RenewCapital').value='1000';get('v2RenewFreq').value='daily';
  get('v2RenewReview').click();return get;
}

test('renewal proposal PNG discloses the actual net disbursement, including zero',async()=>{
  const h=await boot({fullShell:true});try{
    for(const net of [350,0]){
      h.drawn.length=0;
      await h.w.MiCarteraV2ShareCard.proposal({kind:'renewal',renewalMode:'REFINANCE',capital:1000,
        total:1200,term:10,freq:'daily',first:'2026-10-12',installment:120,
        previousBalance:1000-net,netDisbursement:net},{name:'Cliente ficticio'});
      a.ok(h.drawn.includes('Neto a desembolsar'),'PNG must label the cash actually delivered');
      a.ok(h.drawn.includes(net===350?'S/ 350.00':'S/ 0.00'));
    }
  }finally{await h.close();}
});

test('renewal review uses Diaria while retaining daily as the schedule value',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    const pending=h.w.MiCarteraV2DurableActions.refinance('fictitious-old'),get=review(h);
    a.match(get('v2RenewalReview').textContent,/10\s*·\s*Diaria/);
    a.doesNotMatch(get('v2RenewalReview').textContent,/\bdaily\b/);
    a.equal(get('v2RenewFreq').value,'daily');
    get('v2RenewCancel').click();await pending;
  }finally{await h.close();}
});

test('Manuel reproduction sends matching S/ 350.00 in proposal message and PNG without saving',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    let config,outgoing;
    h.w.MiCarteraV2SharePreview.open=value=>{config=value;};
    // External delivery boundary only: no WhatsApp recipient or network is opened.
    h.w.MiCarteraV2ClientShare.send=async value=>{outgoing=value;return 'share-ready';};
    const before=JSON.stringify(h.get()),pending=h.w.MiCarteraV2DurableActions.refinance('fictitious-old');
    const get=review(h);get('v2ShareRenewal').click();
    a.match(config.message,/Neto a desembolsar: S\/ 350\.00/);
    a.match(config.summary,/Neto a desembolsar/);
    await config.send(config.message);
    a.match(outgoing.text,/Neto a desembolsar: S\/ 350\.00/);
    a.ok(h.drawn.includes('Neto a desembolsar'));a.ok(h.drawn.includes('S/ 350.00'));
    a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
    get('v2RenewCancel').click();await pending;
  }finally{await h.close();}
});

test('saved renewal keeps its net amount in image and WhatsApp payload',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    const previewCredit=h.w.MiCarteraV2SharePreview.previewCredit;
    h.w.MiCarteraV2SharePreview.previewCredit=()=>{};
    const pending=h.w.MiCarteraV2DurableActions.refinance('fictitious-old'),get=review(h);
    get('v2RenewAccepted').checked=true;get('v2RenewAccepted').onchange();get('v2ConfirmRenewal').click();
    await pending;
    h.w.MiCarteraV2SharePreview.previewCredit=previewCredit;
    const d=h.get(),credit=d.credits.find(c=>c.id!=='fictitious-old');
    a.equal(credit.netDisbursement,350);a.equal(credit.previousBalance,650);
    a.equal(d.cashMovements.length,1);a.equal(d.cashMovements[0].amount,350);
    const message=h.w.MiCarteraV2CreditShare.textSummary(credit,d.clients[0]);
    a.match(message,/Neto a desembolsar: S\/ 350\.00/);
    h.drawn.length=0;await h.w.MiCarteraV2ShareCard.credit(credit,d.clients[0]);
    a.ok(h.drawn.includes('Neto a desembolsar'));a.ok(h.drawn.includes('S/ 350.00'));
    let outgoing;h.w.navigator.canShare=()=>true;h.w.navigator.share=async value=>{outgoing=value;};
    const preview=h.w.MiCarteraV2SharePreview.previewCredit(credit.id);
    await new Promise(resolve=>setImmediate(resolve));
    const modal=get('v2SharePreview'),messageField=get('v2SharePreviewMessage');
    a.ok(messageField,'a saved renewal must visibly disclose its outgoing message');
    a.match(messageField.value,/Neto a desembolsar: S\/ 350\.00/);
    a.doesNotMatch(modal.textContent,/No se enviarán.*texto/);
    [...modal.querySelectorAll('.v2-share-preview-actions button')].find(b=>b.textContent==='Confirmar y enviar').click();
    await preview;
    a.match(outgoing.text,/Neto a desembolsar: S\/ 350\.00/);a.equal(outgoing.files.length,1);
    a.equal(h.commits.length,1,'sharing must not create a second operation');
  }finally{await h.close();}
});

test('previously saved renewal shares its recorded audit/cash net without rewriting history',async()=>{
  const state=fixture(),credit={...state.credits[0],id:'fictitious-historical',renewedFrom:'fictitious-old',operationId:'fictitious-history-op',schedule:[]};
  state.credits=[credit];
  state.audit=[{id:'fictitious-audit',action:'CREDIT_REFINANCED',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:650,newCapital:1000,cashDisbursed:350}}];
  state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:350}];
  const h=await boot({fullShell:true,state});try{
    const before=JSON.stringify(h.get());
    a.match(h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/Neto a desembolsar: S\/ 350\.00/);
    await h.w.MiCarteraV2CreditShare.image(credit,state.clients[0]);
    a.ok(h.drawn.includes('S/ 350.00'));a.ok(h.drawn.includes('Neto a desembolsar'));
    let outgoing;h.w.navigator.canShare=()=>true;h.w.navigator.share=async value=>{outgoing=value;};
    const preview=h.w.MiCarteraV2SharePreview.previewCredit(credit.id);
    await new Promise(resolve=>setImmediate(resolve));
    [...h.w.document.getElementById('v2SharePreview').querySelectorAll('.v2-share-preview-actions button')].find(b=>b.textContent==='Confirmar y enviar').click();
    await preview;a.match(outgoing.text,/Neto a desembolsar: S\/ 350\.00/);
    a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);a.equal(credit.netDisbursement,undefined);
  }finally{await h.close();}
});

test('historical renewal with inconsistent recorded cash never invents a net amount',async()=>{
  const state=fixture(),credit={...state.credits[0],id:'fictitious-historical',renewedFrom:'fictitious-old',operationId:'fictitious-history-op'};
  state.credits=[credit];state.audit=[{id:'fictitious-audit',action:'CREDIT_REFINANCED',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:650,newCapital:1000,cashDisbursed:350}}];
  state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:450}];
  const h=await boot({fullShell:true,state});try{
    a.doesNotMatch(h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/Neto a desembolsar/);
    a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('deleted historical audit or expense cannot certify a renewal net',async()=>{
  for(const collection of ['audit','cashMovements']){
    const state=fixture(),credit={...state.credits[0],id:'fictitious-historical',renewedFrom:'fictitious-old',operationId:'fictitious-history-op'};
    state.credits=[credit];state.audit=[{id:'fictitious-audit',action:'CREDIT_REFINANCED',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:650,newCapital:1000,cashDisbursed:350}}];
    state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:350}];
    state[collection][0].tombstone=true;state[collection][0].deletedAt='2026-10-11';
    const h=await boot({fullShell:true,state});try{
      a.doesNotMatch(h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/Neto a desembolsar/);
      a.equal(h.commits.length,0);
    }finally{await h.close();}
  }
});

test('ordinary credit keeps its existing graphic-only payload',async()=>{
  const h=await boot({fullShell:true,state:fixture()});try{
    let outgoing;h.w.navigator.canShare=()=>true;h.w.navigator.share=async value=>{outgoing=value;};
    const preview=h.w.MiCarteraV2SharePreview.previewCredit('fictitious-old');
    await new Promise(resolve=>setImmediate(resolve));
    h.w.document.getElementById('v2SharePreview').querySelectorAll('.v2-share-preview-actions button')[1].click();
    await preview;a.equal(outgoing.text,'');a.equal(outgoing.files.length,1);
    a.ok(!h.drawn.includes('Neto a desembolsar'));a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('historical net metadata conflicting with recorded disbursement blocks sharing without changing records',async()=>{
  const state=fixture(),credit={...state.credits[0],id:'fictitious-historical-conflict',renewedFrom:'fictitious-old',operationId:'fictitious-conflict-op',renewalMode:'REFINANCE',netDisbursement:0};
  state.credits=[credit];state.audit=[{id:'fictitious-audit',action:'CREDIT_REFINANCED',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:833.33,newCapital:1000,cashDisbursed:166.67}}];
  state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:166.67}];
  const h=await boot({fullShell:true,state});try{
    const before=JSON.stringify(h.get());
    a.throws(()=>h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/desembolso.*revisión/i);
    a.equal(await h.w.MiCarteraV2SharePreview.previewCredit(credit.id),'prepare-failed');
    a.equal(h.w.document.getElementById('v2SharePreview'),null);
    a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('known historical net recovers its previous balance from verified audit rather than displaying zero',async()=>{
  const state=fixture(),credit={...state.credits[0],id:'fictitious-known-net',renewedFrom:'fictitious-old',operationId:'fictitious-known-op',renewalMode:'REFINANCE',netDisbursement:350};
  state.credits=[credit];state.audit=[{id:'fictitious-audit',action:'CREDIT_REFINANCED',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:650,newCapital:1000,cashDisbursed:350}}];
  state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_REFINANCIAMIENTO',ref:credit.id,amount:350}];
  const h=await boot({fullShell:true,state});try{
    a.match(h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/Saldo anterior: S\/ 650\.00/);
    a.equal(credit.previousBalance,undefined);a.equal(h.get().credits[0].previousBalance,undefined);
  }finally{await h.close();}
});

test('legacy renewal-with-balance recovers only matching audit and exact disbursement',async()=>{
  const state=fixture(),credit={...state.credits[0],id:'fictitious-legacy-balance',renewedFrom:'fictitious-old',operationId:'fictitious-legacy-op'};
  state.credits=[credit];state.audit=[{id:'fictitious-audit',action:'CREDIT_RENEWED_WITH_BALANCE',entityType:'CREDIT',entityId:credit.id,operationId:credit.operationId,detail:{from:'fictitious-old',previousBalance:650,newCapital:1000,cashDisbursed:350}}];
  state.cashMovements=[{id:'fictitious-expense',type:'EGRESO',concept:'DESEMBOLSO_RENOVACION_CON_SALDO',ref:credit.id,amount:350}];
  const h=await boot({fullShell:true,state});try{
    a.match(h.w.MiCarteraV2CreditShare.textSummary(credit,state.clients[0]),/Neto a desembolsar: S\/ 350\.00/);
    a.equal(h.get().credits[0].netDisbursement,undefined);a.equal(h.commits.length,0);
  }finally{await h.close();}
});
