// Actual shell/actions with fictional Auth/Cloud boundaries. A promise is
// metadata for one installment; it never reschedules or settles that installment.
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test'),a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function setup() {
  const h=await boot({fullShell:true}),d=h.get();
  d.clients[0].name='Cliente FICTICIO de compromisos';
  d.credits=[{id:'fictional-promise-credit',clientId:'c1',routeId:'r1',capital:100,
    total:120,rate:20,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',
    version:1,term:3,freq:'weekly',schedule:[1,2,3].map(number=>({number,
      date:'2026-10-'+String(5+(number-1)*7).padStart(2,'0'),amount:40,paid:0,
      balance:40,status:'PENDIENTE'}))}];
  d.payments=[];d.cashMovements=[];d.audit=[];h.set(d);
  h.auth={uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true};
  h.w.MiCarteraV2AuthCloudGate.state=()=>({...h.auth});
  h.w.MiCarteraV2AuthCloudGate.requireReady=()=> {
    if(!h.auth.ready)throw Error('V2_AUTH_NOT_READY');return {...h.auth};
  };
  h.w.MiCarteraV2Dates.today=()=> '2026-10-12';
  if(!h.w.MiCarteraV2PaymentPromises&&fs.existsSync(path.join(__dirname,'../app/payment-promises-v2.js')))
    h.load('app/payment-promises-v2.js');
  h.api=h.w.MiCarteraV2PaymentPromises;
  return h;
}
function api(h) {
  a.ok(h.api&&typeof h.api.set==='function'&&typeof h.api.cancel==='function',
    'the active installment-promise feature is missing');return h.api;
}
function financial(credit) {
  const copy=clone(credit);delete copy.version;delete copy.updatedAt;
  delete copy.paymentPromise;delete copy.paymentPromiseHistory;
  for(const q of copy.schedule){delete q.paymentPromise;delete q.paymentPromiseHistory;}
  return copy;
}
function pause(h) {
  let release;h.w.MiCarteraV2SyncBridge.submit=async operation=> {
    const op=clone(operation);h.commits.push(op);
    return new Promise(resolve=>release=result=>resolve(result||
      {status:'COMMITTED',operationId:op.operationId}));
  };
  return result=>{a.equal(typeof release,'function',h.alerts.join('\n'));release(result);};
}
const input={date:'2026-10-15',observation:'Llamar por la tarde. Dato FICTICIO.'};

test('setting one promise preserves every financial field and original overdue due date',async()=> {
  const h=await setup();try {
    const before=h.get(),record=await api(h).set('fictional-promise-credit',1,input),d=h.get();
    a.equal(record.status,'ACTIVE');a.equal(record.installmentNumber,1);a.equal(record.date,'2026-10-15');
    a.equal(record.observation,input.observation);a.equal(record.amount,40);
    a.deepEqual(financial(d.credits[0]),financial(before.credits[0]));
    a.equal(d.credits[0].schedule[0].date,'2026-10-05','promise must not postpone an overdue installment');
    a.equal(d.credits[0].version,2);a.equal(d.payments.length,0);a.equal(d.cashMovements.length,0);
    a.equal(d.audit.length,1);a.equal(h.commits.length,1);
    a.equal(h.commits[0].entities.length,1);a.equal(h.commits[0].entities[0].collection,'credits');
    a.equal(h.commits[0].type,'CREDIT_PAYMENT_PROMISE_SET');
    a.equal(d.credits[0].paymentPromise.id,record.id,'credit summary represents the same promise');
  }finally{await h.close();}
});

test('multiple installment promises derive one nearest active summary without a second obligation',async()=> {
  const h=await setup();try {
    const A=api(h);await A.set('fictional-promise-credit',1,{...input,date:'2026-10-20'});
    const second=await A.set('fictional-promise-credit',2,{...input,date:'2026-10-16'}),d=h.get();
    a.equal(d.credits[0].schedule.filter(q=>q.paymentPromise?.status==='ACTIVE').length,2);
    a.equal(d.credits[0].paymentPromise.id,second.id);a.equal(d.credits[0].paymentPromise.amount,40);
    a.equal(d.credits[0].schedule.reduce((n,q)=>n+q.balance,0),120);
    a.equal(d.cashMovements.length,0);a.equal(d.payments.length,0);
  }finally{await h.close();}
});

test('cancellation retains per-installment history, clears only that obligation and is idempotent',async()=> {
  const h=await setup();try {
    const A=api(h),first=await A.set('fictional-promise-credit',1,input);
    const second=await A.set('fictional-promise-credit',2,{...input,date:'2026-10-18'});
    const before=h.get();await A.cancel('fictional-promise-credit',1);const cancelled=h.get();
    a.equal(cancelled.credits[0].schedule[0].paymentPromise.status,'CANCELLED');
    a.equal(cancelled.credits[0].schedule[0].paymentPromise.id,first.id);
    a.equal(cancelled.credits[0].schedule[0].paymentPromise.observation,input.observation);
    a.equal(cancelled.credits[0].paymentPromise.id,second.id);
    a.deepEqual(financial(cancelled.credits[0]),financial(before.credits[0]));
    const accepted=clone(cancelled),count=h.commits.length;
    await A.cancel('fictional-promise-credit',1);a.deepEqual(h.get(),accepted);a.equal(h.commits.length,count);
    await A.cancel('fictional-promise-credit',2);a.equal(h.get().credits[0].paymentPromise,null);
  }finally{await h.close();}
});

test('editing an active promise and recreating a cancelled one retains their metadata history',async()=> {
  const h=await setup();try {
    const A=api(h),first=await A.set('fictional-promise-credit',1,input);
    const edited=await A.set('fictional-promise-credit',1,{date:'2026-10-17',observation:'Cambio FICTICIO'});
    a.equal(edited.id,first.id);a.equal(h.get().credits[0].schedule[0].paymentPromiseHistory.length,1);
    await A.cancel('fictional-promise-credit',1);
    const replacement=await A.set('fictional-promise-credit',1,input),q=h.get().credits[0].schedule[0];
    a.notEqual(replacement.id,first.id);a.ok(q.paymentPromiseHistory.some(p=>p.id===first.id&&p.status==='CANCELLED'));
  }finally{await h.close();}
});

test('invalid date, installment, settled credit and unauthorized role never submit metadata',async()=> {
  for(const kind of ['date','installment','paid','renewed','cobrador','owner']) {
    const h=await setup();try {
      const A=api(h),d=h.get();
      if(kind==='paid'){d.credits[0].schedule[0].paid=40;d.credits[0].schedule[0].balance=0;h.set(d);}
      if(kind==='renewed'){d.credits[0].status='RENOVADO';d.credits[0].renewedTo='fictional-successor';h.set(d);}
      if(kind==='cobrador'){h.auth.role='cobrador';d.session.role='COBRADOR';h.set(d);}
      if(kind==='owner')h.w.localStorage.setItem('mi-cartera-v2-local-owner','fictional-other');
      const before=h.get();await a.rejects(()=>A.set('fictional-promise-credit',kind==='installment'?99:1,
        kind==='date'?{...input,date:'2026-02-31'}:input));
      a.deepEqual(h.get(),before,kind);a.equal(h.commits.length,0);
    }finally{await h.close();}
  }
});

test('rejected or unconfirmed ACK preserves all promise, audit and financial metadata',async()=> {
  for(const status of ['ERROR','OFFLINE','QUEUED','LOCAL_ONLY']) {
    const h=await setup();try {
      const A=api(h),before=h.get();h.w.MiCarteraV2SyncBridge.submit=async op=> {
        h.commits.push(clone(op));return {status,operationId:op.operationId};};
      await a.rejects(()=>A.set('fictional-promise-credit',1,input));a.deepEqual(h.get(),before,status);
    }finally{await h.close();}
  }
});

test('double submit is blocked while pending and a rejected attempt releases the guard',async()=> {
  const h=await setup();try {
    const A=api(h),release=pause(h),before=h.get(),pending=A.set('fictional-promise-credit',1,input);
    await tick();a.deepEqual(h.get(),before,'a pending ACK must not change metadata');
    await a.rejects(()=>A.set('fictional-promise-credit',2,input),/procesando|guardando/i);
    a.equal(h.commits.length,1);release({status:'ERROR'});await a.rejects(pending);
    h.w.MiCarteraV2SyncBridge.submit=async op=>({status:'APPLIED',operation:{id:op.operationId}});
    await A.set('fictional-promise-credit',2,input);a.equal(h.get().credits[0].schedule[1].paymentPromise.status,'ACTIVE');
  }finally{await h.close();}
});

test('late promise ACK retains separately accepted payments, cash, clients and other credit commitments',async()=> {
  const h=await setup();try {
    const A=api(h),release=pause(h),pending=A.set('fictional-promise-credit',1,input);await tick();
    const concurrent=h.get();concurrent.payments.push({id:'fictional-other-payment',creditId:'fictional-other-credit',amount:25});
    concurrent.cashMovements.push({id:'fictional-other-cash',type:'INGRESO',amount:25});
    concurrent.audit.push({id:'fictional-other-audit',action:'PAYMENT_RECORDED'});
    concurrent.clients[0].address='Dirección FICTICIA actualizada';
    const other=clone(concurrent.credits[0]);other.id='fictional-other-credit';
    other.schedule[1].paymentPromise={id:'fictional-other-promise',status:'ACTIVE',date:'2026-10-18',amount:40};
    concurrent.credits.push(other);h.set(concurrent);release();await pending;
    const actual=h.get();a.deepEqual(actual.payments,concurrent.payments);a.deepEqual(actual.cashMovements,concurrent.cashMovements);
    a.deepEqual(actual.clients,concurrent.clients);a.deepEqual(actual.credits[1],other);
    a.ok(actual.audit.some(x=>x.id==='fictional-other-audit'));
  }finally{await h.close();}
});

test('a changed target credit or concurrent commitment is preserved after ACK without stale overwrite',async()=> {
  for(const changed of ['payment','promise']) {
    const h=await setup();try {
      const A=api(h),release=pause(h),pending=A.set('fictional-promise-credit',1,input);await tick();
      const d=h.get();d.credits[0].version=3;
      if(changed==='payment'){d.credits[0].schedule[0].balance=15;d.credits[0].schedule[0].paid=25;
        d.payments.push({id:'fictional-concurrent-payment',creditId:d.credits[0].id,amount:25});}
      else d.credits[0].schedule[1].paymentPromise={id:'fictional-concurrent-promise',status:'ACTIVE',date:'2026-10-19'};
      h.set(d);release();await a.rejects(pending,/cambió|conflicto|revisión/i);a.deepEqual(h.get(),d,changed);
    }finally{await h.close();}
  }
});

test('late owner change or A/B/A authentication cannot append a commitment to the active portfolio',async()=> {
  for(const aba of [false,true]) {
    const h=await setup();try {
      const A=api(h),release=pause(h),pending=A.set('fictional-promise-credit',1,input);await tick();
      h.auth={...h.auth,uid:'fictional-owner-b'};h.w.firebaseAuthV2.auth.currentUser={uid:h.auth.uid};
      h.w.localStorage.setItem('mi-cartera-v2-local-owner',h.auth.uid);
      h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:h.auth}));
      if(aba){h.auth={...h.auth,uid:'test-admin'};h.w.firebaseAuthV2.auth.currentUser={uid:h.auth.uid};
        h.w.localStorage.setItem('mi-cartera-v2-local-owner',h.auth.uid);
        h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:h.auth}));
      }else h.set({clients:[],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:h.auth.uid,role:'ADMIN'}});
      const before=h.get();release();await a.rejects(pending,/sesión/i);a.deepEqual(h.get(),before);
    }finally{await h.close();}
  }
});

test('rehydrated promise credit and audit are idempotent and retain Cloud metadata',async()=> {
  const h=await setup();try {
    const A=api(h),release=pause(h),pending=A.set('fictional-promise-credit',1,input);await tick();
    const op=h.commits[0],d=h.get();d.credits[0]={...clone(op.entities[0].data),updatedAt:'fictional-cloud-time'};
    d.audit=[{...clone(op.audit),updatedAt:'fictional-cloud-time'}];h.set(d);release();await pending;
    a.deepEqual(h.get(),d);a.equal(d.audit.length,1);
  }finally{await h.close();}
});

test('an ACK identifying another operation never applies a promise locally',async()=> {
  for(const result of [{status:'COMMITTED',operationId:'fictional-wrong'},
    {status:'APPLIED',operation:{id:'fictional-wrong'}}]) {
    const h=await setup();try {
      const A=api(h),release=pause(h),before=h.get(),pending=A.set('fictional-promise-credit',1,input);await tick();
      release(result);await a.rejects(pending,/otra operación/i);a.deepEqual(h.get(),before);
    }finally{await h.close();}
  }
});

test('a paid installment no longer contributes a promise summary or a second agenda obligation',async()=> {
  const h=await setup();try {
    const A=api(h);await A.set('fictional-promise-credit',1,input);const credit=h.get().credits[0];
    credit.schedule[0].balance=0;credit.schedule[0].paid=40;credit.schedule[0].status='PAGADA';
    a.equal(A.summary(credit),null,'summary must derive from the pending installment, never stale credit.paymentPromise');
    a.equal(credit.schedule[0].paymentPromise.status,'ACTIVE','derived view must not rewrite historical metadata');
  }finally{await h.close();}
});

test('agenda associates each commitment with its own installment without repeating it on every debt row',async()=> {
  const h=await setup();try {
    const A=api(h),record=await A.set('fictional-promise-credit',1,input);
    const doc=h.w.document;doc.getElementById('agendaFrom').value='2026-10-01';doc.getElementById('agendaTo').value='2026-10-31';h.w.MiCarteraV2Agenda.render();
    let rows=Array.from(h.w.__v2Agenda);
    a.equal(rows.filter(row=>row.promise).length,1);a.equal(rows.find(row=>row.promise).number,1);
    a.equal(rows.find(row=>row.promise).promise.id,record.id);a.equal(rows[0].date,'2026-10-05');
    a.equal(rows.reduce((sum,row)=>sum+row.amount,0),120);
    a.ok(doc.querySelector('#agendaList .v2-agenda-overdue-label'),'a commitment must not hide the original overdue status');
    await A.cancel('fictional-promise-credit',1);h.w.MiCarteraV2Agenda.render();rows=Array.from(h.w.__v2Agenda);a.equal(rows.filter(row=>row.promise).length,0);
  }finally{await h.close();}
});

test('the fifth additional installment accepts a commitment without adding or moving debt',async()=> {
  const h=await setup();try {
    const d=h.get(),c=d.credits[0];c.capital=600;c.total=720;c.term=4;
    c.schedule=['2026-10-16','2026-10-23','2026-10-30','2026-11-06'].map((date,i)=>({number:i+1,date,amount:100,paid:0,balance:100}));
    c.schedule.push({number:'A1',date:'2026-11-13',amount:320,paid:0,balance:320,extra:true,type:'ADICIONAL'});h.set(d);
    const before=financial(c),record=await api(h).set(c.id,5,{date:'2026-11-13',observation:'Adicional FICTICIA'});
    a.equal(record.installmentNumber,5);a.equal(record.amount,320);a.deepEqual(financial(h.get().credits[0]),before);
    a.equal(h.get().credits[0].schedule.reduce((sum,q)=>sum+q.balance,0),720);
    a.equal(h.get().cashMovements.length,0);a.equal(h.get().payments.length,0);
  }finally{await h.close();}
});

test('a legacy whole-credit commitment is retained in metadata history when an installment commitment replaces its summary',async()=> {
  const h=await setup();try {
    const d=h.get(),legacy={date:'2026-10-18',amount:120,observation:'Compromiso FICTICIO previo'};
    d.credits[0].paymentPromise=legacy;h.set(d);await api(h).set(d.credits[0].id,1,input);
    a.deepEqual(h.get().credits[0].paymentPromiseHistory,[legacy]);a.equal(h.get().credits[0].total,120);
  }finally{await h.close();}
});

test('the real operational serializer and transaction store persist commitment metadata atomically and replay it once',async()=> {
  const h=await setup();try {
    const Store=require('../app/core/transaction-store.js'),Sync=require('../app/cloud/operational-sync.js'),before=h.get();
    const docs=new Map([['credits/fictional-promise-credit',clone(before.credits[0])],['clients/c1',clone(before.clients[0])]]);
    const adapter={runAtomic:async action=>{
      const staged=new Map(docs),result=await action({get:async key=>staged.has(key)?clone(staged.get(key)):null,set:async(key,value)=>staged.set(key,clone(value))});
      docs.clear();for(const [key,value] of staged)docs.set(key,value);return result;
    }};
    const sync=Sync.createOperationalSync({store:Store.createStore(adapter),actorId:'test-admin'});let submitted;
    h.w.MiCarteraV2SyncBridge.submit=async op=>{submitted={...clone(op),createdAt:'2026-10-12T12:00:00Z'};return sync.submit(submitted);};
    const record=await api(h).set('fictional-promise-credit',1,input);
    a.equal(docs.get('credits/fictional-promise-credit').schedule[0].paymentPromise.id,record.id);
    a.deepEqual(financial(docs.get('credits/fictional-promise-credit')),financial(before.credits[0]));
    a.equal(docs.get('credits/fictional-promise-credit').version,2);
    const replay=await sync.submit(submitted);a.equal(replay.status,'ALREADY_APPLIED');
    a.equal([...docs.keys()].filter(key=>key.startsWith('audit/')).length,1);
    a.equal([...docs.keys()].filter(key=>key.startsWith('payments/')||key.startsWith('expenses/')).length,0);
  }finally{await h.close();}
});

test('active admin form registers one installment and an outdated form cannot submit a stale credit',async()=> {
  const h=await setup();try {
    const A=api(h);A.install();h.w.MiCarteraV2Cards.render();await tick();
    a.ok(h.w.document.querySelector('[data-payment-promise-credit="fictional-promise-credit"]'));
    A.open('fictional-promise-credit');const doc=h.w.document;
    a.ok(doc.getElementById('v2PromiseForm'));a.match(doc.getElementById('v2PromiseOriginal').textContent,/2026-10-05/);
    doc.getElementById('v2PromiseDate').value=input.date;doc.getElementById('v2PromiseObservation').value=input.observation;
    await doc.getElementById('v2PromiseSave').onclick();a.equal(h.get().credits[0].schedule[0].paymentPromise.date,input.date);
    A.open('fictional-promise-credit');const before=h.get();before.credits[0].version+=1;h.set(before);
    doc.getElementById('v2PromiseDate').value='2026-10-22';const count=h.commits.length;
    await doc.getElementById('v2PromiseSave').onclick();a.equal(h.commits.length,count);a.deepEqual(h.get(),before);
    a.ok(h.alerts.some(x=>/cambió|revisión/i.test(x)));
  }finally{await h.close();}
});
