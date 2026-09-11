// Nuevo crédito: pagos adicionales, vista previa y propuesta compartible antes de guardar.
(()=>{
  const $=id=>document.getElementById(id);
  const money=v=>'S/ '+Number(v||0).toFixed(2);
  const fmtDate=s=>{if(!s)return '-';const [y,m,d]=String(s).split('-');return d&&m&&y?`${d}/${m}/${y}`:s};
  const esc=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const state={extras:[],accepted:false};
  const wait=()=>{if(!$('creditForm'))return setTimeout(wait,300);install()};
  function install(){
    if(window.__prestamoYaCreditProposal)return;window.__prestamoYaCreditProposal=true;
    const card=$('creditForm').querySelector('.card');if(!card)return;
    const summary=$('cInstallment')?.parentElement?.parentElement;
    const extra=document.createElement('div');extra.id='creditExtrasBox';extra.innerHTML=`<div class="card" style="border-left:5px solid var(--orange)"><b>📅 Pagos adicionales</b><p class="small muted">Agrega una cuota fuera de la frecuencia normal. Ejemplo: préstamo semanal los viernes + una cuota adicional el miércoles.</p><div id="creditExtrasList"></div><div class="actionbar"><button type="button" class="btn orange" onclick="addExtraCreditPayment()">＋ Agregar pago adicional</button></div></div>`;
    if(summary)summary.insertAdjacentElement('afterend',extra);else card.appendChild(extra);
    const actions=card.querySelector('.actionbar:last-child');
    if(actions){
      const old=actions.querySelector('button[onclick^="saveCredit"]');
      if(old){old.textContent='👁️ Revisar y guardar';old.onclick=()=>window.saveCredit();}
      const preview=document.createElement('button');preview.type='button';preview.className='btn green';preview.textContent='📋 Vista previa / Enviar';preview.onclick=()=>window.previewCreditProposal(false);actions.insertBefore(preview,old||null);
    }
    renderExtras();
    const fields=['cCapital','cRate','cTerm','cFreq','cFirst','cDate','cRestDay'];fields.forEach(id=>$(id)?.addEventListener('input',()=>{state.accepted=false;renderExtras();}));
    ['cFreq','cFirst','cRestDay'].forEach(id=>$(id)?.addEventListener('change',()=>{state.accepted=false;renderExtras();}));
    const rawSave=window.saveCredit;
    if(typeof rawSave==='function'){
      window.__rawSaveCredit=rawSave;
      window.saveCredit=()=>{
        if(!state.accepted)return window.previewCreditProposal(false);
        state.accepted=false;
        const before=(window.db?.credits||[]).length;
        const oldRaw=window.__rawSaveCredit;oldRaw();
        setTimeout(()=>applyExtrasAfterSave(before),120);
      };
    }
    wrapDetail();
  }
  function baseData(){
    const cap=+($('cCapital')?.value||0),rate=+($('cRate')?.value||0),n=+($('cTerm')?.value||0),freq=$('cFreq')?.value||'weekly',first=$('cFirst')?.value||$('cDate')?.value||'',rest=$('cRestDay')?.value||'none';
    const total=cap+cap*rate/100,inst=n?total/n:0;
    let schedule=[];if(typeof window.buildSchedule==='function'&&first&&n>0)schedule=window.buildSchedule(first,n,freq,rest,inst);
    return {cap,rate,n,freq,first,rest,total,inst,schedule};
  }
  function addExtra(){
    const d=prompt('Fecha del pago adicional (AAAA-MM-DD):',typeof today==='function'?today():'');if(!d)return;
    const b=baseData(),a=Number(prompt('Monto del pago adicional S/:',b.inst.toFixed(2)));
    if(!Number.isFinite(a)||a<=0)return toast('Monto adicional inválido');
    if(b.schedule.some(x=>x.date===d)||state.extras.some(x=>x.date===d))return toast('Ya existe un pago programado para esa fecha');
    state.extras.push({date:d,amount:a});state.accepted=false;renderExtras();
  }
  function removeExtra(i){state.extras.splice(i,1);state.accepted=false;renderExtras()}
  function renderExtras(){
    const el=$('creditExtrasList');if(!el)return;const b=baseData();
    el.innerHTML=state.extras.length?state.extras.map((x,i)=>`<div class="card"><b>Pago adicional ${i+1}</b><br>Fecha: ${fmtDate(x.date)} · Monto: <b>${money(x.amount)}</b><button class="btn" style="float:right" onclick="removeExtraCreditPayment(${i})">Quitar</button></div>`).join(''):'<div class="small muted">No hay pagos adicionales.</div>';
    const totalExtra=state.extras.reduce((s,x)=>s+x.amount,0);if($('cTotal'))$('cTotal').textContent=money(b.total+totalExtra);
  }
  function proposal(){
    const b=baseData();if(b.cap<=0||b.n<=0||!b.first)return null;
    const schedule=[...b.schedule,...state.extras.map((x,i)=>({n:b.schedule.length+i+1,date:x.date,amount:x.amount,extra:true}))].sort((a,z)=>String(a.date).localeCompare(String(z.date)));
    const total=b.total+state.extras.reduce((s,x)=>s+x.amount,0);return {b,schedule,total};
  }
  function preview(send){
    const p=proposal();if(!p)return toast('Complete capital, primera fecha y número de cuotas');
    const c=window.db?.clients?.find(x=>String(x.id)===String(window.__selectedClientForProposal));
    const name=c?.name||$('creditClientBox')?.textContent?.split('\n')[0]||'Cliente';
    const rows=p.schedule.map((q,i)=>`<tr><td>${i+1}</td><td>${fmtDate(q.date)}</td><td>${q.extra?'ADICIONAL':'CUOTA'}</td><td>${money(q.amount)}</td></tr>`).join('');
    const text=`PROPUESTA DE PRÉSTAMO\nCliente: ${name}\nCapital: ${money(p.b.cap)}\nInterés: ${p.b.rate}%\nTotal programado: ${money(p.total)}\nFrecuencia: ${p.b.freq}\n\nCRONOGRAMA\n${p.schedule.map((q,i)=>`${i+1}. ${fmtDate(q.date)} - ${q.extra?'Pago adicional':'Cuota'} - ${money(q.amount)}`).join('\n')}\n\nEsta es una propuesta previa y no confirma todavía el crédito.`;
    const modal=document.createElement('div');modal.id='creditProposalModal';modal.className='modal open';modal.innerHTML=`<div class="sheet"><button class="btn close" onclick="document.getElementById('creditProposalModal').remove()">✕</button><div class="sectionTitle">📋 Vista previa del préstamo</div><div class="card"><b>${esc(name)}</b><br>Capital: ${money(p.b.cap)} · Interés: ${p.b.rate}%<br>Frecuencia: ${esc(p.b.freq)} · Cuotas: ${p.b.n}${state.extras.length?' + '+state.extras.length+' adicional(es)':''}<br><b>Total programado: ${money(p.total)}</b></div><div class="card"><b>Cronograma propuesto</b><table class="table"><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Importe</th></tr>${rows}</table></div><div class="card"><p class="small muted">El crédito todavía no está guardado. Puedes enviar esta propuesta al cliente para que la revise.</p><div class="actionbar"><button class="btn blue" onclick="shareCreditProposal()">📤 Enviar propuesta</button><button class="btn green" onclick="acceptCreditProposal()">✅ Cliente acepta y guardar</button><button class="btn red" onclick="rejectCreditProposal()">❌ No acepta</button></div></div></div>`;
    document.body.appendChild(modal);window.__creditProposalText=text;if(send)share();
  }
  async function share(){
    const text=window.__creditProposalText||'';
    try{if(navigator.share){await navigator.share({title:'Propuesta de préstamo',text});return}const url='https://wa.me/?text='+encodeURIComponent(text);window.open(url,'_blank','noopener');}catch(e){if(e?.name!=='AbortError')toast('No se pudo abrir el envío')}
  }
  function accept(){state.accepted=true;const m=$('creditProposalModal');if(m)m.remove();window.saveCredit()}
  function reject(){state.accepted=false;const m=$('creditProposalModal');if(m)m.remove();toast('Propuesta rechazada. El crédito no fue guardado.')}
  function applyExtrasAfterSave(before){
    try{
      const arr=window.db?.credits||[],editId=$('editCreditId')?.value;const cr=editId?arr.find(x=>String(x.id)===String(editId)):(arr.length>before?arr[arr.length-1]:null);if(!cr||!state.extras.length)return;
      const extras=[...state.extras],extraTotal=extras.reduce((s,x)=>s+x.amount,0);cr.total=Number(cr.total||0)+extraTotal;cr.schedule=Array.isArray(cr.schedule)?cr.schedule:[];
      const maxN=cr.schedule.reduce((m,q)=>Math.max(m,Number(q.n||0)),0);extras.forEach((x,i)=>cr.schedule.push({n:maxN+i+1,date:x.date,amount:x.amount,paid:0,postponed:false,extra:true}));
      cr.maturity=cr.schedule.reduce((m,q)=>String(q.date)>String(m)?q.date:m,cr.maturity||'');
      if(typeof window.persist==='function')window.persist();if(typeof window.enqueueSync==='function')window.enqueueSync('CREDITO_MODIFICADO',{id:cr.id,extraPayments:extras});
      state.extras=[];renderExtras();if(typeof window.showCredit==='function')window.showCredit(cr.id);
    }catch(e){console.warn('Pagos adicionales:',e)}
  }
  function wrapDetail(){
    if(typeof window.showCredit!=='function'||window.__prestamoYaCreditDetailShare)return;
    const raw=window.showCredit;window.__prestamoYaCreditDetailShare=true;window.__rawShowCredit=raw;
    window.showCredit=(id)=>{window.__selectedCreditForProposal=id;const r=window.__rawShowCredit(id);setTimeout(()=>{
      const body=$('creditDetailBody');if(!body||body.querySelector('#shareCreditDetailBtn'))return;
      const b=body.querySelector('.actionbar');if(!b)return;
      const btn=document.createElement('button');btn.id='shareCreditDetailBtn';btn.className='btn blue';btn.textContent='📤 Enviar / Compartir detalle';btn.onclick=()=>shareCurrentCredit(id);b.appendChild(btn);
      window.__selectedClientForProposal=(window.db?.credits||[]).find(x=>String(x.id)===String(id))?.clientId;
    },80);return r};
  }
  function shareCurrentCredit(id){
    const cr=(window.db?.credits||[]).find(x=>String(x.id)===String(id)),c=cr&&(window.db?.clients||[]).find(x=>String(x.id)===String(cr.clientId));if(!cr||!c)return toast('No se encontró el crédito');
    const s=typeof window.status==='function'?window.status(cr):{paid:cr.paid||0,remain:Math.max(0,Number(cr.total||0)-Number(cr.paid||0)),overdue:0};
    const text=`DETALLE DE CRÉDITO\nCliente: ${c.name}\nTeléfono: ${c.phone||'-'}\nRuta: ${typeof routeName==='function'?routeName(cr.routeId):'-'}\nCapital: ${money(cr.capital)}\nInterés: ${cr.rate}%\nTotal: ${money(cr.total)}\nPagado: ${money(s.paid)}\nSaldo: ${money(s.remain)}\n\nCRONOGRAMA\n${(cr.schedule||[]).map((q,i)=>`${i+1}. ${fmtDate(q.date)} - ${money(q.amount)}${q.extra?' (ADICIONAL)':''}`).join('\n')}`;
    window.__creditProposalText=text;share();
  }
  window.addExtraCreditPayment=addExtra;window.removeExtraCreditPayment=removeExtra;window.previewCreditProposal=preview;window.shareCreditProposal=share;window.acceptCreditProposal=accept;window.rejectCreditProposal=reject;
  wait();
})();
