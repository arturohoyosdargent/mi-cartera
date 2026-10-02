const {test}=require('node:test'),a=require('node:assert/strict');
const {createQueue}=require('../core/offline-operation-queue.js');
const {createOperationalSync}=require('../cloud/operational-sync.js');
test('hanging transport releases submit and preserves ordered retry with same IDs',async()=>{
 const mem=new Map(),queue=createQueue({getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)});let attempts=0;
 const sync=createOperationalSync({queue,requestTimeoutMs:20,store:{execute:()=>{attempts++;return new Promise(()=>{})}}});
 const first=await sync.submit({operationId:'first',entities:[]});a.equal(first.status,'QUEUED');a.equal(first.durable,true);a.equal(queue.inspect()[0].status,'ERROR');
 const next=await sync.submit({operationId:'second',entities:[]});a.equal(next.status,'QUEUED');a.equal(attempts,1);
 const seen=[];await queue.flush(async op=>{seen.push(op.id);return {status:'ALREADY_APPLIED'}},Date.now()+10000);
 a.deepEqual(seen,['first','second']);a.equal(queue.inspect().filter(x=>x.status!=='SINCRONIZADO').length,0);
});
