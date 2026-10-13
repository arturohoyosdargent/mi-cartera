const {test}=require('node:test'),a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){
 const h=await boot();t.after(()=>h.close());h.load('app/client-edit-v2.js');
 let identity={uid:'test-admin',role:'admin',ready:true};h.w.MiCarteraV2AuthCloudGate.state=()=>({...identity});h.w.MiCarteraV2AuthCloudGate.requireReady=()=>({...identity});
 const initial=h.get();initial.clients.push({id:'fictitious-other',name:'Cliente independiente',phone:'999555777',version:1});h.set(initial);
 const auth=(uid,state)=>{identity={...identity,uid};h.w.firebaseAuthV2.auth.currentUser={uid};h.w.localStorage.setItem('mi-cartera-v2-local-owner',uid);if(state)h.set(state);h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{...identity}}));};
 return {h,initial,auth,remove:()=>h.w.MiCarteraV2ClientEditor.deleteClient('c1')};
}
function defer(f){let release;f.h.w.MiCarteraV2SyncBridge.submit=operation=>{f.h.commits.push(clone(operation));return new Promise(resolve=>{release=()=>resolve({status:'COMMITTED',operationId:operation.operationId});});};return ()=>release();}

test('client deletion only removes that unlinked client once, preserving concurrent cash and other clients',async t=>{
 const f=await fixture(t),release=defer(f),pending=f.remove();await tick();
 const updated=f.h.get();updated.clients[1].name='Nombre nuevo';updated.clients.push({id:'fictitious-new',name:'Alta concurrente'});updated.cashMovements.push({id:'fictitious-cash',type:'INGRESO',amount:50});f.h.set(updated);
 release();await pending;const d=f.h.get();a.deepEqual(d.clients,updated.clients.filter(c=>c.id!=='c1'));a.deepEqual(d.cashMovements,updated.cashMovements);a.equal(d.audit.length,1);a.equal(f.h.commits.length,1);
});
test('client deletion double tap submits one operation and a failed request releases the guard',async t=>{
 const f=await fixture(t),release=defer(f),pending=f.remove();await tick();const second=f.remove();await tick();a.equal(f.h.commits.length,1);release();await Promise.all([pending,second]);
 f.h.set(f.initial);f.h.w.MiCarteraV2SyncBridge.submit=async()=>({status:'ERROR'});await f.remove();a.deepEqual(f.h.get(),f.initial);
 f.h.w.MiCarteraV2SyncBridge.submit=async operation=>({status:'COMMITTED',operationId:operation.operationId});await f.remove();a.ok(!f.h.get().clients.some(c=>c.id==='c1'));
});
for(const change of ['other owner','A to B to A'])test('late client deletion ACK cannot overwrite '+change,async t=>{
 const f=await fixture(t),release=defer(f),pending=f.remove();await tick();const b={clients:[{id:'fictitious-b'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'fictitious-b',role:'ADMIN'}};f.auth('fictitious-b',b);
 let preserved=b;if(change==='A to B to A'){preserved=clone(f.initial);preserved.clients[1].name='A actualizado';f.auth('test-admin',preserved)}
 release();await pending;a.deepEqual(f.h.get(),preserved);
});
test('wrong ACK or mismatched local owner cannot remove a client',async t=>{
 const f=await fixture(t);f.h.w.MiCarteraV2SyncBridge.submit=async operation=>{f.h.commits.push(operation);return {status:'COMMITTED',operationId:'fictitious-wrong'};};await f.remove();a.deepEqual(f.h.get(),f.initial);
 f.h.commits.length=0;f.h.w.localStorage.setItem('mi-cartera-v2-local-owner','fictitious-other-owner');await f.remove();a.equal(f.h.commits.length,0);a.deepEqual(f.h.get(),f.initial);
 f.h.w.localStorage.setItem('mi-cartera-v2-local-owner','test-admin');f.h.w.firebaseAuthV2.auth.currentUser={uid:'fictitious-native-other'};await f.remove();a.equal(f.h.commits.length,0);a.deepEqual(f.h.get(),f.initial);
});
test('a client edited or linked to a credit before ACK remains authoritative',async t=>{
 for(const change of ['edit','credit']){
  const f=await fixture(t),release=defer(f),pending=f.remove();await tick();const newer=f.h.get();if(change==='edit'){newer.clients[0].name='Nombre corregido';newer.clients[0].version=2}else newer.credits.push({id:'fictitious-credit',clientId:'c1',capital:100,total:120,status:'ACTIVO'});f.h.set(newer);release();await pending;a.deepEqual(f.h.get(),newer);
 }
});
test('hydrated deletion with the same audit is idempotent and does not overwrite remote metadata',async t=>{
 const f=await fixture(t),release=defer(f),pending=f.remove();await tick();const hydrated=f.h.get();hydrated.clients=hydrated.clients.filter(c=>c.id!=='c1');hydrated.audit.push({...clone(f.h.commits[0].audit),updatedAt:'fictitious-server-time'});f.h.set(hydrated);release();await pending;a.deepEqual(f.h.get(),hydrated);
});
test('a financial relationship created during confirmation blocks deletion before submit',async t=>{
 const f=await fixture(t);let newer;f.h.w.confirm=()=>{newer=f.h.get();newer.credits.push({id:'fictitious-linked',clientId:'c1',status:'ACTIVO'});f.h.set(newer);return true};await f.remove();a.equal(f.h.commits.length,0);a.deepEqual(f.h.get(),newer);
});
test('orphaned historical payments still protect their client even if the credit is not in the local snapshot',async t=>{
 const f=await fixture(t),d=f.h.get();d.payments.push({id:'fictitious-historical',clientId:'c1',creditId:'fictitious-missing-credit',amount:20});f.h.set(d);await f.remove();a.equal(f.h.commits.length,0);a.deepEqual(f.h.get(),d);
});
