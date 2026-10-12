const fs=require('fs'),assert=require('assert');const d=fs.readFileSync('v2/app/durable-actions-v2.js','utf8'),r=fs.readFileSync('firestore.rules','utf8');assert(!d.includes("collection:'cash'"),'durable actions must not write undefined V2 cash collection');for(const c of ['clients','credits','payments','entries','expenses'])assert(d.includes(`collection:'${c}'`)||d.includes(`?'entries':'expenses'`),`${c} operational path missing`);for(const c of ['capital','entries','expenses','cashClosures','routes'])assert(r.includes(`'${c}'`),`${c} must be explicitly allowed by V2 manager rules`);assert(d.includes('routeId:route'),'client must persist routeId for collector authorization');assert(d.includes("r.payment.routeId=c.routeId"),'payments must bind credit routeId');const {boot}=require('./dom-harness.cjs');
(async()=>{
 const h=await boot();try{
  const state=h.get();state.credits=[{id:'fictitious-path-credit',clientId:'c1',routeId:'r1',status:'ACTIVO',capital:100,total:120,principalPaid:0,interestPaid:0,version:1,schedule:[{number:1,date:'2026-10-12',amount:120,paid:0,balance:120}]}];h.set(state);h.w.prompt=()=> '20';
  await h.w.MiCarteraV2DurableActions.collect('fictitious-path-credit');
  const operation=h.commits.find(op=>op.type==='PAYMENT'),payment=operation.entities.find(e=>e.collection==='payments').data;
  assert.equal(payment.userId,'test-admin','submitted payment must bind verified authenticated uid');
  assert.equal(payment.routeId,'r1','submitted payment must bind the selected credit route');
  const before=h.commits.length,changed=h.get();changed.session.actorId='fictitious-other-actor';h.set(changed);
  await h.w.MiCarteraV2DurableActions.collect('fictitious-path-credit');
  assert.equal(h.commits.length,before,'unverified local actor must not submit a payment');
  console.log('PASS V2 operational Firestore paths and actual verified payment uid/route.');
 }finally{await h.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});