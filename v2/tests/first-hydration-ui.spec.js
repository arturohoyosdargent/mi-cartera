'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
process.env.SOURCE=path.resolve(__dirname,'..');const {boot}=require('./dom-harness.cjs');
test('first authenticated Firebase hydration immediately displays actual credit cards without pressing a filter',async t=>{
 const h=await boot({fullShell:true,state:{clients:[],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}}});t.after(()=>h.close());
 const records={clients:[{id:'hydration-client',name:'CLIENTE FICTICIO REHIDRATADO',version:1}],credits:[{id:'hydration-credit',clientId:'hydration-client',capital:100,total:120,principalPaid:0,interestPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-15',amount:120,balance:120,paid:0}]}]};
 h.w.firestoreV2={db:{},collection:(_db,...parts)=>parts.at(-1),getDocs:async name=>({forEach:fn=>(records[name]||[]).forEach(row=>fn({id:row.id,data:()=>row}))})};
 const ready=h.w.MiCarteraV2AuthCloudGate.state;h.w.MiCarteraV2AuthCloudGate.state=()=>({ready:false});h.load('app/cloud-rehydration-v2.js');await new Promise(r=>setTimeout(r,0));h.w.MiCarteraV2AuthCloudGate.state=ready;
 const result=await h.w.MiCarteraV2CloudRehydration.rehydrate();a.equal(result.status,'REHYDRATED');a.equal(h.get().credits.length,1);a.match(h.w.document.getElementById('creditsList').textContent,/CLIENTE FICTICIO REHIDRATADO/);a.equal(Boolean(h.w.document.querySelector('[data-credit-id="hydration-credit"]')),true);a.equal(h.commits.length,0);
});
