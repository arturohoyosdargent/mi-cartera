const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');

test('credit, collection and payment views share schedule balances and never offer collection on previous credits',async()=>{
  const h=await boot();try{
    h.w.MiCarteraV2Dates.today=()=> '2026-10-07';h.load('app/operational-cards-v2.js');
    const d=h.get(),base={clientId:'c1',capital:100,total:120,principalPaid:30,status:'ACTIVO',schedule:[{n:1,date:'2026-09-30',amount:60,paid:60,balance:0},{n:2,date:'2026-10-07',amount:60,paid:20,balance:40}]};
    d.credits=[{...base,id:'fictional-partial'},{...base,id:'fictional-paid',status:'PAGADO',schedule:base.schedule.map(q=>({...q,paid:60,balance:0}))},{...base,id:'fictional-renewed',status:'RENOVADO',renewedTo:'successor'}];
    d.payments=[{id:'fictional-payment',creditId:'fictional-partial',date:'2026-10-07',amount:20,concept:'CUOTA'}];h.set(d);
    const before=JSON.stringify(h.get()),cards=h.w.MiCarteraV2Cards,doc=h.w.document;
    a.deepEqual(JSON.parse(JSON.stringify(cards.installmentState(d.credits[0]))),{total:120,balance:40,paid:80,status:'PARCIAL',collectible:true});
    a.equal(cards.installmentState(d.credits[1]).collectible,false);a.equal(cards.installmentState(d.credits[2]).collectible,false);
    cards.render();a.equal(doc.querySelectorAll('#creditsList [data-credit-id]').length,1);
    const current=doc.querySelector('#creditsList [data-credit-id]');a.match(current.textContent,/PARCIAL · Capital S\/ 100.00 · Total S\/ 120.00 · Pagado S\/ 80.00 · Saldo S\/ 40.00/);a.match(current.textContent,/Cobrar/);
    a.equal(doc.querySelectorAll('#collectionsList .v2-overdue-card').length,1);a.match(doc.querySelector('#collectionsList').textContent,/S\/ 40.00/);
    a.match(doc.querySelector('#paymentHistory').textContent,/Estado actual: PARCIAL · Saldo S\/ 40.00/);
    h.w.MiCarteraV2CreditOverdue={selectedFilter:()=> 'PREVIOUS'};cards.render();
    a.equal(doc.querySelectorAll('#creditsList [data-credit-id]').length,2);a.doesNotMatch(doc.querySelector('#creditsList').textContent,/Cobrar|Renovar/);a.match(doc.querySelector('#creditsList').textContent,/Ver detalle/);
    a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
  }finally{await h.close();}
});
