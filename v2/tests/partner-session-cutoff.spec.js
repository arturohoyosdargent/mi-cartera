const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
const C=require(path.resolve(process.env.SOURCE||'v2','core/partner-loans.js'));
const A=require(path.resolve(process.env.SOURCE||'v2','core/partner-interest-agenda.js'));
const {boot,KEY}=require('./dom-harness.cjs');
const OWNER='mi-cartera-v2-local-owner';
const input={id:'fictional-loan',partner:'Socio ficticio',date:'2026-09-01',principal:1000,rate:10,firstDue:'2026-10-01'};
function protectedRows(h){
  const queue='mi-cartera-v2-cloud-operations:test-admin',closures='mi-cartera-v2-journal-admin-closures:'+queue;
  h.w.localStorage.setItem(queue,JSON.stringify(Array.from({length:6},(_,i)=>({id:'fictional-protected-'+i,status:'PENDIENTE',operation:{id:'fictional-protected-'+i,type:'PAYMENT',actorId:'test-admin'}}))));
  h.w.localStorage.setItem(closures,JSON.stringify([{id:'fictional-closure-1'},{id:'fictional-closure-2'}]));
  const beforeQueue=h.w.localStorage.getItem(queue),beforeClosures=h.w.localStorage.getItem(closures);
  return ()=>{a.equal(h.w.localStorage.getItem(queue),beforeQueue);a.equal(h.w.localStorage.getItem(closures),beforeClosures)};
}
async function setup({agenda=false}={}){
  const h=await boot();let auth={ready:true,uid:'test-admin',role:'admin'};
  h.w.MiCarteraV2AuthCloudGate.state=()=>({...auth});h.w.MiCarteraV2AuthCloudGate.requireReady=()=>({...auth});
  h.w.localStorage.setItem(OWNER,auth.uid);h.w.MiCarteraV2Dates.today=()=> '2026-10-03';
  h.load('core/partner-loans.js');h.load('app/partner-loans-ui.js');
  if(agenda){h.load('core/partner-interest-agenda.js');h.load('app/partner-interest-agenda-ui.js')}
  h.load('app/screen-navigation-v2.js');h.w.MiCarteraV2ScreenNavigation.install();h.w.MiCarteraPartners.install();
  return {...h,setAuth:x=>{auth=x},verifyProtected:protectedRows(h)};
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function foreignState(){return {clients:[],credits:[],payments:[],audit:[],commercial:[],cashMovements:[{id:'fictional-gestor-cash',type:'INGRESO',amount:700,workerId:'fictional-worker',cashAccountId:'fictional-worker',routeId:'fictional-route'}],session:{actorId:'fictional-gestor',role:'GESTOR',workerId:'fictional-worker'}}}

// Removing the session check after ACK would append the original owner's loan or expense to this new portfolio.
for(const action of ['create','interest','repay','settle'])test('late '+action+' ACK preserves the new scoped owner portfolio',async()=>{
  const h=await setup();try{
    if(action!=='create'){const d=h.get();d.cashMovements=[C.entry(C.create(input))];h.set(d)}
    const entered=deferred(),ack=deferred();let sent=0;
    h.w.MiCarteraV2SyncBridge.submit=async()=>{sent++;entered.resolve();await ack.promise;return {status:'COMMITTED'}};
    const calls={create:()=>h.w.MiCarteraPartners.create(input),interest:()=>h.w.MiCarteraPartners.interest(input.id,{date:'2026-10-01',due:'2026-10-01',amount:100}),repay:()=>h.w.MiCarteraPartners.repay(input.id,{date:'2026-10-02',amount:1000}),settle:()=>h.w.MiCarteraPartners.settle(input.partner,'2026-10-02')};
    const pending=calls[action]();await entered.promise;
    h.setAuth({ready:true,uid:'fictional-gestor',role:'gestor',workerId:'fictional-worker',routeIds:['fictional-route']});h.set(foreignState());h.w.localStorage.setItem(OWNER,'fictional-gestor');
    const before=h.w.localStorage.getItem(KEY);ack.resolve();
    await a.rejects(pending,/sesión|session/i);a.equal(sent,1);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
  }finally{h.close()}
});

// Removing the pre-send check lets the operation gate transmit stale rows after its asynchronous version check.
for(const change of ['uid','role','owner','session'])test('changed '+change+' before bridge submission rejects without a financial write',async()=>{
  const h=await setup();try{
    const entered=deferred(),release=deferred();h.w.MiCarteraV2VersionGuard.ensureReady=async()=>{entered.resolve();await release.promise;return true};
    const pending=h.w.MiCarteraPartners.create(input);await entered.promise;
    if(change==='uid')h.setAuth({ready:true,uid:'fictional-other-admin',role:'admin'});
    if(change==='role')h.setAuth({ready:true,uid:'test-admin',role:'supervisor'});
    if(change==='owner')h.w.localStorage.setItem(OWNER,'fictional-other-owner');
    if(change==='session'){const d=h.get();d.session={...d.session,workerId:'fictional-new-scope'};h.set(d)}
    const before=h.w.localStorage.getItem(KEY);release.resolve();await a.rejects(pending,/sesión|session/i);
    a.equal(h.commits.length,0);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
  }finally{h.close()}
});

test('foreign local owner is rejected before reading or transmitting a partner mutation',async()=>{
  const h=await setup();try{h.w.localStorage.setItem(OWNER,'fictional-other-owner');const before=h.w.localStorage.getItem(KEY);await a.rejects(h.w.MiCarteraPartners.create(input),/sesión|session/i);a.equal(h.commits.length,0);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected()}finally{h.close()}
});

// Rendering only the balance on Auth would leave the financial list and open form accessible after a role downgrade.
test('same UID losing management access clears SOCIOS detail and form and leaves the restricted page',async()=>{
  const h=await setup({agenda:true});try{
    const d=h.get();d.cashMovements=[C.entry(C.create(input))];h.set(d);h.w.MiCarteraPartners.show();h.w.document.querySelector('#addPartnerLoan').click();
    a.ok(h.w.document.querySelector('[data-partner-loan]'));a.ok(h.w.document.getElementById('partnerForm'));
    const before=h.w.localStorage.getItem(KEY);h.setAuth({ready:true,uid:'test-admin',role:'cobrador'});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state'));
    const doc=h.w.document;a.equal(doc.querySelectorAll('[data-partner-loan]').length,0);a.equal(doc.getElementById('partnerForm'),null);a.notEqual(doc.querySelector('.page.active')?.id,'partners');
    for(const id of ['partners','partnerBalanceSummary','partnerInterestCalendar','partnerInterestNotice'])a.equal(doc.getElementById(id).hidden,true);
    a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.commits.length,0);h.verifyProtected();
    h.setAuth({ready:true,uid:'test-admin',role:'admin'});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state'));h.w.MiCarteraPartners.show();a.ok(doc.querySelector('[data-partner-loan]'));a.equal(doc.getElementById('partners').hidden,false);
  }finally{h.close()}
});

test('an Auth session that changes away and back cannot apply an old ACK',async()=>{
  const h=await setup();try{
    const entered=deferred(),ack=deferred();h.w.MiCarteraV2SyncBridge.submit=async()=>{entered.resolve();await ack.promise;return {status:'COMMITTED'}};
    const pending=h.w.MiCarteraPartners.create(input);await entered.promise;const before=h.w.localStorage.getItem(KEY);
    for(const role of ['cobrador','admin']){h.setAuth({ready:true,uid:'test-admin',role});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state'))}
    ack.resolve();await a.rejects(pending,/sesión|session/i);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
  }finally{h.close()}
});

// Omitting the effective payment date from any projection would spend cash and erase debt before the requested cutoff.
test('future interest expense and payment stay pending at an earlier cutoff and apply on their effective date',()=>{
  const base=C.create(input),paid=C.payInterest(base,{id:'fictional-future-interest',date:'2026-11-01',due:'2026-10-01',amount:100});
  const rows=[C.entry(paid),{id:'fictional-interest-expense',type:'EGRESO',category:'INTERES_SOCIO',amount:100,date:'2026-11-01',partnerLoanId:base.id}],before=JSON.stringify(rows);
  a.deepEqual(C.summary(rows,[],'2026-10-03'),{cash:1000,portfolioPrincipal:0,partnerPrincipal:1000,partnerInterestDue:100,partnerInterestPaid:0,netCapital:-100});
  a.deepEqual(C.schedule(paid,'2026-10-03'),[{date:'2026-10-01',amount:100,paid:false}]);
  a.equal(C.summary(rows,[],'2026-11-01').cash,900);a.equal(C.summary(rows,[],'2026-11-01').partnerInterestPaid,100);a.equal(JSON.stringify(rows),before);
});

test('future full capital return and closing date do not reduce earlier debt or stop projected schedule',()=>{
  const closed=C.repay(C.create(input),{id:'fictional-future-return',date:'2026-11-01',amount:1000}),rows=[C.entry(closed),{id:'fictional-return-expense',type:'EGRESO',category:'DEVOLUCION_CAPITAL_SOCIO',amount:1000,date:'2026-11-01'}],before=JSON.stringify(rows);
  a.equal(C.balance(closed,'2026-10-03'),1000);a.equal(C.balance(closed),0);
  a.equal(C.summary(rows,[],'2026-10-03').cash,1000);a.equal(C.summary(rows,[],'2026-10-03').partnerPrincipal,1000);
  a.deepEqual(C.schedule(closed,'2026-12-01','2026-10-03').map(r=>r.date),['2026-10-01','2026-11-01','2026-12-01']);
  a.deepEqual(C.schedule(closed,'2026-12-01').map(r=>r.date),['2026-10-01','2026-11-01']);
  a.equal(C.summary(rows,[],'2026-11-01').cash,0);a.equal(C.summary(rows,[],'2026-11-01').partnerPrincipal,0);a.equal(JSON.stringify(rows),before);
});

test('agenda evaluates paid flags and closing dates at asOf independently of its display horizon',()=>{
  const base=C.create(input),paid=C.payInterest(base,{id:'fictional-future-interest',date:'2026-11-01',due:'2026-10-01',amount:100});
  const m=A.build([paid],'2026-10-03','2026-11');a.equal(m.overdueTotal,100);a.equal(m.overdue[0].paid,false);
  const closed=C.repay(base,{id:'fictional-future-return',date:'2026-11-01',amount:1000});a.deepEqual(A.build([closed],'2026-10-03','2026-12').monthRows.map(r=>r.date),['2026-12-01']);
});

test('future partial return uses the original agreed amount until its date and preserves no-cutoff balance',()=>{
  const partial=C.repay(C.create(input),{id:'fictional-future-partial',date:'2026-11-02',amount:400,nextMonthlyInterest:60});
  a.equal(C.balance(partial,'2026-10-03'),1000);a.equal(C.balance(partial,'2026-11-02'),600);a.equal(C.balance(partial),600);
  a.equal(C.schedule(partial,'2026-12-01','2026-10-03').at(-1).amount,100);a.equal(C.schedule(partial,'2026-12-01','2026-11-02').at(-1).amount,60);
});

test('future contribution and dated cash movements are excluded while undated legacy cash remains compatible',()=>{
  const future=C.create({...input,date:'2026-11-01',firstDue:'2026-12-01'}),rows=[C.entry(future),{id:'fictional-legacy-cash',type:'INGRESO',amount:700},{id:'fictional-future-cash',type:'EGRESO',amount:200,date:'2026-11-01'}];
  a.deepEqual(C.summary(rows,[],'2026-10-03'),{cash:700,portfolioPrincipal:0,partnerPrincipal:0,partnerInterestDue:0,partnerInterestPaid:0,netCapital:700});
  a.equal(C.balance(future,'2026-10-03'),0);
});

// Using full recorded balance for consultation would show zero debt and a future closing as already effective.
test('partner cards and interest form show today capital while a future return remains reserved against duplication',async()=>{
  const h=await setup();try{
    const closed=C.repay(C.create(input),{id:'fictional-future-return',date:'2026-11-01',amount:1000}),d=h.get();
    d.cashMovements=[C.entry(closed),{id:'fictional-return-expense',type:'EGRESO',category:'DEVOLUCION_CAPITAL_SOCIO',amount:1000,date:'2026-11-01'}];h.set(d);
    const before=h.w.localStorage.getItem(KEY);h.w.MiCarteraPartners.show();const doc=h.w.document,card=doc.querySelector('[data-partner-loan]');
    a.match(doc.getElementById('partnerBalanceSummary').textContent,/Capital por devolver: S\/ 1000\.00/);
    a.match(doc.getElementById('partnerList').textContent,/Capital por devolver: S\/ 1000\.00/);a.match(card.textContent,/Capital pendiente: S\/ 1000\.00 · Vigente/);
    a.doesNotMatch(card.textContent,/Capital devuelto el 2026-11-01/);a.match(card.textContent,/reservad/i);a.match(card.querySelector('details').textContent,/2026-11-01/);
    a.equal(card.querySelector('[data-repay]'),null);a.equal(doc.querySelector('[data-settle]'),null);
    card.querySelector('[data-interest]').click();a.match(doc.getElementById('partnerForm').textContent,/Capital pendiente S\/ 1000\.00/);
    await a.rejects(h.w.MiCarteraPartners.repay(input.id,{date:'2026-11-02',amount:1000}),/excede/);await a.rejects(h.w.MiCarteraPartners.settle(input.partner,'2026-11-02'),/No hay capital/);
    a.equal(h.commits.length,0);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
    h.w.MiCarteraV2Dates.today=()=> '2026-11-01';h.w.MiCarteraPartners.render();a.match(doc.querySelector('[data-partner-loan]').textContent,/Capital pendiente: S\/ 0\.00 · Capital devuelto el 2026-11-01/);
  }finally{h.close()}
});

test('repayment review shows cutoff capital and keeps the available amount excluding a future partial return',async()=>{
  const h=await setup();try{
    const partial=C.repay(C.create(input),{id:'fictional-future-partial',date:'2026-11-02',amount:400,nextMonthlyInterest:60}),d=h.get();d.cashMovements=[C.entry(partial)];h.set(d);
    const before=h.w.localStorage.getItem(KEY);h.w.MiCarteraPartners.show();const doc=h.w.document;
    doc.querySelector('[data-repay]').click();const form=doc.getElementById('partnerForm');a.match(form.textContent,/Capital pendiente: S\/ 1000\.00/);
    a.equal(form.querySelector('[name=amount]').value,'600');a.equal(form.querySelector('[name=amount]').max,'600');a.match(form.textContent,/reservad/i);
    a.equal(h.commits.length,0);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
  }finally{h.close()}
});

test('future registered interest stays visible as pending at cutoff without inviting a duplicate payment',async()=>{
  const h=await setup();try{
    const paid=C.payInterest(C.create(input),{id:'fictional-future-interest',date:'2026-11-01',due:'2026-10-01',amount:100}),d=h.get();d.cashMovements=[C.entry(paid),{id:'fictional-interest-expense',type:'EGRESO',category:'INTERES_SOCIO',amount:100,date:'2026-11-01'}];h.set(d);
    const before=h.w.localStorage.getItem(KEY);h.w.MiCarteraPartners.show();const card=h.w.document.querySelector('[data-partner-loan]');
    a.match(card.textContent,/1 interés\(es\) pendiente\(s\): S\/ 100\.00/);a.match(card.textContent,/registrad.+fecha futura/i);a.match(card.querySelector('details').textContent,/2026-11-01/);a.equal(card.querySelector('[data-interest]'),null);
    await a.rejects(h.w.MiCarteraPartners.interest(input.id,{date:'2026-10-03',due:'2026-10-01',amount:100}),/ya fue pagado/);a.equal(h.commits.length,0);a.equal(h.w.localStorage.getItem(KEY),before);h.verifyProtected();
  }finally{h.close()}
});

// Filtering only cash would turn a future credit disbursement into false net capital before its effective date.
test('summary excludes future credit principal at cutoff and retains undated legacy principal',()=>{
  const credits=[{id:'fictional-future-credit',status:'ACTIVE',capital:100,principalPaid:0,date:'2026-11-01'}],cash=[{id:'fictional-future-disbursement',type:'EGRESO',amount:100,date:'2026-11-01'}],before=JSON.stringify({credits,cash});
  a.deepEqual(C.summary(cash,credits,'2026-10-03'),{cash:0,portfolioPrincipal:0,partnerPrincipal:0,partnerInterestDue:0,partnerInterestPaid:0,netCapital:0});
  a.equal(C.summary(cash,credits,'2026-11-01').portfolioPrincipal,100);a.equal(C.summary(cash,credits,'2026-11-01').netCapital,0);
  a.equal(C.summary(cash,[...credits,{id:'fictional-legacy-credit',status:'ACTIVO',capital:70,principalPaid:20}],'2026-10-03').portfolioPrincipal,50);
  a.equal(JSON.stringify({credits,cash}),before);
});
