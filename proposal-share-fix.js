// Préstamo Ya — compartir propuestas como tarjeta visual + pre-mensaje editable.
(()=>{
'use strict';
if(window.__prestamoYaProposalShareFix)return;
window.__prestamoYaProposalShareFix=true;
const ensure=()=>{
 const modal=document.getElementById('creditProposalModal');
 if(!modal)return;
 const bar=modal.querySelector('.actionbar');
 if(!bar)return;
 let box=document.getElementById('proposalPreMessage');
 if(!box){
  box=document.createElement('div');box.id='proposalPreMessage';box.className='card';box.style.cssText='margin-top:10px;border:1px solid #b9ddf4;background:#f4fbff';
  box.innerHTML='<label style="font-weight:bold;display:block;margin-bottom:6px">💬 Mensaje previo</label><textarea id="proposalPreMessageInput" class="input" rows="3" style="width:100%;resize:vertical" placeholder="Escribe aquí el mensaje que acompañará la propuesta..."></textarea><div class="small muted" style="margin-top:5px">Este mensaje se enviará junto con la imagen de la propuesta.</div>';
  bar.parentElement.insertBefore(box,bar);
 }
 const old=Array.from(bar.querySelectorAll('button')).find(b=>/shareCreditProposal/.test(b.getAttribute('onclick')||''));
 if(old){old.textContent='💬 WhatsApp + pantallazo';old.className='btn green';old.onclick=()=>window.PrestamoYaShareProposal?.();old.removeAttribute('onclick')}
};
const share=async()=>{
 const text=window.__creditProposalText||'';
 const engine=window.PrestamoYaShareImage;
 if(!text||!engine?.imageFromText)return window.toast?.('No se pudo preparar la propuesta.');
 const pre=document.getElementById('proposalPreMessageInput')?.value?.trim()||'';
 try{
  const blob=await engine.imageFromText(text);
  if(!blob)throw Error('image');
  const file=new File([blob],'prestamo-ya-propuesta.png',{type:'image/png'});
  const caption=pre||((/RENOVACI[ÓO]N/.test(text))?'Préstamo Ya — Renovación preaprobada':'Préstamo Ya — Crédito preaprobado');
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Propuesta · Préstamo Ya',text:caption,files:[file]});return}
  if(navigator.share){await navigator.share({title:'Propuesta · Préstamo Ya',text:caption});return}
  if(navigator.clipboard){await navigator.clipboard.writeText(caption);window.toast?.('Mensaje copiado.');}
 }catch(e){if(e?.name!=='AbortError')window.toast?.('No fue posible compartir la propuesta.');}
};
window.PrestamoYaShareProposal=share;
const tick=()=>{ensure();setTimeout(ensure,150);setTimeout(ensure,700)};
new MutationObserver(tick).observe(document.body,{childList:true,subtree:true});
})();
