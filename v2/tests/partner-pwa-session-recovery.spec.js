const {test}=require('node:test'),a=require('node:assert/strict');
const {boot,KEY}=require('./dom-harness.cjs');
const OWNER='mi-cartera-v2-local-owner',QUEUE='mi-cartera-v2-cloud-operations:test-admin';
async function setup({owner='test-admin',session=null}={}){
  const h=await boot({fullShell:true});
  const d=h.get();d.session=session;
  d.cashMovements=[h.w.MiCarteraPartnerLoans.entry(h.w.MiCarteraPartnerLoans.create({id:'fictional-partner',partner:'Socio ficticio',date:'2026-09-01',principal:500,rate:10,firstDue:'2026-10-01',historical:true}))];
  h.set(d);if(owner!==null)h.w.localStorage.setItem(OWNER,owner);
  h.w.localStorage.setItem(QUEUE,JSON.stringify([{id:'fictional-pending',status:'PENDIENTE',operation:{actorId:'test-admin',type:'PAYMENT'}}]));
  const journal='mi-cartera-v2-journal-admin-closures:'+QUEUE;h.w.localStorage.setItem(journal,'[{"id":"fictional-closure","status":"CERRADO_ADMIN"}]');
  let reads=0,writes=0;h.w.firestoreV2={db:{},collection:()=>{reads++;throw Error('No Cloud read is allowed during pending recovery');},setDoc:()=>{writes++;throw Error('No Cloud write is allowed during pending recovery');}};
  h.w.MiCarteraPartners.render();h.load('app/cloud-rehydration-v2.js');
  const before=h.get(),queue=h.w.localStorage.getItem(QUEUE),closed=h.w.localStorage.getItem(journal);
  return {...h,verifyRows(){const after=h.get();for(const key of Object.keys(before).filter(x=>x!=='session'))a.deepEqual(after[key],before[key],key+' must be preserved');a.equal(h.w.localStorage.getItem(QUEUE),queue);a.equal(h.w.localStorage.getItem(journal),closed);a.equal(reads,0);a.equal(writes,0);a.equal(h.commits.length,0);}};
}
test('same-owner PWA session recovery restores the home panel and More navigation without consuming pending financial operations',async()=>{
  const h=await setup();try{
    const doc=h.w.document,button=doc.querySelector('#more [data-partner-module]');a.equal(button.disabled,true);
    const result=await h.w.MiCarteraV2CloudRehydration.rehydrate();a.equal(result.status,'SKIPPED_PENDING_LOCAL_OPERATIONS');
    a.equal(h.get().session?.actorId,'test-admin');a.equal(h.get().session?.role,'admin');
    a.equal(doc.getElementById('partnerInterestNotice').hidden,false);a.match(doc.getElementById('partnerInterestNotice').textContent,/Intereses por pagar a socios/);
    a.equal(button.disabled,false);a.equal(button.hidden,false);h.w.show('more');button.click();a.equal(doc.querySelector('.page.active').id,'partners');
    h.verifyRows();
  }finally{h.close()}
});
test('preserved sign-out retains same-owner proof for the next authorized PWA session',async()=>{
  const h=await setup({owner:null,session:{actorId:'test-admin',role:'ADMIN'}});try{
    h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:false,authenticated:false,preserveLocal:true}}));
    a.equal(h.get().session,null);a.equal(h.w.localStorage.getItem(OWNER),'test-admin');
    await h.w.MiCarteraV2CloudRehydration.rehydrate();a.equal(h.get().session.actorId,'test-admin');a.equal(h.w.document.querySelector('#more [data-partner-module]').disabled,false);h.verifyRows();
  }finally{h.close()}
});
for(const scenario of ['foreign-owner','unknown-owner','foreign-session','foreign-queue','ambiguous-legacy-queue','unverified-auth','collector'])test('PWA session recovery preserves access rejection for '+scenario,async()=>{
  const h=await setup({owner:scenario==='foreign-owner'?'other-owner':scenario==='unknown-owner'?null:'test-admin',session:scenario==='foreign-session'?{actorId:'other-owner',role:'ADMIN'}:null});try{
    if(scenario==='foreign-queue')h.w.localStorage.setItem('mi-cartera-v2-cloud-operations:other-owner','[{"status":"PENDIENTE"}]');
    if(scenario==='ambiguous-legacy-queue')h.w.localStorage.setItem('mi-cartera-v2-cloud-operations','{malformed');
    if(scenario==='unverified-auth')h.w.MiCarteraV2AuthCloudGate.state=()=>({uid:'test-admin',role:'admin',ready:false});
    if(scenario==='collector'){const auth={uid:'test-admin',role:'cobrador',ready:true};h.w.MiCarteraV2AuthCloudGate.state=()=>auth;h.w.MiCarteraV2AuthCloudGate.requireReady=()=>auth;}
    const before=h.w.localStorage.getItem(KEY),owner=h.w.localStorage.getItem(OWNER);
    await h.w.MiCarteraV2CloudRehydration.rehydrate();a.equal(h.w.localStorage.getItem(KEY),before);a.equal(h.w.localStorage.getItem(OWNER),owner);a.equal(h.w.MiCarteraPartners.canView(),false);h.verifyRows();
  }finally{h.close()}
});
test('More actually hides the Socios button when management access is rejected',async()=>{
  const h=await setup({owner:'other-owner'});try{const b=h.w.document.querySelector('#more [data-partner-module]');a.equal(b.hidden,true);a.equal(b.disabled,true);a.equal(h.w.getComputedStyle(b).display,'none');h.verifyRows();}finally{h.close()}
});
