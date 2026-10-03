const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function boot(withPending=true){
 const key='mi-cartera-v2-cloud-operations:qa-redmi',journal=JSON.stringify([0,1,2,3].map(i=>({id:'fictional-'+i,status:['PENDIENTE','ERROR','CONFLICTO','BLOQUEADO'][i],attempts:i,nextAttemptAt:0,createdAt:'2026-10-03T14:00:00Z',operation:{id:'fictional-'+i,operationId:'fictional-'+i,actorId:'qa-redmi',type:'PAYMENT',writes:[{kind:'create',path:'payments/fictional-'+i,data:{id:'fictional-'+i,amount:7+i},expectedVersion:0}]}})),null,2);
 const data=new Map(withPending?[[key,journal]]:[]),timers=[],listeners={};let calls=0;
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),key:i=>[...data.keys()][i],get length(){return data.size}};
 const c={console,localStorage:storage,navigator:{onLine:true},setTimeout:(f,ms)=>{if(ms===0){timers.push(f);return 0}return setTimeout(f,ms)},clearTimeout,setInterval(){},document:{visibilityState:'visible',addEventListener(){},getElementById:()=>null,createElement:()=>({style:{}}),querySelector:()=>({insertBefore(){}})},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},addEventListener:(n,f)=>(listeners[n]??=[]).push(f),removeEventListener(){},dispatchEvent:e=>(listeners[e.type]||[]).forEach(f=>f(e))};c.window=c;
 c.MiCarteraV2VersionGuard={requireReady(){}};c.MiCarteraV2AuthCloudGate={requireReady:()=>({uid:'qa-redmi',role:'admin'}),state:()=>({ready:true,uid:'qa-redmi',role:'admin'})};c.MiCarteraV2PilotConfig={evaluate:()=>({ready:true})};c.MiCarteraV2FirestoreAdapter={createFirestoreAtomicAdapter:()=>({})};c.MiCarteraV2Store={createStore:()=>({execute:async()=>{calls++;return {status:'APPLIED'}}})};
 vm.createContext(c);const load=p=>vm.runInContext(fs.readFileSync('v2/'+p,'utf8'),c,{filename:p});
 for(const p of ['core/sync-errors.js','core/offline-operation-queue.js','cloud/operational-sync.js','app/operation-sync-bridge.js','cloud/runtime-cloud.js'])load(p);
 const runtime=c.MiCarteraV2CloudRuntime.configure({orgId:'v2-mi-cartera-pilot'});
 return {c,load,runtime,timers,key,journal,storage,calls:()=>calls};
}
test('four preexisting journal entries remain exact through startup online focus timer and explicit flush',async()=>{
 const h=boot();h.load('app/sync-status-ui.js');for(const f of h.timers)await f();h.c.dispatchEvent(new h.c.CustomEvent('online'));h.c.dispatchEvent(new h.c.CustomEvent('focus'));await new Promise(r=>setImmediate(r));
 a.equal((await h.runtime.flush()).status,'REVIEW_REQUIRED');a.equal(h.calls(),0);a.equal(h.storage.getItem(h.key),h.journal);a.equal(h.c.MiCarteraV2SyncBridge.status().reviewRequired,true);
 await a.rejects(h.c.MiCarteraV2SyncBridge.submit({operationId:'new',type:'PAYMENT',entities:[{collection:'payments',kind:'create',data:{id:'new',amount:1}}]}),/pendientes.*revisión|REVIEW_REQUIRED/i);a.equal(h.calls(),0);a.equal(h.storage.getItem(h.key),h.journal);
});
test('a device with no preexisting pending journal keeps normal online acceptance',async()=>{const h=boot(false);const r=await h.c.MiCarteraV2SyncBridge.submit({operationId:'fresh',type:'PAYMENT',entities:[{collection:'payments',kind:'create',data:{id:'fresh',amount:1}}]});a.equal(r.status,'APPLIED');a.equal(h.calls(),1);a.equal(h.c.MiCarteraV2SyncBridge.status().reviewRequired,false)});
