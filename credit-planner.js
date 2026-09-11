// Planificador de crédito: cuotas automáticas, pagos adicionales, vista previa y envío al cliente.
(()=>{
  const wait=()=>new Promise(resolve=>{const t=()=>{if(document.getElementById('creditForm')&&typeof window.newCredit==='function')return resolve();setTimeout(t,250)};t()});
  wait().then(()=>{
    if(window.__prestamoYaCreditPlanner)return;window.__prestamoYaCreditPlanner=true;
    const $=id=>document.getElementById(id);
    const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
    const iso=d=>{const x=new Date(d+'T12:00:00');return Number.isNaN(x.getTime())?'':x.toISOString().slice(0,10)};
    const pretty=d=>{const x=new Date(d+'T12:00:00');return Number.isNaN(x.getTime())?d:x.toLocaleDateString('es-PE')};
    const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return iso(x)};
    const addMonths=(d,n)=>{const x=new Date(d+'T12:00:00');x.setMonth(x.getMonth()+n);return iso(x)};
    const nextDate=(d,f)=>f==='daily'?addDays(d,1):f==='weekly'?addDays(d,7):f==='biweekly'?addDays(d,14):addMonths(d,1);
    const getPlan=()=>{
      const capital=Number($('cCapital')?.value||0),rate=Number($('cRate')?.value||0),term=Math.max(0,Number($('cTerm')?.value||0)),freq=$('cFreq')?.value||'weekly',first=$('cFirst')?.value||$('cDate')?.value||'',rest=$('cRestDay')?.value||'none';
      const total=capital+(capital*rate/100),base=term?total/term:0, rows=[];let d=first;
      for(let i=1;i<=term;i++){if(!d)break;let guard=0;while(rest!=='none'&&new Date(d+'T12:00:00').getDay()===Number(rest)&&guard++<7)d=addDays(d,1);rows.push({n:i,date:d,amount:base});d=nextDate(d,freq)}
      return {capital,rate,term,freq,first,total,base,rows};
    };
    const render=()=>{
      const p=getPlan();let extra=window.__prestamoYaExtraPayments||[];
      const html=`<div class="card" id="creditPlanner"><b>📅 Vista previa del préstamo</b><div class="small muted" style="margin:5px 0 8px">Revisa las fechas y agrega pagos adicionales antes de guardar.</div><div class="grid"><div class="metric">Total<b>${money(p.total)}</b></div><div class="metric">Cuota<b>${money(p.base)}</b></div></div><div style="overflow:auto;margin-top:8px"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Importe</th></tr></thead><tbody>${p.rows.map(r=>`<tr><td>${r.n}</td><td>${pretty(r.date)}</td><td>Cuota</td><td>${money(r.amount)}</td></tr>`).join('')}${extra.map((r,i)=>`<tr><td>+</td><td>${pretty(r.date)}</td><td>Adicional</td><td>${money(r.amount)}</td></tr>`).join('')}</tbody></table></div><div class="actionbar"><button class="btn" type="button" id="addExtraPayment">＋ Agregar pago adicional</button><button class="btn blue" type="button" id="shareCreditPlan">📤 Enviar al cliente</button></div></div>`;
      let box=$('creditPlanner');if(!box){box=document.createElement('div');box.id='creditPlanner';$('creditForm')?.querySelector('.card')?.appendChild(box)}box.outerHTML=html;
      $('addExtraPayment')?.addEventListener('click',()=>{const date=prompt('Fecha del pago adicional (AAAA-MM-DD):',p.first||new Date().toISOString().slice(0,10));if(!date)return;const amount=Number(String(prompt('Monto del pago adicional:',p.base.toFixed(2))||'').replace(',','.'));if(!Number.isFinite(amount)||amount<=0)return toast('Monto adicional no válido');(window.__prestamoYaExtraPayments||(window.__prestamoYaExtraPayments=[])).push({date:iso(date),amount});render()});
      $('shareCreditPlan')?.addEventListener('click',sharePlan);
    };
    const sharePlan=async()=>{
      const p=getPlan(),extra=window.__prestamoYaExtraPayments||[],client=($('creditClientBox')?.innerText||'').trim();
      const lines=['PRÉSTAMO YA','Propuesta de préstamo',client,'',`Capital: ${money(p.capital)}`,`Interés: ${p.rate}%`,`Total a pagar: ${money(p.total)}`,`Cuota: ${money(p.base)}`,`Frecuencia: ${$('cFreq')?.selectedOptions?.[0]?.textContent||p.freq}`,'','Cronograma:'];
      p.rows.forEach(r=>lines.push(`${r.n}. ${pretty(r.date)} — ${money(r.amount)}`));extra.forEach(r=>lines.push(`Adicional. ${pretty(r.date)} — ${money(r.amount)}`));lines.push('','Esta es una propuesta. El crédito se registrará solo después de que el cliente la acepte.');
      const text=lines.join('\n');
      try{if(navigator.share){await navigator.share({title:'Propuesta de préstamo',text});}else{await navigator.clipboard.writeText(text);toast('Propuesta copiada para enviarla al cliente')}}catch(e){if(e?.name!=='AbortError')toast('No se pudo compartir la propuesta')}};
    const oldNew=window.newCredit;window.newCredit=function(...args){window.__prestamoYaExtraPayments=[];const r=oldNew.apply(this,args);setTimeout(render,150);return r};
    ['cDate','cFirst','cCapital','cRate','cTerm','cFreq','cRestDay'].forEach(id=>$(id)?.addEventListener('input',render));
    ['cFreq','cRestDay'].forEach(id=>$(id)?.addEventListener('change',render));
    const oldSave=window.saveCredit;window.saveCredit=function(...args){
      const p=getPlan(),extra=(window.__prestamoYaExtraPayments||[]).map(x=>({...x,type:'ADICIONAL'}));
      const before=new Set((window.db?.credits||[]).map(x=>String(x.id)));const result=oldSave.apply(this,args);
      setTimeout(()=>{
        try{const cr=(window.db?.credits||[]).find(x=>!before.has(String(x.id)))||((window.db?.credits||[]).find(x=>String(x.id)==String($('editCreditId')?.value||'')));
          if(cr){cr.extraPayments=extra;cr.schedule=Array.isArray(cr.schedule)?cr.schedule.map((s,i)=>({...s,kind:s.kind||'CUOTA',paymentType:s.paymentType||'CUOTA',n:s.n||i+1})):p.rows.map(r=>({n:r.n,date:r.date,amount:r.amount,paid:0,kind:'CUOTA',paymentType:'CUOTA'}));if(extra.length)cr.schedule=[...cr.schedule,...extra.map((x,i)=>({n:`A${i+1}`,date:x.date,amount:x.amount,paid:0,kind:'ADICIONAL',paymentType:'ADICIONAL'}))];if(typeof window.persist==='function')window.persist();if(typeof window.renderAll==='function')window.renderAll();}
        }catch(e){console.warn('Planificador de crédito:',e)}
      },300);return result;
    };
    setTimeout(render,250);
  });
})();
