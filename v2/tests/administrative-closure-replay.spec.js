// Fictional queues/transports only. No Firebase and no real administrative journal is loaded.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const APIs=[['source',require('../core/offline-operation-queue.js')],['hosted',require('../app/core/offline-operation-queue.js')]];
const clone=x=>JSON.parse(JSON.stringify(x));
function record(id,status='PENDIENTE',extra={}){return {id,operation:{id,operationId:id,type:'PAYMENT',actorId:'fictional-owner',writes:[]},status,attempts:0,nextAttemptAt:0,createdAt:'2026-10-03T15:16:30.000Z',lastError:null,...extra};}
function storage(rows){
 const key='mi-cartera-v2-cloud-operations:fictional-owner',closedKey='mi-cartera-v2-journal-admin-closures:'+key;
 const raw=' \n'+JSON.stringify(rows,null,2)+'\n ',closedRaw=' [{"id":"fictional-closed-ledger","noReplay":true}]\n';
 const values=new Map([[key,raw],[closedKey,closedRaw]]),writes=[];
 return {key,raw,closedKey,closedRaw,values,writes,getItem:k=>values.get(k)||null,setItem:(k,v)=>{writes.push(k);values.set(k,String(v))}};
}

// Skipping only CERRADO_ADMIN would still replay a protected ERROR/PENDIENTE row.
for(const [name,Q] of APIs)for(const fixture of [
 {status:'CERRADO_ADMIN'},
 {status:'ERROR',administrativeClosure:{kind:'ADMINISTRATIVE_LOCAL_CLOSURE',noReplay:true,serverApplied:'NOT_VERIFIED'}},
 {status:'PENDIENTE',administrativeClosure:{kind:'ADMINISTRATIVE_LOCAL_CLOSURE',noReplay:true}},
 {status:'CERRADO_ADMIN',administrativeClosure:{kind:'ADMINISTRATIVE_LOCAL_CLOSURE',noReplay:true}}
])test(name+' closed or noReplay queue stays byte-identical through enqueue and repeated flush: '+fixture.status+Boolean(fixture.administrativeClosure),async()=>{
 const item=record('fictional-protected',fixture.status,fixture),s=storage([item]),q=Q.createQueue(s,s.key);let calls=0;
 const returned=q.enqueue({...item.operation,writes:[{kind:'create',path:'payments/fictional-new',data:{amount:999}}]});
 a.deepEqual(returned,item,'same operation ID must preserve its closed payload');
 for(let i=0;i<2;i++){const r=await q.flush(async()=>{calls++;return {status:'APPLIED'}},1000+i);a.equal(r.pending,0);a.equal(r.applied,0);}
 a.equal(calls,0,'protected operation must never reach the executor');a.equal(s.writes.length,0);a.equal(s.getItem(s.key),s.raw);a.equal(s.getItem(s.closedKey),s.closedRaw);
});

// Removing normal retry execution would keep the closure safe but strand legitimate pending operations.
for(const [name,Q] of APIs)test(name+' mixed journal preserves closures while ordinary pending operations retry and apply',async()=>{
 const closed=record('fictional-admin-closed','CERRADO_ADMIN',{administrativeClosure:{noReplay:true,confirmedAt:'2026-10-03T18:23:59.000Z'}}),reserved=record('fictional-noReplay','ERROR',{administrativeClosure:{noReplay:true}}),pending=record('fictional-pending'),s=storage([closed,reserved,pending]),q=Q.createQueue(s,s.key),seen=[];
 let result=await q.flush(async operation=>{seen.push(operation.id);throw Error('RESOURCE_EXHAUSTED')},1000);
 a.equal(result.failed,1);a.equal(result.pending,1);a.deepEqual(seen,['fictional-pending']);
 result=await q.flush(async operation=>{seen.push(operation.id);return {status:'APPLIED'}},1500);a.equal(result.applied,0);a.deepEqual(seen,['fictional-pending']);
 result=await q.flush(async operation=>{seen.push(operation.id);return {status:'APPLIED'}},3000);a.equal(result.applied,1);a.equal(result.pending,0);a.deepEqual(seen,['fictional-pending','fictional-pending']);
 const after=JSON.parse(s.getItem(s.key));a.deepEqual(after[0],closed);a.deepEqual(after[1],reserved);a.equal(after[2].status,'SINCRONIZADO');a.equal(s.getItem(s.closedKey),s.closedRaw);
 const settled=s.getItem(s.key),writeCount=s.writes.length;await q.flush(async()=>{throw Error('No terminal operation may execute')},4000);a.equal(s.getItem(s.key),settled);a.equal(s.writes.length,writeCount);
});

test('actual hosted runtime flush and both reconnect listeners cannot replay an admin closure',async()=>{
 const closed=record('fictional-admin-closed','CERRADO_ADMIN',{administrativeClosure:{noReplay:true}}),s=storage([closed]),listeners=[],executed=[],w={navigator:{onLine:true},localStorage:s,addEventListener:(event,fn)=>{if(event==='online')listeners.push(fn)}};
 w.MiCarteraV2VersionGuard={requireReady(){}};w.MiCarteraV2AuthCloudGate={requireReady:()=>({uid:'fictional-owner',role:'admin'})};w.MiCarteraV2PilotConfig={evaluate:()=>({ready:true})};
 w.MiCarteraV2FirestoreAdapter={createFirestoreAtomicAdapter:()=>({})};w.MiCarteraV2Store={createStore:()=>({execute:async operation=>{executed.push(clone(operation));return {status:'APPLIED'}}})};w.MiCarteraV2SyncBridge={configure(){}};
 const context=vm.createContext({window:w,globalThis:w});
 for(const file of ['core/sync-errors.js','core/offline-operation-queue.js','cloud/operational-sync.js','cloud/runtime-cloud.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../app',file),'utf8'),context,{filename:file});
 const runtime=w.MiCarteraV2CloudRuntime.configure({mode:'PILOT',cloudEnabled:true,allowRealWrites:true,orgId:'v2-mi-cartera-pilot'});
 a.equal((await runtime.flush()).pending,0);for(const listener of listeners)await listener();a.equal(executed.length,0);a.equal(s.getItem(s.key),s.raw);a.equal(s.getItem(s.closedKey),s.closedRaw);
 // The ordinary operation continues to flush through the same real runtime wiring.
 const q=w.MiCarteraV2OfflineQueue.createQueue(s,s.key);q.enqueue(record('fictional-new').operation);for(const listener of listeners)await listener();a.deepEqual(executed.map(row=>row.id),['fictional-new']);a.deepEqual(JSON.parse(s.getItem(s.key))[0],closed);
});
