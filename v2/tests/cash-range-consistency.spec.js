const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const F = require('../app/core/financial-engine.js');
const S = require('../app/core/schedule-engine.js');
const A = require('../app/core/access-audit.js');
const KEY = 'mi-cartera-v2-validation-state';

// Portable DOM boundary; financial/date/actions code runs unchanged. Cloud is
// the only async dependency replaced here, and every fixture is fictional.
function environment(submit) {
  const nodes = new Map(), alerts = [], operations = [], events = {};
  function element(tag = 'div') {
    const el = {tagName:String(tag).toUpperCase(),style:{},dataset:{},children:[],
      value:'',disabled:false,attributes:{},parentNode:null,handlers:{},
      setAttribute(k,v) {this.attributes[k]=String(v);},
      addEventListener(name,fn) {this.handlers[name]=fn;},
      scrollIntoView() {},
      appendChild(child) {child.parentNode=this;this.children.push(child);if(child.id)nodes.set(child.id,child);return child;},
      insertBefore(child,next) {child.parentNode=this;const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,child);if(child.id)nodes.set(child.id,child);},
      insertAdjacentElement(where,child) {const parent=this.parentNode;if(!parent)return;child.parentNode=parent;parent.children.splice(parent.children.indexOf(this)+1,0,child);if(child.id)nodes.set(child.id,child);},
      closest(selector) {return selector==='.card'?(this.className||'').split(' ').includes('card')?this:this.parentNode?.closest(selector):null;},
      querySelector(selector) {return this.querySelectorAll(selector)[0]||null;},
      querySelectorAll(selector) {
        const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);
        return all.filter(child=>selector==='*'||(selector[0]==='#'?child.id===selector.slice(1):selector[0]==='.'?(child.className||'').split(' ').includes(selector.slice(1)):selector.startsWith('[data-')?Object.hasOwn(child.dataset,selector.slice(6,-1).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())):false));
      },
      remove() {this.querySelectorAll('*').forEach(child=>nodes.delete(child.id));nodes.delete(this.id);if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);},
      set innerHTML(html) {
        this.children.forEach(child=>child.remove());this.children=[];this.html=String(html);
        for(const match of String(html).matchAll(/<(input|select|textarea|button|b|div)\b([^>]*)>/g)) {
          const child=element(match[1]),attrs=match[2];child.id=attrs.match(/\bid="([^"]+)"/)?.[1];child.className=attrs.match(/\bclass="([^"]*)"/)?.[1]||'';child.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';
          for(const attribute of attrs.matchAll(/\bdata-([a-z0-9-]+)(?:="([^"]*)")?/g))child.dataset[attribute[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attribute[2]||'';
          if(match[1]==='select'){const options=String(html).slice(match.index).split('</select>')[0];child.value=options.match(/<option value="([^"]*)"[^>]*selected/)?.[1]||options.match(/<option value="([^"]*)"/)?.[1]||'';}
          this.appendChild(child);
        }
      },
      get innerHTML() {return this.html||'';},
      set textContent(value) {this.text=String(value);this.children.forEach(child=>child.remove());this.children=[];},
      get textContent() {return this.text||'';}};
    return el;
  }
  const body=element('body'),head=element('head'),cash=element(),metric=element();
  cash.id='cash';metric.className='card metric';const balance=element('b');balance.id='cashBalance';metric.appendChild(balance);cash.appendChild(metric);const history=element();history.id='cashHistory';cash.appendChild(history);body.appendChild(cash);
  const document={head,body,createElement:element,getElementById:id=>nodes.get(id)||null,
    addEventListener() {},querySelector:selector=>body.querySelector(selector),querySelectorAll:selector=>body.querySelectorAll(selector)};
  const initial={clients:[{id:'fake-client',name:'Cliente ficticio'}],credits:[{id:'fake-credit',capital:600}],payments:[{id:'fake-payment',amount:240,date:'2026-10-01'}],
    cashMovements:[{id:'fake-capital',date:'2026-09-25',type:'INGRESO',amount:1000,category:'APORTE_CAPITAL',concept:'Aporte ficticio'},
      {id:'fake-loan',date:'2026-09-26',type:'EGRESO',amount:600,concept:'DESEMBOLSO_CREDITO'},
      {id:'fake-payment-cash',date:'2026-10-01',type:'INGRESO',amount:240,concept:'COBRO_CUOTA',ref:'fake-payment'},
      {id:'fake-expense',date:'2026-10-02',type:'EGRESO',amount:20,category:'SERVICIOS',concept:'Gasto ficticio',observation:'Detalle ficticio'}],audit:[],session:{role:'ADMIN',actorId:'fake-admin'}};
  let stored=JSON.stringify(initial),writes=0;
  const localStorage={getItem:key=>key===KEY?stored:null,setItem:(key,value)=>{assert.equal(key,KEY);stored=value;writes++;}};
  const window={MiCarteraV2Financial:F,MiCarteraV2Schedule:S,MiCarteraV2AccessAudit:A,
    MiCarteraV2SyncBridge:{status:()=>({configured:true}),submit:async operation=>{operations.push(operation);return submit?submit(operation):{status:'COMMITTED'};}},
    MiCarteraV2VersionGuard:{requireReady() {}},MiCarteraV2AuthCloudGate:{requireReady() {}},V2UI:{},
    addEventListener:(name,fn)=>events[name]=fn};
  const sandbox={window,document,localStorage,console,alert:message=>alerts.push(message)};
  vm.createContext(sandbox);
  for(const file of ['date-utils-v2.js','operation-commit-gate.js','durable-actions-v2.js','cash-menu-v2.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../app',file),'utf8'),sandbox);
  window.MiCarteraV2Dates.today=()=> '2026-10-07';window.MiCarteraV2DurableActions.install();
  return {window,document,alerts,operations,events,get:id=>document.getElementById(id),
    state:()=>JSON.parse(stored),replace:value=>{stored=JSON.stringify(value);},writes:()=>writes,original:JSON.stringify(initial)};
}
const input={date:'2026-10-07',amount:'100',category:'APORTE_CAPITAL',concept:'Aporte de prueba'};

async function ranges() {
  const e=environment(),api=e.window.MiCarteraV2CashMenu;api.install();
  assert.equal(e.get('cashBalance').textContent,'S/ 620.00','cash must use the ledger once, without adding the payment collection again');
  assert.ok(e.get('cashHistoryFrom')&&e.get('cashHistoryTo'),'date range controls must exist even before filtering');
  e.get('cashHistoryPeriod').value='RANGE';e.get('cashHistoryFrom').value='2026-10-01';e.get('cashHistoryTo').value='2026-10-07';
  api.renderSummary();api.renderHistory();
  assert.equal(e.get('cashIncomeTotal').textContent,'S/ 240.00');assert.equal(e.get('cashExpenseTotal').textContent,'S/ 20.00');
  assert.equal(e.get('cashOpeningBalance').textContent,'S/ 400.00');assert.equal(e.get('cashClosingBalance').textContent,'S/ 620.00');
  assert.ok(e.get('cashHistory').innerHTML.includes('Gasto ficticio'),'expense detail must be reachable');
  assert.ok(e.get('cashHistory').innerHTML.includes('Detalle ficticio'));
  e.get('cashHistoryType').value='EGRESO';api.renderHistory();
  assert.ok(e.get('cashHistory').innerHTML.includes('Gasto ficticio'));assert.ok(!e.get('cashHistory').innerHTML.includes('COBRO CUOTA'));
  e.get('cashHistoryFrom').value='2027-01-01';e.get('cashHistoryTo').value='2027-01-03';api.renderSummary();api.renderHistory();
  assert.equal(e.get('cashHistoryPeriod').value,'RANGE','an empty result must retain the filters');assert.equal(e.get('cashHistoryType').value,'EGRESO');
  assert.equal(e.get('cashIncomeTotal').textContent,'S/ 0.00');assert.equal(e.get('cashOpeningBalance').textContent,'S/ 620.00');
  e.get('cashHistoryPeriod').value='ALL';e.get('cashHistoryType').value='ALL';api.renderSummary();api.renderHistory();
  assert.equal(e.get('cashIncomeTotal').textContent,'S/ 1,240.00');assert.equal(e.get('cashExpenseTotal').textContent,'S/ 620.00');
  assert.equal(e.writes(),0);assert.equal(JSON.stringify(e.state()),e.original);
  const legacy=e.state();legacy.cashMovements=[{id:'legacy-date',date:'07/10/2026',type:'INGRESO',amount:60},{id:'iso-date',date:'2026-10-07T16:00:00Z',type:'EGRESO',amount:10}];e.replace(legacy);
  e.get('cashHistoryPeriod').value='RANGE';e.get('cashHistoryFrom').value='2026-10-07';e.get('cashHistoryTo').value='2026-10-07';api.renderSummary();api.renderHistory();
  assert.equal(e.get('cashIncomeTotal').textContent,'S/ 60.00');assert.equal(e.get('cashExpenseTotal').textContent,'S/ 10.00');assert.equal(e.get('cashOpeningBalance').textContent,'S/ 0.00');assert.equal(e.get('cashClosingBalance').textContent,'S/ 50.00');
  e.get('cashHistoryFrom').value='2026-10-08';api.renderSummary();api.renderHistory();assert.equal(e.get('cashClosingBalance').textContent,'Rango inválido');assert.match(e.get('cashHistory').textContent,/rango válido/);assert.equal(e.writes(),0);
}

async function durableCash() {
  let release;const pending=new Promise(resolve=>release=resolve),e=environment(async()=>{await pending;return {status:'COMMITTED'};});
  const first=e.window.V2UI.manualCash('INGRESO',input);
  const duplicate=e.window.V2UI.manualCash('INGRESO',input).then(()=>null,error=>error);
  try {assert.equal(e.operations.length,1,'a repeated tap must not create a second cloud movement');assert.equal(e.writes(),0);}
  catch(error) {release();await first;await duplicate;throw error;}
  const latest=e.state();latest.cashMovements.push({id:'fake-other-operation',date:'2026-10-07',type:'EGRESO',amount:5});latest.payments.push({id:'fake-other-payment',amount:10});e.replace(latest);
  release();const saved=await first;
  assert.match(String((await duplicate)?.message||''),/procesando|guardando/i);
  assert.equal(e.state().cashMovements.length,6,'saving must merge the current local state after durable acceptance');assert.equal(e.state().payments.length,2);assert.equal(e.state().cashMovements.filter(m=>m.id===saved.id).length,1);
  assert.equal(e.operations[0].entities[0].collection,'entries');assert.equal(saved.amount,100);
  for(const bad of [{date:'2026-02-31'},{amount:'Infinity'},{amount:'-1'},{amount:'invalid'}])await assert.rejects(e.window.V2UI.manualCash('EGRESO',{...input,...bad}),/inválid/i);
  const fail=environment(async()=>({status:'ERROR'}));await assert.rejects(fail.window.V2UI.manualCash('EGRESO',input),/V2_OPERATION_NOT_DURABLY_ACCEPTED/);
  assert.equal(fail.writes(),0);assert.equal(JSON.stringify(fail.state()),fail.original);
  let ack;const paused=environment(async()=>{await new Promise(resolve=>ack=resolve);return {status:'COMMITTED'};});
  const waiting=paused.window.V2UI.manualCash('INGRESO',input);const foreign=paused.state();foreign.session={actorId:'other-fictional-admin',role:'ADMIN'};foreign.cashMovements=[];paused.replace(foreign);const before=JSON.stringify(paused.state());ack();
  await assert.rejects(waiting,/sesión|session/i);assert.equal(JSON.stringify(paused.state()),before);assert.equal(paused.writes(),0,'an old ACK must never append money to another session');
  const stale=environment();stale.window.MiCarteraV2AuthCloudGate.state=()=>({ready:true,uid:'other-fictional-admin',role:'admin'});
  await assert.rejects(stale.window.V2UI.manualCash('INGRESO',input),/sesión|session/i);assert.equal(stale.operations.length,0);
  let finish;const returned=environment(async()=>{await new Promise(resolve=>finish=resolve);return {status:'COMMITTED'};});let auth={ready:true,uid:'fake-admin',role:'admin'};returned.window.MiCarteraV2AuthCloudGate.state=()=>auth;
  const old=returned.window.V2UI.manualCash('INGRESO',input);const same=JSON.stringify(returned.state());
  for(const uid of ['other-fictional-admin','fake-admin']){auth={...auth,uid};returned.events['v2-auth-cloud-state']();}finish();
  await assert.rejects(old,/sesión|session/i);assert.equal(JSON.stringify(returned.state()),same);assert.equal(returned.writes(),0);
}

async function formGuard() {
  let release;const pending=new Promise(resolve=>release=resolve),e=environment(async()=>{await pending;return {status:'COMMITTED'};});
  e.window.MiCarteraV2CashMenu.install();
  const income=e.document.querySelectorAll('[data-v2-cash-type]').find(button=>button.dataset.v2CashType==='INGRESO');income.handlers.click();
  e.get('v2CashAmount').value='100';e.get('v2CashConcept').value='Aporte UI ficticio';
  const form=e.get('v2CashForm'),save=form.querySelector('[data-save]');
  const first=save.onclick(),duplicate=save.onclick();
  try {assert.equal(e.operations.length,1,'a second save click must be ignored while pending');assert.equal(save.disabled,true);}
  catch(error) {release();await first;await duplicate;throw error;}
  release();await first;await duplicate;assert.equal(e.get('v2CashForm'),null);assert.equal(e.state().cashMovements.length,5);
  const failure=environment(async()=>({status:'ERROR'}));failure.window.MiCarteraV2CashMenu.install();failure.document.querySelectorAll('[data-v2-cash-type]')[0].handlers.click();failure.get('v2CashAmount').value='50';failure.get('v2CashConcept').value='Conservar borrador';
  const retry=failure.get('v2CashForm').querySelector('[data-save]');await retry.onclick();
  assert.ok(failure.get('v2CashForm'),'a failed commit must preserve the form');assert.equal(failure.get('v2CashAmount').value,'50');assert.equal(retry.disabled,false);
}

Promise.allSettled([ranges(),durableCash(),formGuard()]).then(results=>{
  for(const [index,result] of results.entries())if(result.status==='rejected'){console.error(['range totals and filters','durable cash atomicity','cash form guard'][index],result.reason);process.exitCode=1;}
  if(!process.exitCode)console.log('cash-range-consistency.spec.js PASS');
});
