// Préstamo Ya — compartir comprobante de pago, sin inyectar botones en Detalle del crédito.
(()=>{
'use strict';
if(window.__prestamoYaPaymentResultShareFixV2)return;
window.__prestamoYaPaymentResultShareFixV2=true;
const db=()=>window.db||{clients:[],credits:[]};
const findCredit=id=>{const wanted=String(id||window.selectedCredit||window.__selectedCredit||window.__prestamoYaSelectedCredit||'').trim();if(wanted){const x=(db().credits||[]).find(c=>String(c.id)===wanted);if(x)return x}const m=String(document.getElementById('creditDetailBody')?.innerText||'').match(/ID:\s*([^\n]+)/i);return m?(db().credits||[]).find(c=>String(c.id)===String(m[1]).trim())||null:null};
const clientFor=cr=>cr&&(db().clients||[]).find(c=>String(c.id)===String(cr.clientId))||null;
const share=async id=>{const cr=findCredit(id),c=clientFor(cr),x=window.__prestamoYaLastPaymentShare||{};if(!cr||!c||!x||Date.now()-Number(x.at||0)>86400000)return window.toast?.('No hay un pago reciente para compartir.');const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[],ps=Array.isArray(x.partialQuotas)?x.partialQuotas:[],concept=qs.length?`Cuota${qs.length>1?'s':''} ${qs.join(', ')}`:ps.length?`Abono a cuota ${ps.join(', ')}`:'Pago registrado',text=['PRÉSTAMO YA','PAGO RECIBIDO',`Cliente: ${c.name||'Cliente'}`,`Concepto: ${concept}`,`Monto pagado: S/ ${Number(x.paidAmount||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,`Saldo pendiente: S/ ${Math.max(0,Number(cr.total||0)-Number(cr.paid||0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,'','CRONOGRAMA',...(cr.schedule||[]).slice(0,5).map(q=>`${q.n}. ${q.date||'-'} · S/ ${Number(q.amount||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`)].join('\n');return window.PrestamoYaShareCenter?.share('payment',c,'Comprobante · Préstamo Ya',text)||false};
window.PrestamoYaPaymentResultShare={share};window.sharePaymentResult=share;
})();
