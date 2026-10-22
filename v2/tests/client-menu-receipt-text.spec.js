const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {boot}=require('./dom-harness.cjs');

const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function menu(h){
  const file=path.join(__dirname,'../app/client-actions-menu-v2.js');
  if(!h.w.MiCarteraV2ClientActionsMenu&&fs.existsSync(file))h.load('app/client-actions-menu-v2.js');
  h.w.MiCarteraV2ClientActionsMenu?.install();
}
function clientState(){return {clients:[
  {id:'c1',name:'Ana FICTICIA',phone:'999111222',dni:'12345678',address:'Dirección ficticia'},
  {id:'c-duplicate',name:'Ana Duplicada FICTICIA',phone:'999111222',dni:'12345678'},
  {id:'c2',name:'Beto FICTICIO',phone:'999333444'}
],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}};}
function card(h,id){return h.w.document.querySelector('#clientsList [data-client-card][data-client-id="'+id+'"]');}

// Moving or rebuilding an original button would lose its listener or confirmation.
test('client actions move the original Maps, Waze, WhatsApp, edit, delete and duplicate nodes into an accessible panel',async()=>{
  const h=await boot({fullShell:true,state:clientState()});try{
    h.w.MiCarteraV2Cards.renderClients();h.w.MiCarteraV2ClientEditor.decorate();
    const selected=card(h,'c1'),original=[...selected.querySelectorAll('button')].filter(b=>!b.matches('.v2-client-evaluation-button,[data-client-actions-toggle]')),before=h.get();
    a.equal(original.length,6);
    const map=original.find(b=>b.textContent.includes('Maps')),inline=map.getAttribute('onclick');
    menu(h);
    const toggle=selected.querySelector('[data-client-actions-toggle]'),panel=selected.querySelector('[data-client-actions-panel]');
    a.ok(toggle,'client actions disclosure is missing');a.equal(toggle.textContent,'⚙️ Acciones');
    a.equal(toggle.tagName,'BUTTON');a.equal(toggle.type,'button');a.equal(toggle.getAttribute('aria-expanded'),'false');
    a.equal(toggle.getAttribute('aria-controls'),panel.id);a.equal(panel.getAttribute('role'),'region');a.equal(panel.hidden,true);
    for(const button of original)a.equal(panel.contains(button),true,'original action must retain its node and listeners');
    a.equal(map.getAttribute('onclick'),inline);a.equal(selected.querySelectorAll('[data-client-actions-toggle]').length,1);
    toggle.click();a.equal(panel.hidden,false);a.equal(toggle.getAttribute('aria-expanded'),'true');
    original.find(b=>b.classList.contains('v2-edit-client-button')).click();
    a.equal(h.w.document.getElementById('clientForm').dataset.editId,'c1');a.equal(h.w.document.getElementById('fName').value,'Ana FICTICIA');
    let confirmation;h.w.confirm=text=>{confirmation=text;return false;};
    toggle.click();original.find(b=>b.classList.contains('v2-merge-client-button')).click();
    a.equal(confirmation,'Conservar Ana FICTICIA y consolidar/eliminar el duplicado Ana Duplicada FICTICIA?');
    a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

// Native clicks (including touch-generated clicks) and Escape must leave only one panel open.
test('client action panels close on outside click or Escape and keep the existing delete confirmation',async()=>{
  const h=await boot({fullShell:true,state:clientState()});try{
    h.w.MiCarteraV2Cards.renderClients();h.w.MiCarteraV2ClientEditor.decorate();menu(h);
    const first=card(h,'c1'),second=card(h,'c2'),firstToggle=first.querySelector('[data-client-actions-toggle]'),secondToggle=second.querySelector('[data-client-actions-toggle]');
    a.ok(firstToggle,'client actions disclosure is missing');a.ok(secondToggle);
    const firstPanel=first.querySelector('[data-client-actions-panel]'),secondPanel=second.querySelector('[data-client-actions-panel]');
    firstToggle.click();secondToggle.click();a.equal(firstPanel.hidden,true);a.equal(secondPanel.hidden,false);
    h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    a.equal(secondPanel.hidden,true);a.ok(h.w.document.activeElement===secondToggle,'Escape restores focus to the second action toggle');
    firstToggle.click();h.w.document.body.click();a.equal(firstPanel.hidden,true);a.equal(firstToggle.getAttribute('aria-expanded'),'false');
    secondToggle.click();let confirmation;h.w.confirm=text=>{confirmation=text;return false;};
    second.querySelector('.v2-delete-client-button').click();
    a.equal(confirmation,'¿Eliminar a Beto FICTICIO? Esta acción no se puede deshacer.');a.equal(h.commits.length,0);
    a.ok(h.get().clients.some(c=>c.id==='c2'));
  }finally{await h.close();}
});

// Search uses the original lexical renderClients listener, so wrapping only the public method misses it.
test('search and repeated renders keep one action toggle and one of each original client action',async()=>{
  const h=await boot({fullShell:true,state:clientState()});try{
    menu(h);h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2Cards.render();await tick();
    const search=h.w.document.getElementById('clientSearch');search.value='Ana';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));await tick();
    const cards=[...h.w.document.querySelectorAll('#clientsList [data-client-card]')];a.equal(cards.length,2);
    for(const selected of cards){
      a.equal(selected.querySelectorAll('[data-client-actions-toggle]').length,1,'rerender must retain one actions control');
      a.equal(selected.querySelectorAll('[data-client-actions-panel]').length,1);
      for(const cls of ['v2-edit-client-button','v2-delete-client-button','v2-merge-client-button'])a.equal(selected.querySelectorAll('.'+cls).length,1);
      const panel=selected.querySelector('[data-client-actions-panel]');for(const button of selected.querySelectorAll('.v2-edit-client-button,.v2-delete-client-button,.v2-merge-client-button'))a.ok(panel.contains(button));
    }
    a.ok(card(h,'c2')===null,'search excludes the nonmatching client');a.equal(h.commits.length,0);
  }finally{await h.close();}
});

const applications=[
  {number:5,amount:40,balanceBefore:40,balanceAfter:0,status:'PAGADA'},
  {number:6,amount:20,balanceBefore:40,balanceAfter:20,status:'PARCIAL'}
];
function receiptState(){const state=clientState();state.clients=[state.clients[0]];state.credits=[{id:'cr1',clientId:'c1',capital:280,total:280,rate:0,term:7,freq:'daily',status:'ACTIVO',principalPaid:220,interestPaid:0,penaltyPaid:0,version:1,schedule:Array.from({length:7},(_,i)=>({number:i+1,date:'2026-10-'+String(i+1).padStart(2,'0'),amount:40,paid:i<5?40:i===5?20:0,balance:i<5?0:i===5?20:40,status:i<5?'PAGADA':i===5?'PARCIAL':'PENDIENTE'}))}];state.payments=[{id:'p1',creditId:'cr1',clientId:'c1',amount:60,date:'2026-10-07',concept:'CUOTA',installmentApplications:applications,installmentFrom:5,installmentTo:6,totalInstallments:7,balanceAfterPayment:60}];return state;}

function shortReceiptMessage(message){
  a.match(message,/^¡Gracias, Ana!/);a.match(message,/comprobante de pago/);
  a.ok(message.length<300);a.doesNotMatch(message,/FICTICIA|S\/|Cuota|Saldo|Capital|\\n/);
}

// Financial details belong to the PNG; the editable suggestion addresses only the first name.
test('WhatsApp contenido: receipt text is brief while the PNG retains the actual payment',async()=>{
  const h=await boot({fullShell:true,state:receiptState()});try{
    const d=h.get(),p=d.payments[0],c=d.clients[0],cr=d.credits[0],before=h.get();
    shortReceiptMessage(h.w.MiCarteraV2PaymentReceipt.text(p,c,cr));
    await h.w.MiCarteraV2PaymentReceipt.image(p,c,cr);
    a.ok(h.drawn.includes('S/ 60.00'));a.ok(h.drawn.includes('Total abonado'));a.ok(h.drawn.includes('S/ 220.00'));
    a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

// The editable preview must use the same new message without losing real allocation details in summary or PNG.
test('WhatsApp contenido: receipt preview shares the edited text with a PNG retaining complete and partial real applications',async()=>{
  const h=await boot({fullShell:true,state:receiptState()});try{
    const before=h.get();let outgoing;
    Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});
    Object.defineProperty(h.w.navigator,'share',{value:async data=>{outgoing=data;},configurable:true});
    const pending=h.w.MiCarteraV2SharePreview.previewPayment('p1');await tick();
    const modal=h.w.document.getElementById('v2SharePreview'),message=modal.querySelector('#v2SharePreviewMessage');
    shortReceiptMessage(message.value);
    a.match(modal.querySelector('.v2-share-preview-summary').textContent,/Cuota 5: S\/ 40\.00 · COMPLETADA/);
    a.match(modal.querySelector('.v2-share-preview-summary').textContent,/Cuota 6: S\/ 20\.00 · PARCIAL \(pendiente S\/ 20\.00\)/);
    a.ok(h.drawn.includes('Cuota 5: S/ 40.00 · COMPLETADA'));a.ok(h.drawn.includes('Cuota 6: S/ 20.00 · PARCIAL (pendiente S/ 20.00)'));
    a.equal(outgoing,undefined,'preview must not share before confirmation');
    message.value='Gracias, Ana.\nMensaje editado.';
    await modal.querySelector('.v2-share-preview-actions button:last-child').onclick();a.equal(await pending,'file-share');
    a.equal(outgoing.text,'Gracias, Ana.\nMensaje editado.');a.equal(outgoing.files[0].name,'prestamo-ya-comprobante-pago.png');a.equal(outgoing.files[0].type,'image/png');a.ok(outgoing.files[0].size>0);
    a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});

// A missing or failed message dependency must retain the existing graphical preparation failure UI.
test('receipt preview keeps its alert and prepare-failed result when message preparation fails',{timeout:30000},async()=>{
  for(const scenario of ['text-failure','missing-receipt']){const h=await boot({fullShell:true,state:receiptState()});let timeout;try{
    const before=h.get();h.w.console.error=()=>{};
    if(scenario==='text-failure')h.w.MiCarteraV2PaymentReceipt.text=()=>{throw Error('FICTIONAL_TEXT_FAILURE');};
    else{h.w.MiCarteraV2PaymentReceipt=undefined;a.equal(vm.runInContext('typeof window.MiCarteraV2PaymentReceipt',h.w),'undefined','missing dependency must be absent inside the application VM');}
    const result=await Promise.race([h.w.MiCarteraV2SharePreview.previewPayment('p1').catch(error=>'unexpected-rejection:'+error.message),new Promise(resolve=>{timeout=setTimeout(()=>resolve('preview-timeout'),3000);})]);
    a.equal(result,'prepare-failed',scenario);a.equal(Boolean(h.w.document.getElementById('v2SharePreview')),false);
    a.equal(h.alerts.at(-1),'No se pudo preparar el comprobante gráfico. No se enviará texto en su lugar.');
    a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
  }finally{clearTimeout(timeout);await h.close();}}
});
