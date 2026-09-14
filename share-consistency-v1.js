// Préstamo Ya — Centro único de compartir v7.0
(()=>{
'use strict';
if(window.__prestamoYaShareConsistencyV70)return;
window.__prestamoYaShareConsistencyV70=true;

const db=()=>window.db||{clients:[],credits:[]};
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const clientById=id=>(db().clients||[]).find(c=>String(c.id)===String(id))||null;
const creditById=id=>(db().credits||[]).find(c=>String(c.id)===String(id))||null;
const fmtDate=d=>{if(!d)return '-';try{return new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')}catch(e){return String(d)}};

function paymentCaption(c){
 const x=window.__prestamoYaLastPaymentShare;
 if(!x||Date.now()-Number(x.at||0)>86400000)return null;
 if(x.clientName&&String(c?.name||'')!==String(x.clientName))return null;
 const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[];
 const ps=Array.isArray(x.partialQuotas)?x.partialQuotas:[];
 if(qs.length)return `Préstamo Ya — Cuota${qs.length>1?'s':''} ${qs.join(', ')} pagada${qs.length>1?'s':''}`;
 if(ps.length)return `Préstamo Ya — Abono a cuota ${ps.join(', ')} registrado`;
 return 'Préstamo Ya — Pago registrado';
}

function defaultCaption(kind,c){
 if(kind==='payment')return paymentCaption(c)||'Préstamo Ya — Pago registrado';
 if(kind==='proposal')return 'Préstamo Ya — Crédito preaprobado';
 if(kind==='renewal')return 'Préstamo Ya — Renovación preaprobada';
 return 'Préstamo Ya — Detalle del crédito';
}

function roundRect(x,y,w,h,r,fill,stroke){const ctx=window.__pyCtx;if(!ctx)return;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function text(ctx,s,x,y,size,bold=false,color='#18345f',align='left'){ctx.font=`${bold?'700':'400'} ${size}px Arial`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(s??''),x,y)}
function wrap(ctx,s,max,size,bold=false){ctx.font=`${bold?'700':'400'} ${size}px Arial`;const out=[];let line='';for(const w of String(s||'').split(' ')){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=max)line=t;else{if(line)out.push(line);line=w}}if(line)out.push(line);return out}
function drawHeader(ctx,W,y,title,subtitle){
 const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'#1189df');g.addColorStop(1,'#27b4ed');ctx.fillStyle=g;ctx.fillRect(0,y,W,155);
 text(ctx,'PRÉSTAMO YA',58,y+62,44,true,'#fff');text(ctx,'Tus metas, más cerca',60,y+104,24,false,'#fff');
 text(ctx,title,W-58,y+58,24,true,'#fff','right');text(ctx,subtitle||'CONFIANZA · COMPROMISO · TU PROGRESO',W-58,y+95,16,false,'#fff','right');
}
function makeCanvas(H){const c=document.createElement('canvas');c.width=1000;c.height=H;const ctx=c.getContext('2d');ctx.fillStyle='#f4f9fd';ctx.fillRect(0,0,1000,H);window.__pyCtx=ctx;return c}
function row(ctx,label,value,y,accent=false){ctx.strokeStyle='#dbe7f1';ctx.beginPath();ctx.moveTo(70,y+30);ctx.lineTo(930,y+30);ctx.stroke();text(ctx,label,82,y,21,false,'#49627f');text(ctx,value,920,y,22,true,accent?'#0878d1':'#17345f','right')}

function recentMovements(cr,last){
 const schedule=Array.isArray(cr?.schedule)?cr.schedule:[];
 const paid=schedule.filter(q=>Number(q.paid||0)>0).map(q=>({date:q.date,n:q.n,amount:Number(q.paid||0)}));
 const x=last||{};const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[];const amount=Number(x.paidAmount||0);
 if(qs.length){
   const now=x.at?new Date(Number(x.at)).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
   paid.push({date:now,n:qs.length>1?`Cuotas ${qs[0]} y ${qs[qs.length-1]}`:`Cuota ${qs[0]}`,amount});
 }
 const seen=new Set();return paid.sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(r=>{const k=String(r.date)+'|'+String(r.n)+'|'+r.amount;if(seen.has(k))return false;seen.add(k);return true}).slice(0,3);
}

async function friendlyPaymentImage(c,cr){
 const x=window.__prestamoYaLastPaymentShare||{};const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[];const ps=Array.isArray(x.partialQuotas)?x.partialQuotas:[];
 const paidCount=Array.isArray(cr?.schedule)?cr.schedule.filter(q=>Number(q.paid||0)>=Number(q.amount||0)-0.009).length:0;
 const totalCount=Array.isArray(cr?.schedule)?cr.schedule.filter(q=>!q.extra).length:Number(cr?.term||0);
 const pct=totalCount?Math.min(100,Math.round(paidCount/totalCount*100)):0;
 const H=1540,c=makeCanvas(H),ctx=c.getContext('2d'),W=1000;
 drawHeader(ctx,W,0,'PAGO RECIBIDO','Cada cuota te acerca más a tus metas');
 roundRect(42,180,916,122,22,'#fff','#dbeaf5');
 text(ctx,'✓',95,260,72,true,'#13a86b');text(ctx,'PAGO RECIBIDO',185,228,38,true,'#0d9b62');text(ctx,'¡Gracias por tu cumplimiento!',185,270,23,false,'#405a76');
 roundRect(58,325,884,82,18,'#eef8ff');text(ctx,'Cliente',84,358,18,false,'#49627f');text(ctx,c?.name||'Cliente',84,389,28,true,'#17345f');
 const concept=qs.length?`Cuotas ${qs.join(' y ')}`:ps.length?`Abono a cuota ${ps.join(', ')}`:'Pago registrado';
 const paidAmount=Number(x.paidAmount||0);const balance=Math.max(0,Number(cr?.total||0)-Number(cr?.paid||0));
 row(ctx,'Cuota(s) pagada(s):',concept,448);row(ctx,'Monto pagado:',money(paidAmount),500,true);row(ctx,'Fecha de pago:',fmtDate(x.at?new Date(Number(x.at)).toISOString().slice(0,10):new Date().toISOString()),552);row(ctx,'Saldo pendiente:',money(balance),604);row(ctx,'Próximo vencimiento:',fmtDate(cr?.maturity||cr?.dueDate||''),656);
 roundRect(58,724,884,126,18,'#eaf6ff');text(ctx,`${paidCount} de ${totalCount} cuotas pagadas`,84,765,25,true,'#17345f');text(ctx,`${pct}%`,915,765,25,true,'#0878d1','right');ctx.fillStyle='#d5e0e9';roundRect(84,790,832,22,11,'#d5e0e9');roundRect(84,790,Math.max(12,832*pct/100),22,11,'#168edc');
 roundRect(58,878,884,250,18,'#fff','#dbe7f1');text(ctx,'↻',84,925,40,true,'#0878d1');text(ctx,'Últimos movimientos',138,918,27,true,'#17345f');
 const rows=recentMovements(cr,x);const heads=[['Fecha',90],['Concepto',330],['Monto',865]];heads.forEach(h=>text(ctx,h[0],h[1],964,18,true,'#49627f',h[0]==='Monto'?'right':'left'));let yy=1002;rows.forEach((r,i)=>{if(i%2===0){ctx.fillStyle='#f5f9fc';ctx.fillRect(75,yy-28,850,46)}text(ctx,fmtDate(r.date),90,yy,17,false,'#334e6c');text(ctx,String(r.n).startsWith('Cuota')?r.n:`Cuota ${r.n}`,330,yy,17,false,'#334e6c');text(ctx,money(r.amount),865,yy,18,true,'#0878d1','right');yy+=48});
 roundRect(58,1160,884,170,18,'#eaf6ff');text(ctx,'▰',90,1230,42,true,'#168edc');text(ctx,'¡Gracias por tu pago!',155,1212,27,true,'#0878d1');text(ctx,'Seguimos avanzando juntos.',155,1250,22,false,'#405a76');text(ctx,'Tu esfuerzo construye un mejor futuro.',155,1290,19,true,'#17345f');text(ctx,'↗',850,1265,60,true,'#168edc','center');
 ctx.fillStyle='#d8efff';ctx.fillRect(0,1370,W,170);text(ctx,'PRÉSTAMO YA',500,1430,28,true,'#0878d1','center');text(ctx,'CONFIANZA  ·  COMPROMISO  ·  TU PROGRESO',500,1470,15,false,'#5b8db7','center');delete window.__pyCtx;return new Promise(r=>c.toBlob(r,'image/png'));
}

function parseProposal(){
 const t=String(window.__creditProposalText||'');const get=(re,def='-')=>{const m=t.match(re);return m?clean(m[1]):def};
 const renewal=/Renovación crédito/i.test(t);const cName=get(/Cliente:\s*([^\n]+)/i,'Cliente');
 const cap=get(/Capital:\s*(S\/\s*[0-9.,]+)/i);const rate=get(/Interés:\s*([0-9.,]+%)/i);const total=get(/Total real:\s*(S\/\s*[0-9.,]+)/i);const installment=get(/Cuota regular:\s*(S\/\s*[0-9.,]+)/i);const extra=get(/Pago adicional:\s*(S\/\s*[0-9.,]+)/i,'S/ 0.00');
 const old=get(/Saldo anterior a cancelar:\s*(S\/\s*[0-9.,]+)/i,'S/ 0.00');const delivery=get(/Dinero a entregar:\s*(S\/\s*[0-9.,]+)/i,'');
 const lines=t.split('\n');const idx=lines.findIndex(x=>/^CRONOGRAMA$/i.test(clean(x)));const rows=[];if(idx>=0)lines.slice(idx+1).forEach(line=>{const m=clean(line).match(/^([^.]*)\.\s*([^·]+)·\s*([^·]+)·\s*(S\/\s*[0-9.,]+)\s*·\s*Saldo\s*(S\/\s*[0-9.,]+)/i);if(m&&rows.length<5)rows.push({n:m[1],date:m[2].trim(),type:m[3].trim(),amount:m[4],balance:m[5]})});
 const term=rows.length?((window.cTerm?.value)||''):'';return{renewal,cName,cap,rate,total,installment,extra,old,delivery,rows,term};
}
async function friendlyProposalImage(){
 const p=parseProposal();const c=makeCanvas(1510),ctx=c.getContext('2d'),W=1000;
 drawHeader(ctx,W,0,p.renewal?'RENOVACIÓN PREAPROBADA':'PROPUESTA DE CRÉDITO',p.renewal?'Una nueva oportunidad para seguir avanzando':'Revisa los detalles de tu propuesta');
 roundRect(42,180,916,115,22,'#fff','#dbeaf5');text(ctx,'▤',85,252,55,true,'#0878d1');text(ctx,p.renewal?'RENOVACIÓN PREAPROBADA':'PROPUESTA DE CRÉDITO',160,224,31,true,'#17345f');text(ctx,'Propuesta sujeta a confirmación del cliente',160,264,19,false,'#49627f');
 roundRect(58,320,884,92,18,'#eef8ff');text(ctx,'Cliente',84,353,18,false,'#49627f');text(ctx,p.cName,84,386,28,true,'#17345f');
 roundRect(58,435,884,300,20,'#fff','#dbe7f1');row(ctx,'Monto del crédito:',p.cap,478,true);row(ctx,'Cuota regular:',p.installment,530,true);row(ctx,'Plazo:',p.rows.length?`Primeras ${p.rows.length} cuotas · total según propuesta`: 'Según propuesta',582);row(ctx,'Interés:',p.rate,634);row(ctx,'Total a pagar:',p.total,686,true);
 if(p.renewal){roundRect(76,750,848,88,16,'#f0f9f4');text(ctx,'Renovación',100,785,18,true,'#159765');text(ctx,`Saldo anterior: ${p.old}`,100,818,19,false,'#315b4b');if(p.delivery)text(ctx,`Dinero a entregar: ${p.delivery}`,900,818,19,true,'#159765','right')}
 roundRect(58,875,884,110,18,'#eaf6ff');text(ctx,'↗',88,945,45,true,'#168edc');text(ctx,'Tu esfuerzo hoy construye un mejor futuro.',150,918,24,true,'#17345f');text(ctx,'Pequeños pasos, grandes logros.',150,955,20,false,'#49627f');
 roundRect(ctx,58,1018,884,300,18,'#fff','#dbe7f1');
 text(ctx,'Primeras cuotas',84,1065,27,true,'#17345f');const heads=[['#',92],['Fecha',160],['Cuota',510],['Saldo',870]];heads.forEach(h=>text(ctx,h[0],h[1],1110,17,true,'#49627f',h[0]==='Saldo'?'right':'left'));let yy=1150;p.rows.forEach((r,i)=>{if(i%2===0){ctx.fillStyle='#f5f9fc';ctx.fillRect(75,yy-26,850,42)}text(ctx,r.n,92,yy,16,false,'#334e6c');text(ctx,fmtDate(r.date),160,yy,16,false,'#334e6c');text(ctx,r.amount,510,yy,17,true,'#0878d1','right');text(ctx,r.balance,870,yy,17,false,'#334e6c','right');yy+=43});
 roundRect(ctx,58,1350,884,105,18,'#eaf6ff');text(ctx,'✓',90,1417,42,true,'#159765');text(ctx,'¡Gracias por confiar en nosotros!',145,1400,23,true,'#0878d1');text(ctx,'Estamos para acompañarte en cada paso.',145,1433,18,false,'#49627f');
 ctx.fillStyle='#d8efff';ctx.fillRect(0,1460,W,50);text(ctx,'PRÉSTAMO YA  ·  CONFIANZA · COMPROMISO · TU PROGRESO',500,1492,13,true,'#0878d1','center');delete window.__pyCtx;return new Promise(r=>c.toBlob(r,'image/png'));
}

async function friendlyCreditImage(c,cr){
 const paid=Math.max(0,Number(cr?.paid||0)),balance=Math.max(0,Number(cr?.total||0)-paid);const rows=(cr?.schedule||[]).slice(0,5);const cns=makeCanvas(1280),ctx=cns.getContext('2d'),W=1000;
 drawHeader(ctx,W,0,'DETALLE DEL CRÉDITO','Resumen para el cliente');roundRect(42,180,916,100,20,'#fff','#dbe7f1');text(ctx,'Cliente',78,216,17,false,'#49627f');text(ctx,c?.name||'Cliente',78,254,28,true,'#17345f');row(ctx,'Capital:',money(cr?.capital),320,true);row(ctx,'Total del crédito:',money(cr?.total),370);row(ctx,'Pagado:',money(paid),420,true);row(ctx,'Saldo pendiente:',money(balance),470,true);row(ctx,'Próximo vencimiento:',fmtDate(cr?.maturity||cr?.dueDate||''),520);roundRect(ctx,58,570,884,110,18,'#eaf6ff');text(ctx,'Resumen de cuotas',84,610,23,true,'#17345f');text(ctx,`Cuotas programadas: ${rows.length||cr?.term||'-'}`,84,650,19,false,'#49627f');text(ctx,'Consulta el detalle completo desde tu cuenta.',915,650,16,false,'#49627f','right');roundRect(ctx,58,720,884,330,18,'#fff','#dbe7f1');text(ctx,'Próximas cuotas',84,766,27,true,'#17345f');let y=820;rows.forEach((q,i)=>{text(ctx,String(q.n),90,y,16,false,'#334e6c');text(ctx,fmtDate(q.date),155,y,16,false,'#334e6c');text(ctx,money(q.amount),500,y,17,true,'#0878d1','right');text(ctx,money(Math.max(0,Number(q.amount||0)-Number(q.paid||0))),870,y,17,false,'#334e6c','right');y+=43});roundRect(ctx,58,1090,884,100,18,'#eaf6ff');text(ctx,'Préstamo Ya',84,1130,22,true,'#0878d1');text(ctx,'CONFIANZA · COMPROMISO · TU PROGRESO',84,1165,16,false,'#49627f');text(ctx,'Seguimos avanzando juntos.',915,1148,19,true,'#17345f','right');delete window.__pyCtx;return new Promise(r=>cns.toBlob(r,'image/png'));
}

async function buildImage(kind,c,title,text){
 if(kind==='payment'){const cr=creditById(window.__prestamoYaLastPaymentShare?.creditId)||((db().credits||[]).find(q=>clientById(q.clientId)?.name===c?.name)||null);if(cr)return friendlyPaymentImage(c,cr)}
 if(kind==='proposal'||kind==='renewal')return friendlyProposalImage();
 const cr=creditById(window.selectedCredit||window.__selectedCreditForProposal||window.__prestamoYaPlannerSelectedCredit);if(cr)return friendlyCreditImage(c,cr);
 return window.PrestamoYaShareImage?.imageFromText?window.PrestamoYaShareImage.imageFromText(text):null;
}

async function imageShare(kind,c,title,text,message){
 const caption=clean(message)||defaultCaption(kind,c);
 try{if(navigator.share){const blob=await buildImage(kind,c,title,text);if(blob){const file=new File([blob],'prestamo-ya.png',{type:'image/png'});if(typeof navigator.canShare!=='function'||navigator.canShare({files:[file]})){await navigator.share({title:title||'Préstamo Ya',text:caption,files:[file]});return true}}await navigator.share({title:title||'Préstamo Ya',text:caption});return true}}catch(e){if(e?.name==='AbortError')return false}
 try{if(navigator.clipboard){await navigator.clipboard.writeText(caption+'\n\n'+String(text||''));window.toast?.('Información copiada.');return true}}catch(e){}window.toast?.('No fue posible abrir el panel de compartir.');return false;
}

function btn(bar,id,label,cls,fn){if(!bar||document.getElementById(id))return;const b=document.createElement('button');b.id=id;b.type='button';b.className='btn '+cls;b.textContent=label;b.onclick=fn;bar.appendChild(b)}
function creditText(cr,c){return ['PRÉSTAMO YA — DETALLE DEL CRÉDITO',`Cliente: ${c.name||'-'}`,`Teléfono: ${c.phone||'-'}`,`Capital: ${money(cr.capital)}`,`Interés: ${Number(cr.rate||0)}%`,`Total: ${money(cr.total)}`,`Pagado: ${money(cr.paid)}`,`Saldo: ${money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0)))}`,`Vencimiento: ${cr.maturity||'-'}`,'','CRONOGRAMA',...(cr.schedule||[]).map(q=>`${q.n}. ${q.date||'-'} · ${q.extra?'Pago adicional':'Cuota'} · ${money(q.amount)} · Saldo ${money(Math.max(0,Number(q.amount||0)-Number(q.paid||0)))}`)].join('\n')}
function installCreditDetail(id){const cr=creditById(id),body=document.getElementById('creditDetailBody');if(!cr||!body)return;const c=clientById(cr.clientId);if(!c)return;const bar=body.querySelector('.actionbar');if(!bar)return;const recent=paymentCaption(c);btn(bar,'shareConsistencyCreditDetail',recent?'📤 Compartir comprobante':'📤 Compartir pantallazo','blue',()=>imageShare(recent?'payment':'credit',c,recent?'Confirmación de pago · Préstamo Ya':'Detalle del crédito · Préstamo Ya',recent?`Cliente: ${c.name}`:creditText(cr,c),recent));}
function proposalClient(modal){const text=clean(modal?.innerText||'');return(db().clients||[]).find(c=>c.name&&text.toLowerCase().includes(String(c.name).toLowerCase()))||null}
function proposalShare(){const m=document.getElementById('creditProposalModal');if(!m)return;const c=proposalClient(m);if(!c)return;const old=m.querySelector('[onclick*="shareCreditProposal"]');if(old){old.style.display='none'}let box=document.getElementById('prestamoYaProposalShareBox');if(box)return;box=document.createElement('div');box.id='prestamoYaProposalShareBox';box.className='card';box.style.cssText='border-left:5px solid var(--blue2);background:#f4fbff';box.innerHTML=`<b>📤 Compartir propuesta</b><div class="small muted" style="margin:6px 0">Cliente: ${clean(c.name)} · Tel: ${clean(c.phone||'Sin teléfono')}</div><div class="field"><label>Mensaje previo</label><textarea id="prestamoYaProposalMessage" class="input" rows="3">Hola ${clean(c.name)}, te compartimos la propuesta de tu crédito. Revísala con tranquilidad y nos confirmas si deseas continuar.</textarea></div><div class="actionbar"><button type="button" class="btn green" id="prestamoYaProposalWhatsApp">💬 WhatsApp + pantallazo</button></div>`;const action=m.querySelector('.actionbar');if(action)action.insertAdjacentElement('beforebegin',box);else m.querySelector('.sheet')?.appendChild(box);const send=()=>{const msg=document.getElementById('prestamoYaProposalMessage')?.value||'';return imageShare(/Renovación/i.test(m.innerText)?'renewal':'proposal',c,'Propuesta · Préstamo Ya',window.__creditProposalText||m.innerText,msg)};document.getElementById('prestamoYaProposalWhatsApp')?.addEventListener('click',send)}
function run(){try{const id=window.selectedCredit||window.__selectedCreditForProposal||window.__prestamoYaPlannerSelectedCredit;if(id)installCreditDetail(id);const detail=document.getElementById('creditDetailBody');if(detail){const text=clean(detail.innerText||'');const match=(db().credits||[]).find(cr=>text.includes(String(cr.id)));if(match)installCreditDetail(match.id)}proposalShare()}catch(e){console.warn('Share center v7',e)}}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(run,180)}function boot(){if(!document.body||window.__prestamoYaShareObserverV70)return;window.__prestamoYaShareObserverV70=true;new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});run();setTimeout(run,500);setTimeout(run,1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.PrestamoYaShareCenter={version:'v7.0',share:imageShare,shareImage:imageShare};
})();
