// Préstamo Ya — compatibilidad de compartir crédito.
// El centro único share-consistency-v1.js controla los botones y la imagen.
(()=>{
 'use strict';
 if(window.__prestamoYaCreditShareV3)return;
 window.__prestamoYaCreditShareV3=true;
 window.shareCreditDetailV2=async function(id){
   const center=window.PrestamoYaShareCenter;
   const cr=(window.db?.credits||[]).find(x=>String(x.id)===String(id));
   const c=cr&&(window.db?.clients||[]).find(x=>String(x.id)===String(cr.clientId));
   if(!cr||!c)return window.toast?.('Crédito no encontrado');
   const rows=(cr.schedule||[]).map(q=>`${q.n}. ${q.date||'-'} · ${q.extra?'Pago adicional':'Cuota'} · S/ ${Number(q.amount||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
   const text=['PRÉSTAMO YA — DETALLE DEL CRÉDITO',`Cliente: ${c.name||'-'}`,`Teléfono: ${c.phone||'-'}`,`Capital: S/ ${Number(cr.capital||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,`Interés: ${Number(cr.rate||0)}%`,`Total: S/ ${Number(cr.total||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,`Pagado: S/ ${Number(cr.paid||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,`Saldo: S/ ${Math.max(0,Number(cr.total||0)-Number(cr.paid||0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`,'','CRONOGRAMA',...rows].join('\n');
   if(center?.share)return center.share('credit',c,'Detalle del crédito · Préstamo Ya',text);
   try{await navigator.share?.({title:'Detalle del crédito · Préstamo Ya',text});return true}catch(e){return false}
 };
})();
