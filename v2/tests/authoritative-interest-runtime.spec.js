'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(process.env.SOURCE||path.join(__dirname,'..')),F=require('../core/financial-engine'),S=require('../core/schedule-engine'),Q=require('../core/offline-operation-queue'),O=require('../cloud/operational-sync');
const {createInterestRenewalService}=require('../../functions/v2-interest-renewal');
const clone=x=>JSON.parse(JSON.stringify(x)),base='orgs/v2-mi-cartera-pilot/';
function fixture({role='admin',unavailable=false}={}){
 const old={id:'old-credit',clientId:'same-client',routeId:'route-a',workerId:'worker-a',capital:100,total:120,rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-01',amount:120,paid:0,balance:120}]};
 const d=F.interestRenewal(old,{newCreditId:'new-credit',paymentId:'interest-pay',interestAmount:20,date:'2026-11-23',rate:20,term:2,freq:'weekly',operationId:'renew-op'});
 Object.assign(d.newCredit,{renewalMode:'INTEREST',routeId:'route-a',firstPaymentDate:'2026-11-30',requestedFirstPaymentDate:'2026-11-30',restDay:'',schedule:S.generate({total:120,term:2,freq:'weekly',firstPaymentDate:'2026-11-30'})});
 let docs=new Map([[base+'members/actor',{active:true,role,routeIds:['route-a']}],[base+'credits/old-credit',old]]),direct=0,auth={uid:'actor',role,ready:true,routeIds:['route-a']},lastInput;
 const service=createInterestRenewalService({now:()=> '2026-11-23T18:00:00.000Z',runAtomic:async fn=>{const draft=new Map([...docs].map(([k,v])=>[k,clone(v)]));const r=await fn({get:async k=>draft.get(k)||null,set:async(k,v)=>draft.set(k,clone(v)),create:async(k,v)=>{if(draft.has(k))throw Error('COLLISION');draft.set(k,clone(v))}});docs=draft;return r}});
 const storage=new Map([['mi-cartera-v2-local-owner','actor']]),w={navigator:{onLine:true},addEventListener(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},MI_CARTERA_V2_PILOT_CONFIG:{backendMode:'b2-compatible'},MI_CARTERA_V2_FIREBASE_TEMPLATE:{projectId:'demo-mi-cartera-v2'},MiCarteraV2VersionGuard:{requireReady(){}},MiCarteraV2AuthCloudGate:{requireReady:()=>({...auth})},MiCarteraV2PilotConfig:{evaluate:()=>({ready:true})},MiCarteraV2FirestoreAdapter:{createFirestoreAtomicAdapter:()=>({runAtomic:async()=>{direct++;throw Error('BROWSER_FINANCIAL_WRITE_FORBIDDEN')}})},MiCarteraV2Store:require('../core/transaction-store'),MiCarteraV2OfflineQueue:Q,MiCarteraV2OperationalSync:O,MiCarteraV2SyncBridge:{configure(sync){this.sync=sync}},firebaseFunctionsV2:{recordInterestRenewal:async input=>{lastInput=clone(input);if(unavailable)throw Object.assign(Error('Unavailable'),{code:'functions/unavailable'});return service.execute({uid:auth.uid},input)}}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'app/cloud/runtime-cloud.js'),'utf8'),{window:w});
 const runtime=w.MiCarteraV2CloudRuntime.configure({orgId:'v2-mi-cartera-pilot',db:{},doc(){},runTransaction(){}});
 const payload={operationId:'renew-op',type:'INTEREST_RENEWAL',entities:[{collection:'credits',kind:'set',data:d.oldCredit},{collection:'credits',kind:'create',data:d.newCredit},{collection:'payments',kind:'create',data:{...d.payment,version:1,userId:'actor'}},{collection:'entries',kind:'create',data:{id:'interest-cash',amount:20,ref:'interest-pay',version:1}}],audit:{id:'client-audit',actorId:'actor',action:'INTEREST_RENEWAL'}};
 return {w,runtime,payload,submit:()=>w.MiCarteraV2SyncBridge.sync.submit(payload),direct:()=>direct,input:()=>lastInput,read:k=>docs.get(base+k),change:()=>{auth={...auth,uid:'other-actor'}}};
}
for(const role of ['admin','supervisor'])test(role+' B2 interest renewal dispatches to backend with terms only and preserves canonical receipt',async()=>{
 const h=fixture({role}),r=await h.submit();a.equal(r.status,'APPLIED');a.equal(h.direct(),0);a.equal(r.result.payment.amount,20);a.equal(h.read('entries/interest-cash').amount,20);a.equal(h.input().interestAmount,undefined);a.equal(h.input().schedule,undefined);a.equal(h.input().newCreditId,'new-credit');a.equal((await h.submit()).status,'ALREADY_APPLIED');
});
test('collector and replacement account cannot send interest renewal financial writes',async()=>{
 const denied=fixture({role:'cobrador'});await a.rejects(denied.submit());a.equal(denied.direct(),0);a.equal(denied.read('payments/interest-pay'),undefined);
 const changed=fixture();changed.change();await a.rejects(changed.submit(),/ACTOR_CHANGED/);a.equal(changed.direct(),0);
});
test('unavailable interest renewal stays unconfirmed and never queues a financial snapshot',async()=>{
 const h=fixture({unavailable:true});await a.rejects(h.submit(),/Unavailable/);a.equal(h.direct(),0);a.equal(h.runtime.inspect().length,0);a.equal(h.read('credits/old-credit').version,1);
});

const {boot}=require('./dom-harness.cjs');
async function renewalUI({malformed=false}={}){
 const h=await boot(),d=h.get(),old={id:'ui-old-credit',clientId:'c1',routeId:'r1',workerId:'local-worker',capital:100,total:120,rate:20,term:2,freq:'weekly',principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-01',amount:120,paid:0,balance:120}]};
 d.credits=[old];d.payments=[];d.cashMovements=[];d.audit=[];h.set(d);h.w.MiCarteraV2Dates.today=()=> '2026-11-23';h.w.MI_CARTERA_V2_PILOT_CONFIG={backendMode:'b2-compatible',orgId:'v2-mi-cartera-pilot'};
 let docs=new Map([[base+'members/test-admin',{active:true,role:'admin'}],[base+'credits/'+old.id,{...old,workerId:'verified-server-worker'}]]),accepted;
 const service=createInterestRenewalService({now:()=> '2026-11-23T18:00:00.000Z',runAtomic:async fn=>{const draft=new Map([...docs].map(([k,v])=>[k,clone(v)]));const out=await fn({get:async k=>draft.get(k)||null,set:async(k,v)=>draft.set(k,clone(v)),create:async(k,v)=>draft.set(k,clone(v))});docs=draft;return out}});
 h.w.MiCarteraV2SyncBridge.submit=async op=>{
  const next=op.entities.find(e=>e.collection==='credits'&&e.kind==='create').data,pay=op.entities.find(e=>e.collection==='payments').data,entry=op.entities.find(e=>e.collection==='entries').data;
  accepted=await service.execute({uid:'test-admin'},{creditId:old.id,newCreditId:next.id,paymentId:pay.id,entryId:entry.id,operationId:op.operationId,expectedVersion:1,date:next.date,rate:next.rate,term:next.term,freq:next.freq,firstPaymentDate:next.requestedFirstPaymentDate,restDay:next.restDay,extraPayments:next.schedule.filter(q=>q.extra).map(q=>({date:q.date,amount:q.amount}))});
  const ack=clone(accepted);if(malformed)ack.result.entry.amount=999;return ack;
 };
 h.w.MiCarteraV2SharePreview={previewCredit(){}};
 return {h,accepted:()=>accepted};
}
async function confirmRenewal(h){
 const p=h.w.MiCarteraV2DurableActions.renewInterest('ui-old-credit'),doc=h.w.document;
 for(const [id,value] of Object.entries({v2RenewDate:'2026-11-23',v2RenewFirstDate:'2026-11-30',v2RenewRate:'20',v2RenewTerm:'2',v2RenewFreq:'weekly',v2RenewRest:''}))doc.getElementById(id).value=value;
 doc.getElementById('v2RenewReview').click();doc.getElementById('v2RenewAccepted').checked=true;doc.getElementById('v2RenewAccepted').onchange();doc.getElementById('v2ConfirmRenewal').click();await p;
}
test('durable interest renewal merges backend credits, cash, history and canonical audit instead of planned snapshots',async()=>{
 const {h,accepted}=await renewalUI();try{await confirmRenewal(h);const r=accepted().result,d=h.get();a.equal(d.audit[0]?.id,r.audit.id,h.alerts.join('\n'));a.deepEqual(d.payments[0],r.payment);a.deepEqual(d.cashMovements[0],r.entry);a.equal(d.credits[1].workerId,'verified-server-worker');a.equal(h.w.MiCarteraV2CashMenu.analyze(d,{asOf:'2026-11-23'}).cash.physical,20)}finally{await h.close()}
});
test('malformed interest renewal acknowledgement never replaces the current local portfolio',async()=>{
 const {h}=await renewalUI({malformed:true});try{const before=h.get();await confirmRenewal(h);a.deepEqual(h.get(),before);a.ok(h.alerts.length)}finally{await h.close()}
});
