// Real shell/forms/actions; only Cloud/Auth transport fixtures and storage are fictional.
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
async function setup(){
 const h=await boot({fullShell:true}),d=h.get();
 d.commercial=[{id:'fictional-route',recordType:'ROUTE',name:'RUTA FICTICIA',active:true,version:1},{id:'fictional-worker',workerId:'fictional-worker',recordType:'WORKER',name:'GESTOR FICTICIO',routeId:'fictional-route',active:true,version:1}];
 d.clients[0].version=1;d.credits=[{id:'fictional-credit',clientId:'c1',routeId:'r1',status:'ACTIVO',capital:100,total:100,version:1,schedule:[{n:1,date:'2026-10-12',amount:100,paid:0,balance:100}]}];
 h.set(d);h.w.MiCarteraV2CommercialUI.render();return h;
}
function switchActor(h,emit){
 const auth={uid:'fictional-admin-B',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
 h.w.MiCarteraV2AuthCloudGate.state=()=>({...auth});h.w.MiCarteraV2AuthCloudGate.requireReady=()=>({...auth});
 h.w.firebaseAuthV2.auth.currentUser={uid:auth.uid};h.w.localStorage.setItem('mi-cartera-v2-local-owner',auth.uid);
 const d=h.get();d.session={actorId:auth.uid,role:'ADMIN',routeIds:[]};h.set(d);
 if(emit)h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:auth}));
}
for(const emit of [true,false])test('commercial draft cannot submit under another authorized administrator '+(emit?'after auth event':'without auth event'),async()=>{
 const h=await setup();try{
  const ui=h.w.MiCarteraV2CommercialUI;ui.openForm('route','fictional-route');
  const form=h.w.document.getElementById('v2CommercialForm');form.querySelector('#v2ComName').value='BORRADOR DEL ADMINISTRADOR A';
  switchActor(h,emit);const before=h.get();a.equal(h.w.MiCarteraV2CommercialActions.canView(),true,'B remains authorized to manage its current view');
  if(emit)a.equal(h.w.document.getElementById('v2CommercialForm'),null,'the old actor draft must be removed immediately');
  await form.onsubmit({preventDefault(){}});
  a.equal(h.commits.length,0,'an old form handler must never create an operation for B');a.deepEqual(h.get(),before);
  ui.openForm('route','fictional-route');const current=h.w.document.getElementById('v2CommercialForm');current.querySelector('#v2ComName').value='RUTA CONFIRMADA POR B';await current.onsubmit({preventDefault(){}});
  a.equal(h.commits.length,1,'B can save a fresh form');a.equal(h.get().commercial.find(x=>x.id==='fictional-route').name,'RUTA CONFIRMADA POR B');a.equal(h.get().audit.at(-1).actorId,'fictional-admin-B');
 }finally{await h.close();}
});
for(const emit of [true,false])test('cash draft cannot become another administrator movement '+(emit?'after auth event':'without auth event'),async()=>{
 const h=await setup();try{
  const doc=h.w.document;doc.querySelector('[data-v2-cash-type="INGRESO"]').click();const panel=doc.getElementById('v2CashForm');
  panel.querySelector('#v2CashAmount').value='75';panel.querySelector('#v2CashConcept').value='APORTE FICTICIO DEL ADMINISTRADOR A';
  const save=panel.querySelector('[data-save]');switchActor(h,emit);const before=h.get();
  if(emit)a.equal(doc.getElementById('v2CashForm'),null,'the old actor cash draft must be removed immediately');
  await save.onclick();a.equal(h.commits.length,0,'old cash input must not be committed as B');a.deepEqual(h.get(),before);
  doc.querySelector('[data-v2-cash-type="INGRESO"]').click();const current=doc.getElementById('v2CashForm');current.querySelector('#v2CashAmount').value='25';current.querySelector('#v2CashConcept').value='APORTE FICTICIO CONFIRMADO POR B';await current.querySelector('[data-save]').onclick();
  a.equal(h.commits.length,1,'B can save a fresh cash form');a.equal(h.get().cashMovements.at(-1).amount,25);a.equal(h.get().audit.at(-1).actorId,'fictional-admin-B');
 }finally{await h.close();}
});
