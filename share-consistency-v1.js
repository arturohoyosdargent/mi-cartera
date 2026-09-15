// Préstamo Ya — Centro único de compartir v8.0, estable y aislado por flujo.
(()=>{
'use strict';
if(window.__prestamoYaShareConsistencyV80)return;
window.__prestamoYaShareConsistencyV80=true;
const db=()=>window.db||{clients:[],credits:[]};
const paymentCaption=()=>{const x=window.__prestamoYaLastPaymentShare||{};if(!x||Date.now()-Number(x.at||0)>86400000)return 'Préstamo Ya — Pago registrado';const q=Array.isArray(x.paidQuotas)?x.paidQuotas:[],p=Array.isArray(x.partialQuotas)?x.partialQuotas:[];if(q.length)return `Préstamo Ya — Cuota${q.length>1?'s':''} ${q.join(', ')} pagada${q.length>1?'s':''}`;if(p.length)return `Préstamo Ya — Abono a cuota ${p.join(', ')} registrado`;return 'Préstamo Ya — Pago registrado'};
const caption=(kind)=>kind==='payment'?paymentCaption():kind==='proposal'?'Préstamo Ya — Crédito preaprobado':kind==='renewal'?'Préstamo Ya — Renovación preaprobada':'Préstamo Ya — Detalle del crédito';
const share=async(kind,c,title,text)=>{const image=window.PrestamoYaShareImage;if(!image?.imageFromText)return window.toast?.('Motor de imágenes no disponible.');try{const blob=await image.imageFromText(text);if(!blob)throw Error('EMPTY_IMAGE');const file=new File([blob],kind==='payment'?'prestamo-ya-pago.png':kind==='proposal'?'prestamo-ya-propuesta.png':'prestamo-ya-detalle.png',{type:'image/png'}),textCaption=caption(kind);if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:title||textCaption,text:textCaption,files:[file]});return true}if(navigator.share){await navigator.share({title:title||textCaption,text:textCaption});return true}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(textCaption+'\n\n'+text);window.toast?.('Detalle copiado. Este dispositivo no permite adjuntar la imagen automáticamente.');return true}throw Error('SHARE_NOT_SUPPORTED')}catch(e){if(e?.name==='AbortError')return false;console.error('Centro compartir',e);window.toast?.('No fue posible compartir la información.');return false}};
window.PrestamoYaShareCenter={version:'v8',share,caption};
})();
