'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SOURCE = path.resolve(__dirname, '..');
const {boot} = require('./dom-harness.cjs');
const OWNER = 'mi-cartera-v2-local-owner';
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

// The real DOM, financial engine, schedule engine and acceptance gate execute.
// Authentication, local storage and durable transport contain fictional data only.
async function fixture(t) {
  const h = await boot();
  t.after(() => h.close());
  let identity = {uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
  const gate = h.w.MiCarteraV2AuthCloudGate;
  gate.state = () => clone(identity);
  gate.requireReady = () => {
    if (!identity.ready) throw new Error('V2_AUTH_NOT_READY');
    return clone(identity);
  };
  h.w.MiCarteraV2Dates.today = () => '2026-10-07';
  const d = h.get();
  d.credits = [{id:'FICTICIO-REN-OLD',clientId:'c1',routeId:'r1',capital:600,total:720,
    principalPaid:300,interestPaid:60,penaltyPaid:0,rate:20,term:4,freq:'weekly',restDay:'',
    status:'ACTIVO',version:1,schedule:Array.from({length:4},(_,i) => ({number:i+1,
      date:['2026-10-01','2026-10-08','2026-10-15','2026-10-22'][i],amount:180,
      paid:i<2?180:0,balance:i<2?0:180,status:i<2?'PAGADA':'PENDIENTE'}))}];
  d.payments=[];d.cashMovements=[];d.audit=[];
  h.set(d);
  const previews=[];
  h.w.MiCarteraV2SharePreview={close(){},previewCredit:id=>previews.push(id)};
  function switchIdentity(uid, state, {ready=true}={}) {
    identity={uid,role:'admin',ready,authenticated:ready,member:ready,routeIds:[]};
    h.w.firebaseAuthV2.auth.currentUser=ready?{uid}:null;
    if(uid)h.w.localStorage.setItem(OWNER,uid);
    if(state)h.set(state);
    h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:clone(identity)}));
  }
  return {h,previews,switchIdentity,initial:clone(d)};
}
function review(f) {
  const doc=f.h.w.document;
  doc.getElementById('v2RenewDate').value='2026-10-07';
  doc.getElementById('v2RenewFirstDate').value='2026-10-12';
  doc.getElementById('v2RenewReview').onclick();
  assert.ok(doc.getElementById('v2RenewalReview'),'the real renewal review must open');
}
function confirm(f) {
  const doc=f.h.w.document,accepted=doc.getElementById('v2RenewAccepted');
  accepted.checked=true;accepted.onchange();
  doc.getElementById('v2ConfirmRenewal').onclick();
}
function delayedRenewal(f) {
  let release;
  f.h.w.MiCarteraV2SyncBridge.submit=async operation => {
    f.h.commits.push(clone(operation));
    if(['INTEREST_RENEWAL','REFINANCE'].includes(operation.type)) {
      return new Promise(resolve => {release=()=>resolve({status:'COMMITTED',operationId:operation.operationId});});
    }
    return {status:'COMMITTED',operationId:operation.operationId};
  };
  return () => {assert.equal(typeof release,'function','renewal must be awaiting its durable response');release();};
}
function otherOwner() {
  return {clients:[{id:'FICTICIO-B-CLIENT',name:'Cuenta B FICTICIA'}],credits:[],payments:[],
    cashMovements:[{id:'FICTICIO-B-CASH',amount:777,type:'INGRESO',date:'2026-10-07'}],audit:[],
    session:{actorId:'fictional-owner-b',role:'ADMIN'}};
}
function acceptedSnapshot(f, operation) {
  const state=f.h.get();
  for(const entity of operation.entities) {
    const target=['entries','expenses'].includes(entity.collection)?'cashMovements':entity.collection;
    const rows=state[target]||(state[target]=[]),index=rows.findIndex(row=>row.id===entity.data.id);
    if(index<0)rows.push(clone(entity.data));else rows[index]=clone(entity.data);
  }
  if(operation.audit&&!state.audit.some(row=>row.id===operation.audit.id))state.audit.push(clone(operation.audit));
  state.clients.push({id:'FICTICIO-HYDRATED-CLIENT',name:'Cliente remoto FICTICIO'});
  return state;
}

for(const method of ['renewInterest','refinance']) {
  test(method+': a proposal opened by A cannot submit after B confirms',async t=>{
    const f=await fixture(t),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');review(f);
    const b=otherOwner();f.switchIdentity('fictional-owner-b',b);
    confirm(f);await pending;
    assert.equal(f.h.commits.length,0,'stale-owner confirmation must not reach durable transport');
    assert.deepEqual(f.h.get(),b);
    assert.equal(f.previews.length,0);
  });
  test(method+': a predecessor changed during proposal review cannot submit old terms',async t=>{
    const f=await fixture(t),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');review(f);
    const newer=f.h.get();newer.credits[0].version=2;newer.credits[0].principalPaid=325;
    newer.credits[0].schedule[2].balance=155;newer.credits[0].schedule[2].paid=25;f.h.set(newer);
    confirm(f);await pending;
    assert.equal(f.h.commits.length,0,'changed balances require a new accepted proposal');
    assert.deepEqual(f.h.get(),newer);
  });
  for(const change of ['another owner','logout','A to B to A']) {
    test(method+': delayed acceptance preserves local state after '+change,async t=>{
      const f=await fixture(t),release=delayedRenewal(f),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');
      review(f);confirm(f);await tick();assert.equal(f.h.commits.length,1);
      let preserved;
      if(change==='another owner') {
        preserved=otherOwner();f.switchIdentity('fictional-owner-b',preserved);
      }else if(change==='logout') {
        preserved=f.h.get();preserved.session=null;f.switchIdentity('test-admin',preserved,{ready:false});
      }else {
        f.switchIdentity('fictional-owner-b',otherOwner());
        preserved=clone(f.initial);preserved.clients.push({id:'FICTICIO-A-NEW',name:'Nuevo cliente A FICTICIO'});
        f.switchIdentity('test-admin',preserved);
      }
      release();await pending;
      assert.deepEqual(f.h.get(),preserved,'late ACK must never restore the captured portfolio/session');
      assert.equal(f.previews.length,0,'late ACK must not open an old-owner saved-credit preview');
    });
  }
  test(method+': delayed acceptance preserves separately accepted cash and client writes',async t=>{
    const f=await fixture(t),release=delayedRenewal(f),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');
    review(f);confirm(f);await tick();
    const movement=await f.h.w.V2UI.manualCash('INGRESO',{date:'2026-10-07',amount:75,
      category:'APORTE_CAPITAL',concept:'Aporte concurrente FICTICIO'});
    const doc=f.h.w.document;doc.getElementById('fName').value='Cliente concurrente FICTICIO';
    doc.getElementById('fPhone').value='999222333';await f.h.w.V2UI.addClient();
    const before=f.h.get(),client=before.clients.find(row=>row.name==='Cliente concurrente FICTICIO');
    assert.ok(movement&&client);assert.equal(f.h.commits.length,3);
    release();await pending;const after=f.h.get();
    assert.deepEqual(after.cashMovements.find(row=>row.id===movement.id),clone(movement),'independent accepted cash must survive');
    assert.deepEqual(after.clients.find(row=>row.id===client.id),client,'independent accepted client must survive');
    assert.ok(before.audit.every(row=>after.audit.some(saved=>saved.id===row.id)));
    assert.equal(after.credits.length,2);
    assert.equal(new Set(after.credits.map(row=>row.id)).size,2);
  });
  test(method+': same accepted renewal hydrated before ACK remains idempotent',async t=>{
    const f=await fixture(t),release=delayedRenewal(f),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');
    review(f);confirm(f);await tick();const hydrated=acceptedSnapshot(f,f.h.commits[0]);f.h.set(hydrated);
    release();await pending;
    assert.deepEqual(f.h.get(),hydrated,'an exact accepted transaction must not be appended or replace newer unrelated rows');
    assert.equal(f.h.get().credits.length,2);
    assert.equal(new Set(f.h.get().cashMovements.map(row=>row.id)).size,f.h.get().cashMovements.length);
  });
  test(method+': same renewal ID with a conflicting hydrated successor stays authoritative',async t=>{
    const f=await fixture(t),release=delayedRenewal(f),pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');
    review(f);confirm(f);await tick();const hydrated=acceptedSnapshot(f,f.h.commits[0]);
    const successor=hydrated.credits.find(row=>row.id!=='FICTICIO-REN-OLD');
    successor.version=2;successor.schedule[0].balance-=10;successor.schedule[0].paid=10;
    f.h.set(hydrated);release();await pending;
    assert.deepEqual(f.h.get(),hydrated,'a conflicting newer successor must not be overwritten by the earlier ACK');
    assert.equal(f.previews.length,0,'a conflicting result must not show a stale saved-credit preview');
  });
  test(method+': an acknowledgement for another operation never changes local records',async t=>{
    const f=await fixture(t);
    f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{
      f.h.commits.push(clone(operation));return {status:'COMMITTED',operationId:'FICTICIO-OTHER-OPERATION'};
    };
    const pending=f.h.w.V2UI[method]('FICTICIO-REN-OLD');review(f);confirm(f);await pending;
    assert.deepEqual(f.h.get(),f.initial,'accepted status alone cannot identify this renewal');
    assert.equal(f.previews.length,0);
  });
}
