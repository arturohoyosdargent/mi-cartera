const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{boot}=require('./dom-harness.cjs');
const tick=()=>new Promise(r=>setTimeout(r,30));
const settled=promise=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve('unresolved'),200))]);
async function setup(){const h=await boot({fullShell:true});h.w.MiCarteraV2AuthCloudGate.ORG='v2-mi-cartera-pilot';h.w.MiCarteraV2Dates.today=()=> '2026-10-09';
 h.w.firebaseAuthV2={auth:{currentUser:{uid:'test-admin'}}};h.w.localStorage.setItem('mi-cartera-v2-local-owner','test-admin');
 if(!h.w.MiCarteraV2CreditEvaluationUI){if(!fs.existsSync(path.join(__dirname,'../app/credit-evaluation-ui-v2.js'))){await h.close();a.fail('Evaluation UI missing');}h.load('app/credit-evaluation-v2.js');h.load('app/credit-evaluation-ui-v2.js');}
 return h;}
test('mobile/PC client evaluation opens real evidence without changing any client, payment, balance or cash',async()=>{
 for(const width of [390,1280]){const h=await setup();try{h.w.innerWidth=width;const before=h.get();h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2CreditEvaluationUI.decorateClients();const button=h.w.document.querySelector('.v2-client-evaluation-button');a.ok(button);a.match(button.textContent,/🟡 Evaluación/);button.click();const panel=h.w.document.getElementById('v2CreditEvaluationPanel');a.ok(panel);a.match(panel.textContent,/Cliente Prueba/);a.match(panel.textContent,/No determinado/);a.match(panel.textContent,/Recomendación/);a.deepEqual(h.get(),before);a.equal(h.commits.length,0);}finally{await h.close();}}
});
test('portfolio has all three filters and partial/accent-insensitive name search across every client',async()=>{
 const h=await setup();try{const d=h.get();d.clients=Array.from({length:14},(_,i)=>({id:'c'+i,name:i===13?'Álex Final':'Cliente '+i}));h.set(d);h.w.MiCarteraV2CreditEvaluationUI.openPortfolio();const search=h.w.document.getElementById('v2EvaluationSearch');a.ok(search);search.value='alex';search.dispatchEvent(new h.w.Event('input'));const list=h.w.document.getElementById('v2EvaluationList');a.match(list.textContent,/Álex Final/);a.ok(!list.textContent.includes('Cliente 1'));a.equal(h.w.document.querySelectorAll('[data-evaluation-filter]').length,4);a.equal(h.commits.length,0);}finally{await h.close();}
});
test('shared customer report uses existing editable graphical preview and hides internal evidence/formulas',async()=>{
 const h=await setup();try{let outgoing;Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(h.w.navigator,'share',{value:x=>{outgoing=x;return Promise.resolve()},configurable:true});const before=h.get();const pending=h.w.MiCarteraV2CreditEvaluationUI.share('c1');await tick();const preview=h.w.document.getElementById('v2SharePreview');a.ok(preview);const message=preview.querySelector('#v2SharePreviewMessage');a.match(message.value,/EN OBSERVACIÓN/);a.ok(!/c1|test-admin|formula|scoring|≥|>=/.test(message.value));message.value='Mensaje revisado por el administrador';await preview.querySelectorAll('.v2-share-preview-actions button')[2].onclick();a.equal(await pending,'file-share');a.equal(outgoing.text,message.value);a.equal(outgoing.files[0].type,'image/png');a.ok(outgoing.files[0].size>0);a.deepEqual(h.get(),before);a.equal(h.commits.length,0);}finally{await h.close();}
});
test('session switching closes evaluation panels and blocks stale report sharing',async()=>{
 const h=await setup();try{const pending=h.w.MiCarteraV2CreditEvaluationUI.share('c1');await tick();h.w.MiCarteraV2AuthCloudGate.state=()=>({ready:true,uid:'other-user',role:'admin'});const modal=h.w.document.getElementById('v2SharePreview');await modal.querySelectorAll('.v2-share-preview-actions button')[2].onclick();a.equal(await pending,'share-failed');a.equal(h.commits.length,0);h.w.MiCarteraV2CreditEvaluationUI.open('c1');a.equal(h.w.document.getElementById('v2CreditEvaluationPanel'),null);}finally{await h.close();}
});
test('logout and relogin with the same UID invalidates a previous evaluation preview',async()=>{
 const h=await setup();try{let sends=0;Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(h.w.navigator,'share',{value:()=>{sends++;return Promise.resolve()},configurable:true});
 const pending=h.w.MiCarteraV2CreditEvaluationUI.share('c1');await tick();const modal=h.w.document.getElementById('v2SharePreview'),send=modal.querySelectorAll('.v2-share-preview-actions button')[2];
 h.w.MiCarteraV2AuthCloudGate.state=()=>({ready:false,uid:null});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:false}}));a.equal(h.w.document.getElementById('v2SharePreview'),null);
 h.w.MiCarteraV2AuthCloudGate.state=()=>({ready:true,uid:'test-admin',role:'admin'});h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true}}));await send.onclick();a.equal(await pending,'share-failed');a.equal(sends,0);
 }finally{await h.close();}
});
test('a stale gate UID cannot read or share a different Firebase/owner session',async()=>{
 const h=await setup();try{h.w.firebaseAuthV2.auth.currentUser.uid='new-user';h.w.localStorage.setItem('mi-cartera-v2-local-owner','new-user');a.equal(h.w.MiCarteraV2CreditEvaluationUI.open('c1'),false);a.equal(await h.w.MiCarteraV2CreditEvaluationUI.share('c1'),'share-failed');a.equal(h.commits.length,0);}finally{await h.close();}
});
test('changing the tenant getter without a verified membership event blocks evaluation',async()=>{
 const h=await setup();try{h.w.MiCarteraV2AuthCloudGate.ORG='different-org';a.equal(h.w.MiCarteraV2CreditEvaluationUI.open('c1'),false);a.equal(await h.w.MiCarteraV2CreditEvaluationUI.share('c1'),'share-failed');a.equal(h.commits.length,0);}finally{await h.close();}
});
test('temporary owner invalidation cancels a report still preparing even when the original owner returns',async()=>{
 const h=await setup();try{const renderer=await h.w.MiCarteraV2PaymentReceipt.ensureRenderer();let finish;h.w.MiCarteraV2PaymentReceipt.ensureRenderer=()=>new Promise(resolve=>{finish=resolve;});const pending=h.w.MiCarteraV2CreditEvaluationUI.share('c1');h.w.localStorage.setItem('mi-cartera-v2-local-owner','other-owner');h.w.dispatchEvent(new h.w.Event('storage'));h.w.localStorage.setItem('mi-cartera-v2-local-owner','test-admin');h.w.dispatchEvent(new h.w.Event('storage'));finish(renderer);await tick();a.equal(!!h.w.document.getElementById('v2SharePreview'),false);a.equal(await pending,'prepare-failed');}finally{await h.close();}
});

test('latest evaluation share keeps its preview when an earlier PNG finishes late',{timeout:30000},async()=>{
 const h=await setup();try{const d=h.get();d.clients.push({id:'c2',name:'Cliente B FICTICIO'});h.set(d);const before=h.get(),renderer=await settled(h.w.MiCarteraV2PaymentReceipt.ensureRenderer());a.equal(typeof renderer.evaluation,'function');let finish;
 h.w.MiCarteraV2PaymentReceipt.ensureRenderer=async()=>({...renderer,evaluation:(report,client)=>client.id==='c1'?new Promise(resolve=>{finish=resolve;}):renderer.evaluation(report,client)});
 const first=h.w.MiCarteraV2CreditEvaluationUI.share('c1');await tick();a.equal(typeof finish,'function','first report must be preparing PNG');const second=h.w.MiCarteraV2CreditEvaluationUI.share('c2');await tick();const newest=h.w.document.getElementById('v2SharePreview');a.match(newest.textContent,/Cliente B FICTICIO/);
 finish(new h.w.Blob(['fictional-delayed-png'],{type:'image/png'}));await tick();a.ok(h.w.document.getElementById('v2SharePreview')===newest,'earlier preparation must not replace the latest preview');a.equal(await settled(first),'cancelled');
 newest.querySelectorAll('.v2-share-preview-actions button')[1].click();a.equal(await settled(second),'cancelled');a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});

test('latest evaluation share resolves an earlier open preview and blocks its retained send callback',{timeout:30000},async()=>{
 const h=await setup();try{const d=h.get();d.clients.push({id:'c2',name:'Cliente B FICTICIO'});h.set(d);const before=h.get();let sends=0,oldSend;Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(h.w.navigator,'share',{value:()=>{sends++;return Promise.resolve();},configurable:true});
 const preview=h.w.MiCarteraV2SharePreview,open=preview.open;preview.open=config=>{oldSend??=config.send;return open(config);};const first=h.w.MiCarteraV2CreditEvaluationUI.share('c1');await tick();const second=h.w.MiCarteraV2CreditEvaluationUI.share('c2');await tick();
 a.equal(await settled(first),'cancelled','replaced preview must resolve its promise');const newest=h.w.document.getElementById('v2SharePreview');a.match(newest.textContent,/Cliente B FICTICIO/);
 a.equal(await oldSend('Mensaje anterior'),'cancelled');a.equal(sends,0);a.ok(h.w.document.getElementById('v2SharePreview')===newest);
 newest.querySelectorAll('.v2-share-preview-actions button')[1].click();a.equal(await settled(second),'cancelled');a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});

test('owner readiness refreshes existing client and portfolio views after verified login',async()=>{
 const h=await setup();try{const before=h.get();h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2CreditEvaluationUI.openPortfolio();h.w.localStorage.removeItem('mi-cartera-v2-local-owner');
 h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:true,uid:'test-admin',role:'admin'}}));a.equal(h.w.document.querySelectorAll('.v2-client-evaluation-button').length,0);a.match(h.w.document.getElementById('v2EvaluationList').textContent,/Inicia sesión/);
 h.w.localStorage.setItem('mi-cartera-v2-local-owner','test-admin');h.w.dispatchEvent(new h.w.CustomEvent('v2-local-owner-ready',{detail:{ready:true,uid:'test-admin'}}));
 a.ok(h.w.document.querySelector('.v2-client-evaluation-button'));a.match(h.w.document.getElementById('v2EvaluationList').textContent,/Cliente Prueba/);a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});

test('owner readiness cannot authorize an unverified tenant change',async()=>{
 const h=await setup();try{const before=h.get();h.w.MiCarteraV2Cards.render();h.w.MiCarteraV2CreditEvaluationUI.openPortfolio();h.w.MiCarteraV2AuthCloudGate.ORG='different-org';
 h.w.dispatchEvent(new h.w.CustomEvent('v2-local-owner-ready',{detail:{ready:true,uid:'test-admin',role:'admin',org:'different-org',authenticated:true,member:true}}));
 a.equal(h.w.document.querySelectorAll('.v2-client-evaluation-button').length,0);a.match(h.w.document.getElementById('v2EvaluationList').textContent,/Inicia sesión/);a.equal(h.w.MiCarteraV2CreditEvaluationUI.open('c1'),false);a.equal(await h.w.MiCarteraV2CreditEvaluationUI.share('c1'),'share-failed');a.deepEqual(h.get(),before);a.equal(h.commits.length,0);
 }finally{await h.close();}
});
