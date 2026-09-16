// Mi Cartera PRO V2 — isolated runtime composition root.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2Runtime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function createRuntime(deps){const {financial:F,operations:O,store,queue}=deps||{};if(!F||!O||!store||!queue)throw new Error('V2_RUNTIME_DEPS_REQUIRED');
 async function commitOrQueue(operation,online=true){if(!online){queue.enqueue(operation);return {status:'QUEUED',operationId:operation.id};}try{return await store.execute(operation);}catch(e){const msg=String(e?.message||e);if(/RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|NETWORK|OFFLINE/i.test(msg)){queue.enqueue(operation);return {status:'QUEUED',operationId:operation.id,error:msg};}throw e;}}
 async function pay(credit,input,online=true){const result=F.allocatePayment(credit,input);return {domain:result,persistence:await commitOrQueue(O.payment(result),online)};}
 async function renewInterest(credit,input,online=true){const result=F.interestRenewal(credit,input);return {domain:result,persistence:await commitOrQueue(O.interestRenewal(result),online)};}
 async function refinance(credit,input,online=true){const result=F.refinance(credit,input);return {domain:result,persistence:await commitOrQueue(O.refinance(result),online)};}
 async function sync(){return queue.flush(op=>store.execute(op));}
 return {pay,renewInterest,refinance,sync,inspectQueue:queue.inspect};}
return {createRuntime};});