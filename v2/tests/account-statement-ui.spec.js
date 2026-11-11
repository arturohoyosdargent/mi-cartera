'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

const today='2026-11-10';
function credit(id,date,amount) {
  return {id,clientId:'c1',status:'ACTIVO',capital:amount,total:amount,
    schedule:[{number:1,date,amount,paid:0,balance:amount,status:'PENDIENTE'}],version:1};
}
async function setup() {
  const h=await boot({fullShell:true,state:{
    clients:[{id:'c1',name:'Cliente ficticio',phone:'999111222'}],
    credits:[credit('cobro-hoy',today,40),credit('futuro','2026-12-09',70)],
    payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}
  }});
  h.w.MiCarteraV2Dates.today=()=>today;
  h.w.MiCarteraV2Cards.render();
  return h;
}

test('statement UI opens in Clientes and Cobranza and refreshes filtered balances from committed payments',async()=> {
  const h=await setup(),d=h.w.document;
  try {
    const client=d.querySelector('#clientsList [data-account-statement]');
    const collections=d.querySelector('#collectionsList [data-account-statement]');
    assert.ok(client&&collections,'both cards offer Estado de cuenta');
    client.click();
    const ui=h.w.MiCarteraV2AccountStatementUI;
    await ui.refresh();
    let panel=d.getElementById('v2AccountStatement');
    assert.ok(panel);
    assert.match(panel.querySelector('[data-debt]').textContent,/110\.00/);
    assert.match(panel.querySelector('[data-due]').textContent,/40\.00/);
    assert.match(panel.querySelector('[data-whatsapp]').href,/wa\.me\/51999111222/);
    const filter=panel.querySelector('[data-filter]');
    filter.value='upcoming';filter.dispatchEvent(new h.w.Event('change'));
    await ui.refresh();
    assert.match(panel.querySelector('[data-count]').textContent,/1 de 2/);
    assert.match(panel.querySelector('[data-debt]').textContent,/110\.00/);
    const next=h.get();
    next.credits[0].schedule[0]={...next.credits[0].schedule[0],paid:15,balance:25,status:'PARCIAL'};
    next.payments.push({id:'p1',creditId:'cobro-hoy',amount:15,date:today});
    next.clients[0].phone='999111333';
    h.set(next);h.w.MiCarteraV2Cards.render();
    h.w.dispatchEvent(new h.w.Event('mi-cartera-v2-payment-recorded'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(panel.querySelector('[data-debt]').textContent,/95\.00/);
    assert.match(panel.querySelector('[data-due]').textContent,/25\.00/);
    assert.match(panel.querySelector('[data-whatsapp]').href,/wa\.me\/51999111333/);
    assert.match(panel.querySelector('[data-download]').href,/^blob:/);
    panel.querySelector('[data-close]').click();
    d.querySelector('#collectionsList [data-account-statement]').click();
    await ui.refresh();
    panel=d.getElementById('v2AccountStatement');
    assert.match(panel.querySelector('[data-due]').textContent,/25\.00/);
    h.setAuth({uid:'second-account',role:'admin',ready:false,authenticated:true,member:false},true);
    assert.equal(d.getElementById('v2AccountStatement'),null);
  } finally { await h.close(); }
});
