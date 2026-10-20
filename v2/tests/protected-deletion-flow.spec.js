'use strict';
// Real UI/gate/sync/store flow with fictional documents and an in-memory transaction boundary.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
process.env.SOURCE=path.resolve(__dirname,'..');
const {boot}=require('./dom-harness.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
async function fixture(t,{paid=false}={}){
 const h=await boot({fullShell:true});t.after(()=>h.close());
 const d=h.get();d.clients=[{id:'FICTICIO-CLIENTE',name:'Cliente ficticio aislado',phone:'999000000',version:1}];
 d.credits=[{id:'FICTICIO-CREDITO',clientId:'FICTICIO-CLIENTE',capital:100,total:120,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-15',amount:120,paid:paid?20:0,balance:paid?100:120}]}];
 d.cashMovements=[{id:'FICTICIO-DESEMBOLSO',ref:'FICTICIO-CREDITO',type:'EGRESO',concept:'DESEMBOLSO_CREDITO',amount:100,version:1}];
 d.payments=paid?[{id:'FICTICIO-PAGO',creditId:'FICTICIO-CREDITO',amount:20,version:1}]:[];d.audit=[];h.set(d);
 const documents=new Map([...d.clients.map(x=>['clients/'+x.id,x]),...d.credits.map(x=>['credits/'+x.id,x]),...d.cashMovements.map(x=>['expenses/'+x.id,x]),...d.payments.map(x=>['payments/'+x.id,x])].map(([k,v])=>[k,clone(v)]));
 let atomicCalls=0;const adapter={runAtomic:async fn=>{atomicCalls++;const draft=new Map([...documents].map(([k,v])=>[k,clone(v)]));const result=await fn({get:async k=>clone(draft.get(k)||null),set:async(k,v)=>draft.set(k,clone(v))});documents.clear();for(const item of draft)documents.set(...item);return result}};
 h.load('app/cloud/operational-sync.js');
 const store=h.w.MiCarteraV2Store.createStore(adapter),sync=h.w.MiCarteraV2OperationalSync.createOperationalSync({store,actorId:'test-admin'});
 h.w.MiCarteraV2SyncBridge.submit=op=>sync.submit(op);
 h.w.MiCarteraV2Cards.render();
 const button=[...h.w.document.querySelectorAll('#creditsList button')].find(x=>/Eliminar crédito/.test(x.textContent));assert.ok(button,'actual shell exposes the existing guarded deletion button');
 const onclick=button.getAttribute('onclick');assert.equal(onclick,"MiCarteraV2Cards.deleteCredit('FICTICIO-CREDITO')");
 return {h,d,documents,get atomicCalls(){return atomicCalls},click:()=>vm.runInContext(onclick,vm.createContext(h.w))};
}
test('actual shell button -> confirmation -> real gate/sync/store accepts eligible deletion and tombstones only credit/disbursement',async t=>{
 const f=await fixture(t);let confirmations=0;f.h.w.confirm=message=>{confirmations++;assert.match(message,/no se puede deshacer/);return true};
 await f.click();assert.equal(confirmations,1);assert.equal(f.atomicCalls,1);assert.equal(f.h.get().credits.length,0);assert.deepEqual(f.h.get().clients,f.d.clients);assert.deepEqual(f.h.get().payments,[]);assert.equal(f.h.get().cashMovements.length,0);assert.equal(f.h.get().audit.at(-1).action,'CREDIT_DELETED');
 assert.equal(f.documents.get('credits/FICTICIO-CREDITO').tombstone,true);assert.equal(f.documents.get('expenses/FICTICIO-DESEMBOLSO').tombstone,true);assert.deepEqual(f.documents.get('clients/FICTICIO-CLIENTE'),f.d.clients[0]);
 assert.equal([...f.documents].filter(([k])=>k.startsWith('operations/')).length,1);assert.match(f.h.alerts.at(-1),/eliminado correctamente/);
});
test('actual shell cancellation does not enter durable store or change the fixture',async t=>{const f=await fixture(t),before=clone(f.h.get());f.h.w.confirm=()=>false;await f.click();assert.equal(f.atomicCalls,0);assert.deepEqual(f.h.get(),before)});
test('actual shell protected credit with payments explains its block before confirmation and durable submission',async t=>{const f=await fixture(t,{paid:true}),before=clone(f.h.get());let confirmations=0;f.h.w.confirm=()=>{confirmations++;return true};await f.click();assert.equal(confirmations,0);assert.equal(f.atomicCalls,0);assert.deepEqual(f.h.get(),before);assert.match(f.h.alerts.at(-1),/pagos registrados.*proteger el historial financiero/)});
