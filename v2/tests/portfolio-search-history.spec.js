const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = path.join(__dirname, '../app');

// Portable DOM doubles: scripts, event handlers and rendered markup are real.
// Only the browser surface is substituted; no transport or financial write runs.
function element(tag = 'div', attrs = '') {
  const events = new Map(), values = new Map(), classes = new Set();
  for (const match of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) values.set(match[1], match[2]);
  for (const cls of (values.get('class') || '').split(/\s+/).filter(Boolean)) classes.add(cls);
  const node = {tagName:tag.toUpperCase(), value:'', style:{}, dataset:{}, children:[], textContent:'',
    getAttribute:name => values.get(name), setAttribute(name, value) {values.set(name,String(value));},
    classList:{contains:cls => classes.has(cls), add:cls => classes.add(cls),
      remove:cls => classes.delete(cls), toggle(cls, force) {
        const enabled = force ?? !classes.has(cls); enabled ? classes.add(cls) : classes.delete(cls); return enabled;
      }},
    addEventListener(name, listener) {if(!events.has(name)) events.set(name, []); events.get(name).push(listener);},
    dispatch(name) {for(const listener of events.get(name) || []) listener({target:node});},
    appendChild(child) {node.children.push(child); return child;}, before() {}, remove() {},
    insertAdjacentElement(_position, child) {node.children.push(child);}, scrollIntoView() {},
    querySelector(selector) {return node.children.find(child => selector === '.row' && child.classList.contains('row') || selector === '.v2-overdue-label' && child.className === 'v2-overdue-label') || null;},
    querySelectorAll(selector) {return selector === 'button' ? node.buttons || [] : [];}}
  for(const [name,value] of values) if(name.startsWith('data-')) node.dataset[name.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase())] = value;
  return node;
}

function buttons(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => {
    const button = element('button', match[1]); button.textContent = match[2].replace(/<[^>]*>/g, ''); return button;
  });
}

function list() {
  const node = element();
  Object.defineProperty(node, 'innerHTML', {get:() => node.html || '', set(html) {
    node.html = html; node.buttons = buttons(html); node.cards = [];
    const starts = [...html.matchAll(/<div\b([^>]*data-(?:client|credit)-card="1"[^>]*)>/g)];
    for(let i=0;i<starts.length;i++) {
      const start = starts[i], markup = html.slice(start.index, starts[i+1]?.index ?? html.length), card = element('div', start[1]);
      const heading = element('b'), line = element(), row = element('div', 'class="row"');
      heading.textContent = markup.match(/<b>(.*?)<\/b>/)?.[1] || '';
      line.textContent = markup.match(/<\/b><div>(.*?)<\/div>/)?.[1] || '';
      card.children = [heading,line,row]; card.buttons = buttons(markup); node.cards.push(card);
    }
  }});
  node.querySelectorAll = selector => selector === 'button' ? node.buttons || [] : (node.cards || []).filter(card => selector === '[data-credit-card]' ? card.dataset.creditCard : selector === '[data-client-card]' ? card.dataset.clientCard : false);
  return node;
}

function environment() {
  const client = {id:'fake-client',name:'María Álvarez',phone:'999000001',dni:'12345678',reference:'Fixture'},
    schedule = (balance,date='2026-10-01') => [{number:1,date,amount:100,balance}],
    credits = [
      {id:'fake-overdue',clientId:client.id,status:'ACTIVE',capital:100,total:100,schedule:schedule(100)},
      {id:'fake-current',clientId:client.id,status:'ACTIVO',capital:100,total:100,schedule:schedule(100,'2099-01-01')},
      {id:'fake-paid',clientId:client.id,status:'PAID',capital:100,total:100,schedule:schedule(0)},
      {id:'fake-renewed',clientId:client.id,status:'RENOVADO',renewedTo:'fake-current',capital:100,total:100,schedule:schedule(100)},
      {id:'fake-cancelled',clientId:client.id,status:'CANCELLED',capital:100,total:100,schedule:schedule(100)},
      {id:'fake-zero',clientId:client.id,status:'ACTIVE',capital:100,total:100,schedule:schedule(0)}
    ], stored = JSON.stringify({clients:[client,{id:'fake-other',name:'Otro Cliente',phone:'999000002'}],credits,payments:[]});
  const elements = new Map(), documentEvents = new Map(), timers = [], actions = [];
  const shell = fs.readFileSync(path.join(app, 'operational-shell.html'), 'utf8');
  for(const match of shell.matchAll(/<input\b([^>]*\bid="([^"]+)"[^>]*)>/g)) elements.set(match[2], element('input',match[1]));
  for(const id of ['clientsList','creditsList','collectionsList','paymentHistory']) elements.set(id,list());
  const filterButtons = buttons(shell).filter(button => Object.hasOwn(button.dataset, 'creditFilter'));
  const document = {readyState:'loading',head:element('head'),getElementById:id => elements.get(id) || null,
    createElement:element,addEventListener(name, listener) {if(!documentEvents.has(name)) documentEvents.set(name,[]); documentEvents.get(name).push(listener);},
    querySelectorAll(selector) {return selector === '[data-credit-card]' ? elements.get('creditsList').querySelectorAll(selector) : selector === '[data-credit-filter]' ? filterButtons : [];}};
  const localStorage = {getItem:() => stored,setItem() {throw new Error('Search and filters must remain read-only');}};
  const window = {localStorage,addEventListener() {},V2UI:{collect:id => actions.push(['collect',id])},show() {},
    MiCarteraV2CreditFormParity:{},MiCarteraV2CustomerExperience:{reminder:() => actions.push(['whatsapp'])},
    MiCarteraV2CreditShare:{share:cr => actions.push(['credit',cr.id])}};
  const context = {window,document,localStorage,console,alert() {},setTimeout:fn => timers.push(fn),clearTimeout() {}};
  vm.createContext(context);
  for(const file of ['date-utils-v2.js','operational-cards-v2.js','credit-overdue-v2.js']) vm.runInContext(fs.readFileSync(path.join(app,file),'utf8'),context);
  window.MiCarteraV2Dates.today = () => '2026-10-07';
  Object.assign(context,{MiCarteraV2Cards:window.MiCarteraV2Cards,V2UI:window.V2UI,MiCarteraV2CreditFormParity:window.MiCarteraV2CreditFormParity});
  const flush = () => {while(timers.length) timers.shift()();};
  for(const listener of documentEvents.get('DOMContentLoaded') || []) listener(); flush();
  return {elements,filterButtons,actions,window,flush,
    input(id,value) {const control=elements.get(id);assert(control,`${id} must be available`);control.value=value;control.dispatch('input');flush();},
    click(button) {vm.runInContext(button.getAttribute('onclick'),context);flush();},
    visibleIds() {return elements.get('creditsList').querySelectorAll('[data-credit-card]').filter(card => card.style.display !== 'none').map(card => card.dataset.creditId);},
    refresh() {window.MiCarteraV2Cards.render();flush();}};
}

let failures = 0;
function test(name, body) {try {body();console.log('PASS '+name);} catch(error) {failures++;console.error('FAIL '+name+'\n'+error.stack);}}

test('partial names ignore case, spaces and accents in clients and credits', () => {
  const e=environment();e.input('clientSearch','  MARIA  ');
  assert.deepStrictEqual(e.elements.get('clientsList').querySelectorAll('[data-client-card]').map(card => card.dataset.clientId),['fake-client']);
  e.input('clientSearch','alv');assert.deepStrictEqual(e.elements.get('clientsList').querySelectorAll('[data-client-card]').map(card => card.dataset.clientId),['fake-client']);
  e.input('creditSearch','maria');assert.deepStrictEqual(e.visibleIds(),['fake-overdue','fake-current']);
  e.input('creditSearch','alv');assert.deepStrictEqual(e.visibleIds(),['fake-overdue','fake-current']);
  e.input('creditSearch','no existe');assert.deepStrictEqual(e.visibleIds(),[]);
});

test('active credits are default and previous credits have a separate read-only view', () => {
  const e=environment();assert.deepStrictEqual(e.visibleIds(),['fake-overdue','fake-current']);
  const previous=e.filterButtons.find(button => /Ver créditos anteriores/.test(button.textContent));assert(previous,'previous-credit control must be visible');
  e.click(previous);assert.deepStrictEqual(e.visibleIds(),['fake-paid','fake-renewed','fake-cancelled','fake-zero']);
  for(const card of e.elements.get('creditsList').querySelectorAll('[data-credit-card]')) assert(!card.buttons.some(button => /Cobrar|Renovar/.test(button.textContent)),'previous credits must not offer collection or renewal');
  e.input('creditSearch','alv');assert.deepStrictEqual(e.visibleIds(),['fake-paid','fake-renewed','fake-cancelled','fake-zero']);
  e.refresh();assert.deepStrictEqual(e.visibleIds(),['fake-paid','fake-renewed','fake-cancelled','fake-zero'],'refresh must retain the view without duplicating cards');
  e.click(e.filterButtons.find(button => button.textContent === 'Activos'));assert.deepStrictEqual(e.visibleIds(),['fake-overdue','fake-current']);
  e.click(e.filterButtons.find(button => button.textContent === 'Vencidos'));assert.deepStrictEqual(e.visibleIds(),['fake-overdue']);
  assert.strictEqual(new Set(e.visibleIds()).size,e.visibleIds().length);
});

test('collection search filters partial names and preserves collection, credit and WhatsApp actions', () => {
  const e=environment();e.input('collectionsSearch','maria');
  const host=e.elements.get('collectionsList');assert(host.innerHTML.includes('María Álvarez'));
  e.click(host.buttons.find(button => /Cobrar/.test(button.textContent)));
  e.click(host.buttons.find(button => /Ver crédito/.test(button.textContent)));
  e.click(host.buttons.find(button => /WhatsApp/.test(button.textContent)));
  assert.deepStrictEqual(e.actions,[['collect','fake-overdue'],['credit','fake-overdue'],['whatsapp']]);
  e.input('collectionsSearch','alv');assert(host.innerHTML.includes('María Álvarez'));
  e.input('collectionsSearch','otro');assert(!host.innerHTML.includes('María Álvarez'));
  e.input('collectionsSearch','');assert(host.innerHTML.includes('María Álvarez'));
});

test('direct focus opens previous credits while keeping active credits separate', () => {
  const e=environment();assert.strictEqual(e.window.MiCarteraV2CreditOverdue.focus('fake-paid'),true);
  assert.deepStrictEqual(e.visibleIds(),['fake-paid','fake-renewed','fake-cancelled','fake-zero']);
  assert.strictEqual(e.window.MiCarteraV2CreditOverdue.focus('fake-overdue'),true);
  assert.deepStrictEqual(e.visibleIds(),['fake-overdue','fake-current']);
});

if(failures) process.exitCode=1;
