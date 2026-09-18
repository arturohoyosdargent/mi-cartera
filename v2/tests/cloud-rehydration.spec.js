const assert=require('assert'),fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('v2/app/cloud-rehydration-v2.js','utf8'),shell=fs.readFileSync('v2/app/operational-shell.html','utf8');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),dump:k=>m.get(k)}}
async function main(){
 assert(shell.includes('<script src="cloud-rehydration-v2.js"></script>'),'shell must load cloud rehydration');
 const local=storage({'mi-cartera-v2-validation-state':JSON.stringify({clients:[{id:'old'}],audit:[]})});
 const rows={clients:[{id:'c1'}],credits:[{id:'cr1',status:'ACTIVE',schedule:[{number:1,date:'2026-09-17',amount:60,paid:60,balance:0,status:'PAGADA'},{number:2,date:'2026-09-24',amount:60,paid:20,balance:40,status:'PARCIAL'},{number:3,date:'2026-10-01',amount:60,paid:0,balance:60,status:'PENDIENTE'}]}],payments:[{id:'p1',creditId:'cr1',amount:60}],entries:[{id:'e1',type:'INGRESO'}],expenses:[{id:'x1',type:'EGRESO'}]};
 const listeners={};class CE{constructor(name,o={}){this.type=name;this.detail=o.detail}}
 const window={localStorage:local,CustomEvent:CE,addEventListener:(n,f)=>listeners[n]=f,dispatchEvent(){},MiCarteraV2AuthCloudGate:{requireReady:()=>({uid:'u1',role:'admin'})}};
 window.firestoreV2={db:{},collection:(db,...p)=>p[p.length-1],getDocs:async name=>({forEach(fn){for(const x of rows[name])fn({id:x.id,data:()=>x})}})};
 vm.runInNewContext(src,{window});assert.equal(window.MiCarteraV2CloudRehydration.pending(),false);
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
 const d=JSON.parse(local.dump('mi-cartera-v2-validation-state'));assert.equal(d.clients[0].id,'c1');assert.equal(d.credits[0].id,'cr1');assert.equal(d.payments[0].id,'p1');assert.equal(d.cashMovements.length,2);assert.equal(d.credits[0].schedule[0].status,'PAGADA');assert.equal(d.credits[0].schedule[0].balance,0);assert.equal(d.credits[0].schedule[1].status,'PARCIAL');assert.equal(d.credits[0].schedule[1].paid,20);assert.equal(d.credits[0].schedule[1].balance,40);assert.equal(d.credits[0].schedule[2].balance,60);
 local.setItem('mi-cartera-v2-cloud-operations',JSON.stringify([{status:'PENDIENTE'}]));assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'SKIPPED_PENDING_LOCAL_OPERATIONS');
 // Second-device regression: a repeated authenticated hydration must replace, not duplicate, Cloud rows.
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'SKIPPED_PENDING_LOCAL_OPERATIONS');
 local.setItem('mi-cartera-v2-cloud-operations','[]');
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
 const d2=JSON.parse(local.dump('mi-cartera-v2-validation-state'));assert.equal(d2.clients.length,1);assert.equal(d2.credits.length,1);assert.equal(d2.payments.length,1);assert.equal(d2.cashMovements.length,2);
 // Collector regression: route-scoped reads only, own payments only, and local cash is preserved.
 const local2=storage({'mi-cartera-v2-validation-state':JSON.stringify({cashMovements:[{id:'local-cash'}]})}),calls=[];
 const w2={localStorage:local2,CustomEvent:CE,addEventListener(){},dispatchEvent(){},MiCarteraV2AuthCloudGate:{requireReady:()=>({uid:'collector-1',role:'cobrador',routeIds:['R1','R2']})}};
 w2.firestoreV2={db:{},collection:(db,...p)=>({name:p[p.length-1]}),where:(field,op,value)=>({field,op,value}),query:(base,clause)=>({base,clause}),getDocs:async ref=>{calls.push(ref);return{forEach(){}}}};
 vm.runInNewContext(src,{window:w2});assert.equal((await w2.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
 assert.equal(calls.length,5);assert(calls.every(x=>x.clause),'collector must never perform unrestricted collection reads');assert.equal(calls.filter(x=>x.base.name==='clients'&&x.clause.field==='routeId').length,2);assert.equal(calls.filter(x=>x.base.name==='credits'&&x.clause.field==='routeId').length,2);assert.equal(calls.filter(x=>x.base.name==='payments'&&x.clause.field==='userId'&&x.clause.value==='collector-1').length,1);assert.equal(JSON.parse(local2.dump('mi-cartera-v2-validation-state')).cashMovements[0].id,'local-cash');
 console.log('V2 cloud rehydration guard: PASS');
}main().catch(e=>{console.error(e);process.exit(1)});
