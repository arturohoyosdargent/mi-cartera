const assert=require('assert'),fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('v2/app/cloud-rehydration-v2.js','utf8'),shell=fs.readFileSync('v2/app/operational-shell.html','utf8');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),dump:k=>m.get(k)}}
async function main(){
 assert(shell.includes('<script src="cloud-rehydration-v2.js"></script>'),'shell must load cloud rehydration');
 const local=storage({'mi-cartera-v2-validation-state':JSON.stringify({clients:[{id:'old'}],audit:[]})});
 const rows={clients:[{id:'c1'}],credits:[{id:'cr1'}],payments:[{id:'p1'}],entries:[{id:'e1',type:'INGRESO'}],expenses:[{id:'x1',type:'EGRESO'}]};
 const listeners={};class CE{constructor(name,o={}){this.type=name;this.detail=o.detail}}
 const window={localStorage:local,CustomEvent:CE,addEventListener:(n,f)=>listeners[n]=f,dispatchEvent(){},MiCarteraV2AuthCloudGate:{requireReady:()=>({uid:'u1',role:'admin'})}};
 window.firestoreV2={db:{},collection:(db,...p)=>p[p.length-1],getDocs:async name=>({forEach(fn){for(const x of rows[name])fn({id:x.id,data:()=>x})}})};
 vm.runInNewContext(src,{window});assert.equal(window.MiCarteraV2CloudRehydration.pending(),false);
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
 const d=JSON.parse(local.dump('mi-cartera-v2-validation-state'));assert.equal(d.clients[0].id,'c1');assert.equal(d.credits[0].id,'cr1');assert.equal(d.payments[0].id,'p1');assert.equal(d.cashMovements.length,2);
 local.setItem('mi-cartera-v2-cloud-operations',JSON.stringify([{status:'PENDIENTE'}]));assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'SKIPPED_PENDING_LOCAL_OPERATIONS');
 // Second-device regression: a repeated authenticated hydration must replace, not duplicate, Cloud rows.
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'SKIPPED_PENDING_LOCAL_OPERATIONS');
 local.setItem('mi-cartera-v2-cloud-operations','[]');
 assert.equal((await window.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
 const d2=JSON.parse(local.dump('mi-cartera-v2-validation-state'));assert.equal(d2.clients.length,1);assert.equal(d2.credits.length,1);assert.equal(d2.payments.length,1);assert.equal(d2.cashMovements.length,2);
 console.log('V2 cloud rehydration guard: PASS');
}main().catch(e=>{console.error(e);process.exit(1)});
