// Préstamo Ya — compartir comprobante desde el resultado de una recaudación.
(()=>{
'use strict';
if(window.__prestamoYaPaymentResultShareFix)return;
window.__prestamoYaPaymentResultShareFix=true;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const db=()=>window.db||{clients:[],credits:[]};
const findCredit=()=>{
 const id=window.selectedCredit||window.__selectedCredit||window.__prestamoYaSelectedCredit;
 if(id){const x=(db().credits||[]).find(c=>String(c.id)===String(id));if(x)return x}
 const body=document.getElementById('creditDetailBody');
 const txt=body?.innerText||'';
 const m=txt.match(/ID:\s*([^\n]+)/i);
 if(m){const x=(db().credits||[]).find(c=>String(c.id)===String(m[1]).trim());if(x)return x}
 return null;
};
const findClient=cr=>cr&&((db().clients||[]).find(c=>String(c.id)===String(cr.clientId))||null);
const caption=c=>{
 const x=window.__prestamoYaLastPaymentShare;
 if(x&&(!x.clientName||String(x.clientName)===String(c?.name||''))){
  const q=Array.isArray(x.paidQuotas)?x.paidQuotas:[];
  const p=Array.isArray(x.partialQuotas)?x.partialQuotas:[];
  if(q.length)return `Préstamo Ya — Cuota${q.length>1?'s':''} ${q.join(', ')} pagada${q.length>1?'s':''}`;
  if(p.length)return `Préstamo Ya — Abono a cuota ${p.join(', ')} registrado`;
 }
 return 'Préstamo Ya — Pago registrado';
};
const textFor=(cr,c)=>{
 const x=window.__prestamoYaLastPaymentShare||{};
 const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[];
 const ps=Array.isArray(x.partialQuotas)?x.partialQuotas:[];
 const concept=qs.length?`Cuota${qs.length>1?'s':''} ${qs.join(', ')}`:ps.length?`Abono a cuota ${ps.join(', ')}`:'Pago registrado';
 const paid=Number(x.paidAmount||0);
 const balance=Math.max(0,Number(cr?.total||0)-Number(cr?.paid||0));
 const rows=Array.isArray(cr?.schedule)?cr.schedule.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3):[];
 return ['PRÉSTAMO YA','PAGO RECIBIDO',`Cliente: ${c?.name||'Cliente'}`,`Concepto: ${concept}`,`Monto pagado: ${money(paid)}`,`Saldo pendiente: ${money(balance)}`,`Próximo vencimiento: ${cr?.maturity||'-'}`,'','ÚLTIMOS MOVIMIENTOS',...rows.map(q=>`${q.date||'-'} · ${q.extra?'Pago adicional':'Cuota '+(q.n??'')} · ${money(q.amount||0)}`)].join('\n');
};
const share=async()=>{
 const cr=findCredit(),c=findClient(cr),engine=window.PrestamoYaShareImage;
 if(!cr||!c||!engine?.imageFromText)return window.toast?.('No se pudo preparar el comprobante.');
 try{
  const blob=await engine.imageFromText(textFor(cr,c));
  if(!blob)throw Error('image');
  const file=new File([blob],'prestamo-ya-comprobante.png',{type:'image/png'});
  const captionText=caption(c);
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Comprobante · Préstamo Ya',text:captionText,files:[file]});return}
  if(navigator.share){await navigator.share({title:'Comprobante · Préstamo Ya',text:captionText});return}
  await navigator.clipboard?.writeText(captionText);window.toast?.('Texto copiado.');
 }catch(e){if(e?.name!=='AbortError')window.toast?.('No fue posible compartir el comprobante.');}
};
const install=()=>{
 const body=document.getElementById('creditDetailBody');if(!body)return;
 const bar=body.querySelector('.actionbar');if(!bar)return;
 if(document.getElementById('prestamoYaPaymentResultShare'))return;
 const b=document.createElement('button');b.id='prestamoYaPaymentResultShare';b.type='button';b.className='btn blue';b.textContent='💬 WhatsApp + pantallazo';b.onclick=share;
 bar.appendChild(b);
};
let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(install,120)};
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
install();setTimeout(install,500);setTimeout(install,1500);
})();
