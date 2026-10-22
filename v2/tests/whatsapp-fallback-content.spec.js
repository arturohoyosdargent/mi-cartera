const {test}=require('node:test');
const a=require('node:assert/strict');
const {boot}=require('./dom-harness.cjs');

function fixture(){return {
  clients:[{id:'fictional-fallback-client',name:'  Ana María Pérez  ',phone:'999111222'}],
  credits:[{id:'fictional-fallback-credit',clientId:'fictional-fallback-client',capital:1000,total:1200,rate:20,term:12,freq:'daily',status:'ACTIVE',version:1,
    schedule:Array.from({length:12},(_,i)=>({number:i+1,date:`2026-10-${String(i+1).padStart(2,'0')}`,amount:100,paid:i<3?100:i===3?40:0,balance:i<3?0:i===3?60:100,status:i<3?'PAGADA':'PENDIENTE'}))}],
  payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}
};}
function brief(message){
  a.match(message,/^Hola Ana,/);a.ok(message.length<300);
  a.doesNotMatch(message,/María|Pérez|S\/|CRONOGRAMA|Capital:|Total:|Saldo:|2026-10|fictional-/);
}

test('WhatsApp contenido: wrapped agenda and collection reminders stay brief when the lazy reminder module is absent',async()=>{
  for(const entry of ['daily','automatic','collections']){
    const h=await boot({fullShell:true,state:fixture()});try{
      const before=JSON.stringify(h.get()),shares=[];
      a.equal(h.w.MiCarteraV2CollectionReminderShare,undefined,'the shell must exercise its real missing-module suggestion');
      Object.defineProperty(h.w.navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(h.w.navigator,'share',{configurable:true,value:async payload=>{shares.push(payload);}});
      h.w.URL.createObjectURL=()=> 'blob:fictional-fallback-preview';h.w.URL.revokeObjectURL=()=>{};
      if(entry!=='collections'){
        if(entry==='daily')h.load('app/agenda-v2.js');
        h.w.document.getElementById('agendaFrom').value='2026-10-04';h.w.document.getElementById('agendaTo').value='2026-10-04';
        h.w.MiCarteraV2Agenda.render();h.w.MiCarteraV2SharePreview.wrap();
      }
      const pending=entry==='collections'?h.w.MiCarteraV2Cards.remind('fictional-fallback-credit'):h.w.MiCarteraV2Agenda.remind('fictional-fallback-credit:4');
      await new Promise(resolve=>setImmediate(resolve));
      const modal=h.w.document.getElementById('v2SharePreview'),field=modal?.querySelector('#v2SharePreviewMessage');a.ok(field);brief(field.value);
      a.equal(field.readOnly,false);a.equal(shares.length,0);a.ok(modal.querySelector('img'));
      a.ok(h.drawn.includes('Próximas 6 de 9 cuotas pendientes'));a.ok(h.drawn.includes('S/ 340.00'));a.ok(h.drawn.includes('S/ 860.00'));
      field.value='Mensaje personal intacto · S/ 60';await [...modal.querySelectorAll('.v2-share-preview-actions button')].find(button=>button.textContent==='Confirmar y enviar').onclick();
      a.equal(await pending,'file-share');a.equal(shares.length,1);a.equal(shares[0].text,field.value);a.equal(shares[0].files.length,1);a.equal(shares[0].files[0].type,'image/png');
      a.equal(h.w.MiCarteraV2CollectionReminderShare,undefined);a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,0);
    }finally{await h.close();}
  }
});
