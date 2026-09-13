// Reparación de clientes v4 + vínculo seguro del cliente en créditos.
(()=>{
'use strict';
const wait=()=>{if(typeof window.db!=='object'||typeof window.cloudSyncNow!=='function')return setTimeout(wait,300);if(window.__prestamoYaClientRepairV4)return;window.__prestamoYaClientRepairV4=true;
window.syncClientsNow=async()=>{try{window.updateSyncUI?.();return true}catch(_){return false}};

const dbx=()=>window.db||null;
const clients=()=>dbx()?.clients||[];
const byId=id=>clients().find(c=>String(c.id)===String(id));
const valid=id=>!!byId(id);
const remember=id=>{if(!valid(id))return null;const s=String(id);window.__prestamoYaPendingClientId=s;window.__selectedClientForProposal=s;try{window.selectedClient=s}catch(_){}try{if(typeof selectedClient!=='undefined')selectedClient=s}catch(_){}return s};

function domClientId(){
 const box=document.getElementById('creditClientBox');
 const form=document.getElementById('creditForm');
 const els=[];
 if(box)box.querySelectorAll('select,input,[data-client-id]').forEach(x=>els.push(x));
 if(form)form.querySelectorAll('select,input,[data-client-id]').forEach(x=>{const i=String(x.id||'').toLowerCase(),n=String(x.name||'').toLowerCase();if(i.includes('client')||i.includes('cliente')||n.includes('client')||n.includes('cliente')||x.hasAttribute('data-client-id'))els.push(x)});
 for(const el of els){const v=el.getAttribute('data-client-id')||el.value;if(valid(v))return String(v)}
 return null;
}
function resolve(){
 const dom=domClientId();if(dom)return remember(dom);
 if(valid(window.__prestamoYaPendingClientId))return remember(window.__prestamoYaPendingClientId);
 try{if(typeof selectedClient!=='undefined'&&valid(selectedClient))return remember(selectedClient)}catch(_){}
 if(valid(window.selectedClient))return remember(window.selectedClient);
 if(valid(window.__selectedClientForProposal))return remember(window.__selectedClientForProposal);
 return null;
}
function captureNew(before){const c=clients().find(x=>!before.has(String(x.id)));if(c)remember(c.id);return c||null}
function patch(){
 if(typeof window.newCredit==='function'&&!window.newCredit.__clientBindingFix){const raw=window.newCredit;const f=function(clientId,...a){if(valid(clientId))remember(clientId);const r=raw.call(this,clientId,...a);setTimeout(resolve,0);return r};f.__clientBindingFix=true;window.newCredit=f}
 if(typeof window.saveClient==='function'&&!window.saveClient.__clientBindingFix){const raw=window.saveClient;const f=function(...a){const before=new Set(clients().map(c=>String(c.id)));const r=raw.apply(this,a);setTimeout(()=>captureNew(before),0);return r};f.__clientBindingFix=true;window.saveClient=f}
 const form=document.getElementById('creditForm');
 if(form&&!form.__clientBindingListeners){form.__clientBindingListeners=true;form.addEventListener('change',e=>{const t=e.target;if(t&&(t.closest('#creditClientBox')||String(t.id||'').toLowerCase().includes('client')||String(t.name||'').toLowerCase().includes('client'))){const id=domClientId();if(id)remember(id)}},true)}
 if(typeof window.saveCredit==='function'&&!window.saveCredit.__clientBindingFix){const raw=window.saveCredit;const f=function(...a){const id=resolve();if(!id){try{toast('Seleccione cliente o abra el crédito desde el cliente')}catch(_){}return}remember(id);try{if(typeof selectedClient!=='undefined')selectedClient=id}catch(_){}try{window.selectedClient=id}catch(_){}try{window.__selectedClientForProposal=id}catch(_){}return raw.apply(this,a)};f.__clientBindingFix=true;window.saveCredit=f}
}
const boot=()=>{patch();setTimeout(patch,250);setTimeout(patch,800);setTimeout(patch,1600);setTimeout(patch,3000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(()=>patch()).observe(document.documentElement,{childList:true,subtree:true});
};
wait();
})();
