'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require(path.join(process.env.V2_TEST_HARNESS||__dirname,'dom-harness.cjs'));
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture(t,{credits=true,legacy=false}={}){
 const h=await boot();t.after(()=>h.close());
 if(process.env.DURABLE_ACTIONS_SOURCE){h.load(path.relative(path.resolve(process.env.SOURCE||'v2'),process.env.DURABLE_ACTIONS_SOURCE));h.w.MiCarteraV2DurableActions.install();}
 const d=h.get();Object.assign(d.clients[0],{route:'r1',routeId:'r1',workerId:'worker-1',version:1});if(legacy)delete d.clients[0].routeId;
 d.credits=credits?[{id:'credit-1',clientId:'c1',routeId:'r1',workerId:'worker-1',capital:100,total:120,principalPaid:10,interestPaid:2,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-10',amount:120,paid:12,balance:108}]}]:[];
 d.payments=[{id:'historical-payment',creditId:'credit-1',amount:12,operationId:'historical-operation',capitalAmount:10,interestAmount:2,penaltyAmount:0}];
 d.cashMovements=[{id:'historical-cash',type:'INGRESO',amount:12,ref:'historical-payment'}];h.set(d);
 const c=d.clients[0],fields={fName:c.name,fPhone:c.phone,fDni:c.dni,fAddress:c.address,fGuarantor:c.guarantor,fGuarantorPhone:c.guarantorPhone,fReference:c.reference,fRoute:c.routeId||c.route,fLocation:c.location};
 for(const [key,value] of Object.entries(fields)){const input=h.w.document.getElementById(key);if(input){input.value=String(value??'');input.dataset.clientId=c.id;}}
 return h;
}
for(const status of ['ACTIVO','PAGADO','RENOVADO'])test('simple client edit refuses a different route while a non-tombstone '+status+' credit exists',async t=>{
 const h=await fixture(t),state=h.get();state.credits[0].status=status;h.set(state);h.w.document.getElementById('fRoute').value='r2';const before=h.get();
 await h.w.MiCarteraV2DurableActions.addClient();assert.deepEqual(h.get(),before);assert.equal(h.commits.length,0);assert.match(h.alerts.join('\n'),/Rutas\s*\/\s*Gestores.*cartera/i);
});
test('same-route client editing preserves every credit, payment, cash row and worker assignment',async t=>{
 const h=await fixture(t),before=h.get();h.w.document.getElementById('fName').value='Nombre actualizado';await h.w.MiCarteraV2DurableActions.addClient();
 const after=h.get();assert.equal(h.alerts.length,0);assert.equal(h.commits.length,1);assert.equal(h.commits[0].type,'CLIENT_UPDATE');assert.equal(after.clients[0].name,'Nombre actualizado');assert.equal(after.clients[0].routeId,'r1');assert.equal(after.clients[0].workerId,'worker-1');
 for(const key of ['credits','payments','cashMovements'])assert.deepEqual(after[key],before[key]);
});
test('client route remains editable when there are no non-tombstone credits for that client',async t=>{
 const h=await fixture(t,{credits:false}),before=h.get();h.w.document.getElementById('fRoute').value='r2';await h.w.MiCarteraV2DurableActions.addClient();
 assert.equal(h.alerts.length,0);assert.equal(h.commits.length,1);assert.equal(h.get().clients[0].routeId,'r2');assert.deepEqual(h.get().payments,before.payments);assert.deepEqual(h.get().cashMovements,before.cashMovements);
});
test('tombstoned credits and another client portfolio do not prevent an otherwise valid route edit',async t=>{
 const h=await fixture(t),d=h.get();d.credits[0].tombstone=true;d.credits.push({...clone(d.credits[0]),id:'other-credit',clientId:'other-client',tombstone:false});h.set(d);const before=h.get();
 h.w.document.getElementById('fRoute').value='r2';await h.w.MiCarteraV2DurableActions.addClient();assert.equal(h.alerts.length,0);assert.equal(h.get().clients[0].routeId,'r2');assert.deepEqual(h.get().credits,before.credits);
});
test('legacy route is the canonical fallback and cannot be changed while a credit remains',async t=>{
 const h=await fixture(t,{legacy:true});h.w.document.getElementById('fRoute').value='r2';const before=h.get();await h.w.MiCarteraV2DurableActions.addClient();
 assert.deepEqual(h.get(),before);assert.equal(h.commits.length,0);assert.match(h.alerts.join('\n'),/Rutas\s*\/\s*Gestores.*cartera/i);
});
test('editing the unchanged legacy route can retain the contact and establish its existing canonical routeId',async t=>{
 const h=await fixture(t,{legacy:true}),before=h.get();h.w.document.getElementById('fName').value='Nombre actualizado';await h.w.MiCarteraV2DurableActions.addClient();
 assert.equal(h.alerts.length,0);assert.equal(h.get().clients[0].routeId,'r1');assert.deepEqual(h.get().credits,before.credits);
});
