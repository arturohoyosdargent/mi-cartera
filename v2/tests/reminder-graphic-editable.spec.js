const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

function fixture(){return {
  clients:[{id:'fictional-client',name:'Manuel Coronado Cordova',phone:'999111222'}],
  credits:[{id:'fictional-credit',clientId:'fictional-client',capital:600,total:600,principalPaid:100,interestPaid:0,status:'ACTIVE',version:1,
    schedule:Array.from({length:24},(_,i)=>({number:i+1,date:'2026-10-'+String(i+3).padStart(2,'0'),amount:25,paid:i<4?25:0,balance:i<4?0:25,status:i<4?'PAGADA':'PENDIENTE'}))}],
  payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}
};}
async function setup(width=390){
  const h=await boot({fullShell:true,state:fixture()});
  Object.defineProperty(h.w,'innerWidth',{value:width,configurable:true});
  h.load('app/collection-reminder-share-v2.js');
  const shares=[],revoked=[];let nativeCallsBeforeCanvas=0;
  Object.defineProperty(h.w.navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(h.w.navigator,'share',{value:data=>{shares.push(data);return Promise.resolve();},configurable:true});
  const originalCanvas=h.w.HTMLCanvasElement.prototype.toBlob;
  h.w.HTMLCanvasElement.prototype.toBlob=function(callback){nativeCallsBeforeCanvas+=shares.length;originalCanvas.call(this,callback)};
  h.w.URL.createObjectURL=blob=>{a.equal(blob.type,'image/png');return 'blob:fictional-credit-preview';};
  h.w.URL.revokeObjectURL=url=>revoked.push(url);
  h.w.MiCarteraV2CustomerExperience.reminder=()=>{throw Error('Text-only external transport must not be used in this flow')};
  h.w.MiCarteraV2Cards.render();
  return {...h,shares,revoked,canvasSharedEarly:()=>nativeCallsBeforeCanvas};
}
async function preview(h,source='collections'){
  const pending=source==='collections'?h.w.MiCarteraV2Cards.remind('fictional-credit'):
    h.w.MiCarteraV2Agenda.remind('fictional-credit:5');
  await new Promise(resolve=>setImmediate(resolve));
  const modal=h.w.document.getElementById('v2SharePreview');a.ok(modal,'the existing confirmation preview must open');
  return {pending,modal,field:modal.querySelector('#v2SharePreviewMessage'),buttons:modal.querySelectorAll('.v2-share-preview-actions button')};
}

for(const width of [1280,390])test('Cobranza reminder shares the existing credit PNG and the final edited message at viewport '+width,async()=>{
  const h=await setup(width);try{
    const before=h.w.localStorage.getItem('mi-cartera-v2-validation-state'),href=h.w.location.href;
    const {pending,modal,field,buttons}=await preview(h);
    a.equal(h.shares.length,0,'preview must never send before confirmation');
    a.equal(field.readOnly,false,'reminder text must actually be editable');
    a.match(field.value,/Hola Manuel Coronado Cordova, te recordamos que tienes un pago pendiente de S\/ 25\.00 con vencimiento el 7\/10\/2026\./);
    a.ok(!field.value.includes('2026-10-07'));a.ok(!field.value.includes('\\n'));
    a.match(modal.querySelector('img')?.getAttribute('src')||'',/^blob:/,'preview must show the already generated credit graphic');
    a.ok(h.drawn.includes('DETALLE DEL CRÉDITO'),'must reuse the approved credit renderer');
    a.ok(!h.drawn.includes('RECORDATORIO DE PAGO'),'must not create a different reminder card');
    field.value='Hola Manuel, coordinamos tu pago.\\nNos vemos a las 5.';
    const confirmation=buttons[2].onclick();
    a.equal(h.shares.length,1,'file share must start in the confirmation gesture, before awaiting image generation');
    await confirmation;a.equal(await pending,'file-share');
    a.equal(h.shares[0].text,'Hola Manuel, coordinamos tu pago.\nNos vemos a las 5.');
    a.equal(h.shares[0].files.length,1);a.equal(h.shares[0].files[0].type,'image/png');a.ok(h.shares[0].files[0].size>0);
    a.equal(h.shares[0].files[0].name,'prestamo-ya-detalle-credito.png');
    a.equal(h.canvasSharedEarly(),0);a.equal(h.w.location.href,href,'must not invoke the obsolete text-only WhatsApp route');
    a.equal(h.w.localStorage.getItem('mi-cartera-v2-validation-state'),before);a.equal(h.commits.length,0);
    a.deepEqual(h.revoked,['blob:fictional-credit-preview']);
  }finally{h.close()}
});

test('agenda reminder resolves its credit and retains the editable graphic flow',async()=>{
  const h=await setup();try{
    h.w.document.getElementById('agendaFrom').value='2026-10-07';h.w.document.getElementById('agendaTo').value='2026-10-07';h.w.MiCarteraV2Agenda.render();
    const {pending,field,buttons}=await preview(h,'agenda');field.value='Mensaje de agenda editado';
    await buttons[2].onclick();a.equal(await pending,'file-share');a.equal(h.shares[0].text,'Mensaje de agenda editado');a.equal(h.shares[0].files[0].type,'image/png');a.equal(h.commits.length,0);
  }finally{h.close()}
});

test('cancelling a reminder sends no message and releases the graphical preview',async()=>{
  const h=await setup();try{const {pending,buttons}=await preview(h);buttons[1].onclick();a.equal(await pending,'cancelled');a.equal(h.shares.length,0);a.deepEqual(h.revoked,['blob:fictional-credit-preview']);a.equal(h.commits.length,0);}finally{h.close()}
});

test('a browser without PNG sharing reports the limitation and never falls back to text-only WhatsApp',async()=>{
  const h=await setup();try{
    Object.defineProperty(h.w.navigator,'canShare',{value:()=>false,configurable:true});
    const href=h.w.location.href,{pending,buttons}=await preview(h);await buttons[2].onclick();
    a.equal(await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve('unresolved-share'),100))]),'share-failed');a.equal(h.shares.length,0);a.equal(h.w.location.href,href);a.match(h.alerts.at(-1),/no admite compartir.*PNG/);a.equal(h.commits.length,0);
  }finally{h.close()}
});

test('failed graphic preparation cannot silently send a textual reminder',async()=>{
  const h=await setup();try{
    h.w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};
    const pending=h.w.MiCarteraV2Cards.remind('fictional-credit');await new Promise(resolve=>setImmediate(resolve));
    h.w.document.querySelector('#v2SharePreview .v2-share-preview-actions button:nth-child(2)')?.onclick();
    a.equal(await pending,'prepare-failed');a.equal(h.shares.length,0);a.equal(h.w.document.getElementById('v2SharePreview'),null);a.match(h.alerts.at(-1),/ficha gráfica/);a.equal(h.commits.length,0);
  }finally{h.close()}
});

test('a changed authenticated owner cannot share a reminder prepared in the previous session',async()=>{
  const h=await setup();try{
    const {pending,buttons}=await preview(h);h.w.MiCarteraV2AuthCloudGate.state=()=>({uid:'another-fictional-owner',role:'admin',ready:true});
    await buttons[2].onclick();a.equal(await pending,'share-failed');a.equal(h.shares.length,0);a.match(h.alerts.at(-1),/sesión cambió/);a.equal(h.commits.length,0);
  }finally{h.close()}
});
