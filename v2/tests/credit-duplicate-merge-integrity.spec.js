'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
process.env.SOURCE=path.resolve(__dirname,'..');
const {boot}=require('./dom-harness.cjs');
const OWNER='mi-cartera-v2-local-owner',clone=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){
 const h=await boot();t.after(()=>h.close());let identity={uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
 const gate=h.w.MiCarteraV2AuthCloudGate;gate.state=()=>clone(identity);gate.requireReady=()=>{if(!identity.ready)throw Error('V2_AUTH_NOT_READY');return clone(identity)};
 const d=h.get(),source={id:'FICTICIO-MERGE-SOURCE',clientId:'c1',capital:100,total:120,rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,routeId:'r1',term:1,freq:'weekly',firstPaymentDate:'2026-10-15',schedule:[{number:1,date:'2026-10-15',amount:120,balance:120,paid:0,status:'PENDIENTE'}]};
 d.credits=[source,{...clone(source),id:'FICTICIO-MERGE-TARGET'}];d.payments=[];d.audit=[];d.cashMovements=[{id:'FICTICIO-MERGE-SOURCE-CASH',ref:source.id,type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,date:'2026-10-12',version:1},{id:'FICTICIO-MERGE-TARGET-CASH',ref:'FICTICIO-MERGE-TARGET',type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,date:'2026-10-12',version:1},{id:'FICTICIO-OTHER-CASH',type:'INGRESO',amount:70,date:'2026-10-12',version:1}];h.set(d);h.load('app/operational-cards-v2.js');
 function auth(uid,state,{ready=true}={}){identity={...identity,uid,ready,authenticated:ready,member:ready};h.w.firebaseAuthV2.auth.currentUser=ready?{uid}:null;if(uid)h.w.localStorage.setItem(OWNER,uid);if(state)h.set(state);h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:clone(identity)}));}
 return {h,auth,initial:clone(d),merge:()=>h.w.MiCarteraV2Cards.consolidateDuplicateCredit(source.id,'FICTICIO-MERGE-TARGET')};
}
function delayed(f){const releases=[];f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));if(['CREDIT_DUPLICATE_CONSOLIDATE','CREDIT_DELETE'].includes(operation.type))return new Promise(resolve=>releases.push(()=>resolve({status:'COMMITTED',operationId:operation.operationId})));return {status:'COMMITTED',operationId:operation.operationId}};return ()=>{assert.ok(releases.length);for(const release of releases)release()};}
const success=f=>f.h.alerts.filter(message=>/duplicado consolidado/i.test(message)).length;
test('accepted duplicate consolidation preserves target, client and one actual disbursement',async t=>{
 const f=await fixture(t);await f.merge();const after=f.h.get();assert.equal(f.h.commits.length,1);assert.deepEqual(after.credits,[f.initial.credits[1]]);assert.deepEqual(after.clients,f.initial.clients);assert.deepEqual(after.cashMovements,f.initial.cashMovements.slice(1));assert.equal(after.audit.length,1);assert.equal(success(f),1);
});
test('cancelled, rejected or payment-linked consolidation remains unchanged',async t=>{
 const f=await fixture(t);f.h.w.confirm=()=>false;await f.merge();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),f.initial);
 f.h.w.confirm=()=>true;f.h.w.MiCarteraV2SyncBridge.submit=async()=>({status:'ERROR'});await f.merge();assert.deepEqual(f.h.get(),f.initial);
 const paid=f.h.get();paid.payments.push({id:'FICTICIO-PAY',creditId:'FICTICIO-MERGE-TARGET',amount:20});f.h.set(paid);await f.merge();assert.deepEqual(f.h.get(),paid);assert.equal(success(f),0);
});
for(const change of ['another owner','logout','A to B to A'])test('late consolidation ACK preserves local state after '+change,async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.merge();await tick();assert.equal(f.h.commits.length,1);const b={clients:[],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'fictional-b',role:'ADMIN'}};let preserved;
 if(change==='another owner'){preserved=b;f.auth('fictional-b',b)}else if(change==='logout'){preserved=f.h.get();preserved.session=null;f.auth('test-admin',preserved,{ready:false})}else{f.auth('fictional-b',b);preserved=clone(f.initial);preserved.clients.push({id:'FICTICIO-NEW-A',name:'Nuevo A'});f.auth('test-admin',preserved)}
 release();await pending;assert.deepEqual(f.h.get(),preserved);assert.equal(success(f),0);
});
test('wrong consolidation ACK cannot remove source credit or cash',async t=>{
 const f=await fixture(t);f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(clone(operation));return {status:'COMMITTED',operationId:'FICTICIO-WRONG-ACK'}};await f.merge();assert.deepEqual(f.h.get(),f.initial);assert.equal(success(f),0);
});
test('double consolidation and direct deletion of the same source submit once',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.merge();await tick();const again=f.merge(),deletion=f.h.w.MiCarteraV2Cards.deleteCredit('FICTICIO-MERGE-SOURCE');await tick();const count=f.h.commits.length;release();await Promise.all([pending,again,deletion]);assert.equal(count,1);assert.equal(f.h.get().audit.length,1);
});
test('target changes during confirmation block consolidation before submission',async t=>{
 const f=await fixture(t);let newer;f.h.w.confirm=()=>{newer=f.h.get();newer.credits[1].version=2;newer.credits[1].routeId='FICTICIO-NEW-ROUTE';f.h.set(newer);return true};await f.merge();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),newer);
});
test('late consolidation preserves independently accepted cash and refreshed clients',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.merge();await tick();const movement=await f.h.w.V2UI.manualCash('INGRESO',{date:'2026-10-12',amount:50,category:'APORTE_CAPITAL',concept:'FICTICIO concurrente'});const before=f.h.get();before.clients[0].name='Cliente FICTICIO actualizado';f.h.set(before);release();await pending;const after=f.h.get();assert.deepEqual(after.cashMovements.find(row=>row.id===movement.id),clone(movement));assert.equal(after.clients[0].name,before.clients[0].name);assert.ok(before.audit.every(row=>after.audit.some(saved=>saved.id===row.id)));assert.equal(after.credits.length,1);
});
test('already hydrated consolidation is idempotent without reverting server rows or metadata',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.merge();await tick();const hydrated=f.h.get();hydrated.credits=hydrated.credits.slice(1);hydrated.cashMovements=hydrated.cashMovements.slice(1);hydrated.audit.push({...clone(f.h.commits[0].audit),updatedAt:'FICTICIO-SERVER-METADATA'});hydrated.clients.push({id:'FICTICIO-REMOTE-CLIENT',name:'Cliente remoto'});f.h.set(hydrated);release();await pending;assert.deepEqual(f.h.get(),hydrated);
});
test('newer target revision, payment and cash stay authoritative after an older merge ACK',async t=>{
 const f=await fixture(t),release=delayed(f),pending=f.merge();await tick();const newer=f.h.get();newer.credits[1].version=2;newer.credits[1].principalPaid=20;newer.credits[1].schedule[0].paid=20;newer.credits[1].schedule[0].balance=100;newer.payments.push({id:'FICTICIO-HYDRATED-PAY',creditId:'FICTICIO-MERGE-TARGET',amount:20});f.h.set(newer);release();await pending;assert.deepEqual(f.h.get(),newer);assert.equal(success(f),0);
});
test('OWNER mismatch and linked renewal history block source and target consolidation',async t=>{
 const f=await fixture(t);f.h.w.localStorage.setItem(OWNER,'FICTICIO-OTHER');await f.merge();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),f.initial);
 f.h.w.localStorage.setItem(OWNER,'test-admin');const chain=f.h.get();chain.credits[0].status='RENOVADO';chain.credits[0].renewedTo='FICTICIO-MERGE-TARGET';chain.credits[1].renewedFrom='FICTICIO-MERGE-SOURCE';f.h.set(chain);await f.merge();assert.equal(f.h.commits.length,0);assert.deepEqual(f.h.get(),chain);
});
