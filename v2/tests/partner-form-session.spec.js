// Real partner forms/actions; Auth, Cloud and local storage hold fictional fixtures only.
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
const OWNER='mi-cartera-v2-local-owner';
const loan={id:'fictional-loan',partner:'SOCIO FICTICIO A',date:'2026-09-01',principal:1000,rate:10,firstDue:'2026-10-01'};
async function setup(t){
 const h=await boot();t.after(()=>h.close());h.w.MiCarteraV2Dates.today=()=> '2026-10-13';
 h.load('core/partner-loans.js');h.load('app/partner-loans-ui.js');h.w.MiCarteraPartners.install();
 const d=h.get();d.cashMovements=[h.w.MiCarteraPartnerLoans.entry(h.w.MiCarteraPartnerLoans.create(loan))];h.set(d);h.w.MiCarteraPartners.render();
 return h;
}
function switchActor(h,uid='fictional-admin-B',emit=true){
 const auth={uid,role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
 h.w.MiCarteraV2AuthCloudGate.state=()=>({...auth});h.w.MiCarteraV2AuthCloudGate.requireReady=()=>({...auth});
 h.w.firebaseAuthV2.auth.currentUser={uid};h.w.localStorage.setItem(OWNER,uid);
 const d=h.get();d.session={actorId:uid,role:'ADMIN',routeIds:[]};h.set(d);
 if(emit)h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:auth}));
}
function open(h,action){
 const doc=h.w.document;
 const selector={create:'#addPartnerLoan',interest:'[data-interest="fictional-loan"]',repay:'[data-repay="fictional-loan"]',settle:'[data-settle]'}[action];
 doc.querySelector(selector).click();const panel=doc.getElementById('partnerForm'),form=panel.querySelector('form');
 if(action==='create'){
  const fields={partner:'BORRADOR FICTICIO A',date:'2026-10-13',principal:'500',rate:'10',firstDue:'2026-11-13'};
  for(const [name,value] of Object.entries(fields))form.querySelector('[name="'+name+'"]').value=value;
 }
 return {panel,form,submit:()=>form.onsubmit({preventDefault(){},target:form})};
}

// Removing the draft identity guard must let A's inputs create a movement attributed to B.
for(const action of ['create','interest','repay','settle'])for(const emit of [true,false])test('stale '+action+' form cannot save as another authorized administrator '+(emit?'after auth event':'without auth event'),async t=>{
 const h=await setup(t),draft=open(h,action);switchActor(h,'fictional-admin-B',emit);const before=h.get();
 if(emit)a.equal(Boolean(h.w.document.getElementById('partnerForm')),false,'close A draft even when B retains management access');
 await draft.submit();a.equal(h.commits.length,0);a.deepEqual(h.get(),before);
 const fresh=open(h,action);await fresh.submit();a.equal(h.commits.length,1);a.equal(h.get().audit.at(-1).actorId,'fictional-admin-B');
});

// Checking only before the dialog would allow an identity change during confirmation to transmit old inputs.
for(const action of ['create','interest','repay','settle'])test('session change during '+action+' confirmation cannot submit the old draft',async t=>{
 const h=await setup(t),draft=open(h,action);let before;
 h.w.confirm=()=>{switchActor(h);before=h.get();return true};
 await draft.submit();a.equal(h.commits.length,0);a.deepEqual(h.get(),before);a.equal(Boolean(h.w.document.getElementById('partnerForm')),false);
});

for(const action of ['create','interest','repay','settle'])test('A to B to A cannot reactivate a detached '+action+' draft and A can save a fresh form',async t=>{
 const h=await setup(t),draft=open(h,action);switchActor(h);switchActor(h,'test-admin');const before=h.get();
 await draft.submit();a.equal(h.commits.length,0);a.deepEqual(h.get(),before);
 const fresh=open(h,action);await fresh.submit();a.equal(h.commits.length,1);a.equal(h.get().audit.at(-1).actorId,'test-admin');
});

test('native Auth user mismatch closes a draft before a financial submission',async t=>{
 const h=await setup(t),draft=open(h,'create'),before=h.get();
 h.w.firebaseAuthV2.auth.currentUser={uid:'fictional-native-B'};h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state'));
 a.equal(Boolean(h.w.document.getElementById('partnerForm')),false);await draft.submit();a.equal(h.commits.length,0);a.deepEqual(h.get(),before);
});
