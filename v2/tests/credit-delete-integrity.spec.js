'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
process.env.SOURCE=path.resolve(__dirname,'..');
const {boot}=require('./dom-harness.cjs');
const OWNER='mi-cartera-v2-local-owner',clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){
 const h=await boot();t.after(()=>h.close());
 let identity={uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
 const gate=h.w.MiCarteraV2AuthCloudGate;gate.state=()=>clone(identity);gate.requireReady=()=>{if(!identity.ready)throw Error('V2_AUTH_NOT_READY');return clone(identity)};
 const d=h.get();d.credits=[{id:'FICTICIO-DEL-1',clientId:'c1',capital:100,total:120,rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,routeId:'r1',schedule:[{number:1,date:'2026-10-15',amount:120,balance:120,paid:0,status:'PENDIENTE'}]}];
 d.payments=[];d.audit=[];d.cashMovements=[{id:'FICTICIO-DEL-CASH',ref:'FICTICIO-DEL-1',type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,date:'2026-10-12',version:1},{id:'FICTICIO-OTHER-CASH',type:'INGRESO',amount:70,date:'2026-10-12',version:1}];h.set(d);
 h.load('app/operational-cards-v2.js');
 function auth(uid,state,{ready=true}={}){identity={...identity,uid,ready,authenticated:ready,member:ready};h.w.firebaseAuthV2.auth.currentUser=ready?{uid}:null;if(uid)h.w.localStorage.setItem(OWNER,uid);if(state)h.set(state);h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:clone(identity)}));}
 return {h,auth,initial:clone(d),remove:()=>h.w.MiCarteraV2Cards.deleteCredit('FICTICIO-DEL-1')};
}
function delayed(f){const releases=[];f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));if(operation.type==='CREDIT_DELETE')return new Promise(resolve=>{releases.push(()=>resolve({status:'COMMITTED',operationId:operation.operationId}))});return {status:'COMMITTED',operationId:operation.operationId}};return ()=>{assert.ok(releases.length);for(const release of releases)release()};}
const success=f=>f.h.alerts.filter(message=>/eliminado correctamente/i.test(message)).length;

test('one accepted deletion removes only the unchanged credit/disbursement and preserves its client',async t=>{
 const f=await fixture(t);await f.remove();const after=f.h.get();
 assert.equal(f.h.commits.length,1);assert.equal(after.credits.length,0);assert.deepEqual(after.clients,f.initial.clients);
 assert.deepEqual(after.cashMovements,[f.initial.cashMovements[1]]);assert.equal(after.audit.length,1);assert.equal(success(f),1);
});
test('rejected deletion and cancelled confirmation preserve every field',async t=>{
 const f=await fixture(t);f.h.w.confirm=()=>false;await f.remove();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),f.initial);
 f.h.w.confirm=()=>true;f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));return {status:'ERROR'}};
 await f.remove();assert.deepEqual(f.h.get(),f.initial);assert.equal(success(f),0);
});
for(const change of ['another owner','logout','A to B to A'])test('late deletion ACK preserves local state after '+change,async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();assert.equal(f.h.commits.length,1);
 const b={clients:[{id:'FICTICIO-B-CLIENT',name:'Cliente B'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'fictional-b',role:'ADMIN'}};let preserved;
 if(change==='another owner'){preserved=b;f.auth('fictional-b',preserved)}else if(change==='logout'){preserved=f.h.get();preserved.session=null;f.auth('test-admin',preserved,{ready:false})}else{f.auth('fictional-b',b);preserved=clone(f.initial);preserved.clients.push({id:'FICTICIO-A-NEW',name:'Nuevo A'});f.auth('test-admin',preserved)}
 release();await pending;assert.deepEqual(f.h.get(),preserved);assert.equal(success(f),0);
});
test('an ACK belonging to a different deletion cannot remove financial records',async t=>{
 const f=await fixture(t);f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));return {status:'COMMITTED',operationId:'FICTICIO-WRONG-ACK'}};
 await f.remove();assert.deepEqual(f.h.get(),f.initial);assert.equal(success(f),0);
});
test('double tap submits one deletion and a rejected request releases its guard',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();const second=f.remove();await tick();
 const count=f.h.commits.length;release();await Promise.all([pending,second]);assert.equal(count,1);
 f.h.set(f.initial);f.h.w.MiCarteraV2SyncBridge.submit=async()=>({status:'ERROR'});await f.remove();
 f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));return {status:'COMMITTED',operationId:operation.operationId}};
 await f.remove();assert.equal(f.h.get().credits.length,0);
});
test('changed credit or a newly recorded payment during confirmation blocks stale deletion',async t=>{
 const f=await fixture(t);let current;f.h.w.confirm=()=>{current=f.h.get();current.credits[0].version=2;current.payments.push({id:'FICTICIO-NEW-PAY',creditId:'FICTICIO-DEL-1',amount:20});f.h.set(current);return true};
 await f.remove();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),current);assert.equal(success(f),0);
});
test('late deletion ACK preserves separately accepted cash and a refreshed client',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();
 const movement=await f.h.w.V2UI.manualCash('INGRESO',{date:'2026-10-12',amount:50,category:'APORTE_CAPITAL',concept:'Aporte FICTICIO concurrente'});
 const current=f.h.get();current.clients[0].name='Cliente FICTICIO actualizado';f.h.set(current);release();await pending;const after=f.h.get();
 assert.deepEqual(after.cashMovements.find(row=>row.id===movement.id),clone(movement));assert.equal(after.clients[0].name,current.clients[0].name);
 assert.equal(after.credits.length,0);assert.ok(current.audit.every(row=>after.audit.some(saved=>saved.id===row.id)));
});
test('an already hydrated deletion is idempotent and preserves the authoritative snapshot',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();const accepted=f.h.commits[0],hydrated=f.h.get();
 hydrated.credits=[];hydrated.cashMovements=hydrated.cashMovements.filter(row=>row.id!=='FICTICIO-DEL-CASH');hydrated.audit.push({...clone(accepted.audit),updatedAt:'FICTICIO-SERVER-METADATA'});hydrated.clients.push({id:'FICTICIO-REMOTE-CLIENT',name:'Cliente remoto'});f.h.set(hydrated);
 release();await pending;assert.deepEqual(f.h.get(),hydrated);assert.equal(f.h.get().audit.filter(row=>row.id===accepted.audit.id).length,1);
});
test('a newer hydrated credit revision and its payment are never erased by an older deletion ACK',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();const newer=f.h.get();newer.credits[0].version=2;newer.credits[0].principalPaid=20;newer.credits[0].schedule[0].paid=20;newer.credits[0].schedule[0].balance=100;newer.payments.push({id:'FICTICIO-HYDRATED-PAY',creditId:'FICTICIO-DEL-1',amount:20});f.h.set(newer);
 release();await pending;assert.deepEqual(f.h.get(),newer);assert.equal(success(f),0);
});
test('a changed disbursement or conflicting audit during ACK is preserved without partial deletion',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.remove();await tick();const newer=f.h.get();newer.cashMovements[0].version=2;newer.cashMovements[0].amount=90;newer.audit.push({...clone(f.h.commits[0].audit),action:'FICTICIO-CONFLICT'});f.h.set(newer);
 release();await pending;assert.deepEqual(f.h.get(),newer);assert.equal(success(f),0);
});
test('a mismatched OWNER blocks deletion before durable submission',async t=>{
 const f=await fixture(t);f.h.w.localStorage.setItem(OWNER,'FICTICIO-OTHER-OWNER');await f.remove();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),f.initial);
});
test('recorded paid balances without payment rows still protect financial history',async t=>{
 const f=await fixture(t),paid=f.h.get();paid.credits[0].principalPaid=20;paid.credits[0].schedule[0].paid=20;paid.credits[0].schedule[0].balance=100;f.h.set(paid);
 await f.remove();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),paid);
});
test('missing, contradictory or duplicated disbursements require review instead of erasing a credit during incomplete synchronization',async t=>{
 for(const change of ['missing','amount','duplicate']){
  const f=await fixture(t),d=f.h.get();
  if(change==='missing')d.cashMovements=d.cashMovements.filter(m=>m.ref!=='FICTICIO-DEL-1');
  if(change==='amount')d.cashMovements[0].amount=90;
  if(change==='duplicate')d.cashMovements.push({...clone(d.cashMovements[0]),id:'FICTICIO-DUPLICATE-DISBURSEMENT'});
  f.h.set(d);await f.remove();assert.equal(f.h.commits.length,0,change);assert.deepEqual(f.h.get(),d);
 }
});

test('a predecessor or successor linked by renewal cannot be deleted as an unrecorded credit',async t=>{
 const f=await fixture(t),renewed=f.h.get();renewed.credits[0].status='RENOVADO';renewed.credits[0].renewedTo='FICTICIO-SUCCESSOR';renewed.credits.push({...clone(renewed.credits[0]),id:'FICTICIO-SUCCESSOR',status:'ACTIVO',renewedFrom:'FICTICIO-DEL-1',renewedTo:undefined});f.h.set(renewed);
 await f.remove();await f.h.w.MiCarteraV2Cards.deleteCredit('FICTICIO-SUCCESSOR');assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),clone(renewed));
});
