'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
const T=require('../core/transaction-store'),Sync=require('../cloud/operational-sync'),clone=x=>JSON.parse(JSON.stringify(x));
async function setup(){
 const h=await boot({fullShell:true}),d=h.get();
 d.clients=[{id:'c1',name:'CLIENTE FICTICIO',phone:'999000001',routeId:'route-a',route:'route-a',version:1}];
 d.credits=[1,2].map(n=>({id:'credit-'+n,clientId:'c1',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',routeId:'route-a',version:1,schedule:[{number:1,date:'2026-11-20',amount:120,paid:0,balance:120}]}));
 d.payments=[{id:'historical-payment',creditId:'credit-1',clientId:'c1',amount:10,routeId:'route-a'}];d.cashMovements=[{id:'historical-cash',amount:10,type:'INGRESO',ref:'historical-payment'}];d.audit=[];
 d.commercial=['a','b'].flatMap(k=>[{id:'route-'+k,recordType:'ROUTE',name:'Ruta '+k,active:true,version:1},{id:'worker-'+k,recordType:'WORKER',name:'Gestor '+k,routeId:'route-'+k,workerId:'worker-'+k,authUid:'fictional-'+k,active:true,version:1}]);h.set(d);return h;
}
function server(h,alterClient,Store=T){
 const d=h.get(),db=new Map();for(const col of ['clients','credits'])for(const row of d[col])db.set(col+'/'+row.id,clone(row));for(const row of d.commercial)db.set('routes/'+row.id,clone(row));if(alterClient)db.set('clients/c1',{...db.get('clients/c1'),...alterClient});
 const store=Store.createStore({runAtomic:async fn=>{const draft=new Map([...db].map(([k,v])=>[k,clone(v)]));const result=await fn({get:async k=>draft.get(k)||null,set:async(k,v)=>draft.set(k,clone(v))});db.clear();for(const row of draft)db.set(...row);return result;}},{validateSession:op=>h.w.MiCarteraV2CommercialActions.assertMetadataSession(op)}),sync=Sync.createOperationalSync({store,actorId:'test-admin'});h.w.MiCarteraV2SyncBridge.submit=op=>sync.submit(op);return db;
}
const assign=h=>h.w.MiCarteraV2CommercialActions.assign.bind(h.w.MiCarteraV2CommercialActions);
test('individual assignment cannot separate an active credit from the client collector route',async()=>{
 const h=await setup();try{const before=h.get(),commits=h.commits.length;for(const includeCredits of [false,true])await a.rejects(assign(h)({clientId:'c1',creditId:'credit-1',workerId:'worker-b',includeCredits}),/ruta.*cliente|cliente.*cartera|todos.*créditos/i);a.deepEqual(h.get(),before);a.equal(h.commits.length,commits)}finally{await h.close()}
});
test('individual same-route assignment preserves client, sibling and all financial history',async()=>{
 const h=await setup();try{const before=h.get();await assign(h)({clientId:'c1',creditId:'credit-1',workerId:'worker-a'});const after=h.get();a.equal(after.credits[0].workerId,'worker-a');a.equal(after.credits[0].routeId,after.clients[0].routeId);a.deepEqual(after.clients,before.clients);a.deepEqual(after.credits[1],before.credits[1]);for(const key of ['capital','total','principalPaid','interestPaid','penaltyPaid','schedule'])a.deepEqual(after.credits[0][key],before.credits[0][key]);a.deepEqual(after.payments,before.payments);a.deepEqual(after.cashMovements,before.cashMovements)}finally{await h.close()}
});
test('existing client plus portfolio assignment moves contact and both credits atomically without financial changes',async()=>{
 const h=await setup();try{const before=h.get(),db=server(h);await assign(h)({clientId:'c1',workerId:'worker-b',includeCredits:true});const after=h.get();a.equal(db.get('clients/c1').routeId,'route-b');for(const [i,c]of after.credits.entries()){a.equal(c.routeId,'route-b');a.equal(db.get('credits/'+c.id).routeId,'route-b');for(const key of ['capital','total','principalPaid','interestPaid','penaltyPaid','schedule'])a.deepEqual(c[key],before.credits[i][key])}a.deepEqual(after.payments,before.payments);a.deepEqual(after.cashMovements,before.cashMovements);a.equal(after.audit.length,1)}finally{await h.close()}
});
test('server client route changed since hydration blocks assignment with no partial metadata or grants',async()=>{
 for(const Store of [T,require('../app/core/transaction-store')]){const h=await setup();try{const before=h.get(),db=server(h,{routeId:'route-b',route:'route-b'},Store),snapshot=clone([...db]);await a.rejects(assign(h)({clientId:'c1',creditId:'credit-1',workerId:'worker-a'}),/METADATA_CLIENT_ROUTE_CHANGED/);a.deepEqual([...db],snapshot);a.deepEqual(h.get(),before)}finally{await h.close()}}
});
test('legacy contact without canonical route cannot silently gain a single-credit route; whole-portfolio materializes it',async()=>{
 const h=await setup();try{const d=h.get();delete d.clients[0].routeId;h.set(d);const before=h.get();await a.rejects(assign(h)({clientId:'c1',creditId:'credit-1',workerId:'worker-a'}),/ruta.*cliente|cliente.*cartera|todos.*créditos/i);a.deepEqual(h.get(),before);await assign(h)({clientId:'c1',workerId:'worker-a',includeCredits:true});a.equal(h.get().clients[0].routeId,'route-a')}finally{await h.close()}
});
