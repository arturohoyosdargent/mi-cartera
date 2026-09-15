// Préstamo Ya — botón permanente de WhatsApp + pantallazo en Detalle del crédito.
(()=>{
'use strict';
if(window.__prestamoYaCreditDetailShareButtonV1)return;
window.__prestamoYaCreditDetailShareButtonV1=true;
const body=()=>document.getElementById('creditDetailBody');
const id=()=>{const m=String(body()?.innerText||'').match(/(?:^|\n)ID:\s*([^\n]+)/i);return m?String(m[1]).trim():''};
const install=()=>{
 const b=body(),bar=b?.querySelector('.actionbar');
 if(!b||!bar)return false;
 let btn=[...bar.querySelectorAll('button')].find(x=>/WhatsApp\s*\+\s*pantallazo/i.test(x.textContent||''));
 if(!btn){
  btn=document.createElement('button');btn.className='btn blue';btn.type='button';btn.textContent='💬 WhatsApp + pantallazo';
  btn.style.flexBasis='100%';btn.style.width='100%';bar.appendChild(btn);
 }
 if(btn.__permanentDetailShare)return true;
 btn.__permanentDetailShare=true;btn.removeAttribute('onclick');
 btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const share=window.shareCreditDetailV2;if(typeof share!=='function'){window.toast?.('El módulo de compartir todavía está cargando.');return}share(id())});
 return true;
};
const boot=()=>{if(install())return;setTimeout(boot,250)};
new MutationObserver(()=>install()).observe(document.body,{childList:true,subtree:true});
boot();
setTimeout(install,500);setTimeout(install,1200);setTimeout(install,2500);
})();
