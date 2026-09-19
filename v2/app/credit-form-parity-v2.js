// Mi Cartera PRO V2 — credit form parity, including optional additional installments.
(function(root){
  'use strict';

  const K='mi-cartera-v2-validation-state';
  const $=id=>document.getElementById(id);
  const money=n=>Number(n||0).toFixed(2);
  const roundMoney=n=>Math.round((Number(n)||0)*100)/100;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function norm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')}
  function parseLocalDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null}
  function formatLocalDate(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
  function addDays(value,n){const date=parseLocalDate(value);if(!date)return '';date.setDate(date.getDate()+Number(n||0));return formatLocalDate(date)}
  function addMonths(value,n){const date=parseLocalDate(value);if(!date)return '';const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+Number(n||0));const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(Math.min(day,last));return formatLocalDate(date)}
  function maturity(first,term,freq){term=Number(term);if(!parseLocalDate(first)||!(term>0))return '';const periods=Math.max(0,term-1);if(freq==='monthly')return addMonths(first,periods);const step={daily:1,weekly:7,biweekly:14}[freq]||1;return addDays(first,periods*step)}
  function clients(){try{return JSON.parse(localStorage.getItem(K)||'{}').clients||[]}catch{return []}}
  function resolveClient(query,list=clients()){const q=String(query??'').trim();if(!q)return null;const all=Array.isArray(list)?list:[],byId=all.find(c=>String(c.id??'')===q);if(byId)return byId;const nq=norm(q),byName=all.find(c=>norm(c.name)===nq);if(byName)return byName;if(nq.length<2)return null;const hits=all.filter(c=>[c.name,c.phone,c.dni,c.reference].some(v=>norm(v).includes(nq)));return hits.length===1?hits[0]:null}
  function selectedClient(){return resolveClient($('cClient')?.value)}
  function refreshClientOptions(){
    const input=$('cClient');if(!input)return;
    let list=$('creditClientOptions');
    if(!list){list=document.createElement('datalist');list.id='creditClientOptions';input.setAttribute('list',list.id);input.insertAdjacentElement('afterend',list)}
    list.innerHTML='';
    for(const c of clients().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'))){const o=document.createElement('option');o.value=String(c.name||c.id||'');o.label=[c.phone,c.dni,c.reference].filter(Boolean).join(' · ');o.dataset.clientId=String(c.id||'');list.appendChild(o)}
    const label=input.previousElementSibling;if(label?.tagName==='LABEL')label.textContent='Cliente (buscar por nombre)';input.placeholder='Busca por nombre, teléfono o DNI';input.setAttribute('autocomplete','off');
  }
  function updateClientTools(){const c=selectedClient(),info=$('creditClientInfo');if(info)info.textContent=c?`${c.name}${c.phone?' · '+c.phone:''}${c.address?' · '+c.address:''}${c.reference?' · Ref: '+c.reference:''}`:'Busca y selecciona un cliente registrado para usar ubicación, Maps, Waze y WhatsApp.';for(const id of ['creditMaps','creditWaze','creditWhatsApp','creditProposalShare'])if($(id))$(id).disabled=!c}
  function navigate(provider){const c=selectedClient();if(!c)return alert('Selecciona primero un cliente registrado.');try{root.MiCarteraV2CustomerExperience.openMap(provider,{address:c.address||'',location:c.location||''})}catch(e){alert(e.message||'El cliente no tiene dirección o ubicación válida.')}}
  function whatsapp(){const c=selectedClient();if(!c)return alert('Selecciona primero un cliente registrado.');if(!String(c.phone||'').trim())return alert('El cliente no tiene teléfono registrado.');root.MiCarteraV2CustomerExperience.whatsapp(c,`Hola ${c.name||''}. Te contactamos desde Mi Cartera PRO por tu crédito.`)}

  function readExtraPayments(){
    return [...document.querySelectorAll('[data-v2-extra-row]')].map(row=>({date:String(row.querySelector('[data-v2-extra-date]')?.value||''),amount:roundMoney(row.querySelector('[data-v2-extra-amount]')?.value||0)})).filter(x=>x.date&&x.amount>0);
  }
  function nextExtraDate(first,term,freq){
    const last=maturity(first,term,freq);if(!last)return '';
    if(freq==='monthly')return addMonths(last,1);
    return addDays(last,{daily:1,weekly:7,biweekly:14}[freq]||1);
  }
  function plan(input={}){
    const capital=Number(input.capital??($('cCapital')?.value||0)),rate=Number(input.rate??($('cRate')?.value||0)),term=Number(input.term??($('cTerm')?.value||0)),freq=input.freq??($('cFreq')?.value||''),first=input.firstPaymentDate??($('cFirst')?.value||''),restDay=input.restDay??($('cRestDay')?.value||'');
    const total=roundMoney(capital*(1+rate/100));
    const extraPayments=(input.extraPayments??readExtraPayments()).map(x=>({date:String(x.date||''),amount:roundMoney(x.amount)})).filter(x=>x.date&&x.amount>0);
    const extraTotal=roundMoney(extraPayments.reduce((sum,x)=>sum+x.amount,0));
    const regularTotal=roundMoney(total-extraTotal);
    let schedule=[],error='';
    try{if(total>0&&Number.isInteger(term)&&term>0&&first){const S=root.MiCarteraV2Schedule;if(extraPayments.length&&S?.generateWithExtras)schedule=S.generateWithExtras({total,term,freq,firstPaymentDate:first,restDay,extraPayments});else if(S?.generate)schedule=S.generate({total,term,freq,firstPaymentDate:first,restDay});}}catch(e){error=String(e?.message||e||'SCHEDULE_ERROR')}
    const regularInstallment=term>0?regularTotal/term:0;
    const last=schedule.length?schedule[schedule.length-1].date:maturity(first,term,freq);
    return {capital,rate,term,freq,first,restDay,total,extraPayments,extraTotal,regularTotal,installment:regularInstallment,regularInstallment,schedule,maturity:last,error};
  }
  function extraSummary(p){
    if(!p.extraPayments.length)return 'Sin cuota adicional. El sistema dividirá el total entre las cuotas normales.';
    if(p.error)return `Revisa la cuota adicional: ${p.error}`;
    return `Adicional: ${money(p.extraTotal)} · Cuota normal recalculada: ${money(p.regularInstallment)} · Total conservado: ${money(p.total)}`;
  }
  function renderSchedulePreview(){
    const el=$('v2SchedulePreview');if(!el)return;
    const p=plan();
    if(!p.capital||!p.term||!p.first){el.innerHTML='<b>Vista previa del cronograma</b><p class="metric">Completa capital, cuotas y primera fecha de pago.</p>';return}
    const rows=p.schedule.length?p.schedule:[];
    const error=p.error?`<p style="color:#9e2020"><b>Revisar:</b> ${esc(p.error)}</p>`:'';
    el.innerHTML=`<b>Vista previa del cronograma</b><p class="metric">${esc(extraSummary(p))}</p>${error}<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left">#</th><th style="text-align:left">Fecha</th><th style="text-align:left">Tipo</th><th style="text-align:right">Importe</th><th style="text-align:right">Saldo</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${esc(q.number??q.n??'')}</td><td>${esc(q.date)}</td><td>${q.extra?'ADICIONAL':'CUOTA'}</td><td style="text-align:right">S/ ${money(q.amount)}</td><td style="text-align:right">S/ ${money(q.balance??q.amount)}</td></tr>`).join('')||'<tr><td colspan="5">No se pudo construir el cronograma.</td></tr>'}</tbody></table></div>`;
  }
  function calc(){
    const p=plan();
    if($('cTotalPreview'))$('cTotalPreview').textContent='S/ '+money(p.total);
    if($('cInstallmentPreview'))$('cInstallmentPreview').textContent='S/ '+money(p.regularInstallment);
    if($('cMaturity'))$('cMaturity').value=p.maturity||maturity(p.first,p.term,p.freq);
    if($('v2ExtraSummary'))$('v2ExtraSummary').textContent=extraSummary(p);
    renderSchedulePreview();
  }
  function addExtraRow(seed={}){
    const host=$('v2ExtraRows');if(!host)return;
    const row=document.createElement('div');row.className='card';row.dataset.v2ExtraRow='1';row.style.margin='8px 0';
    const title=document.createElement('b');title.textContent=`Cuota adicional ${host.children.length+1}`;row.appendChild(title);
    const fields=document.createElement('div');fields.className='row';
    const dateBox=document.createElement('div'),dateLabel=document.createElement('label');dateLabel.textContent='Fecha';const date=document.createElement('input');date.type='date';date.className='input';date.dataset.v2ExtraDate='1';date.value=seed.date||nextExtraDate($('cFirst')?.value,Number($('cTerm')?.value||0),$('cFreq')?.value||'');dateBox.append(dateLabel,date);
    const amountBox=document.createElement('div'),amountLabel=document.createElement('label');amountLabel.textContent='Monto que pagará el cliente S/';const amount=document.createElement('input');amount.type='number';amount.step='0.01';amount.min='0.01';amount.className='input';amount.dataset.v2ExtraAmount='1';amount.value=seed.amount??'';amountBox.append(amountLabel,amount);
    fields.append(dateBox,amountBox);row.appendChild(fields);
    const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Quitar cuota adicional';remove.addEventListener('click',()=>{row.remove();renumberExtraRows();calc()});row.appendChild(remove);host.appendChild(row);
    date.addEventListener('input',calc);amount.addEventListener('input',calc);date.addEventListener('change',calc);amount.addEventListener('change',calc);renumberExtraRows();calc();
  }
  function renumberExtraRows(){document.querySelectorAll('[data-v2-extra-row]').forEach((row,i)=>{const title=row.querySelector('b');if(title)title.textContent=`Cuota adicional ${i+1}`})}
  function resetExtraPayments(){const host=$('v2ExtraRows');if(host)host.innerHTML='';calc()}
  function mountScheduleEditor(){
    if($('v2ExtraScheduleBox'))return;
    const form=$('creditForm'),anchor=$('cTotalPreview')?.closest('.grid');if(!form)return;
    const box=document.createElement('div');box.id='v2ExtraScheduleBox';box.className='card';box.innerHTML='<b>＋ Cuota adicional (opcional)</b><p class="metric">Ejemplo: deuda total S/720, cuatro cuotas semanales de S/100 y una quinta cuota adicional de S/320. Las cuotas normales se recalculan y la deuda total no aumenta.</p><div id="v2ExtraRows"></div><button id="v2AddExtraPayment" type="button" class="btn">＋ Agregar cuota adicional</button><div id="v2ExtraSummary" class="metric" style="margin-top:8px"></div>';
    if(anchor)anchor.insertAdjacentElement('beforebegin',box);else form.querySelector('.card')?.appendChild(box);
    const preview=document.createElement('div');preview.id='v2SchedulePreview';preview.className='card';preview.style.overflow='auto';if(anchor)anchor.insertAdjacentElement('afterend',preview);else form.querySelector('.card')?.appendChild(preview);
    $('v2AddExtraPayment').addEventListener('click',()=>addExtraRow());
    renderSchedulePreview();
  }
  function bindNewCredit(){for(const button of [...document.querySelectorAll('button')].filter(x=>/nuevo crédito/i.test(String(x.textContent||''))))if(!button.dataset.v2ExtraResetBound){button.dataset.v2ExtraResetBound='1';button.addEventListener('click',resetExtraPayments,true)}}
  function installDurableScheduleOverride(){
    if(root.__v2ExtraScheduleWrapped){
      const handler=root.__v2ExtraScheduleHandler;
      if(handler){
        if(root.V2UI)root.V2UI.addCredit=handler;
        const save=$('saveCredit');if(save)save.onclick=handler;
      }
      return true;
    }
    const S=root.MiCarteraV2Schedule,actions=root.MiCarteraV2DurableActions;
    if(!S?.generate||!actions?.addCredit)return false;
    const raw=actions.addCredit;
    async function addCreditWithExtras(){
      const p=plan();
      if(!p.extraPayments.length)return raw.apply(this,arguments);
      if(p.error){alert(`Corrige el cronograma: ${p.error}`);return}
      const original=S.generate;
      S.generate=function(input){
        const sameTotal=Math.abs(Number(input?.total||0)-p.total)<0.005;
        const sameTerm=Number(input?.term)===p.term;
        const sameFrequency=String(input?.freq||'')===String(p.freq||'');
        const sameStart=String(input?.firstPaymentDate||'')===String(p.first||'');
        return sameTotal&&sameTerm&&sameFrequency&&sameStart?p.schedule:original.call(this,input);
      };
      try{return await raw.apply(this,arguments)}finally{S.generate=original}
    }
    actions.addCredit=addCreditWithExtras;
    if(root.V2UI)root.V2UI.addCredit=addCreditWithExtras;
    const save=$('saveCredit');if(save)save.onclick=addCreditWithExtras;
    root.__v2ExtraScheduleHandler=addCreditWithExtras;
    root.__v2ExtraScheduleWrapped=true;
    return true;
  }
  function proposalText(c){
    const p=plan();
    if(!(p.capital>0)||!(p.term>0)||!p.first)throw new Error('Completa capital, cuotas y primera fecha antes de compartir la propuesta.');
    if(p.error)throw new Error(`Corrige el cronograma: ${p.error}`);
    const freqLabel={daily:'diaria',weekly:'semanal',biweekly:'quincenal',monthly:'mensual'}[p.freq]||p.freq;
    const rows=p.schedule.map(q=>`${q.number??q.n}. ${q.date} · ${q.extra?'Pago adicional':'Cuota'} · S/ ${money(q.amount)}`).join('\n');
    return `Hola ${c?.name||''}. Esta es tu propuesta de crédito de Mi Cartera PRO:\n\nCapital: S/ ${money(p.capital)}\nInterés: ${p.rate}%\nTotal: S/ ${money(p.total)}\nCuotas: ${p.term} (${freqLabel})\nMonto por cuota: S/ ${money(p.regularInstallment)}\nCuota adicional: S/ ${money(p.extraTotal)}\nPrimera cuota: ${p.first}\nÚltima cuota: ${p.maturity||'-'}\n\nCRONOGRAMA\n${rows}\n\nRevisa estas condiciones antes de aceptar el crédito.`;
  }
  async function shareProposal(){const c=selectedClient();if(!c)return alert('Selecciona primero un cliente registrado.');let msg;try{msg=proposalText(c)}catch(e){return alert(e.message)}const hasPhone=Boolean(String(c.phone||'').trim());if(hasPhone&&root.MiCarteraV2CustomerExperience?.whatsapp){try{root.MiCarteraV2CustomerExperience.whatsapp(c,msg);return 'whatsapp'}catch(e){console.warn('V2 proposal WhatsApp failed; continuing with fallback.',e)}}if(navigator.share){try{await navigator.share({title:'Mi Cartera PRO · Propuesta de crédito',text:msg});return 'native-share'}catch(e){if(e?.name==='AbortError')return 'cancelled';console.warn('V2 proposal native share failed; continuing with clipboard.',e)}}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(msg);alert(hasPhone?'Propuesta copiada. Puedes pegarla en WhatsApp.':'El cliente no tiene teléfono registrado. La propuesta quedó copiada para compartirla por otro medio.');return 'clipboard'}throw new Error(hasPhone?'CREDIT_PROPOSAL_SHARE_UNAVAILABLE':'CREDIT_PROPOSAL_SHARE_UNAVAILABLE_NO_PHONE')}
  function renderClientTools(){
    const input=$('cClient');if(!input)return;refreshClientOptions();
    if($('creditClientInfo')){updateClientTools();return}
    const box=document.createElement('div');box.id='creditClientTools';box.className='card';box.innerHTML='<b>Ubicación y contacto del cliente</b><p id="creditClientInfo" class="metric">Busca y selecciona un cliente registrado para usar ubicación, Maps, Waze y WhatsApp.</p><div class="row"><button class="btn blue" id="creditMaps" type="button">🗺️ Google Maps</button><button class="btn" id="creditWaze" type="button">🚗 Waze</button><button class="btn green" id="creditWhatsApp" type="button">💬 WhatsApp</button><button class="btn green" id="creditProposalShare" type="button">📤 Compartir propuesta</button></div>';
    input.insertAdjacentElement('afterend',box);$('creditMaps').onclick=()=>navigate('maps');$('creditWaze').onclick=()=>navigate('waze');$('creditWhatsApp').onclick=whatsapp;$('creditProposalShare').onclick=shareProposal;updateClientTools();
  }
  function filter(status){document.querySelectorAll('[data-credit-card]').forEach(el=>{const s=el.dataset.status||'';el.style.display=!status||s===status?'':'none'});document.querySelectorAll('[data-credit-filter]').forEach(b=>b.classList.toggle('blue',b.dataset.creditFilter===status))}
  function install(){
    renderClientTools();mountScheduleEditor();bindNewCredit();
    ['cCapital','cRate','cTerm','cFreq','cFirst','cRestDay'].forEach(id=>{const el=$(id);el?.addEventListener('input',calc);el?.addEventListener('change',calc)});
    $('cClient')?.addEventListener('input',updateClientTools);$('cClient')?.addEventListener('change',updateClientTools);calc();updateClientTools();
    setTimeout(()=>{if(!installDurableScheduleOverride())setTimeout(installDurableScheduleOverride,100)},0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  root.addEventListener?.('storage',()=>{refreshClientOptions();updateClientTools()});
  root.addEventListener?.('mi-cartera-v2-sync',()=>{refreshClientOptions();updateClientTools()});
  root.addEventListener?.('load',()=>setTimeout(installDurableScheduleOverride,0));
  root.MiCarteraV2CreditFormParity={calc,maturity,filter,addDays,addMonths,norm,resolveClient,selectedClient,refreshClientOptions,updateClientTools,navigate,whatsapp,proposalText,shareProposal,renderClientTools,readExtraPayments,plan,addExtraRow,resetExtraPayments,renderSchedulePreview,installDurableScheduleOverride};
})(window);
