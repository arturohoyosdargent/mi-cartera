const Q=require('../core/offline-operation-queue');
function queue(observed=[]){const m=new Map();const q=Q.createQueue({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)});const enqueue=q.enqueue;q.enqueue=async op=>{const item=await enqueue(op);if(!observed.some(x=>x.id===op.id))observed.push(op);return item};return q}
module.exports={queue};
