const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {boot,KEY}=require('./dom-harness.cjs');
const SUPPORT_KEY='mi-cartera-v2-support-tickets';
const visible=host=>Array.from(host.children).filter(x=>x.matches('.card,.v2-cash-detail')&&!x.hidden&&!x.matches('[data-v2-history-more]'));
const more=host=>host.querySelector(':scope > [data-v2-history-more]');
async function setup(role='cobrador'){
 const h=await boot();h.w.MiCarteraV2AuthCloudGate={ORG:'fixture-org',state:()=>({ready:true,uid:'fixture-user',role})};
 h.w.firebaseAuthV2={auth:{currentUser:{uid:'fixture-user'}}};h.w.localStorage.setItem('mi-cartera-v2-local-owner','fixture-user');
 const d=h.get();d.clients=[{id:'fixture-client',name:'Cliente Ficticio',phone:'999000123'}];
 d.credits=Array.from({length:13},(_,i)=>({id:'active-'+i,clientId:'fixture-client',status:'ACTIVE',capital:100,total:100,schedule:[{amount:100,balance:100,date:'2099-01-01'}]}));
 d.payments=Array.from({length:23},(_,i)=>({id:'p'+String(i+1).padStart(2,'0'),date:'2026-10-'+String(i+1).padStart(2,'0'),amount:i+1,clientId:'fixture-client'}));
 d.cashMovements=Array.from({length:23},(_,i)=>({id:'cash-'+i,date:'2026-10-'+String(i+1).padStart(2,'0'),type:'INGRESO',amount:10,category:'APORTE_CAPITAL',concept:'Ingreso ficticio '+i}));
 h.set(d);h.load('app/operational-cards-v2.js');h.load('app/support-center-v2.js');
 if(fs.existsSync(path.join(__dirname,'../app/history-list-v2.js')))h.load('app/history-list-v2.js');
 h.w.document.dispatchEvent(new h.w.Event('DOMContentLoaded'));h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2CashMenu.install();
 return h;
}
test('payment history initially shows 10, exposes every later payment with Ver más and preserves action buttons',async()=>{
 const h=await setup();try{const box=h.w.document.getElementById('paymentHistory'),before=h.w.localStorage.getItem(KEY);
  a.equal(box.querySelectorAll(':scope > .card').length,23,'all payments must stay in the DOM');a.equal(visible(box).length,10);
  a.ok(visible(box)[0].querySelector('button'));more(box).click();a.equal(visible(box).length,20);more(box).click();a.equal(visible(box).length,23);a.equal(more(box),null);
  h.w.MiCarteraV2Cards.renderPayments();a.equal(visible(box).length,23,'a render of the same history retains the expanded batch');
  a.equal(h.w.document.querySelectorAll('#clientsList > [data-client-card]').length,1);a.equal(h.w.document.querySelectorAll('#creditsList > [data-credit-card]').length,13,'active portfolio must never be batched');
  a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});
test('payment search evaluates the full history and displays every match while the unfiltered view starts at 10 again',async()=>{
 const h=await setup();try{const box=h.w.document.getElementById('paymentHistory'),search=h.w.document.getElementById('paymentSearch'),before=h.w.localStorage.getItem(KEY);
  a.equal(visible(box).length,10);a.doesNotMatch(visible(box).map(x=>x.textContent).join(''),/Operación: p01/);
  search.value='p01';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));a.equal(visible(box).length,1);a.match(visible(box)[0].textContent,/Operación: p01/);a.equal(more(box),null);
  search.value='Ficticio';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));a.equal(visible(box).length,23,'search must not truncate matching records');a.equal(more(box),null);
  search.value='';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));a.equal(visible(box).length,10);a.ok(more(box));a.equal(h.w.localStorage.getItem(KEY),before);
 }finally{await h.close();}
});
test('cash batches are limited to movement details inside each group, retain full totals and date filtering',async()=>{
 const h=await setup();try{const box=h.w.document.getElementById('cashHistory'),group=box.querySelector('details'),before=h.w.localStorage.getItem(KEY);
  a.equal(group.querySelectorAll(':scope > .v2-cash-detail').length,23);a.equal(visible(group).length,10);a.match(group.querySelector('summary').textContent,/23 movimientos.*230\.00/);
  a.equal(h.w.document.getElementById('cashBalance').textContent,'S/ 230.00');more(group).click();a.equal(visible(group).length,20);
  h.w.MiCarteraV2CashMenu.renderHistory();a.equal(visible(box.querySelector('details')).length,20);
  const period=h.w.document.getElementById('cashHistoryPeriod');period.value='RANGE';h.w.document.getElementById('cashHistoryFrom').value='2026-10-01';h.w.document.getElementById('cashHistoryTo').value='2026-10-01';period.dispatchEvent(new h.w.Event('change',{bubbles:true}));
  const filtered=box.querySelector('details');a.equal(visible(filtered).length,1);a.match(filtered.textContent,/Ingreso ficticio 0/);a.equal(more(filtered),null);
  a.equal(h.w.document.getElementById('cashIncomeTotal').textContent,'S/ 10.00');a.equal(h.w.document.getElementById('cashBalance').textContent,'S/ 230.00');a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});
test('support histories batch only the authenticated user and separately the authorized organization inbox',async()=>{
 for(const role of ['cobrador','admin']){const h=await setup(role);try{
  const reports=Array.from({length:23},(_,i)=>({id:'SOP-'+i,uid:'fixture-user',orgId:'fixture-org',type:'MEJORA',description:'Reporte ficticio '+i,status:'NUEVO',createdAt:'2026-10-07T12:00:00Z'}));
  reports.push({id:'SOP-colleague',uid:'other',orgId:'fixture-org',type:'ERROR',description:'Falla ficticia',status:'NUEVO'},{id:'SOP-foreign',uid:'fixture-user',orgId:'foreign-org',type:'ERROR',description:'Falla ajena',status:'NUEVO'});
  h.w.localStorage.setItem(SUPPORT_KEY,JSON.stringify(reports));const before=h.w.localStorage.getItem(SUPPORT_KEY);h.w.MiCarteraV2Support.render();
  const own=h.w.document.getElementById('supportList');a.equal(own.querySelectorAll(':scope > [data-support-ticket]').length,23);a.equal(visible(own).length,10);more(own).click();a.equal(visible(own).length,20);
  if(role==='admin'){const inbox=h.w.document.getElementById('v2SupportInboxList');a.equal(inbox.querySelectorAll(':scope > [data-support-ticket]').length,24);a.equal(visible(inbox).length,10);more(inbox).click();a.equal(visible(inbox).length,20);a.equal(inbox.querySelectorAll('select').length,24);a.doesNotMatch(inbox.textContent,/SOP-foreign/);}
  else{a.equal(h.w.document.getElementById('v2SupportInboxList'),null);a.doesNotMatch(own.textContent,/SOP-colleague/);}
  a.equal(h.w.localStorage.getItem(SUPPORT_KEY),before);a.equal(h.commits.length,0);
 }finally{await h.close();}}
});
test('explicit audit rows can be batched without changing unrelated security content',async()=>{
 const h=await setup();try{const box=h.w.document.getElementById('auditHistory'),before=h.w.localStorage.getItem(KEY);
  box.innerHTML='<p>Información de auditoría</p>'+Array.from({length:13},(_,i)=>'<div class="card" data-audit-entry="'+i+'">Evento ficticio '+i+'</div>').join('');
  h.w.dispatchEvent(new h.w.Event('mi-cartera-v2-rehydrated'));a.equal(visible(box).length,10);a.equal(box.querySelector('p').hidden,false);more(box).click();a.equal(visible(box).length,13);a.equal(more(box),null);a.equal(h.w.localStorage.getItem(KEY),before);
 }finally{await h.close();}
});
