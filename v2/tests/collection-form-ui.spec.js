const test=require('node:test'),assert=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture(t){
 const h=await boot({fullShell:true});t.after(()=>h.close());const state=h.get();
 state.credits=[{id:'FICTICIO-COBRO-1',clientId:'c1',routeId:'r1',workerId:'worker-fictional',capital:100,total:120,rate:20,term:2,freq:'weekly',principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-13',amount:60,paid:0,balance:60},{number:2,date:'2026-10-20',amount:60,paid:0,balance:60}]}];
 h.set(state);h.w.prompt=()=>{throw Error('prompt() is not supported')};h.w.confirm=()=>{throw Error('confirm() is not supported')};
 return {h,initial:clone(h.get()),doc:h.w.document};
}
function open(f){return f.h.w.MiCarteraV2DurableActions.collect('FICTICIO-COBRO-1')}
function el(f,id){const node=f.doc.getElementById(id);assert.ok(node,'expected integrated control '+id);return node}
function review(f,amount){const input=el(f,'v2CollectionAmount');input.value=String(amount);input.dispatchEvent(new f.h.w.Event('input',{bubbles:true}));el(f,'v2CollectionReview').click()}
function confirm(f){el(f,'v2CollectionConfirm').click()}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('Cobrar opens an editable integrated form when native browser dialogs throw',async t=>{
 const f=await fixture(t),pending=open(f),form=el(f,'v2CollectionForm'),input=el(f,'v2CollectionAmount');
 assert.equal(form.getAttribute('role'),'region');assert.ok(f.doc.querySelector('label[for="v2CollectionAmount"]'));
 assert.equal(input.value,'60.00');assert.equal(f.doc.activeElement,input);
 assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.alerts,[]);
 el(f,'v2CollectionCancel').click();await pending;assert.equal(f.doc.getElementById('v2CollectionForm'),null);
 assert.deepEqual(f.h.get(),f.initial);
});

test('edited amount is reviewed with its calculated application and commits only after explicit confirmation',async t=>{
 const f=await fixture(t),pending=open(f);review(f,'75.00');
 const summary=el(f,'v2CollectionReviewPanel').textContent;
 for(const text of ['Cliente Prueba','75.00','120.00','45.00','62.50','12.50'])assert.ok(summary.includes(text),'review shows '+text);
 const rows=[...el(f,'v2CollectionReviewPanel').querySelectorAll('tbody tr')];assert.equal(rows.length,2);
 assert.match(rows[0].textContent,/60\.00/);assert.match(rows[1].textContent,/15\.00/);
 assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,0);
 confirm(f);await pending;const after=f.h.get();assert.equal(after.payments.length,1);assert.equal(after.payments[0].amount,75);
 assert.equal(after.payments[0].capitalAmount,62.5);assert.equal(after.payments[0].interestAmount,12.5);
 assert.deepEqual(after.credits[0].schedule.map(row=>row.balance),[0,45]);assert.equal(after.cashMovements[0].amount,75);
 assert.equal(f.h.commits.length,1);assert.deepEqual(f.h.alerts,[]);
});

test('returning to edit invalidates the prior review and cancelling from review writes nothing',async t=>{
 const f=await fixture(t),pending=open(f);review(f,75);el(f,'v2CollectionBack').click();
 assert.equal(f.doc.getElementById('v2CollectionReviewPanel'),null);assert.equal(el(f,'v2CollectionAmount').value,'75');
 review(f,30);assert.match(el(f,'v2CollectionReviewPanel').textContent,/30\.00/);
 el(f,'v2CollectionCancel').click();await pending;assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,0);
});

for(const amount of ['',0,-1,'NaN','Infinity','120.01','1.001'])test('invalid or excessive collection amount '+JSON.stringify(amount)+' cannot reach review',async t=>{
 const f=await fixture(t),pending=open(f);review(f,amount);
 assert.equal(f.doc.getElementById('v2CollectionReviewPanel'),null);assert.ok(el(f,'v2CollectionError').textContent.trim());
 assert.equal(el(f,'v2CollectionAmount').getAttribute('aria-invalid'),'true');
 assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,0);el(f,'v2CollectionCancel').click();await pending;
});

test('editing the hidden amount after review cannot submit the old reviewed payment',async t=>{
 const f=await fixture(t),pending=open(f);review(f,60);el(f,'v2CollectionAmount').value='121';confirm(f);
 assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),f.initial);
 el(f,'v2CollectionCancel').click();await pending;
});

test('double opening and double confirmation create one payment while durable acceptance is pending',async t=>{
 const f=await fixture(t);let release;f.h.w.MiCarteraV2SyncBridge.submit=operation=>{f.h.commits.push(clone(operation));return new Promise(resolve=>{release=()=>resolve({status:'COMMITTED'})})};
 const pending=open(f);await open(f);assert.equal(f.doc.querySelectorAll('#v2CollectionForm').length,1);
 review(f,60);const button=el(f,'v2CollectionConfirm');button.click();button.click();await tick();
 assert.equal(f.h.commits.length,1);assert.deepEqual(f.h.get(),f.initial);release();await pending;
 assert.equal(f.h.get().payments.length,1);assert.equal(f.h.get().cashMovements.length,1);
});

for(const phase of ['before review','before confirmation'])test('credit revision changed '+phase+' blocks durable submission',async t=>{
 const f=await fixture(t),pending=open(f);if(phase==='before confirmation')review(f,60);
 const changed=f.h.get();changed.credits[0].version=2;changed.credits[0].schedule[0].balance=50;f.h.set(changed);
 if(phase==='before review')review(f,60);else confirm(f);
 assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),changed);
 el(f,'v2CollectionCancel').click();await pending;
});

for(const change of ['logout','other owner','A to B to A'])test('session '+change+' while the form is open invalidates confirmation',async t=>{
 const f=await fixture(t),pending=open(f);review(f,60);
 if(change==='logout')f.h.setAuth({uid:'',role:'admin',ready:false,authenticated:false,member:false},true);
 else {f.h.setAuth({uid:'other-fictional-owner',role:'admin',ready:true,authenticated:true,member:true},true);if(change==='A to B to A')f.h.setAuth({uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true},true)}
 const preserved=f.h.get();assert.equal(Boolean(f.doc.getElementById('v2CollectionForm')),false,'old-owner form must close immediately');
 await pending;assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),preserved);
});

test('Cobrar is inserted beside the visible credit when a duplicate card exists in an inactive page',async t=>{
 const f=await fixture(t);f.doc.querySelectorAll('.page.active').forEach(page=>page.classList.remove('active'));
 const hidden=f.doc.createElement('section'),visible=f.doc.createElement('section');hidden.className='page';visible.className='page active';
 hidden.innerHTML='<article data-credit-id="FICTICIO-COBRO-1"></article>';
 visible.innerHTML='<article data-credit-id="FICTICIO-COBRO-1"><button type="button">Cobrar visible</button></article>';
 f.doc.body.append(hidden,visible);visible.querySelector('button').focus();const pending=open(f);
 assert.equal(el(f,'v2CollectionForm').parentElement===visible,true,'form is inside the active page');el(f,'v2CollectionCancel').click();await pending;
 assert.equal(f.doc.activeElement,visible.querySelector('button'));
});

test('identical authenticated state notifications keep the reviewed form usable',async t=>{
 const f=await fixture(t),pending=open(f);review(f,60);
 f.h.setAuth({uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]},true);
 confirm(f);await pending;assert.equal(f.h.get().payments.length,1);assert.equal(f.h.commits.length,1);
});

test('a renderer removing the form cancels its pending action and releases its credit guard',async t=>{
 const f=await fixture(t),pending=open(f);let settled=false;pending.then(()=>{settled=true});
 el(f,'v2CollectionForm').remove();await tick();assert.equal(settled,true,'removed form must resolve its pending action');
 await pending;const again=open(f);el(f,'v2CollectionCancel').click();await again;assert.equal(f.h.commits.length,0);
});

for(const phase of ['entry','review'])test('leaving the collection '+phase+' screen cancels preparation and releases its credit guard',async t=>{
 const f=await fixture(t);f.h.w.show('credits');const pending=open(f);let settled=false;pending.then(()=>{settled=true});
 if(phase==='review')review(f,60);
 f.h.w.show('home');await tick();
 assert.equal(settled,true,'hidden preparation must resolve when navigation leaves its page');
 await pending;assert.equal(f.doc.getElementById('v2CollectionForm'),null);
 f.h.w.show('credits');const again=open(f);el(f,'v2CollectionCancel').click();await again;
 assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.alerts,[]);
});

for(const status of ['QUEUED','OFFLINE','REJECTED'])test('non durable '+status+' acceptance leaves financial records untouched',async t=>{
 const f=await fixture(t);f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));return {status}};
 const pending=open(f);review(f,60);confirm(f);await pending;
 assert.deepEqual(f.h.get(),f.initial);assert.equal(f.h.commits.length,1);assert.ok(f.h.alerts.length);
});

test('transport persistence failure leaves financial records untouched',async t=>{
 const f=await fixture(t);f.h.w.MiCarteraV2SyncBridge.submit=async()=>{throw Error('FICTICIO_PERSISTENCE_FAILED')};
 const pending=open(f);review(f,60);confirm(f);await pending;
 assert.deepEqual(f.h.get(),f.initial);assert.ok(f.h.alerts.some(message=>message.includes('FICTICIO_PERSISTENCE_FAILED')));
});

test('leaving after confirmation preserves the in-flight payment guard until its single durable acknowledgement',async t=>{
 const f=await fixture(t);f.h.w.show('credits');let release;
 f.h.w.MiCarteraV2SyncBridge.submit=operation=>{f.h.commits.push(clone(operation));return new Promise(resolve=>{release=()=>resolve({status:'COMMITTED'})})};
 const pending=open(f);review(f,60);confirm(f);await tick();assert.equal(f.h.commits.length,1);
 f.h.w.show('home');await tick();await open(f);
 assert.equal(f.h.commits.length,1);assert.deepEqual(f.h.get(),f.initial);
 release();await pending;assert.equal(f.h.get().payments.length,1);assert.equal(f.h.get().cashMovements.length,1);
 const again=open(f);el(f,'v2CollectionCancel').click();await again;assert.equal(f.h.commits.length,1);
});
