const {test}=require('node:test'),a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
for(const view of ['clients','credits','payments'])test(view+' search matches accents and formatted phone without changing records',async()=>{
 const h=await boot();try{
  const d=h.get();d.clients=[{id:'test-accent',name:'Elías Prueba',phone:'+51 944 318 711',dni:'70883345'}];
  d.credits=[{id:'test-credit',clientId:'test-accent',capital:100,total:110,status:'ACTIVO',schedule:[],version:1}];
  d.payments=[{id:'test-payment',creditId:'test-credit',amount:10,date:'2026-09-26',version:1}];h.set(d);
  h.load('app/operational-cards-v2.js');
  h.w.document.dispatchEvent(new h.w.Event('DOMContentLoaded'));
  const map={clients:['clientSearch','clientsList'],credits:['creditSearch','creditsList'],payments:['paymentSearch','paymentHistory']};
  const [inputId,listId]=map[view],input=h.w.document.getElementById(inputId),list=h.w.document.getElementById(listId);
  a.ok(input,'search control exists');const before=JSON.stringify(h.get());
  for(const query of ['elias','ELÍAS','944318711','70883345']){input.value=query;input.dispatchEvent(new h.w.Event('input',{bubbles:true}));a.match(list.textContent,/Elías Prueba/,query)}
  input.value='no-coincide';input.dispatchEvent(new h.w.Event('input',{bubbles:true}));a.doesNotMatch(list.textContent,/Elías Prueba/);
  a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
 }finally{h.close()}
});
for(const grouped of [false,true])test('agenda '+(grouped?'grouped':'base')+' search matches accents and formatted phone without changing records',async()=>{
 const h=await boot();try{
  const d=h.get();d.clients=[{id:'accent',name:'Elías Prueba',phone:'+51 944 318 711'}];
  d.credits=[{id:'agenda-credit',clientId:'accent',status:'ACTIVO',schedule:[{date:'2026-09-26',amount:50,balance:50}]}];h.set(d);
  h.load('app/agenda-v2.js');if(grouped)h.load('app/agenda-grouped-v2.js');
  h.w.document.getElementById('agendaFrom').value='2026-09-26';h.w.document.getElementById('agendaTo').value='2026-09-26';
  const input=h.w.document.getElementById('agendaSearch'),list=h.w.document.getElementById('agendaList'),before=JSON.stringify(h.get());
  for(const query of ['elias','ELÍAS','944318711']){input.value=query;h.w.MiCarteraV2Agenda.render();a.match(list.textContent,/Elías Prueba/,query)}
  input.value='no-coincide';h.w.MiCarteraV2Agenda.render();a.doesNotMatch(list.textContent,/Elías Prueba/);
  a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
 }finally{h.close()}
});
