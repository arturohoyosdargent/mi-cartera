const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),path=require('path');
const source=process.env.SOURCE||path.resolve(__dirname,'..');
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),key:i=>[...data.keys()][i],get length(){return data.size}};}
function boot(localStorage=storage()){
 const events={},nodes={},createElement=()=>({style:{},dataset:{},appendChild(child){this.child=child}});const root={localStorage,navigator:{onLine:true},console,setTimeout,clearTimeout,setInterval(){},CustomEvent:class{constructor(type,v){this.type=type;this.detail=v?.detail}},addEventListener:(n,f)=>(events[n]??=[]).push(f),dispatchEvent:e=>(events[e.type]||[]).forEach(f=>f(e)),document:{visibilityState:'visible',addEventListener(){},getElementById:k=>nodes[k],createElement,querySelector:()=>({insertBefore:e=>{nodes[e.id]=e}})}};root.window=root;vm.createContext(root);
 const load=f=>vm.runInContext(fs.readFileSync(path.join(source,f),'utf8'),root,{filename:f});
 for(const f of ['core/sync-errors.js','core/offline-operation-queue.js','cloud/operational-sync.js','app/operation-sync-bridge.js'])load(f);
 root.MiCarteraV2AuthCloudGate={state:()=>({ready:true,uid:'fake-redmi',role:'admin'})};root.MiCarteraV2CloudRehydration={foreignPending:()=>false,state:()=>({})};
 const queue=root.MiCarteraV2OfflineQueue.createQueue(localStorage,'mi-cartera-v2-cloud-operations:fake-redmi');
 return {root,queue,load,nodes,configure:store=>{const sync=root.MiCarteraV2OperationalSync.createOperationalSync({store,queue,actorId:'fake-redmi'});root.MiCarteraV2SyncBridge.configure(sync);return sync}};
}
const input=()=>({operationId:'redmi-regression-7-08',type:'PAYMENT',entities:[{collection:'payments',kind:'create',data:{id:'fake-payment-7-08',amount:7.08,version:1}}]});
const turn=()=>new Promise(r=>setImmediate(r));
test('transport hangs while browser says online: journal survives process close and reconnect uses same operation',async()=>{
 const local=storage(),h=boot(local);let sending=0;h.configure({execute:()=>{sending++;return new Promise(()=>{})}});h.load('app/sync-status-ui.js');
 h.root.MiCarteraV2SyncBridge.submit(input());await turn();
 assert.equal(sending,1);assert.equal(h.queue.inspect().length,1,'Payment must be durable before network waits');assert.equal(h.queue.inspect()[0].status,'PENDIENTE');
 assert.match(h.nodes.v2SyncDetails.textContent,/pendientes|curso/i);assert.doesNotMatch(h.nodes.v2SyncDetails.textContent,/Sin operaciones pendientes/);
 const resumed=boot(local),received=[];const sync=resumed.configure({execute:async op=>{received.push(op);return {status:'APPLIED',operationId:op.id}}});await sync.flush();
 assert.equal(received.length,1);assert.equal(received[0].id,input().operationId);assert.equal(received[0].writes[0].data.amount,7.08);assert.equal(resumed.queue.inspect()[0].status,'SINCRONIZADO');
});
test('online acceptance is journalled before execute and acknowledged only on server result',async()=>{const h=boot();let writes=0;const sync=h.configure({execute:async op=>{assert.equal(h.queue.inspect()[0]?.id,op.id);assert.equal(h.queue.inspect()[0].status,'PENDIENTE');writes++;return {status:'APPLIED',operationId:op.id}}});assert.equal((await sync.submit(input())).status,'APPLIED');assert.equal(writes,1);assert.equal(h.queue.inspect()[0].status,'SINCRONIZADO');});
test('unavailable response preserves exact journal entry for retry, not a false completion',async()=>{const h=boot();const sync=h.configure({execute:async()=>{throw Object.assign(Error('offline transport'),{code:'unavailable'})}});const result=await sync.submit(input());assert.equal(result.status,'QUEUED');assert.equal(result.durable,true);assert.equal(h.queue.inspect().length,1);assert.equal(h.queue.inspect()[0].status,'ERROR');assert.equal(h.queue.inspect()[0].attempts,1);});
test('storage failure prevents network execution entirely',async()=>{const local=storage();local.setItem=()=>{throw Error('QuotaExceededError')};const h=boot(local);let calls=0;const sync=h.configure({execute:async()=>{calls++;return {status:'APPLIED'}}});await assert.rejects(sync.submit(input()),/QuotaExceededError/);assert.equal(calls,0);});
test('UI never claims no pending operations while a submit is entering durable storage',()=>{const h=boot();h.root.MiCarteraV2SyncBridge.status=()=>({configured:true,pending:1,queue:[]});h.load('app/sync-status-ui.js');h.root.dispatchEvent(new h.root.CustomEvent('mi-cartera-v2-sync'));assert.match(h.nodes.v2SyncDetails.textContent,/curso|guardando/i);assert.doesNotMatch(h.nodes.v2SyncDetails.textContent,/Sin operaciones pendientes/);});
test('pending banner opens the read-only device diagnostic without submitting anything',()=>{const h=boot(),opened=[];h.root.MiCarteraV2PendingReview={open:()=>opened.push(true)};h.root.MiCarteraV2SyncBridge.status=()=>({configured:true,pending:4,queue:[{status:'ERROR'},{status:'ERROR'},{status:'ERROR'},{status:'ERROR'}]});h.load('app/sync-status-ui.js');h.root.dispatchEvent(new h.root.CustomEvent('mi-cartera-v2-sync'));const button=h.nodes.v2SyncDetails.child;assert.equal(button.textContent,'Ver operaciones locales (solo lectura)');button.onclick();assert.equal(opened.length,1);});
test('review: permanent rejection remains journalled and cannot be reported as accepted',async()=>{
 const h=boot(),denial=Object.assign(Error('payment denied'),{code:'permission-denied'});
 const sync=h.configure({execute:async()=>{throw denial}});
 await assert.rejects(sync.submit(input()),error=>error===denial);
 assert.equal(h.queue.inspect().length,1);assert.equal(h.queue.inspect()[0].id,input().operationId);
 assert.equal(h.queue.inspect()[0].status,'BLOQUEADO');assert.equal(sync.getState().status,'ERROR');
});
test('review: unrecognised executor result cannot acknowledge the durable journal',async()=>{
 const h=boot(),sync=h.configure({execute:async()=>({status:'UNKNOWN_RESPONSE'})});
 await assert.rejects(sync.submit(input()),/UNKNOWN_EXECUTOR_RESULT/);
 assert.equal(h.queue.inspect()[0].status,'BLOQUEADO');assert.equal(h.queue.inspect()[0].lastError,'UNKNOWN_EXECUTOR_RESULT');
});
