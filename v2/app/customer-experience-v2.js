// Mi Cartera PRO V2 — customer experience parity: location, Maps/Waze and safe share helpers.
(function(root){'use strict';
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function coords(v){const m=String(v||'').match(/\[?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]?/);return m?`${m[1]},${m[2]}`:''}
function target(c){return coords(c?.location)||String(c?.address||'').trim()}
function openMap(provider,c){const q=target(c);if(!q)throw new Error('CLIENT_LOCATION_REQUIRED');const e=encodeURIComponent(q),url=provider==='waze'?`https://www.waze.com/ul?q=${e}&navigate=yes`:`https://www.google.com/maps/search/?api=1&query=${e}`;root.open(url,'_blank','noopener')}
function phone(c){let p=String(c?.phone||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===9)p='51'+p;return p}
function whatsapp(c,text){const p=phone(c);if(!p)throw new Error('CLIENT_PHONE_REQUIRED');root.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`,'_blank','noopener')}
function captureLocation(){if(!navigator.geolocation)return alert('Ubicación no disponible en este dispositivo.');navigator.geolocation.getCurrentPosition(p=>{$('fLocation').value=`${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`},e=>alert('No se pudo obtener la ubicación: '+e.message),{enableHighAccuracy:true,timeout:15000,maximumAge:0})}
function navButtons(c){if(!target(c))return '';return `<div class="row"><button type="button" class="btn blue" data-map="${esc(c.id)}">🗺️ Google Maps</button><button type="button" class="btn" data-waze="${esc(c.id)}">🚗 Waze</button></div>`}
function reminder(c,amount,date){const money=Number(amount||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});whatsapp(c,`Hola ${c.name||''}, te recordamos tu pago de S/ ${money}${date?' para el '+date:''}. Gracias.`)}
root.MiCarteraV2CustomerExperience={captureLocation,openMap,whatsapp,navButtons,reminder,target};
})(window);
