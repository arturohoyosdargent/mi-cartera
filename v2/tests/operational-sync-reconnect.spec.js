const assert=require('assert');
const path=require('path');

function fresh(){const p=path.join(__dirname,'../cloud/operational-sync.js');delete require.cache[require.resolve(p)];return require(p)}

(async()=>{
 const listeners={},events=[];
 global.addEventListener=(name,fn)=>{listeners[name]=fn};
 global.dispatchEvent=e=>events.push(e);
 global.CustomEvent=class CustomEvent{constructor(type,init){this.type=type;this.detail=init.detail}};
 let fail=true,executed=[];
 const store={execute:async op=>{if(fail){const e=new Error('NETWORK');e.code='NETWORK';throw e}executed.push(op);return {status:'APPLIED',operationId:op.operationId}}};
 const pending=[];
 const queue={enqueue:op=>pending.push(op),flush:async fn=>{const out=[];while(pending.length)out.push(await fn(pending.shift()));return {status:'FLUSHED',count:out.length}}};
 const {createOperationalSync}=fresh();
 const sync=createOperationalSync({store,queue,actorId:'qa-device'});
 const input={operationId:'op-offline-1',type:'PAYMENT',entities:[{collection:'payments',kind:'create',data:{id:'pay-1',version:1,amount:25}}]};
 const queued=await sync.submit(input);
 assert.equal(queued.status,'QUEUED');
 assert.equal(sync.getState().status,'PENDING');
 assert.equal(pending.length,1);
 assert(listeners.online,'online reconnect listener must be installed');
 fail=false;
 await listeners.online();
 assert.equal(executed.length,1,'queued operation must execute exactly once after reconnect');
 assert.equal(executed[0].operationId,'op-offline-1','operation id must survive offline queue/reconnect');
 const state=sync.getState();
 assert.equal(state.status,'SYNCED');
 assert(state.lastFlushAt,'successful reconnect must record lastFlushAt');
 assert.equal(state.lastError,null);
 assert.equal(events.at(-1).type,'mi-cartera-v2-sync');
 assert.equal(events.at(-1).detail.ok,true);
 assert.equal(events.at(-1).detail.state.status,'SYNCED');
 console.log('operational-sync-reconnect.spec.js PASS');
})().catch(e=>{console.error(e);process.exit(1)});
