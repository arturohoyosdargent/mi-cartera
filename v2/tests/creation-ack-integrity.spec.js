// Exercise reverse ACK ordering through real durable actions and financial code.
// All customers, sessions and asynchronous transport responses are fictional.
const {test}=require('node:test'),a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
const {collect}=require('./collection-form-driver.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function setup() {
  const h=await boot(),d=h.get();d.clients[0].name='Cliente FICTICIO existente';
  d.credits=[{id:'fictional-old-credit',clientId:'c1',routeId:'r1',capital:100,total:120,
    rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,
    term:3,freq:'weekly',schedule:[1,2,3].map(number=>({number,
      date:'2026-10-'+String(12+(number-1)*7),amount:40,paid:0,balance:40,status:'PENDIENTE'}))}];
  d.payments=[];d.cashMovements=[];d.audit=[];h.set(d);
  h.auth={uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true};
  h.w.MiCarteraV2AuthCloudGate.state=()=>({...h.auth});
  h.w.MiCarteraV2AuthCloudGate.requireReady=()=>({...h.auth});
  h.w.MiCarteraV2Dates.today=()=> '2026-10-12';
  h.previews=[];h.w.MiCarteraV2SharePreview={previewPayment:id=>h.previews.push(id),
    previewCredit:id=>h.previews.push(id)};
  h.resetCount=0;h.w.MiCarteraV2CustomerExperience={resetForm:()=>h.resetCount++};
  return h;
}
function fillCreation(h,kind,{edit=false}={}) {
  const values=kind==='client'?{fName:'Cliente NUEVO FICTICIO',fPhone:'999222333',
    fDni:'00000002',fAddress:'Dirección FICTICIA',fRoute:'r1'}:
    {cClient:'c1',cCapital:'200',cRate:'10',cTerm:'4',cFreq:'weekly',cFirst:'2026-11-02'};
  for(const [id,value] of Object.entries(values))h.w.document.getElementById(id).value=value;
  if(kind==='credit')h.w.document.getElementById('cAccepted').checked=true;
  if(kind==='client'&&edit)h.w.document.getElementById('fName').dataset.clientId='c1';
}
async function delayedCreation(h,kind,options) {
  fillCreation(h,kind,options);let release;
  const type=kind==='credit'?'CREDIT_CREATE':options?.edit?'CLIENT_UPDATE':'CLIENT_CREATE';
  h.w.MiCarteraV2SyncBridge.submit=async operation=> {
    const op=clone(operation);h.commits.push(op);
    if(op.type!==type)return {status:'COMMITTED',operationId:op.operationId};
    return new Promise(resolve=>release=result=>resolve(result||
      {status:'COMMITTED',operationId:op.operationId}));
  };
  const pending=h.w.V2UI[kind==='client'?'addClient':'addCredit']();await tick();
  a.equal(typeof release,'function',h.alerts.join('\n'));
  return {pending,release,op:h.commits[0]};
}
async function completeFinancialAction(h,action) {
  if(action==='payment')return collect(h,'fictional-old-credit','40');
  const pending=h.w.V2UI[action]('fictional-old-credit'),doc=h.w.document;
  if(action==='refinance')doc.getElementById('v2RenewCapital').value='200';
  doc.getElementById('v2RenewDate').value='2026-10-12';
  doc.getElementById('v2RenewFirstDate').value='2026-10-13';
  doc.getElementById('v2RenewReview').click();
  const accepted=doc.getElementById('v2RenewAccepted');
  a.ok(accepted,h.alerts.join('\n'));accepted.checked=true;accepted.onchange();
  doc.getElementById('v2ConfirmRenewal').click();await pending;
}
function assertExistingFinancialRecords(actual,accepted) {
  for(const key of ['credits','payments','cashMovements','audit']) {
    for(const record of accepted[key])a.deepEqual(actual[key].find(x=>x.id===record.id),record,
      'late creation ACK must retain accepted '+key+' '+record.id);
  }
}

for(const kind of ['client','credit'])for(const action of ['payment','renewInterest','refinance']) {
  test('late '+kind+' creation ACK retains an already accepted '+action,async()=> {
    const h=await setup();try {
      const {release,pending,op}=await delayedCreation(h,kind);
      await completeFinancialAction(h,action);const accepted=h.get();
      a.ok(accepted.audit.length>0,h.alerts.join('\n'));release();await pending;
      const actual=h.get();assertExistingFinancialRecords(actual,accepted);
      a.equal(actual[kind==='client'?'clients':'credits'].filter(x=>x.id===op.entities[0].data.id).length,1);
      a.ok(actual.audit.some(x=>x.id===op.audit.id));
      if(kind==='credit')a.ok(actual.cashMovements.some(x=>x.id===op.entities[1].data.id));
    }finally{await h.close();}
  });
}

test('late creation ACKs cannot restore a different authenticated portfolio or an A/B/A lifecycle',async()=> {
  for(const kind of ['client','credit'])for(const aba of [false,true]) {
    const h=await setup();try {
      const {release,pending}=await delayedCreation(h,kind),original=h.get();
      h.auth={...h.auth,uid:'fictional-owner-b'};
      h.w.firebaseAuthV2.auth.currentUser={uid:h.auth.uid};
      h.w.localStorage.setItem('mi-cartera-v2-local-owner',h.auth.uid);
      h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:h.auth}));
      if(aba){h.auth={...h.auth,uid:'test-admin'};
        h.w.firebaseAuthV2.auth.currentUser={uid:h.auth.uid};
        h.w.localStorage.setItem('mi-cartera-v2-local-owner',h.auth.uid);h.set(original);
        h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:h.auth}));
      }else h.set({clients:[],credits:[],payments:[],cashMovements:[],audit:[],
        session:{actorId:h.auth.uid,role:'ADMIN'}});
      const before=h.get();release();await pending;a.deepEqual(h.get(),before,kind+' '+aba);
      a.equal(h.resetCount,0);a.ok(h.alerts.some(x=>/sesión|session/i.test(x)));
    }finally{await h.close();}
  }
});

test('rehydrated creation entities retain cloud metadata without duplicates',async()=> {
  for(const kind of ['client','credit']) {
    const h=await setup();try {
      const {release,pending,op}=await delayedCreation(h,kind),d=h.get();
      for(const entity of op.entities){const key=entity.collection==='entries'||entity.collection==='expenses'?
        'cashMovements':entity.collection;d[key].push({...clone(entity.data),
          updatedAt:'fictional-cloud-time',__firestoreId:'fictional-document'});}
      d.audit.push({...clone(op.audit),updatedAt:'fictional-cloud-time'});h.set(d);
      release({status:'APPLIED',operation:{id:op.operationId}});await pending;
      a.deepEqual(h.get(),d,'creation merge must be idempotent '+kind);
    }finally{await h.close();}
  }
});

test('conflicting created entity/audit or edited client revision is preserved atomically',async()=> {
  for(const kind of ['client','credit'])for(const target of ['entity','audit']) {
    const h=await setup();try {
      const {release,pending,op}=await delayedCreation(h,kind),d=h.get();
      if(target==='audit')d.audit.push({...clone(op.audit),detail:{fictionalConflict:true}});
      else d[kind==='client'?'clients':'credits'].push({...clone(op.entities[0].data),
        version:99});h.set(d);release();await pending;a.deepEqual(h.get(),d);
      a.equal(h.resetCount,0);a.ok(h.alerts.some(x=>/conflicto|revisión|revision|conflict/i.test(x)));
    }finally{await h.close();}
  }
  const h=await setup();try {
    const {release,pending}=await delayedCreation(h,'client',{edit:true}),d=h.get();
    d.clients[0].version=5;d.clients[0].name='Edición concurrente FICTICIA';h.set(d);
    release();await pending;a.deepEqual(h.get(),d);a.equal(h.resetCount,0);
  }finally{await h.close();}
});

test('a client edit ACK retains concurrent payment and refreshes only that client',async()=> {
  const h=await setup();try {
    const {release,pending,op}=await delayedCreation(h,'client',{edit:true});
    await completeFinancialAction(h,'payment');const accepted=h.get();
    release();await pending;const actual=h.get();assertExistingFinancialRecords(actual,accepted);
    a.equal(actual.clients[0].name,op.entities[0].data.name);a.equal(actual.clients.length,1);
  }finally{await h.close();}
});

test('late credit creation ACK cannot resurrect a client removed from the current portfolio',async()=> {
  const h=await setup();try {
    const {release,pending}=await delayedCreation(h,'credit'),d=h.get();
    d.clients=[];h.set(d);release();await pending;a.deepEqual(h.get(),d);
    a.ok(h.alerts.some(x=>/cliente|client|conflicto/i.test(x)));
  }finally{await h.close();}
});

test('wrong ACK identifiers and unconfirmed creations leave every local record unchanged',async()=> {
  for(const kind of ['client','credit'])for(const ack of [
    {status:'COMMITTED',operationId:'fictional-wrong'},
    {status:'APPLIED',operation:{id:'fictional-wrong'}},{status:'ERROR'},{status:'QUEUED'}]) {
    const h=await setup();try {
      const {release,pending}=await delayedCreation(h,kind),before=h.get();
      release(ack);await pending;a.deepEqual(h.get(),before);a.equal(h.resetCount,0);
    }finally{await h.close();}
  }
});

test('initial owner mismatch blocks creation without submitting',async()=> {
  for(const kind of ['client','credit']) {
    const h=await setup();try {
      fillCreation(h,kind);h.w.localStorage.setItem('mi-cartera-v2-local-owner','fictional-other');
      const before=h.get();await h.w.V2UI[kind==='client'?'addClient':'addCredit']();
      a.deepEqual(h.get(),before);a.equal(h.commits.length,0);a.equal(h.resetCount,0);
    }finally{await h.close();}
  }
});

test('client phone/DNI and active-credit duplicate checks still block creation',async()=> {
  for(const kind of ['client','credit']) {
    const h=await setup();try {
      fillCreation(h,kind);
      if(kind==='client')h.w.document.getElementById('fPhone').value='999111222';
      else {const d=h.get();d.credits[0]={...d.credits[0],capital:200,total:220,
        rate:10,term:4,freq:'weekly',firstPaymentDate:'2026-11-02'};h.set(d);}
      const before=h.get();await h.w.V2UI[kind==='client'?'addClient':'addCredit']();
      a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
      a.ok(h.alerts.some(x=>/existe|mismos datos/i.test(x)));
    }finally{await h.close();}
  }
});
