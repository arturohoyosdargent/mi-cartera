'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot,KEY}=require('./dom-harness.cjs');

const today='2026-11-20';
function installment(date,amount=60,number=1){return {number,date,amount,paid:0,balance:amount,status:'PENDIENTE'};}
function credit(id,schedule=[installment(today)]){
  return {id,clientId:'fictional-client',date:'2026-10-20',status:'ACTIVO',capital:100,total:120,
    principalPaid:0,interestPaid:0,penaltyPaid:0,schedule,version:1};
}
async function setup(credits){
  const h=await boot({fullShell:true,today:()=>today,state:{
    clients:[{id:'fictional-client',name:'Cliente Ficticio',phone:'999000123',routeId:'fictional-route'}],
    credits,payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}
  }});
  const d=h.w.document;
  d.getElementById('agendaFrom').value='2026-11-19';d.getElementById('agendaTo').value=today;
  h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2Agenda.render();
  return h;
}
const groupAction=h=>[...h.w.document.querySelectorAll('#agendaList .v2-agenda-client-card > .row button')];
function unchanged(h,before){assert.equal(h.w.localStorage.getItem(KEY),before);assert.equal(h.commits.length,0);}

// A first-credit handler in the group action would omit the other credit from the outgoing graphic.
test('a multi-credit client reminder opens one existing consolidated PNG containing both same-date credits',async()=>{
  const h=await setup([credit('fictional-credit-a'),credit('fictional-credit-b')]);
  try{
    const d=h.w.document,before=h.w.localStorage.getItem(KEY);
    assert.equal(d.querySelectorAll('#agendaList .v2-agenda-client-card').length,1);
    assert.match(d.getElementById('agendaSummary').textContent,/2 cuotas pendientes.*120\.00/);
    const action=groupAction(h).find(button=>button.textContent.includes('Recordar cliente'));
    assert.ok(action,'the client-level action must cover every credit');
    action.click();await h.w.MiCarteraV2AccountStatementUI.refresh();
    const panel=d.getElementById('v2AccountStatement');assert.ok(panel);
    assert.match(panel.querySelector('[data-count]').textContent,/2 de 2/);
    assert.match(panel.querySelector('[data-due]').textContent,/120\.00/);
    assert.ok(h.drawn.some(text=>text.includes('fictional-credit-a')));
    assert.ok(h.drawn.some(text=>text.includes('fictional-credit-b')));
    assert.match(panel.querySelector('[data-download]').href,/^blob:/);
    assert.equal(d.getElementById('v2SharePreview'),null,'the action must not prepare the first credit alone');
    panel.querySelector('[data-close]').click();unchanged(h,before);
  }finally{await h.close();}
});

// Dropping either the visible credit reference or its individual handler makes identical rows ambiguous.
test('same-date equal-amount installments identify their separate credits and retain individual reminders',async()=>{
  const h=await setup([credit('fictional-credit-a'),credit('fictional-credit-b')]);
  try{
    const before=h.w.localStorage.getItem(KEY),rows=[...h.w.document.querySelectorAll('#agendaList .v2-agenda-detail-row')];
    const reminded=[];h.w.MiCarteraV2Agenda.remind=id=>reminded.push(id);
    assert.equal(rows.length,2);
    for(const [index,id] of ['fictional-credit-a','fictional-credit-b'].entries()){
      assert.ok(rows[index].textContent.includes('Crédito '+id),'show credit reference '+id);
      assert.match(rows[index].textContent,/Cuota 1.*2026-11-20.*60\.00/);
      rows[index].querySelector('button').click();assert.equal(reminded[index],id+':1');
    }
    unchanged(h,before);
  }finally{await h.close();}
});

test('several installments of one credit retain the single-credit next reminder',async()=>{
  const h=await setup([credit('fictional-credit-a',[installment('2026-11-19',40),installment(today,60,2)])]);
  try{
    const before=h.w.localStorage.getItem(KEY),buttons=groupAction(h);
    const next=buttons.find(button=>button.textContent.includes('Recordar próximo'));
    const reminded=[];h.w.MiCarteraV2Agenda.remind=id=>reminded.push(id);
    assert.ok(next);next.click();assert.deepEqual(reminded,['fictional-credit-a:1']);
    assert.equal(buttons.some(button=>button.textContent.includes('Recordar cliente')),false);unchanged(h,before);
  }finally{await h.close();}
});

test('agenda reminder and credit buttons treat quoted IDs as data when clicked',async()=>{
  const id="fictional-credit-');window.__agendaInjected=true;//",h=await setup([credit(id)]);
  try{
    const before=h.w.localStorage.getItem(KEY),reminded=[],focused=[],shown=[];
    h.w.MiCarteraV2Agenda.remind=value=>reminded.push(value);
    h.w.MiCarteraV2CreditOverdue.focus=value=>focused.push(value);h.w.show=value=>shown.push(value);
    const buttons=[...h.w.document.querySelectorAll('#agendaList button')];
    for(const button of buttons.filter(button=>/Recordar|Ver crédito/.test(button.textContent))){
      assert.equal(button.getAttribute('onclick'),null,'IDs must not be evaluated as JavaScript');button.click();
    }
    assert.deepEqual(reminded,[id+':1',id+':1']);assert.deepEqual(focused,[id]);assert.deepEqual(shown,['credits']);
    assert.equal(h.w.__agendaInjected,undefined);unchanged(h,before);
  }finally{await h.close();}
});

test('a filtered agenda still offers a consolidated reminder when the client has another active credit outside its dates',async()=>{
  const h=await setup([credit('fictional-credit-today'),credit('fictional-credit-future',[installment('2026-12-20')])]);
  try{
    const before=h.w.localStorage.getItem(KEY);
    assert.equal(h.w.document.querySelectorAll('#agendaList .v2-agenda-detail-row').length,1);
    const action=groupAction(h).find(button=>button.textContent.includes('Recordar cliente'));
    assert.ok(action,'date filtering must not hide the client-level reminder');
    action.click();await h.w.MiCarteraV2AccountStatementUI.refresh();
    assert.match(h.w.document.querySelector('#v2AccountStatement [data-count]').textContent,/2 de 2/);
    unchanged(h,before);
  }finally{await h.close();}
});

// Using <= today for the overdue branch incorrectly tells a customer today's installment is already late.
test('a collection due today is labelled HOY without an overdue label or red overdue card',async()=>{
  const h=await setup([credit('fictional-credit-today')]);
  try{
    const before=h.w.localStorage.getItem(KEY),card=h.w.document.querySelector('#collectionsList > .card');
    assert.ok(card);assert.match(card.textContent,/HOY/);assert.doesNotMatch(card.textContent,/VENCIDO/);
    assert.equal(card.classList.contains('v2-overdue-card'),false);unchanged(h,before);
  }finally{await h.close();}
});

test('a collection from yesterday keeps its overdue label and red overdue card',async()=>{
  const h=await setup([credit('fictional-credit-overdue',[installment('2026-11-19')])]);
  try{
    const before=h.w.localStorage.getItem(KEY),card=h.w.document.querySelector('#collectionsList > .card');
    assert.match(card.textContent,/VENCIDO/);assert.equal(card.classList.contains('v2-overdue-card'),true);unchanged(h,before);
  }finally{await h.close();}
});

test('mixed yesterday and today installments remain overdue and collect both pending amounts',async()=>{
  const h=await setup([credit('fictional-credit-mixed',[installment('2026-11-19',40),installment(today,60,2)])]);
  try{
    const before=h.w.localStorage.getItem(KEY),card=h.w.document.querySelector('#collectionsList > .card');
    assert.match(card.textContent,/VENCIDO.*2 cuotas pendientes.*100\.00/);
    assert.equal(card.classList.contains('v2-overdue-card'),true);unchanged(h,before);
  }finally{await h.close();}
});
