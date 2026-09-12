// Préstamo Ya — medios de pago ampliados: Yape/Plin, Efectivo y Otros editable.
(function(){
 'use strict';
 if(window.__prestamoYaPaymentMethods)return;
 window.__prestamoYaPaymentMethods=true;
 const selectors=()=>[...document.querySelectorAll('select')].filter(s=>{const t=((s.id||'')+' '+(s.name||'')+' '+(s.parentElement?.innerText||'')).toLowerCase();const opts=[...s.options].map(o=>o.textContent.toLowerCase());return /(pago|medio|metodo|método)/.test(t)||opts.some(o=>/yape|plin|efectivo/.test(o))});
 function enhance(s){if(!s||s.dataset.pyPaymentEnhanced)return;s.dataset.pyPaymentEnhanced='1';if(![...s.options].some(o=>String(o.value).toUpperCase()==='OTROS'))s.insertAdjacentHTML('beforeend','<option value="OTROS">Otros</option>');const wrap=document.createElement('div');wrap.className='field pyOtherPayment';wrap.style.display='none';wrap.innerHTML='<label>Especifique el medio de pago</label><input class="input" type="text" placeholder="Ej.: Transferencia bancaria, BCP, Interbank, Mercado Pago…">';s.parentElement?.appendChild(wrap);const input=wrap.querySelector('input');const sync=()=>{const other=String(s.value).toUpperCase()==='OTROS';wrap.style.display=other?'block':'none';};s.addEventListener('change',sync);sync();s._pyOtherInput=input;s._pySync=sync}
 function scan(){selectors().forEach(enhance)}
 scan();new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});
 const old=window.registerPayment;
 if(typeof old==='function'&&!window.__prestamoYaPaymentMethodsWrapped){window.__prestamoYaPaymentMethodsWrapped=true;window.registerPayment=function(id,...args){scan();const sels=selectors(),s=sels.find(x=>String(x.value).toUpperCase()==='OTROS');let custom='';if(s&&s._pyOtherInput){custom=String(s._pyOtherInput.value||'').trim();if(!custom)return toast('Indique el medio de pago en “Otros”');let opt=[...s.options].find(o=>String(o.value).startsWith('OTROS:'));if(!opt){opt=document.createElement('option');s.appendChild(opt)}opt.value='OTROS:'+custom;opt.textContent='Otros: '+custom;s.value=opt.value;s._pySync?.()}
   const beforeIds=new Set((window.db?.payments||[]).map(p=>String(p.id)));const result=old(id,...args);setTimeout(()=>{const arr=window.db?.payments||[];const added=arr.find(p=>!beforeIds.has(String(p.id)))||arr[arr.length-1];if(added&&s?.value){const m=String(s.value);const label=m.startsWith('OTROS:')?m.slice(6):m;['method','paymentMethod','medioPago','medio','formaPago'].forEach(k=>{if(Object.prototype.hasOwnProperty.call(added,k)||k==='method')added[k]=label})}if(typeof window.persist==='function')window.persist()},0);return result}}
 window.PrestamoYaPaymentMethods={version:'v1',scan};
})();
