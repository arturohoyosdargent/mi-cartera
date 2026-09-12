// Planificación, vista previa y compartir propuestas de crédito.
(async()=>{
  const started=Date.now();
  const wait=()=>new Promise(resolve=>{const tick=()=>{if(typeof window.newCredit==='function'&&typeof window.calcCredit==='function'&&document.getElementById('creditForm'))return resolve();if(Date.now()-started>15000)return resolve();setTimeout(tick,150)};tick()});
  await wait();
  if(typeof window.newCredit!=='function')return;
  if(window.__prestamoYaCreditPlanning)return;
  window.__prestamoYaCreditPlanning=true;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateLabel=v=>v?new Date(v+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}):'-';
  const money2=v=>'S/ '+Number(v||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const state=()=>({date:$('cDate')?.value||today(),first:$('cFirst')?.value||$('cDate')?.value||today(),capital:Number($('cCapital')?.value||0),rate:Number($('cRate')?.value||0),term:Number($('cTerm')?.value||0),freq:$('cFreq')?.value||'daily',rest:$('cRestDay')?.value||'none'});
  const extras=()=>Array.from(document.querySelectorAll('#extraPaymentsList .extraPayment')).map(x=>({date:x.querySelector('.extraDate')?.value||'',amount:Number(x.querySelector('.extraAmount')?.value||0),note:x.querySelector('.extraNote')?.value||'Pago adicional'})).filter(x=>x.date&&x.amount>0);
  const freqLabel=v=>({daily:'Diaria',weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual'}[v]||v);

  function addFields(){
    const form=document.getElementById('creditForm');if(!form||document.getElementById('creditPlanningFields'))return;
    const card=document.createElement('div');card.id='creditPlanningFields';card.className='card';
    card.innerHTML='<b>📅 Pagos adicionales / abonos programados</b><p class="small muted">Programa una fecha adicional fuera del calendario normal. No crea una deuda nueva: es un pago adicional/abono que se aplicará al saldo del crédito.</p><div id="extraPaymentsList"></div><button type="button" class="btn" onclick="addExtraPaymentRow()">＋ Agregar pago adicional</button></div><div class="card" id="creditPreviewCard"><b>👁 Vista previa del préstamo</b><div id="creditPreview"></div><div class="actionbar"><button type="button" class="btn green" onclick="shareCreditProposal()">📤 Enviar propuesta al cliente</button><button type="button" class="btn" onclick="copyCreditProposal()">📋 Copiar propuesta</button></div></div>';
    const actions=form.querySelector('.actionbar');form.querySelector('.card')?.appendChild(card);if(actions)form.querySelector('.card').appendChild(card);else form.appendChild(card);
  }

  // El bloque anterior necesita quedar dentro del formulario, después de los totales. Reubicarlo de forma segura.
  function ensureFields(){
    const form=document.getElementById('creditForm');if(!form)return;
    if(document.getElementById('creditPlanningFields'))return;
    const cards=form.querySelectorAll('.card');const main=cards[0];
    const wrap=document.createElement('div');wrap.innerHTML='<div class="card" id="creditPlanningFields"><b>📅 Pagos adicionales / abonos programados</b><p class="small muted">Programa una fecha adicional fuera del calendario normal. Es un abono adicional al mismo crédito; no aumenta por sí solo el total pactado.</p><div id="extraPaymentsList"></div><button type="button" class="btn" onclick="addExtraPaymentRow()">＋ Agregar pago adicional</button></div><div class="card" id="creditPreviewCard"><b>👁 Vista previa del préstamo</b><div id="creditPreview"></div><div class="actionbar"><button type="button" class="btn green" onclick="shareCreditProposal()">📤 Enviar propuesta al cliente</button><button type="button" class="btn" onclick="copyCreditProposal()">📋 Copiar propuesta</button></div></div>';
    const node=wrap.firstElementChild;const preview=wrap.lastElementChild;form.appendChild(node);form.appendChild(preview);
  }

  window.addExtraPaymentRow=()=>{ensureFields();const list=document.getElementById('extraPaymentsList');const row=document.createElement('div');row.className='extraPayment card';row.style.margin='8px 0';row.innerHTML='<div class="twocol"><div class="field"><label>Fecha adicional</label><input class="input extraDate" type="date" onchange="refreshCreditPreview()"></div><div class="field"><label>Monto S/</label><input class="input extraAmount" type="number" min="0" step="0.01" placeholder="Ej. 210.00" oninput="refreshCreditPreview()"></div></div><div class="field"><label>Detalle</label><input class="input extraNote" value="Pago adicional" oninput="refreshCreditPreview()"></div><button type="button" class="btn red" onclick="this.parentElement.remove();refreshCreditPreview()">Eliminar</button>';list.appendChild(row);refreshCreditPreview()};

  function buildPreview(){
    ensureFields();
    const s=state(), total=s.capital+s.capital*s.rate/100, inst=s.term?total/s.term:0;
    let regular=[];
    if(s.capital>0&&s.term>0&&typeof window.buildSchedule==='function')regular=window.buildSchedule(s.first,s.term,s.freq,s.rest,inst);
    const ex=extras();
    const all=[...regular.map(q=>({...q,kind:'Cuota'})),...ex.map((x,i)=>({n:'A'+(i+1),date:x.date,amount:x.amount,kind:'Adicional',note:x.note}))].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const c=db?.clients?.find(x=>String(x.id)===String(window.selectedClient));
    let h='<div class="grid"><div class="metric">Capital<b>'+money2(s.capital)+'</b></div><div class="metric">Interés<b>'+s.rate.toFixed(2)+'%</b></div><div class="metric">Total pactado<b>'+money2(total)+'</b></div><div class="metric">Cuota regular<b>'+money2(inst)+'</b></div></div>';
    h+='<div class="info"><b>Frecuencia:</b> '+freqLabel(s.freq)+' · <b>'+s.term+' cuotas</b> · <b>1ra fecha:</b> '+dateLabel(s.first)+' · <b>Vencimiento:</b> '+dateLabel($('cMaturity')?.value)+'</div>';
    h+='<h4>Calendario propuesto</h4><table class="table"><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Monto</th></tr>';
    h+=all.map(q=>'<tr><td>'+q.n+'</td><td>'+dateLabel(q.date)+'</td><td>'+q.kind+(q.note?' · '+esc(q.note):'')+'</td><td>'+money2(q.amount)+'</td></tr>').join('')||'<tr><td colspan="4">Ingrese capital y plazo para ver el calendario.</td></tr>';
    h+='</table>';
    if(ex.length)h+='<div class="info"><b>Pagos adicionales programados:</b> '+ex.length+'. Se aplicarán como abonos al mismo crédito.</div>';
    if(c)h='<div class="info"><b>Cliente:</b> '+esc(c.name)+' · <b>Tel:</b> '+esc(c.phone||'-')+'<br><b>Ruta:</b> '+esc(routeName(c.routeId))+'</div>'+h;
    return {html:h,text:proposalText(s,total,inst,regular,ex,c)};
  }
  function proposalText(s,total,inst,regular,ex,c){
    let t='PROPUESTA DE PRÉSTAMO\n\nCliente: '+(c?.name||'-')+'\nCapital: '+money2(s.capital)+'\nInterés: '+s.rate.toFixed(2)+'%\nTotal pactado: '+money2(total)+'\nFrecuencia: '+freqLabel(s.freq)+'\nCuota regular: '+money2(inst)+'\n\nCALENDARIO PROPUESTO\n';
    regular.forEach((q,i)=>t+=(i+1)+'. '+dateLabel(q.date)+' — '+money2(q.amount)+'\n');
    if(ex.length){t+='\nPAGOS ADICIONALES / ABONOS PROGRAMADOS\n';ex.forEach((x,i)=>t+='A'+(i+1)+'. '+dateLabel(x.date)+' — '+money2(x.amount)+' — '+x.note+'\n')}
    t+='\nEsta es una propuesta previa. El crédito no queda registrado hasta que el administrador pulse "Guardar crédito".\n';return t;
  }
  window.refreshCreditPreview=()=>{try{const p=buildPreview();const el=document.getElementById('creditPreview');if(el)el.innerHTML=p.html}catch(e){console.warn('Vista previa de crédito:',e)}};
  window.copyCreditProposal=async()=>{const p=buildPreview();try{await navigator.clipboard.writeText(p.text);toast('Propuesta copiada');}catch(e){toast('No se pudo copiar la propuesta')}};
  window.shareCreditProposal=async()=>{const p=buildPreview();if(!state().capital||!state().term)return toast('Complete capital y plazo antes de enviar');try{if(navigator.share){await navigator.share({title:'Propuesta de préstamo',text:p.text});toast('Propuesta compartida');}else{await navigator.clipboard.writeText(p.text);toast('Propuesta copiada: compártala por WhatsApp o SMS')}}catch(e){if(e?.name!=='AbortError')toast('No se pudo compartir la propuesta')}};

  const rawNewCredit=window.newCredit;
  window.newCredit=(...args)=>{rawNewCredit(...args);setTimeout(()=>{ensureFields();refreshCreditPreview()},50)};
  const rawEditCredit=window.editCredit;
  window.editCredit=(...args)=>{rawEditCredit(...args);setTimeout(()=>{ensureFields();refreshCreditPreview()},50)};
  const rawCalc=window.calcCredit;
  window.calcCredit=(...args)=>{rawCalc(...args);setTimeout(refreshCreditPreview,0)};

  // Mantener los pagos adicionales al guardar, como abonos programados sobre el mismo crédito.
  const rawSave=window.saveCredit;
  window.saveCredit=()=>{
    const ex=extras();
    rawSave();
    setTimeout(()=>{
      const id=window.selectedCredit,cr=(db.credits||[]).find(x=>String(x.id)===String(id));
      if(!cr||!ex.length)return;
      const baseMax=Math.max(0,...(cr.schedule||[]).map(q=>Number(q.n)||0));
      const existingDates=new Set((cr.schedule||[]).map(q=>q.date));
      ex.forEach((x,i)=>{if(existingDates.has(x.date))return;cr.schedule.push({n:baseMax+i+1,date:x.date,amount:x.amount,paid:0,postponed:false,additional:true,note:x.note});});
      cr.schedule.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      if(typeof persist==='function')persist();
      if(typeof enqueueSync==='function')enqueueSync('CREDITO_MODIFICADO',cr);
      if(typeof showCredit==='function')showCredit(cr.id);
    },100);
  };

  // Compartir el detalle actual del crédito desde la pantalla de detalle.
  const rawShow=window.showCredit;
  window.showCredit=(id)=>{rawShow(id);setTimeout(()=>{
    const body=document.getElementById('creditDetailBody');if(!body||body.querySelector('[data-share-credit]'))return;
    const bar=body.querySelector('.actionbar');if(!bar)return;
    const b=document.createElement('button');b.className='btn';b.setAttribute('data-share-credit','1');b.textContent='📤 Compartir detalle';b.onclick=()=>shareCurrentDetail(id);bar.appendChild(b);
  },30)};
  window.shareCurrentDetail=async(id)=>{const cr=db.credits.find(x=>String(x.id)===String(id)),c=db.clients.find(x=>String(x.id)===String(cr?.clientId));if(!cr||!c)return toast('Crédito no encontrado');const s=status(cr);let t='DETALLE DE CRÉDITO\n\nCliente: '+c.name+'\nTel: '+(c.phone||'-')+'\nRuta: '+routeName(cr.routeId)+'\nCapital: '+money2(cr.capital)+'\nInterés: '+cr.rate+'%\nTotal: '+money2(cr.total)+'\nPagado: '+money2(s.paid)+'\nSaldo: '+money2(s.remain)+'\nMora: '+money2(s.overdue)+'\n\nCRONOGRAMA\n';(cr.schedule||[]).forEach(q=>t+=q.n+'. '+dateLabel(q.date)+' — '+money2(q.amount)+' — pagado '+money2(q.paid)+'\n');try{if(navigator.share)await navigator.share({title:'Detalle de crédito · '+c.name,text:t});else{await navigator.clipboard.writeText(t);toast('Detalle copiado')}}catch(e){if(e?.name!=='AbortError')toast('No se pudo compartir el detalle')}};

  ensureFields();refreshCreditPreview();
})();
