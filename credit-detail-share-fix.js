// Préstamo Ya — compartir desde Detalle del crédito v4, con diseño visual unificado.
(()=>{
'use strict';
if(window.__prestamoYaCreditDetailShareFixV4)return;
window.__prestamoYaCreditDetailShareFixV4=true;
const db=()=>window.db||{clients:[],credits:[]};
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=s=>{if(!s)return '-';try{return new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}).replace(/\./g,'')}catch(e){return String(s)}};
const today=()=>new Date().toISOString().slice(0,10);
const body=()=>document.getElementById('creditDetailBody');
const bodyId=()=>{const m=String(body()?.innerText||'').match(/(?:^|\n)ID:\s*([^\n]+)/i);return m?String(m[1]).trim():''};
const findCredit=id=>{const wanted=String(id||'').trim()||bodyId();return wanted?(db().credits||[]).find(x=>String(x.id)===wanted)||null:null};
const clientFor=cr=>cr&&(db().clients||[]).find(x=>String(x.id)===String(cr.clientId))||null;
const status=cr=>{const bal=Math.max(0,Number(cr?.total||0)-Number(cr?.paid||0)),due=String(cr?.maturity||cr?.dueDate||'').slice(0,10);if(bal<=0)return 'CRÉDITO CANCELADO';if(due&&due<today())return 'CUOTA VENCIDA';return 'CRÉDITO ACTIVO'};
const caption=cr=>status(cr)==='CUOTA VENCIDA'?'Préstamo Ya — Tu cuota está vencida':status(cr)==='CRÉDITO CANCELADO'?'Préstamo Ya — Crédito cancelado':'Préstamo Ya — Detalle del crédito';
const makeImage=async(cr,c)=>{const W=1000,H=1580,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const x=canvas.getContext('2d');x.fillStyle='#f3f8fc';x.fillRect(0,0,W,H);
const text=(s,a,b,size,bold=false,color='#17345f',align='left')=>{x.fillStyle=color;x.font=`${bold?'700':'400'} ${size}px Arial`;x.textAlign=align;x.textBaseline='alphabetic';x.fillText(String(s??''),a,b)};
const box=(a,b,w,h,r,fill='#fff',stroke='#dbe8f3')=>{x.beginPath();x.roundRect(a,b,w,h,r);x.fillStyle=fill;x.fill();x.strokeStyle=stroke;x.lineWidth=2;x.stroke()};
const circle=(cx,cy,r,fill='#e5f4ff')=>{x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fillStyle=fill;x.fill()};
const icon=(kind,cx,cy)=>{circle(cx,cy,27,'#e5f4ff');x.strokeStyle='#0d82cf';x.fillStyle='#0d82cf';x.lineWidth=4;x.lineCap='round';if(kind==='money'){x.beginPath();x.ellipse(cx,cy,13,18,0,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(cx-8,cy-8);x.lineTo(cx+8,cy-8);x.moveTo(cx-8,cy);x.lineTo(cx+8,cy);x.moveTo(cx-8,cy+8);x.lineTo(cx+8,cy+8);x.stroke()}else if(kind==='percent'){text('%',cx,cy+10,25,true,'#0d82cf','center')}else if(kind==='calendar'){x.strokeRect(cx-13,cy-11,26,24);x.beginPath();x.moveTo(cx-13,cy-3);x.lineTo(cx+13,cy-3);x.moveTo(cx-7,cy-17);x.lineTo(cx-7,cy-7);x.moveTo(cx+7,cy-17);x.lineTo(cx+7,cy-7);x.stroke()}else if(kind==='chart'){x.fillRect(cx-14,cy+2,6,12);x.fillRect(cx-3,cy-6,6,20);x.fillRect(cx+8,cy-15,6,29)}else if(kind==='check'){x.beginPath();x.moveTo(cx-12,cy);x.lineTo(cx-3,cy+9);x.lineTo(cx+14,cy-12);x.stroke()}else{x.strokeRect(cx-11,cy-14,22,28);x.beginPath();x.moveTo(cx-6,cy-6);x.lineTo(cx+7,cy-6);x.moveTo(cx-6,cy+1);x.lineTo(cx+7,cy+1);x.moveTo(cx-6,cy+8);x.lineTo(cx+4,cy+8);x.stroke()}};
// Header — misma identidad visual de la propuesta.
const hg=x.createLinearGradient(38,0,W-38,0);hg.addColorStop(0,'#178bdc');hg.addColorStop(1,'#31b4ed');x.fillStyle=hg;x.fillRect(38,28,W-76,150);text('PRÉSTAMO YA',72,91,43,true,'#fff');text('Tus metas, más cerca',74,130,25,false,'#fff');text('SOLUCIONES FINANCIERAS',930,83,18,true,'#fff','right');text('PARA UN MEJOR MAÑANA',930,112,18,true,'#fff','right');x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=2;x.beginPath();x.moveTo(655,55);x.lineTo(655,150);x.stroke();
// Title card.
box(58,202,884,116,24,'#fff');icon('doc',105,260);text('DETALLE DEL CRÉDITO',150,255,31,true);text('Consulta el estado de tu crédito.',150,286,20,false,'#65788c');
// Client card.
box(58,334,884,100,20,'#eaf6ff','#dceef9');circle(105,384,30,'#d8efff');x.fillStyle='#087bd1';x.beginPath();x.arc(105,376,10,0,Math.PI*2);x.fill();x.beginPath();x.arc(105,394,17,Math.PI,0);x.fill();text('Cliente:',150,370,16,false,'#62758b');text(c?.name||'Cliente',150,401,25,true);text(`Teléfono: ${c?.phone||'-'}`,900,401,16,false,'#49627f','right');
// Six highlighted metrics, like the proposal.
box(58,450,884,316,24,'#fff');
const rows=[['money','Capital',money(cr.capital),0,0],['percent','Interés',`${Number(cr.rate||0)}%`,1,0],['check','Total',money(cr.total),0,1],['check','Pagado',money(cr.paid),1,1],['money','Saldo',money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0))),0,2],['calendar','Vencimiento',fmtDate(cr.maturity||cr.dueDate),1,2]];
rows.forEach(r=>{const col=r[3],row=r[4],cx=102+col*420,yy=515+row*91;icon(r[0],cx,yy-7);text(r[1],cx+48,yy-17,16,false,'#62758b');text(r[2],cx+48,yy+10,21,true,r[1]==='Saldo'?'#c0392b':'#087bd1')});
// Status ribbon.
box(58,782,884,64,18,status(cr)==='CUOTA VENCIDA'?'#fff3ef':'#eaf8ff',status(cr)==='CUOTA VENCIDA'?'#f3d5cd':'#d8effb');text(status(cr),500,823,20,true,status(cr)==='CUOTA VENCIDA'?'#c0392b':'#087bd1','center');
// Schedule card, compact and useful.
box(58,866,884,430,24,'#fff');icon('calendar',103,914);text('Cronograma de pagos',150,921,27,true);text('#',90,962,15,true,'#62758b');text('Fecha',150,962,15,true,'#62758b');text('Cuota',510,962,15,true,'#62758b');text('Pagado',690,962,15,true,'#62758b');text('Saldo',895,962,15,true,'#62758b','right');
const schedule=Array.isArray(cr.schedule)?cr.schedule.slice(0,6):[];schedule.forEach((q,i)=>{const yy=1005+i*49;if(i%2===0){x.fillStyle='#f5f9fc';x.fillRect(76,yy-28,848,42)}const qbal=Math.max(0,Number(q.amount||0)-Number(q.paid||0));text(q.n??i+1,90,yy,15);text(fmtDate(q.date),150,yy,15);text(money(q.amount),510,yy,15,false,'#087bd1');text(money(q.paid),690,yy,15);text(money(qbal),895,yy,15,true,qbal>0?'#c0392b':'#17345f','right')});
if(schedule.length===0)text('Sin cuotas registradas en el cronograma.',500,1015,17,false,'#62758b','center');
// Motivational + goals block, matching proposal visual language.
box(58,1318,884,92,20,'#eaf6ff','#eaf6ff');text('Tu esfuerzo hoy construye tu mejor futuro.',90,1354,19,true,'#17345f');text('Pequeños pasos, grandes logros.',90,1382,16,false,'#49627f');text('Vamos',820,1355,23,true,'#087bd1','center');text('por más',820,1382,20,true,'#087bd1','center');
box(58,1424,884,76,18,'#eaf6ff','#eaf6ff');text('¡Gracias por confiar en nosotros!',92,1456,19,true,'#087bd1');text('Juntos hacemos tus metas posibles.',92,1482,15,false,'#49627f');
text('PRÉSTAMO YA  ·  CONFIANZA · COMPROMISO · TU PROGRESO',500,1548,15,true,'#087bd1','center');
return new Promise(r=>canvas.toBlob(r,'image/png'))};
const share=async id=>{const cr=findCredit(id),c=clientFor(cr);if(!cr||!c)return window.toast?.('No se encontró el crédito en el detalle actual');window.__prestamoYaLastPaymentShare=null;try{const blob=await makeImage(cr,c);if(!blob)throw Error('DETAIL_IMAGE_EMPTY');const file=new File([blob],'prestamo-ya-detalle-credito.png',{type:'image/png'}),cap=caption(cr);if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Detalle del crédito · Préstamo Ya',text:cap,files:[file]});return true}if(navigator.share){await navigator.share({title:'Detalle del crédito · Préstamo Ya',text:cap});return true}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(cap);window.toast?.('Mensaje copiado. Este dispositivo no permite adjuntar la imagen automáticamente.');return true}throw Error('SHARE_NOT_SUPPORTED')}catch(e){if(e?.name==='AbortError')return false;console.error('Detalle crédito compartir',e);window.toast?.('No fue posible compartir el detalle del crédito.');return false}};
window.shareCreditDetailV2=share;
const install=()=>{const bdy=body();if(!bdy)return;const bar=bdy.querySelector('.actionbar');if(!bar)return;const buttons=[...bar.querySelectorAll('button')];const target=buttons.find(b=>/WhatsApp\s*\+\s*pantallazo/i.test(b.textContent||'')&&!b.id?.includes('PaymentResult'));if(!target)return;if(target.__detailShareV4)return;const id=bodyId(),b=target.cloneNode(true);b.__detailShareV4=true;b.dataset.creditId=id;b.removeAttribute('onclick');b.type='button';b.textContent='💬 WhatsApp + pantallazo';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();share(b.dataset.creditId||bodyId())});target.replaceWith(b)};
let timer=0;const scheduleInstall=()=>{clearTimeout(timer);timer=setTimeout(install,100)};new MutationObserver(scheduleInstall).observe(document.body,{childList:true,subtree:true});install();setTimeout(install,500);setTimeout(install,1200);setTimeout(install,2500);
})();
