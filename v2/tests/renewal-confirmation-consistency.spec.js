const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const F = require('../app/core/financial-engine.js');
const S = require('../app/core/schedule-engine.js');
const A = require('../core/access-audit.js');

// Only DOM and the cloud transport are faked. Financial, schedule and durable
// commit logic are real; all credit/customer data is fictional.
function fixture(overrides = {}) {
  return {id:'fake-old',clientId:'fake-client',capital:600,total:720,
    principalPaid:300,interestPaid:60,penaltyPaid:0,rate:20,term:4,
    freq:'weekly',restDay:'',status:'ACTIVO',version:1,routeId:'fake-route',
    schedule:[{number:1,date:'2026-10-01',amount:360,paid:0,balance:360,status:'PENDIENTE'}],
    ...overrides};
}

function environment({credit = fixture(), submit} = {}) {
  const elements = new Map(), alerts = [], operations = [], previews = [], links = [], sharePreviews = [];
  const initial = {clients:[{id:'fake-client',name:'Cliente ficticio',phone:'999000000'}],
    credits:[credit],payments:[],cashMovements:[],audit:[],
    session:{role:'ADMIN',actorId:'fake-admin'}};
  let stored = JSON.stringify(initial), writes = 0;
  function element() {
    return {style:{},dataset:{},value:'',checked:false,disabled:false,children:new Map(),
      setAttribute() {},addEventListener() {},
      remove() {elements.delete(this.id);},
      querySelector(selector) {return this.children.get(selector.slice(1)) || null;},
      set innerHTML(html) {
        this.html = html;
        for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
          const child = element(), attrs = match[2];
          child.id = match[3];
          child.value = attrs.match(/\bvalue="([^"]*)"/)?.[1] || '';
          child.disabled = /\bdisabled\b/.test(attrs);
          this.children.set(child.id,child);
        }
      },
      get innerHTML() {return this.html || '';}};
  }
  const document = {getElementById(id) {
    if(elements.has(id))return elements.get(id);
    for(const el of elements.values())if(el.children.has(id))return el.children.get(id);
    return null;
  },createElement:element,querySelector:()=>null,addEventListener() {},
  body:{appendChild:el=>elements.set(el.id,el)}};
  const localStorage = {getItem:()=>stored,setItem:(key,value)=>{stored=value;writes++;}};
  const window = {MiCarteraV2Financial:F,MiCarteraV2Schedule:S,MiCarteraV2AccessAudit:A,
    MiCarteraV2Dates:{today:()=> '2026-10-07'},
    MiCarteraV2SyncBridge:{status:()=>({configured:true}),submit:async operation=>{
      operations.push(JSON.parse(JSON.stringify(operation)));
      return submit ? submit(operation) : {status:'COMMITTED',operationId:operation.operationId};
    }},
    MiCarteraV2VersionGuard:{requireReady() {}},
    MiCarteraV2AuthCloudGate:{requireReady() {},state:()=>({uid:'fake-admin',ready:true,role:'admin'})},
    MiCarteraV2SharePreview:{previewCredit:id=>previews.push(id),open:config=>sharePreviews.push(config)},MiCarteraV2ShareCard:{fmt:date=>date},
    addEventListener() {},open:(...args)=>links.push(args)};
  const sandbox = {window,document,localStorage,alert:message=>alerts.push(message),console};
  vm.createContext(sandbox);
  for(const file of ['operation-commit-gate.js','durable-actions-v2.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../app',file),'utf8'),sandbox);
  }
  return {api:window.MiCarteraV2DurableActions,document,alerts,operations,previews,links,sharePreviews,
    state:()=>JSON.parse(stored),writes:()=>writes,original:JSON.stringify(initial),
    get:id=>document.getElementById(id)};
}

function review(env, values = {}) {
  for(const [id,value] of Object.entries(values))env.get(id).value=String(value);
  env.get('v2RenewReview').onclick();
  return env.get('v2RenewalReview');
}
function confirm(env) {
  const accepted=env.get('v2RenewAccepted');accepted.checked=true;accepted.onchange();
  env.get('v2ConfirmRenewal').onclick();
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

async function run() {
  // Regressions: using principal as the refinance deduction overstates cash;
  // showing total debt as interest-only capital misstates the accepted proposal.
  for(const engine of [F,require('../core/financial-engine.js')]) {
  const refi=engine.refinance(fixture(),{newCreditId:'fake-new',newCapital:600,
    previousBalance:360,rate:20,date:'2026-10-07',term:4,freq:'weekly'});
  assert.equal(refi.newCredit.capital,600);
  assert.equal(refi.previousBalance,360);
  assert.equal(refi.cashDisbursed,240);
  assert.equal(engine.refinance(fixture(),{newCreditId:'legacy-api',newCapital:600}).cashDisbursed,300);
  assert.throws(()=>engine.refinance(fixture(),{newCreditId:'too-low',newCapital:350,previousBalance:360}),/NEW_CAPITAL_BELOW_PREVIOUS_BALANCE/);
  for(const previousBalance of [-1,NaN,Infinity,'invalid']) {
    assert.throws(()=>engine.refinance(fixture(),{newCreditId:'invalid-balance',newCapital:600,previousBalance}),/INVALID_PREVIOUS_BALANCE/);
  }
  for(const newCapital of [NaN,Infinity,'invalid']) {
    assert.throws(()=>engine.refinance(fixture(),{newCreditId:'invalid-capital',newCapital,previousBalance:360}),/INVALID_NEW_CAPITAL/);
  }
  }

  const interest=environment();
  const interestPending=interest.api.renewInterest('fake-old');
  assert.equal(interest.get('v2RenewCapital').value,'300.00','interest-only proposal must retain outstanding principal');
  const interestReview=review(interest,{v2RenewDate:'2026-10-05',v2RenewFirstDate:'2026-10-11',v2RenewRest:'0'});
  assert.ok(interestReview.innerHTML.includes('Nuevo capital: <b>S/ 300.00</b>'));
  assert.ok(interestReview.innerHTML.includes('Total nuevo: <b>S/ 360.00</b>'));
  assert.ok(interestReview.innerHTML.includes('Interés a cobrar: <b>S/ 60.00</b>'),'the proposal must disclose the interest payment recorded upon confirmation');
  assert.ok(interestReview.innerHTML.includes('Vencimiento: <b>2026-11-02</b>'),'proposal maturity must include rest-day adjustments');
  assert.ok(interestReview.innerHTML.includes('Primera cuota: <b>2026-10-12</b>'),'proposal must show the real first installment after the rest day');
  assert.equal(interest.writes(),0,'review must not change financial state');
  interest.get('v2ShareRenewal').onclick();
  assert.ok(interest.sharePreviews[0].message.includes('Primera cuota: 2026-10-12'),'shared proposal must use the real first installment date');
  assert.equal(interest.writes(),0,'sharing a proposal must not register a renewal');
  confirm(interest);await interestPending;
  const savedInterest=interest.state(),successor=savedInterest.credits[1];
  assert.equal(successor.capital,300);assert.equal(successor.total,360);
  assert.equal(savedInterest.credits[0].principalPaid,300);
  assert.equal(savedInterest.credits[0].interestPaid,120);
  assert.equal(savedInterest.payments[0].capitalAmount,0);
  assert.equal(savedInterest.payments[0].interestAmount,60);
  assert.equal(savedInterest.cashMovements[0].amount,60);
  assert.equal(savedInterest.payments[0].date,'2026-10-05');
  assert.equal(savedInterest.cashMovements[0].date,'2026-10-05','interest cash entry must use the selected renewal date');
  assert.equal(savedInterest.credits[0].status,'RENOVADO');
  assert.equal(savedInterest.credits[0].renewedTo,successor.id);
  assert.equal(successor.renewedFrom,'fake-old');
  assert.deepEqual(F.validateChain(savedInterest.credits),[]);
  assert.equal(successor.restDay,'0');
  assert.equal(successor.date,'2026-10-05');
  assert.equal(successor.firstPaymentDate,'2026-10-12','saved-credit sharing must receive the actual first installment');
  assert.deepEqual(successor.schedule.map(q=>q.date),['2026-10-12','2026-10-19','2026-10-26','2026-11-02']);
  assert.equal(successor.maturity,'2026-11-02','maturity must follow the actual final installment');

  let release;
  const deferred=new Promise(resolve=>{release=resolve;});
  const capital=environment({submit:async operation=>{await deferred;return {status:'COMMITTED',operationId:operation.operationId};}});
  const capitalPending=capital.api.refinance('fake-old');
  const capitalReview=review(capital,{v2RenewDate:'2026-10-05',v2RenewCapital:600,v2RenewFirstDate:'2026-10-11',v2RenewRest:'0'});
  assert.ok(capitalReview.innerHTML.includes('Neto a desembolsar: <b>S/ 240.00</b>'));
  assert.equal(capital.writes(),0);
  confirm(capital);await tick();
  await capital.api.refinance('fake-old');
  assert.equal(capital.operations.length,1,'double tap must submit one atomic renewal');
  assert.equal(capital.writes(),0,'state must wait for durable acceptance');
  release();await capitalPending;
  const savedCapital=capital.state(),newCapital=savedCapital.credits[1];
  assert.equal(savedCapital.credits.length,2);
  assert.equal(savedCapital.payments.length,0);
  assert.equal(savedCapital.cashMovements.length,1);
  assert.equal(newCapital.capital,600);assert.equal(newCapital.total,720);
  assert.equal(savedCapital.cashMovements[0].amount,240,'cash must match the accepted net amount');
  assert.equal(newCapital.date,'2026-10-05');
  assert.equal(savedCapital.cashMovements[0].date,'2026-10-05','refinance cash expense must use the selected renewal date');
  assert.equal(savedCapital.audit[0].detail.previousBalance,360);
  assert.equal(savedCapital.audit[0].detail.cashDisbursed,240);
  assert.equal(newCapital.restDay,'0','capital renewal must use the selected rest day');
  assert.equal(newCapital.firstPaymentDate,'2026-10-12');
  assert.deepEqual(newCapital.schedule.map(q=>q.date),['2026-10-12','2026-10-19','2026-10-26','2026-11-02']);
  assert.equal(newCapital.maturity,'2026-11-02');
  assert.deepEqual(newCapital.schedule.map(q=>q.amount),[180,180,180,180]);
  assert.deepEqual(F.validateChain(savedCapital.credits),[]);
  assert.equal(capital.previews[0],newCapital.id);
  await capital.api.refinance('fake-old');
  assert.equal(capital.operations.length,1,'a renewed predecessor must not create another successor');

  for(const method of ['renewInterest','refinance']) {
    const failed=environment({submit:async()=>({status:'ERROR'})});
    const pending=failed.api[method]('fake-old');
    review(failed);confirm(failed);await pending;
    assert.equal(failed.writes(),0,'failed '+method+' must not write local credit/payment/cash state');
    assert.equal(JSON.stringify(failed.state()),failed.original);
    assert.equal(failed.previews.length,0,'failed renewal must not open a saved-credit preview');
    const retry=failed.api[method]('fake-old');
    assert.ok(failed.get('v2RenewalForm'),'failed renewal must release the in-flight guard');
    failed.get('v2RenewCancel').onclick();await retry;
  }
  console.log('renewal-confirmation-consistency.spec.js PASS');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
