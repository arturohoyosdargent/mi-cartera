// Préstamo Ya — mensaje de pago + WhatsApp directo al cliente.
(()=>{
 'use strict';
 if(window.__prestamoYaPaymentShareMessageV2)return;
 window.__prestamoYaPaymentShareMessageV2=true;
 const key=v=>String(v??''),money=v=>'S/ '+Number(v||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
 const credit=id=>(window.db?.credits||[]).find(x=>key(x.id)===key(id));
 const client=cr=>(window.db?.clients||[]).find(x=>key(x.id)===key(cr?.clientId));
 const phone=c=>{let p=String(c?.phone||'').replace(/\D/g,'');if(p.length===9)p='51'+p;return p};
 const snapshot=id=>{const cr=credit(id);return cr?Object.fromEntries((cr.schedule||[]).map(q=>[key(q.n),Number(q.paid||0)])):null};
 const changed=(id,before)=>{const cr=credit(id);if(!cr||!before)return null;const inc=(cr.schedule||[]).filter(q=>Number(q.paid||0)>Number(before[key(q.n)]||0));if(!inc.length)return null;const c=client(cr),paid=inc.filter(q=>Number(q.paid||0)>=Number(q.amount||0)).map(q=>q.n),partial=inc.filter(q=>Number(q.paid||0)<Number(q.amount||0)).map(q=>q.n);let text=paid.length===1?`Préstamo Ya — Cuota ${paid[0]} pagada`:paid.length>1?`Préstamo Ya — Cuotas ${paid.join(', ')} pagadas`:`Préstamo Ya — Abono a cuota ${partial.join(', ')} registrado`;const amount=inc.reduce((s,q)=>s+Number(q.amount||0),0);window.__prestamoYaLastPaymentShare={creditId:cr.id,clientId:cr.clientId,clientName:c?.name||'',message:text,at:Date.now(),paidQuotas:paid,partialQuotas:partial,paidAmount:amount};return window.__prestamoYaLastPaymentShare};
 window.PrestamoYaWhatsApp=window.PrestamoYaWhatsApp||{};
 window.PrestamoYaWhatsApp.confirmation=()=>{const x=window.__prestamoYaLastPaymentShare;if(!x||Date.now()-Number(x.at||0)>86400000)return toast('No hay un pago reciente para confirmar.');const cr=credit(x.creditId),c=client(cr),p=phone(c);if(!cr||!c||!p)return toast('No se encontró el teléfono del cliente.');const remain=Math.max(0,Number(cr.total||0)-Number(cr.paid||0));const q=x.paidQuotas?.length?`cuota${x.paidQuotas.length>1?'s':''} ${x.paidQuotas.join(', ')}`:(x.partialQuotas?.length?`abono a cuota ${x.partialQuotas.join(', ')}`:'pago registrado');const msg=`Hola ${c.name||''}, confirmamos que hemos recibido tu pago de ${money(x.paidAmount)} correspondiente a ${q}. ${remain>0?'Saldo pendiente: '+money(remain)+'.':'El crédito queda totalmente pagado.'} Gracias por tu pago. — Préstamo Ya`;window.open('https://wa.me/'+p+'?text='+encodeURIComponent(msg),'_blank','noopener')};
 window.prestamoYaGetPaymentShareMessage=id=>{const x=window.__prestamoYaLastPaymentShare;return x&&key(x.creditId)===key(id)&&Date.now()-Number(x.at||0)<86400000?x.message:null};
 const install=()=>{const fn=window.registerPayment;if(typeof fn!=='function'||fn.__pyPaymentShareV2)return false;const wrapped=function(id,...args){const before=snapshot(id),result=fn.apply(this,[id,...args]);Promise.resolve(result).then(()=>changed(id,before)).catch(()=>{});return result};wrapped.__pyPaymentShareV2=true;window.registerPayment=wrapped;return true};
 const wait=()=>install()||setTimeout(wait,250);wait();
})();
