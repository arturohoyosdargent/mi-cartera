// Mi Cartera PRO V2 — presentation batches for already-rendered history lists.
(function(root){'use strict';
const BATCH=10,states=new Map(),$=id=>document.getElementById(id);
function identityKey(){try{const gate=root.MiCarteraV2AuthCloudGate,s=gate?.state?.()||{};return [gate?.ORG||'',s.uid||'',s.role||'',s.ready===true].join('|')}catch{return 'NO_SESSION'}}
function styles(){if($('v2HistoryListStyles'))return;const style=document.createElement('style');style.id='v2HistoryListStyles';style.textContent='[data-v2-history-row][hidden]{display:none!important}.v2-history-more{display:block;min-height:44px;margin:10px 0;width:100%}';document.head.appendChild(style)}
function batch(host,selector,key,searching=false){
 if(!host)return;
 const rows=Array.from(host.children).filter(row=>row.matches(selector)),old=Array.from(host.children).find(row=>row.dataset.v2HistoryMore==='1');
 old?.remove();
 const signature=identityKey()+'|'+JSON.stringify(rows.map(row=>row.textContent));
 let state=states.get(key);if(!state||state.signature!==signature)state={signature,count:BATCH};
 if(searching){states.delete(key);for(const row of rows){if(row.dataset.v2HistoryRow==='1')row.hidden=false}return}
 states.set(key,state);
 const show=()=>{for(const [index,row] of rows.entries()){row.dataset.v2HistoryRow='1';row.hidden=index>=state.count}};
 show();if(rows.length<=state.count)return;
 const button=document.createElement('button');button.type='button';button.className='btn v2-history-more';button.dataset.v2HistoryMore='1';
 if(host.id)button.setAttribute('aria-controls',host.id);
 const label=()=>{button.textContent='Ver más · '+Math.max(0,rows.length-state.count)+' restantes'};label();
 button.onclick=()=>{state.count+=BATCH;show();if(state.count>=rows.length)button.remove();else label()};host.appendChild(button);
}
function wrap(api,name){
 const original=api?.[name];if(typeof original!=='function'||original.__v2HistoryWrapped)return;
 function wrapped(){const result=original.apply(this,arguments);try{render()}catch(error){console.error('V2_HISTORY_RENDER_FAILED',error)}return result}
 wrapped.__v2HistoryWrapped=true;api[name]=wrapped;
}
function render(){
 wrap(root.V2UI,'render');wrap(root.MiCarteraV2Cards,'render');wrap(root.MiCarteraV2Cards,'renderPayments');wrap(root.MiCarteraV2CashMenu,'renderHistory');wrap(root.MiCarteraV2CashMenu,'install');
 batch($('paymentHistory'),'.card','payments',!!String($('paymentSearch')?.value||'').trim());
 batch($('supportList'),'[data-support-ticket]','support-own');batch($('v2SupportInboxList'),'[data-support-ticket]','support-inbox');
 batch($('auditHistory'),'[data-audit-entry]','audit');
 for(const group of $('cashHistory')?.querySelectorAll('details')||[]){const summary=group.querySelector('summary');if(summary)batch(group,'.v2-cash-detail','cash|'+(summary.querySelector('b')?.textContent||summary.textContent))}
}
function install(){styles();render()}
document.addEventListener('DOMContentLoaded',install);
document.addEventListener('input',event=>{if(event.target?.id==='paymentSearch')render()});
document.addEventListener('change',event=>{if(/^cashHistory(Period|From|To|Type)$/.test(event.target?.id||''))render()});
root.addEventListener?.('storage',render);root.addEventListener?.('mi-cartera-v2-rehydrated',render);
root.addEventListener?.('mi-cartera-v2-sync',event=>{if(event.detail?.ok!==false)render()});
root.addEventListener?.('v2-auth-cloud-state',()=>{states.clear();render()});
root.MiCarteraV2HistoryList={install,render};
if(document.readyState!=='loading')install();
})(window);
