// Mi Cartera PRO V2 — client action disclosure. Reuses the original action nodes and listeners.
(function(root){'use strict';
let opened=null,observed=null,observer=null,sequence=0,listeners=false;
function styles(){if(document.getElementById('v2ClientActionsMenuStyles'))return;const style=document.createElement('style');style.id='v2ClientActionsMenuStyles';style.textContent=`
.v2-client-primary-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.v2-client-primary-actions>.btn{flex:1;min-height:44px;font:inherit}
[data-client-actions-panel]{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:8px;padding:10px;margin-top:8px;border:1px solid #d4d9dd;border-radius:10px;background:#f4f9fc}
[data-client-actions-panel][hidden]{display:none}[data-client-actions-panel]>.btn{min-height:44px;width:100%;font:inherit;overflow-wrap:anywhere}
`;document.head.appendChild(style)}
function close(restoreFocus){if(!opened)return;const current=opened;opened=null;current.panel.hidden=true;current.toggle.setAttribute('aria-expanded','false');if(restoreFocus&&current.toggle.isConnected)current.toggle.focus()}
function togglePanel(toggle,panel){const closing=opened?.toggle===toggle;close();if(closing)return;panel.hidden=false;toggle.setAttribute('aria-expanded','true');opened={toggle,panel};panel.querySelector('button:not([disabled]),a[href]')?.focus()}
function isAction(button){if(button.matches('.v2-edit-client-button,.v2-delete-client-button,.v2-merge-client-button'))return true;const action=String(button.dataset.action||''),inline=String(button.getAttribute('onclick')||'');return /^(map|waze|contact|editClient|deleteClient|mergeDuplicateClient)$/.test(action)||/\.(map|waze|contact|editClient|deleteClient|mergeDuplicateClient)\s*\(/.test(inline)}
function decorate(){const list=document.getElementById('clientsList');if(!list)return;if(opened&&!opened.toggle.isConnected)close();let created=false;for(const card of list.querySelectorAll('[data-client-card]')){
  let primary=card.querySelector('.v2-client-primary-actions');if(!primary){primary=document.createElement('div');primary.className='v2-client-primary-actions';card.appendChild(primary);created=true}
  let panel=card.querySelector('[data-client-actions-panel]');if(!panel){panel=document.createElement('div');panel.dataset.clientActionsPanel='1';panel.id='v2ClientActionsPanel-'+(++sequence);panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Acciones de '+(card.querySelector('b')?.textContent||'cliente'));card.appendChild(panel)}
  let toggle=primary.querySelector('[data-client-actions-toggle]');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='btn';toggle.dataset.clientActionsToggle='1';toggle.textContent='⚙️ Acciones';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>togglePanel(toggle,panel));primary.prepend(toggle)}
  const oldRows=new Set();for(const button of card.querySelectorAll('button')){if(!isAction(button)||button.parentElement===panel)continue;oldRows.add(button.parentElement);panel.appendChild(button)}
  for(const row of card.querySelectorAll('.v2-client-actions'))if(row!==panel)row.classList.remove('v2-client-actions');panel.classList.add('v2-client-actions');
  for(const row of oldRows)if(row!==primary&&row!==panel&&row?.classList.contains('row')&&!row.children.length&&!row.textContent.trim())row.remove();
  const evaluation=card.querySelector('.v2-client-evaluation-button');if(evaluation&&evaluation.parentElement!==primary)primary.appendChild(evaluation);
}
// Evaluation owns its own button. Request decoration only for newly created rows;
// its text updates must not start a MutationObserver loop.
if(created)root.MiCarteraV2CreditEvaluationUI?.decorateClients?.();}
function wrapCards(){const cards=root.MiCarteraV2Cards;if(!cards||cards.__v2ClientActionsMenuWrapped)return;for(const name of ['render','renderClients'])if(typeof cards[name]==='function'){const render=cards[name];cards[name]=function(){const result=render.apply(this,arguments);root.MiCarteraV2ClientEditor?.decorate?.();decorate();return result}}cards.__v2ClientActionsMenuWrapped=true}
function install(){styles();wrapCards();if(!listeners){listeners=true;document.addEventListener('click',event=>{if(opened&&!opened.panel.contains(event.target)&&!opened.toggle.contains(event.target))close()});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();close(true)}})}const list=document.getElementById('clientsList');if(list&&observed!==list){observer?.disconnect();observed=list;observer=new root.MutationObserver(decorate);observer.observe(list,{childList:true,subtree:true})}decorate()}
root.MiCarteraV2ClientActionsMenu={install,decorate,close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
for(const event of ['mi-cartera-v2-rehydrated','mi-cartera-v2-sync','v2-auth-cloud-state'])root.addEventListener(event,install);
})(window);
