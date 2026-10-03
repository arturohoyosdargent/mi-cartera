// Mi Cartera PRO V2 — unified collection reminder sharing: approved branded card + editable message through the unified native panel.
(function(root){'use strict';
const D=root.MiCarteraV2Dates||{},money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=s=>{if(!s)return '';const v=D.normalize?.(s)||String(s).slice(0,10);try{return new Date(v+'T12:00:00').toLocaleDateString('es-PE')}catch{return v}};
let rendererPromise=null;
function ensureRenderer(){if(root.MiCarteraV2ShareCard?.reminder)return Promise.resolve(root.MiCarteraV2ShareCard);if(rendererPromise)return rendererPromise;rendererPromise=new Promise((ok,bad)=>{const existing=[...document.scripts].find(s=>s.src.endsWith('share-card-renderer-v2.js'));const done=()=>root.MiCarteraV2ShareCard?.reminder?ok(root.MiCarteraV2ShareCard):bad(new Error('SHARE_CARD_RENDERER_NOT_READY'));if(existing){if(root.MiCarteraV2ShareCard?.reminder)return ok(root.MiCarteraV2ShareCard);existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>bad(new Error('SHARE_CARD_RENDERER_LOAD_FAILED')),{once:true});return}const s=document.createElement('script');s.src='share-card-renderer-v2.js';s.onload=done;s.onerror=()=>bad(new Error('SHARE_CARD_RENDERER_LOAD_FAILED'));document.head.appendChild(s)}).catch(e=>{rendererPromise=null;throw e});return rendererPromise}
function text(c,amount,date){return root.MiCarteraV2ClientShare?.message?.('reminder',c)||`Hola ${String(c?.name||'cliente').trim().split(/\s+/)[0]}, te recuerdo que tienes una cuota próxima a vencer. Te envío el detalle.`}
async function share(c,amount,date,editedMessage){
  const preparationToken=root.MiCarteraV2ClientShare?.begin?.(),ownerUid=root.MiCarteraV2AuthCloudGate?.state?.().uid;let msg=String(editedMessage??text(c,amount,date));let blob=null;
  try{const r=await ensureRenderer();blob=await r.reminder({amount,date},c)}catch(e){console.warn('V2 reminder branded card unavailable; sharing stopped.',e)}
  if(root.MiCarteraV2ClientShare){const file=blob?new File([blob],'prestamo-ya-recordatorio.png',{type:'image/png'}):null;return root.MiCarteraV2ClientShare.send({preparationToken,ownerUid,kind:'reminder',client:c,text:msg,title:'PRÉSTAMO YA · Recordatorio de pago',file})}
  if(ownerUid){const current=root.MiCarteraV2AuthCloudGate?.state?.();if(!current?.ready||current.uid!==ownerUid)throw Error('La sesión cambió. Vuelve a abrir la ficha desde tu sesión actual.')}throw new Error('No se pudo cargar el panel de compartir. Vuelve a abrir el recordatorio.');
}
root.MiCarteraV2CollectionReminderShare={share,text,ensureRenderer};
})(window);
