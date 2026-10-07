// Actual shell modules, two isolated DOM sessions and an in-memory atomic Cloud
// boundary. These fixtures never authenticate against or write to Firebase.
const {test}=require('node:test'),a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
const T=require('../core/transaction-store'),Sync=require('../cloud/operational-sync');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const clone=value=>JSON.parse(JSON.stringify(value));
const cash=d=>Math.round(d.cashMovements.reduce((n,m)=>n+(m.type==='INGRESO'?m.amount:-m.amount),0)*100)/100;
const debt=c=>Math.round(c.schedule.reduce((n,q)=>n+Number(q.balance),0)*100)/100;
const loan={id:'fictional-partner-loan',partner:'Socio FICTICIO',date:'2026-09-01',principal:500,rate:10,firstDue:'2026-10-01',historical:true};

async function attachCloud(h,db){
  const store=T.createStore({runAtomic:async fn=>{const staged=new Map(db);const r=await fn({get:async p=>staged.get(p)||null,set:async(p,v)=>staged.set(p,clone(v))});db.clear();for(const row of staged)db.set(...row);return r;}});
  const sync=Sync.createOperationalSync({store,actorId:'test-admin'});
  h.w.MiCarteraV2SyncBridge.submit=async op=>{h.commits.push(clone(op));return sync.submit(op);};
  h.w.firestoreV2={db:{},collection:(unused,...parts)=>parts.at(-1),getDocs:async name=>({forEach(fn){for(const [key,row] of db)if(key.startsWith(name+'/'))fn({id:row.id,data:()=>clone(row)});}})};
  h.load('app/cloud-rehydration-v2.js');
  h.w.MiCarteraV2Dates.today=()=> '2026-10-07';
}
function renew(h,creditId,method,capital){
  const pending=h.w.V2UI[method](creditId),doc=h.w.document;
  if(capital)doc.getElementById('v2RenewCapital').value=String(capital);
  doc.getElementById('v2RenewDate').value='2026-10-07';
  doc.getElementById('v2RenewFirstDate').value='2026-10-09';
  doc.getElementById('v2RenewReview').click();
  const accepted=doc.getElementById('v2RenewAccepted');a.ok(accepted);accepted.checked=true;accepted.onchange();doc.getElementById('v2ConfirmRenewal').click();
  return pending;
}

test('actual shell retains every operational screen and durable financial flow across two sessions and reopening',async()=>{
  const db=new Map();let pc=await boot({fullShell:true}),mobile,reopened;
  try{
    const initial=pc.get();initial.clients[0].name='María CLIENTE FICTICIA';initial.clients[0].route='Ruta FICTICIA';initial.clients[0].version=1;pc.set(initial);db.set('clients/c1',clone(initial.clients[0]));
    await attachCloud(pc,db);
    const doc=pc.w.document;
    for(const screen of ['home','clients','credits','collections','cash','admin','more','partners']){
      pc.w.show(screen);a.equal(doc.querySelector('.page.active').id,screen);
      if(screen!=='home')a.ok(doc.querySelector('#'+screen+' .screen-close'),'close control missing on '+screen);
    }
    a.match(doc.querySelector('#more').textContent,/Socios/);a.match(doc.querySelector('#home').textContent,/Socios/);
    await pc.w.V2UI.manualCash('INGRESO',{date:'2026-09-30',amount:1000,category:'APORTE_CAPITAL',concept:'Aporte FICTICIO'});
    for(const [id,value] of Object.entries({cClient:'c1',cCapital:'200',cRate:'20',cTerm:'4',cFreq:'weekly',cFirst:'2026-10-09'}))doc.getElementById(id).value=value;
    doc.getElementById('cAccepted').checked=true;await pc.w.V2UI.addCredit();
    const creditId=pc.get().credits[0]?.id;a.ok(creditId,pc.alerts.join('\n'));a.equal(cash(pc.get()),800);a.equal(debt(pc.get().credits[0]),240);
    pc.w.prompt=()=> '37.50';await pc.w.V2UI.collect(creditId);
    const paid=pc.get(),payment=paid.payments[0];a.ok(payment,pc.alerts.join('\n'));a.equal(payment.amount,37.5);a.equal(debt(paid.credits[0]),202.5);a.equal(cash(paid),837.5);
    a.match(pc.w.MiCarteraV2PaymentReceipt.text(payment,paid.clients[0],paid.credits[0]),/Cuota correspondiente a: CUOTA 1 DE 4/);
    await pc.w.MiCarteraPartners.create(loan);a.equal(cash(pc.get()),837.5,'historical contribution must not increase cash again');
    mobile=await boot({fullShell:true});await attachCloud(mobile,db);await mobile.w.MiCarteraV2CloudRehydration.rehydrate();
    a.deepEqual(mobile.get().cashMovements.sort((a,b)=>a.id.localeCompare(b.id)),pc.get().cashMovements.map(row=>({...row,updatedAt:db.get((row.type==='INGRESO'?'entries/':'expenses/')+row.id).updatedAt})).sort((a,b)=>a.id.localeCompare(b.id)));
    a.equal(mobile.get().payments.length,1);a.equal(mobile.get().credits.length,1);a.equal(mobile.w.MiCarteraPartners.canView(),true);mobile.w.MiCarteraPartners.show();a.match(mobile.w.document.querySelector('#partnerList').textContent,/Socio FICTICIO/);
    await mobile.w.MiCarteraPartners.interest(loan.id,{date:'2026-10-07',due:'2026-10-01',amount:50});
    await mobile.w.MiCarteraPartners.repay(loan.id,{date:'2026-10-07',amount:200,nextMonthlyInterest:30});
    await pc.w.MiCarteraV2CloudRehydration.rehydrate();a.equal(cash(pc.get()),587.5);a.equal(pc.w.MiCarteraPartnerLoans.balance(pc.get().cashMovements.find(m=>m.partnerLoan).partnerLoan),300);
    await renew(pc,creditId,'refinance',400);const refinanced=pc.get(),newCredit=refinanced.credits[1];a.ok(newCredit,pc.alerts.join('\n'));
    a.equal(newCredit.capital,400);a.equal(debt(newCredit),480);a.equal(refinanced.cashMovements.find(m=>m.concept==='DESEMBOLSO_REFINANCIAMIENTO').amount,197.5);a.equal(cash(refinanced),390);
    await renew(pc,newCredit.id,'renewInterest');a.equal(pc.get().credits.length,3);a.equal(pc.get().payments.length,2);a.equal(cash(pc.get()),470);a.deepEqual(clone(pc.w.MiCarteraV2Financial.validateChain(pc.get().credits)),[]);
    await mobile.w.MiCarteraV2CloudRehydration.rehydrate();await mobile.w.MiCarteraV2CloudRehydration.rehydrate();
    const persisted=mobile.get();a.equal(persisted.clients.length,1);a.equal(persisted.credits.length,3);a.equal(persisted.payments.length,2);a.equal(cash(persisted),470);a.equal(new Set(persisted.cashMovements.map(m=>m.id)).size,persisted.cashMovements.length);
    await mobile.close();mobile=null;reopened=await boot({fullShell:true,state:persisted});await attachCloud(reopened,db);await reopened.w.MiCarteraV2CloudRehydration.rehydrate();
    const restored=reopened.get();a.equal(cash(restored),470);a.equal(restored.credits.length,3);a.equal(restored.cashMovements.filter(m=>m.partnerLoan).length,1);
    reopened.w.MiCarteraPartners.show();a.match(reopened.w.document.querySelector('#partnerList').textContent,/Capital pendiente: S\/ 300\.00/);
    reopened.w.MiCarteraV2CreditFormParity.filter('ACTIVE');a.equal(reopened.w.document.querySelectorAll('#creditsList [data-credit-id]').length,1);
    reopened.w.MiCarteraV2CreditFormParity.filter('PREVIOUS');a.equal(reopened.w.document.querySelectorAll('#creditsList [data-credit-id]').length,2);
    a.match(reopened.w.document.querySelector('#adminParity').textContent,/Ruta FICTICIA/);
    for(const h of [pc,reopened])a.deepEqual(h.alerts,[]);
  }finally{await pc.close();if(mobile)await mobile.close();if(reopened)await reopened.close();}
});

test('PWA install caches both Socios models and views; all paths exist and only stale resource caches are removed',async()=>{
  const app=path.resolve(__dirname,'../app'),listeners={},added=[],deleted=[];
  const old='mi-cartera-pro-v2-old',unrelated='unrelated-resource-cache';
  const caches={open:async()=>({addAll:async urls=>added.push(...urls.map(x=>x.url||x))}),keys:async()=>[old,unrelated],delete:async key=>deleted.push(key)};
  const self={location:{origin:'https://fictional.test'},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting(){},clients:{claim(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(app,'service-worker.js'),'utf8'),{self,caches,Request:class{constructor(url){this.url=url}},URL});
  let installing;listeners.install({waitUntil:p=>installing=p});await installing;
  for(const resource of ['core/partner-loans.js','core/partner-interest-agenda.js','partner-loans-ui.js','partner-interest-agenda-ui.js'])a.ok(added.includes('./'+resource),'missing cached '+resource);
  for(const resource of added)a.ok(fs.existsSync(path.join(app,resource)),'missing offline asset '+resource);
  let activating;listeners.activate({waitUntil:p=>activating=p});await activating;a.deepEqual(deleted,[old]);
  for(const file of ['partner-loans.js','partner-interest-agenda.js'])a.equal(fs.readFileSync(path.join(app,'core',file),'utf8'),fs.readFileSync(path.join(app,'../core',file),'utf8'));
});
