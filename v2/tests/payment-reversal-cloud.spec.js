const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {boot}=require('./dom-harness.cjs');
const root=path.resolve(process.env.SOURCE||'v2');
const {createStore}=require(path.join(root,'core/transaction-store.js'));
const {createOperationalSync}=require(path.join(root,'cloud/operational-sync.js'));
function backend(seed){
  const db=new Map(Object.entries(seed));
  const store=createStore({runAtomic:async fn=>{
    const staged=new Map(db);let writing=false;
    const result=await fn({get:async key=>{a.equal(writing,false,'Firestore reads must precede writes');return staged.get(key)||null},set:async(key,value)=>{
      writing=true;
      if(/^(payments|audit)\//.test(key)&&db.has(key))throw Object.assign(Error('Append-only Firestore collection'),{code:'permission-denied'});
      staged.set(key,JSON.parse(JSON.stringify(value)));
    }});
    db.clear();for(const pair of staged)db.set(...pair);return result;
  }});
  return {db,store};
}
const p={id:'pay-original',creditId:'credit',amount:110,capitalAmount:100,interestAmount:10,routeId:'r1',userId:'collector',date:'2026-09-26',version:1};
const cash={id:'cash-original',ref:p.id,type:'INGRESO',amount:110,version:1};
const credit={id:'credit',clientId:'c1',capital:100,total:110,principalPaid:100,interestPaid:10,status:'PAGADO',version:2,schedule:[{amount:110,paid:110,balance:0,status:'PAGADA'}]};
test('payment reversal commits with deployed append-only constraints and leaves original payment untouched',async()=>{
  const h=await boot();try{
    const d=h.get();Object.assign(d,{credits:[credit],payments:[p],cashMovements:[cash]});h.set(d);
    const b=backend({['payments/'+p.id]:p,['credits/'+credit.id]:credit,['entries/'+cash.id]:cash});
    const sync=createOperationalSync({store:b.store});let submitted;
    h.w.MiCarteraV2SyncBridge.submit=async op=>{submitted=op;return sync.submit(op)};
    a.equal(await h.w.MiCarteraV2WriteActions.reversePayment(p.id),true,h.alerts.join());
    a.deepEqual(b.db.get('payments/'+p.id),p,'original immutable payment remains');
    const markers=[...b.db.values()].filter(x=>x.recordType==='PAYMENT_REVERSAL');
    a.equal(markers.length,1);a.equal(markers[0].reversesPaymentId,p.id);a.equal(markers[0].userId,p.userId);
    a.equal(b.db.get('credits/'+credit.id).status,'ACTIVO');
    a.equal(b.db.get('entries/'+cash.id).tombstone,true);
    a.equal(h.get().payments.length,0);a.equal(h.get().cashMovements.length,0);
    a.equal((await sync.submit(submitted)).status,'ALREADY_APPLIED');
    a.equal([...b.db.values()].filter(x=>x.recordType==='PAYMENT_REVERSAL').length,1);
  }finally{h.close()}
});
test('legacy queued payment deletion becomes one immutable reversal after restart and cannot reverse twice',async()=>{
  const b=backend({['payments/'+p.id]:p});
  const old={id:'old-offline-reversal',type:'PAYMENT_REVERSE',writes:[{kind:'delete',path:'payments/'+p.id,data:{...p,version:2},expectedVersion:1}]};
  a.equal((await b.store.execute(JSON.parse(JSON.stringify(old)))).status,'APPLIED');
  a.deepEqual(b.db.get('payments/'+p.id),p);
  a.equal((await b.store.execute(old)).status,'ALREADY_APPLIED');
  await a.rejects(b.store.execute({...old,id:'different-reversal'}),/PAYMENT_ALREADY_REVERSED/);
  a.equal([...b.db.values()].filter(x=>x.recordType==='PAYMENT_REVERSAL').length,1);
});
for(const role of ['admin','cobrador'])test(role+' rehydration excludes reversed payment and marker while retaining another payment',async()=>{
  const h=await boot();try{
    const d=h.get();d.clients=[];d.payments=[p];d.session={actorId:'collector',role};h.set(d);
    const marker={id:'reversal-'+p.id,recordType:'PAYMENT_REVERSAL',reversesPaymentId:p.id,userId:p.userId,routeId:p.routeId,tombstone:true,version:1};
    const auth={uid:'collector',role,routeIds:['r1']};
    h.w.MiCarteraV2AuthCloudGate={state:()=>auth,requireReady:()=>auth};
    let writes=0;
    h.w.firestoreV2={db:{},collection:(_,org,id,name)=>name,query:name=>name,where(){},getDocs:async name=>({forEach(fn){if(name==='payments')for(const x of [p,marker,{...p,id:'pay-keep'}])fn({id:x.id,data:()=>x})}}),doc:(_,org,id,name,key)=>name+'/'+key,runTransaction:async()=>{writes++;throw Error('Unexpected write')}};
    h.load('app/cloud-rehydration-v2.js');
    a.equal((await h.w.MiCarteraV2CloudRehydration.rehydrate()).status,'REHYDRATED');
    a.deepEqual(h.get().payments.map(x=>x.id),['pay-keep']);a.equal(writes,0);
  }finally{h.close()}
});
