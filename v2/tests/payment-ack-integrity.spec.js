// Real durable payment/actions and financial engine; only Cloud/Auth boundaries
// are fictional. No Firebase SDK, network request or production data is loaded.
const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function credit(id='fictional-credit') {
  return {id,clientId:'c1',routeId:'r1',capital:100,total:120,rate:20,
    principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,
    term:3,freq:'weekly',schedule:[1,2,3].map(number=>({number,
      date:'2026-10-'+String(11+(number-1)*7),amount:40,paid:0,
      balance:40,status:'PENDIENTE'}))};
}
async function setup() {
  const h=await boot(),d=h.get();
  d.clients[0].name='Cliente FICTICIO de integridad';d.credits=[credit()];
  d.payments=[];d.cashMovements=[];d.audit=[];h.set(d);
  h.previews=[];h.w.MiCarteraV2SharePreview={previewPayment:id=>h.previews.push(id)};
  h.w.MiCarteraV2Dates.today=()=> '2026-10-11';h.w.prompt=()=> '40';
  h.auth={uid:'test-admin',role:'admin',ready:true,authenticated:true,
    member:true,routeIds:['r1']};
  h.w.MiCarteraV2AuthCloudGate.state=()=>({...h.auth});
  h.w.MiCarteraV2AuthCloudGate.requireReady=()=> {
    if(!h.auth.ready)throw Error('V2_AUTH_NOT_READY');return {...h.auth};
  };
  h.emitAuth=()=>h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',
    {detail:{...h.auth}}));
  return h;
}
function pausePayments(h) {
  const releases=new Map();
  h.w.MiCarteraV2SyncBridge.submit=async operation=> {
    const op=clone(operation);h.commits.push(op);
    if(op.type!=='PAYMENT')return {status:'COMMITTED',operationId:op.operationId};
    return new Promise(resolve=>releases.set(op.entities[0].data.id,
      result=>resolve(result||{status:'COMMITTED',operationId:op.operationId})));
  };
  return (id='fictional-credit',result)=> {
    a.equal(typeof releases.get(id),'function','payment must reach fictional transport');
    releases.get(id)(result);
  };
}
async function pendingPayment(h) {
  const release=pausePayments(h),pending=h.w.V2UI.collect('fictional-credit');
  await tick();a.equal(h.commits.length,1);return {release,pending};
}
function unchanged(h,before,message) {
  a.deepEqual(h.get(),before,message);a.equal(h.previews.length,0);
}

test('rejected or unconfirmed payment ACK keeps credit, cash, audit and preview unchanged',async()=> {
  for(const status of ['ERROR','OFFLINE','LOCAL_ONLY','QUEUED']) {
    const h=await setup();try {
      const before=h.get();h.w.MiCarteraV2SyncBridge.submit=async op=> {
        h.commits.push(clone(op));return {status,operationId:op.operationId};
      };
      await h.w.V2UI.collect('fictional-credit');unchanged(h,before,status);
      a.equal(h.commits.length,1);a.ok(h.alerts.length);
    }finally{await h.close();}
  }
});

test('one accepted partial payment persists its exact allocation and cash once',async()=> {
  const h=await setup();try {
    h.w.prompt=()=> '55';await h.w.V2UI.collect('fictional-credit');const d=h.get();
    a.equal(d.payments.length,1,h.alerts.join('\n'));a.equal(d.cashMovements.length,1);
    a.equal(d.audit.length,1);a.equal(d.cashMovements[0].amount,55);
    a.equal(d.credits[0].principalPaid,45.83);a.equal(d.credits[0].interestPaid,9.17);
    a.deepEqual(d.credits[0].schedule.map(q=>q.balance),[0,25,40]);
    a.deepEqual(d.payments[0].installmentApplications,[
      {number:1,amount:40,balanceBefore:40,balanceAfter:0,status:'PAGADA'},
      {number:2,amount:15,balanceBefore:40,balanceAfter:25,status:'PARCIAL'}]);
    a.equal(d.payments[0].balanceAfterPayment,65);a.equal(d.credits[0].version,2);
    a.equal(h.previews.length,1);a.equal(h.commits.length,1);
  }finally{await h.close();}
});

test('transaction-store ACK shape applies this payment in a configured commercial organization',async()=> {
  const h=await setup();try {
    h.w.MiCarteraV2AuthCloudGate.ORG='fictional-commercial-org';
    h.w.MiCarteraV2SyncBridge.submit=async op=> {
      h.commits.push(clone(op));return {status:'APPLIED',operation:{id:op.operationId}};
    };
    await h.w.V2UI.collect('fictional-credit');
    a.equal(h.get().payments.length,1,h.alerts.join('\n'));a.equal(h.commits.length,1);
  }finally{await h.close();}
});

test('overpayment and cancellation never submit or mutate financial state',async()=> {
  for(const raw of ['121','0','-1',null]) {
    const h=await setup();try {const before=h.get();h.w.prompt=()=>raw;
      await h.w.V2UI.collect('fictional-credit');unchanged(h,before,String(raw));
      a.equal(h.commits.length,0);
    }finally{await h.close();}
  }
});

test('mismatched local actor, owner or Firebase identity blocks payment before submission',async()=> {
  for(const kind of ['actor','owner','firebase','role','membership']) {
    const h=await setup();try {
      if(kind==='actor'){const d=h.get();d.session.actorId='fictional-other';h.set(d);}
      if(kind==='owner')h.w.localStorage.setItem('mi-cartera-v2-local-owner','fictional-other');
      if(kind==='firebase')h.w.firebaseAuthV2.auth.currentUser={uid:'fictional-other'};
      if(kind==='role')h.auth.role='supervisor';
      if(kind==='membership')h.auth.member=false;
      const before=h.get();await h.w.V2UI.collect('fictional-credit');
      unchanged(h,before,kind);a.equal(h.commits.length,0,kind);
    }finally{await h.close();}
  }
});

test('a late accepted payment cannot replace a different authenticated portfolio',async()=> {
  const h=await setup();try {
    const {release,pending}=await pendingPayment(h);
    h.auth={...h.auth,uid:'fictional-owner-b'};
    h.w.firebaseAuthV2.auth.currentUser={uid:h.auth.uid};
    h.w.localStorage.setItem('mi-cartera-v2-local-owner',h.auth.uid);
    h.set({clients:[{id:'fictional-b',name:'Cuenta B FICTICIA'}],credits:[],payments:[],
      cashMovements:[{id:'fictional-b-cash',amount:777,type:'INGRESO'}],audit:[],
      session:{actorId:h.auth.uid,role:'ADMIN'}});h.emitAuth();
    const before=h.get();release();await pending;unchanged(h,before,'late owner ACK');
    a.ok(h.alerts.some(x=>/sesión|session/i.test(x)));
  }finally{await h.close();}
});

test('switching away and back invalidates an in-flight payment while identical auth notifications do not',async()=> {
  for(const changed of [true,false]) {
    const h=await setup();try {
      const {release,pending}=await pendingPayment(h),before=h.get();
      if(changed){h.auth={...h.auth,uid:'fictional-owner-b'};h.emitAuth();}
      h.auth={...h.auth,uid:'test-admin'};h.emitAuth();release();await pending;
      if(changed)unchanged(h,before,'A/B/A auth lifecycle');
      else a.equal(h.get().payments.length,1,h.alerts.join('\n'));
    }finally{await h.close();}
  }
});

test('a changed authority or local owner during payment ACK preserves the current portfolio',async()=> {
  for(const kind of ['owner','route','org','not-ready']) {
    const h=await setup();try {
      const {release,pending}=await pendingPayment(h),before=h.get();
      if(kind==='owner')h.w.localStorage.setItem('mi-cartera-v2-local-owner','fictional-b');
      if(kind==='route'){h.auth={...h.auth,routeIds:['fictional-other-route']};h.emitAuth();}
      if(kind==='org'){h.w.MiCarteraV2AuthCloudGate.ORG='fictional-other-org';h.emitAuth();}
      if(kind==='not-ready'){h.auth={...h.auth,ready:false};h.emitAuth();}
      release();await pending;unchanged(h,before,kind);
    }finally{await h.close();}
  }
});

test('payment ACK merges an independently committed cash movement and refreshed clients',async()=> {
  const h=await setup();try {
    const {release,pending}=await pendingPayment(h);
    const m=await h.w.V2UI.manualCash('INGRESO',{date:'2026-10-11',amount:75,
      category:'APORTE_CAPITAL',concept:'Aporte FICTICIO concurrente'});
    const concurrent=h.get();concurrent.clients[0].address='Dirección FICTICIA actualizada';
    concurrent.credits.push(credit('fictional-unrelated'));h.set(concurrent);
    release();await pending;const actual=h.get();
    a.ok(actual.cashMovements.some(x=>x.id===m.id),'accepted concurrent cash must survive');
    a.ok(actual.audit.some(x=>x.id===concurrent.audit[0].id),'concurrent audit must survive');
    a.equal(actual.clients[0].address,'Dirección FICTICIA actualizada');
    a.ok(actual.credits.some(x=>x.id==='fictional-unrelated'));
    a.equal(actual.payments.length,1);a.equal(actual.cashMovements.length,2);
    a.deepEqual(actual.credits.find(x=>x.id==='fictional-credit').schedule.map(x=>x.balance),[0,40,40]);
  }finally{await h.close();}
});

test('payments for different credits acknowledged in reverse order retain both collections',async()=> {
  const h=await setup();try {
    const d=h.get();d.credits.push(credit('fictional-credit-b'));h.set(d);
    const release=pausePayments(h),first=h.w.V2UI.collect('fictional-credit'),
      second=h.w.V2UI.collect('fictional-credit-b');await tick();
    a.equal(h.commits.length,2);release('fictional-credit-b');await second;
    release();await first;const actual=h.get();
    a.equal(actual.payments.length,2);a.equal(actual.cashMovements.length,2);a.equal(actual.audit.length,2);
    a.deepEqual(actual.credits.map(c=>c.schedule.map(q=>q.balance)),[[0,40,40],[0,40,40]]);
  }finally{await h.close();}
});

test('already rehydrated accepted payment entities are idempotent and preserve cloud metadata',async()=> {
  const h=await setup();try {
    const {release,pending}=await pendingPayment(h),op=h.commits[0],d=h.get();
    const metadata={updatedAt:'fictional-cloud-time',__firestoreId:'fictional-doc'};
    d.credits[0]={...clone(op.entities[0].data),...metadata};
    d.payments=[{...clone(op.entities[1].data),...metadata}];
    d.cashMovements=[{...clone(op.entities[2].data),...metadata}];
    d.audit=[{...clone(op.audit),...metadata}];h.set(d);
    release();await pending;a.deepEqual(h.get(),d,'rehydration must not duplicate or erase metadata');
    a.equal(h.previews.length,1);
  }finally{await h.close();}
});

test('a newer local credit revision or conflicting accepted entity is never overwritten by payment ACK',async()=> {
  for(const kind of ['credit','payment','cash','audit']) {
    const h=await setup();try {
      const {release,pending}=await pendingPayment(h),d=h.get(),op=h.commits[0];
      if(kind==='credit'){d.credits[0].version=3;d.credits[0].schedule[0].balance=17;}
      if(kind==='payment')d.payments.push({...clone(op.entities[1].data),amount:99});
      if(kind==='cash')d.cashMovements.push({...clone(op.entities[2].data),amount:99});
      if(kind==='audit')d.audit.push({...clone(op.audit),detail:{amount:99}});
      h.set(d);release();await pending;unchanged(h,d,kind);
      a.ok(h.alerts.some(x=>/revisión|conflicto|revision|conflict/i.test(x)),kind);
    }finally{await h.close();}
  }
});

test('a wrong operation ACK cannot apply financial entities or open a receipt',async()=> {
  for(const result of [{status:'COMMITTED',operationId:'fictional-wrong-operation'},
    {status:'APPLIED',operation:{id:'fictional-wrong-operation'}}]) {
    const h=await setup();try {
      const {release,pending}=await pendingPayment(h),before=h.get();
      release('fictional-credit',result);await pending;
      unchanged(h,before,'ACK must identify this operation');
    }finally{await h.close();}
  }
});

test('a credit changed while the payment confirmation is open blocks stale submission',async()=> {
  const h=await setup();try {
    let current;h.w.confirm=()=> {current=h.get();current.credits[0].version=2;
      current.credits[0].schedule[0].balance=20;h.set(current);return true;};
    await h.w.V2UI.collect('fictional-credit');unchanged(h,current,'stale confirmation');
    a.equal(h.commits.length,0);
  }finally{await h.close();}
});

test('double taps create one pending payment and rejection releases the retry guard',async()=> {
  const h=await setup();try {
    const {release,pending}=await pendingPayment(h),before=h.get();
    await h.w.V2UI.collect('fictional-credit');a.equal(h.commits.length,1);
    release('fictional-credit',{status:'ERROR'});await pending;unchanged(h,before,'failed payment');
    h.w.MiCarteraV2SyncBridge.submit=async op=> {h.commits.push(clone(op));
      return {status:'COMMITTED',operationId:op.operationId};};
    await h.w.V2UI.collect('fictional-credit');a.equal(h.get().payments.length,1);
    a.equal(h.commits.length,2);
  }finally{await h.close();}
});
