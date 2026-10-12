// Regression tests execute the real hydration module with fictional transport/storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('v2/app/cloud-rehydration-v2.js','utf8');
const K='mi-cartera-v2-validation-state',OWNER='mi-cartera-v2-local-owner';
const A='fictional-admin-A',B='fictional-collector-B',Q='mi-cartera-v2-cloud-operations:'+A;
const clone=value=>JSON.parse(JSON.stringify(value));
const empty=()=>({clients:[],credits:[],payments:[],cashMovements:[],audit:[],commercial:[],session:{actorId:A,role:'admin',routeIds:[]}});
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
function harness(initial=empty(),options={}){
 const storage=new Map([[K,JSON.stringify(initial)],[OWNER,A]]),remote=new Map(),listeners={},events=[];
 let identity={uid:A,role:'admin',ready:true,authenticated:true,routeIds:[]},reads=0;
 const window={localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),key:i=>[...storage.keys()][i],get length(){return storage.size}},navigator:{onLine:true},CustomEvent:class{constructor(type,arg){this.type=type;this.detail=arg.detail}},addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:event=>events.push(event),MiCarteraV2AuthCloudGate:{state:()=>clone(identity),requireReady(){if(!identity.ready)throw Error('V2_AUTH_NOT_READY');return clone(identity)}}};
 window.firestoreV2={db:{},collection:(_,orgs,org,name)=>({name}),doc:(_,orgs,org,name,id)=>name+'/'+id,
  where:(field,op,value)=>({field,op,value}),query:(base,clause)=>({...base,clause}),
  getDocs:async ref=>{const rows=[...remote].filter(([key,row])=>key.startsWith(ref.name+'/')&&(!ref.clause||row[ref.clause.field]===ref.clause.value)).map(([,row])=>clone(row));await options.readHook?.(++reads,ref.name);return {forEach:fn=>rows.forEach(row=>fn({id:row.id,data:()=>clone(row)}))}},
  setDoc:async(key,value)=>{await options.writeHook?.(key,remote);remote.set(key,{...(remote.get(key)||{}),...clone(value)})},
  runTransaction:async(_,fn)=>{await options.transactionHook?.(remote);const staged=new Map(remote);const result=await fn({get:async key=>({exists:()=>staged.has(key),data:()=>clone(staged.get(key))}),set:(key,value)=>staged.set(key,clone(value))});remote.clear();for(const row of staged)remote.set(...row);return result}};
 if(options.disableWrites){delete window.firestoreV2.setDoc;delete window.firestoreV2.runTransaction;}
 vm.runInNewContext(source,{window,console:{warn(){}}});
 return {window,storage,remote,listeners,events,setIdentity:value=>identity=value,read:()=>JSON.parse(storage.get(K))};
}
const tests=[];
function test(name,run){tests.push({name,run});}

test('logout during Cloud read cannot restore the old session or apply its snapshot',async()=>{
 const waiting=deferred(),started=deferred(),h=harness(empty(),{disableWrites:true,readHook:async n=>{if(n===1){started.resolve();await waiting.promise;}}});
 h.remote.set('clients/fictional-client-A',{id:'fictional-client-A',name:'CLIENTE FICTICIO A'});
 const running=h.listeners['v2-auth-cloud-state']({detail:{ready:true,authenticated:true}});
 await started.promise;
 h.setIdentity({uid:null,role:null,ready:false,authenticated:false,routeIds:[]});
 await h.listeners['v2-auth-cloud-state']({detail:{ready:false,authenticated:false,preserveLocal:true}});
 waiting.resolve();await running;
 assert.equal(h.read().session,null,'delayed hydration must not restore logged-out actor A');
 assert.deepEqual(h.read().clients,[],'delayed snapshot must not populate logged-out state');
 assert.equal(h.events.some(event=>event.type==='mi-cartera-v2-sync'&&event.detail.source==='cloud-rehydration'),false);
});

test('actor change during Cloud read hydrates the latest actor with scoped data',async()=>{
 const waiting=deferred(),started=deferred(),h=harness(empty(),{disableWrites:true,readHook:async n=>{if(n===1){started.resolve();await waiting.promise;}}});
 h.remote.set('clients/fictional-client-A',{id:'fictional-client-A',routeId:'fictional-route-A'});
 h.remote.set('clients/fictional-client-B',{id:'fictional-client-B',routeId:'fictional-route-B'});
 h.remote.set('payments/fictional-payment-A',{id:'fictional-payment-A',userId:A,amount:20});
 h.remote.set('payments/fictional-payment-B',{id:'fictional-payment-B',userId:B,amount:30});
 const running=h.listeners['v2-auth-cloud-state']({detail:{ready:true,authenticated:true}});
 await started.promise;
 const next={uid:B,role:'cobrador',ready:true,authenticated:true,routeIds:['fictional-route-B']};
 h.setIdentity(next);const switched=h.listeners['v2-auth-cloud-state']({detail:next});
 waiting.resolve();await Promise.all([running,switched]);
 assert.equal(h.read().session.actorId,B,'latest ready actor must not be skipped behind A');
 assert.equal(h.read().session.role,'cobrador');
 assert.deepEqual(h.read().session.routeIds,['fictional-route-B']);
 assert.deepEqual(h.read().clients.map(row=>row.id),['fictional-client-B']);
 assert.deepEqual(h.read().payments.map(row=>row.id),['fictional-payment-B']);
});

test('pending payment created during Cloud read preserves the newest local state',async()=>{
 const waiting=deferred(),started=deferred(),h=harness(empty(),{disableWrites:true,readHook:async n=>{if(n===1){started.resolve();await waiting.promise;}}});
 h.remote.set('credits/fictional-credit',{id:'fictional-credit',version:1,schedule:[{number:1,amount:100,paid:0,balance:100}]});
 const running=h.window.MiCarteraV2CloudRehydration.rehydrate();await started.promise;
 h.storage.set(Q,JSON.stringify([{id:'fictional-pending',status:'PENDIENTE'}]));
 const next=empty();next.credits=[{id:'fictional-credit',version:2,schedule:[{number:1,amount:100,paid:25,balance:75}]}];next.payments=[{id:'fictional-local-payment',creditId:'fictional-credit',amount:25}];
 h.storage.set(K,JSON.stringify(next));waiting.resolve();await running;
 assert.equal(h.read().credits[0].schedule[0].balance,75,'pending local balance must not revert to Cloud balance 100');
 assert.equal(h.read().credits[0].version,2);
 assert.deepEqual(h.read().payments.map(row=>row.id),['fictional-local-payment']);
 assert.equal(h.window.MiCarteraV2CloudRehydration.pending(),true);
});

test('Cloud ID created after the snapshot keeps its newer version and local balance',async()=>{
 const initial=empty();initial.credits=[{id:'fictional-collision',version:1,schedule:[{number:1,amount:100,paid:0,balance:100}]}];
 const collide=remote=>remote.set('credits/fictional-collision',{id:'fictional-collision',version:2,schedule:[{number:1,amount:100,paid:25,balance:75}]});
 const h=harness(initial,{writeHook:async(key,remote)=>{if(key==='credits/fictional-collision')collide(remote);},transactionHook:async remote=>collide(remote)});
 await h.window.MiCarteraV2CloudRehydration.rehydrate();
 assert.equal(h.remote.get('credits/fictional-collision').version,2,'missing-ID upload must not overwrite a concurrent Cloud version');
 assert.equal(h.remote.get('credits/fictional-collision').schedule[0].balance,75);
 assert.equal(h.read().credits[0].version,2);
 assert.equal(h.read().credits[0].schedule[0].balance,75);
});

test('existing or concurrent Cloud tombstones cannot be resurrected by missing-ID local merges',async()=>{
 for(const timing of ['snapshot','transaction']){
  const initial=empty();
  initial.clients=[{id:'fictional-deleted-client',name:'CLIENTE FICTICIO'}];
  initial.credits=[{id:'fictional-deleted-credit',amount:100,schedule:[{number:1,amount:100,paid:0,balance:100}]}];
  initial.payments=[{id:'fictional-deleted-payment',creditId:'fictional-deleted-credit',amount:25}];
  initial.cashMovements=[{id:'fictional-deleted-entry',type:'INGRESO',amount:100},{id:'fictional-deleted-expense',type:'EGRESO',amount:10}];
  initial.audit=[{id:'fictional-deleted-audit',action:'FICTIONAL_RECORD'}];
  const tombstones=remote=>{for(const [name,rows] of [['clients',initial.clients],['credits',initial.credits],['payments',initial.payments],['entries',[initial.cashMovements[0]]],['expenses',[initial.cashMovements[1]]],['audit',initial.audit]])for(const row of rows)remote.set(name+'/'+row.id,{id:row.id,tombstone:true,deletedAt:'2026-10-10T00:00:00Z'});};
  const h=harness(initial,timing==='transaction'?{transactionHook:async remote=>tombstones(remote)}:{});
  if(timing==='snapshot')tombstones(h.remote);
  await h.window.MiCarteraV2CloudRehydration.rehydrate();
  for(const name of ['clients','credits','payments','cashMovements','audit'])assert.deepEqual(h.read()[name],[],timing+': Cloud-deleted '+name+' must stay hidden');
  for(const row of h.remote.values()){assert.equal(row.tombstone,true);assert.equal(row.amount,undefined,'local financial fields must never overwrite Cloud tombstones');}
 }
});

test('an initially live Cloud row tombstoned during another upload cannot reappear locally',async()=>{
 const initial=empty();initial.clients=[{id:'fictional-existing-A'},{id:'fictional-new-B'}];
 const h=harness(initial,{transactionHook:async remote=>remote.set('clients/fictional-existing-A',{id:'fictional-existing-A',tombstone:true,deletedAt:'2026-10-11T00:00:00Z'})});
 h.remote.set('clients/fictional-existing-A',{id:'fictional-existing-A'});
 await h.window.MiCarteraV2CloudRehydration.rehydrate();
 assert.equal(h.remote.get('clients/fictional-existing-A').tombstone,true,'Cloud deletion must remain intact');
 assert.deepEqual(h.read().clients.map(row=>row.id),['fictional-new-B'],'local fallback must not restore the initially live row hidden by the reread');
 assert.equal(h.remote.get('clients/fictional-new-B').id,'fictional-new-B','the unrelated missing-ID upload must still succeed');
});

(async()=>{let failures=0;for(const {name,run} of tests){try{await run();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`Cloud hydration race regressions: ${tests.length-failures}/${tests.length} passed`);if(failures)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
