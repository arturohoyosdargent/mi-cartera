// Préstamo Ya — identifica exactamente qué cuota(s) cambió al registrar un pago.
(()=>{
 'use strict';
 if(window.__prestamoYaPaymentShareMessage)return;
 window.__prestamoYaPaymentShareMessage=true;
 const key=v=>String(v??'');
 const snapshot=id=>{const cr=(window.db?.credits||[]).find(x=>key(x.id)===key(id));return cr?Object.fromEntries((cr.schedule||[]).map(q=>[key(q.n),Number(q.paid||0)])):null};
 const changed=(id,before)=>{const cr=(window.db?.credits||[]).find(x=>key(x.id)===key(id));if(!cr||!before)return null;const increased=(cr.schedule||[]).filter(q=>Number(q.paid||0)>Number(before[key(q.n)]||0)).map(q=>({n:q.n,fullyPaid:Number(q.paid||0)>=Number(q.amount||0)}));if(!increased.length)return null;const paid=increased.filter(x=>x.fullyPaid).map(x=>x.n),partial=increased.filter(x=>!x.fullyPaid).map(x=>x.n);let text;if(paid.length===1)text=`Préstamo Ya — Cuota ${paid[0]} pagada`;else if(paid.length>1){const last=paid[paid.length-1];text=`Préstamo Ya — Cuotas ${paid.slice(0,-1).join(', ')} y ${last} pagadas`}else text=`Préstamo Ya — Abono a cuota ${partial.length===1?partial[0]:partial.join(', ')} registrado`;const client=(window.db?.clients||[]).find(x=>key(x.id)===key(cr.clientId));window.__prestamoYaLastPaymentShare={creditId:cr.id,clientId:cr.clientId,clientName:client?.name||'',message:text,at:Date.now(),paidQuotas:paid,partialQuotas:partial};return window.__prestamoYaLastPaymentShare};
 const install=()=>{const fn=window.registerPayment;if(typeof fn!=='function'||fn.__prestamoYaPaymentShare)return false;const wrapped=function(id,...args){const before=snapshot(id);const result=fn.apply(this,[id,...args]);Promise.resolve(result).then(()=>changed(id,before)).catch(()=>{});return result};wrapped.__prestamoYaPaymentShare=true;window.registerPayment=wrapped;return true};
 const wait=()=>install()||setTimeout(wait,250);wait();
 window.prestamoYaGetPaymentShareMessage=id=>{const x=window.__prestamoYaLastPaymentShare;return x&&key(x.creditId)===key(id)&&Date.now()-Number(x.at||0)<86400000?x.message:null};
})();
