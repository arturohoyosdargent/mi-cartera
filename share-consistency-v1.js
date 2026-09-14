// Préstamo Ya — Centro único de compartir v6.0
(()=>{
'use strict';
if(window.__prestamoYaShareConsistencyV60)return;
window.__prestamoYaShareConsistencyV60=true;

const db=()=>window.db||{clients:[],credits:[]};
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const clientById=id=>(db().clients||[]).find(c=>String(c.id)===String(id))||null;
const creditById=id=>(db().credits||[]).find(c=>String(c.id)===String(id))||null;
const clientOf=id=>{const cr=creditById(id);return cr&&clientById(cr.clientId)};

function paymentCaption(c){
 const x=window.__prestamoYaLastPaymentShare;
 if(!x||Date.now()-Number(x.at||0)>86400000)return null;
 if(x.clientName&&String(c?.name||'')!==String(x.clientName))return null;
 const qs=Array.isArray(x.paidQuotas)?x.paidQuotas:[];
 const ps=Array.isArray(x.partialQuotas)?x.partialQuotas:[];
 if(qs.length)return `Préstamo Ya — Cuota${qs.length>1?'s':''} ${qs.join(', ')} pagada${qs.length>1?'s':''}`;
 if(ps.length)return `Préstamo Ya — Abono a cuota ${ps.join(', ')} registrado`;
 return 'Préstamo Ya — Pago registrado';
}

function defaultCaption(kind,c){
 if(kind==='payment')return paymentCaption(c)||'Préstamo Ya — Pago registrado';
 if(kind==='proposal')return 'Préstamo Ya — Crédito preaprobado';
 if(kind==='renewal')return 'Préstamo Ya — Renovación preaprobada';
 return 'Préstamo Ya — Detalle del crédito';
}

async function imageShare(kind,c,title,text,message){
 const engine=window.PrestamoYaShareImage;
 const caption=clean(message)||defaultCaption(kind,c);
 const full=String(text||'');
 try{
   if(navigator.share&&engine?.imageFromText){
     const blob=await engine.imageFromText(full);
     if(blob){
       const file=new File([blob],'prestamo-ya.png',{type:'image/png'});
       if(typeof navigator.canShare!=='function'||navigator.canShare({files:[file]})){
         await navigator.share({title:title||'Préstamo Ya',text:caption,files:[file]});
         return true;
       }
     }
   }
   if(navigator.share){
     await navigator.share({title:title||'Préstamo Ya',text:caption});
     return true;
   }
 }catch(e){
   if(e?.name==='AbortError')return false;
 }
 try{
   if(navigator.clipboard){
     await navigator.clipboard.writeText(caption+'\n\n'+full);
     window.toast?.('Información copiada.');
     return true;
   }
 }catch(e){}
 window.toast?.('No fue posible abrir el panel de compartir.');
 return false;
}

function btn(bar,id,label,cls,fn){
 if(!bar||document.getElementById(id))return;
 const b=document.createElement('button');
 b.id=id;b.type='button';b.className='btn '+cls;b.textContent=label;b.onclick=fn;
 bar.appendChild(b);
}

function creditText(cr,c){
 const rows=(cr.schedule||[]).map(q=>`${q.n}. ${q.date||'-'} · ${q.extra?'Pago adicional':'Cuota'} · ${money(q.amount)} · Saldo ${money(Math.max(0,Number(q.amount||0)-Number(q.paid||0)))}`);
 return ['PRÉSTAMO YA — DETALLE DEL CRÉDITO',`Cliente: ${c.name||'-'}`,`Teléfono: ${c.phone||'-'}`,`Capital: ${money(cr.capital)}`,`Interés: ${Number(cr.rate||0)}%`,`Total: ${money(cr.total)}`,`Pagado: ${money(cr.paid)}`,`Saldo: ${money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0)))}`,`Vencimiento: ${cr.maturity||'-'}`,'','CRONOGRAMA',...rows].join('\n');
}

function installCreditDetail(id){
 const cr=creditById(id);
 const body=document.getElementById('creditDetailBody');
 if(!cr||!body)return;
 const c=clientById(cr.clientId);
 if(!c)return;
 const bar=body.querySelector('.actionbar');
 if(!bar)return;
 const recentPayment=paymentCaption(c);
 const label=recentPayment?'📤 Compartir comprobante':'📤 Compartir pantallazo';
 const text=recentPayment?
   ['PRÉSTAMO YA — CONFIRMACIÓN DE PAGO',`Cliente: ${c.name||'-'}`,`Pago recibido: ${money(window.__prestamoYaLastPaymentShare?.paidAmount)}`,`Concepto: ${recentPayment.replace(/^Préstamo Ya — /,'')}`,`Saldo: ${money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0)))}`].join('\n'):
   creditText(cr,c);
 btn(bar,'shareConsistencyCreditDetail',label,'blue',()=>imageShare(recentPayment?'payment':'credit',c,recentPayment?'Confirmación de pago · Préstamo Ya':'Detalle del crédito · Préstamo Ya',text,recentPayment));
}

function proposalClient(modal){
 const text=clean(modal?.innerText||'');
 const clients=db().clients||[];
 return clients.find(c=>c.name&&text.toLowerCase().includes(String(c.name).toLowerCase()))||null;
}

function proposalShare(){
 const m=document.getElementById('creditProposalModal');
 if(!m)return;
 const c=proposalClient(m);
 if(!c)return;
 const source=window.__creditProposalText||clean(m.innerText);
 let box=document.getElementById('prestamoYaProposalShareBox');
 if(box)return;
 box=document.createElement('div');
 box.id='prestamoYaProposalShareBox';
 box.className='card';
 box.style.cssText='border-left:5px solid var(--blue2);background:#f4fbff';
 box.innerHTML=`<b>📤 Compartir propuesta</b><div class="small muted" style="margin:6px 0">Cliente: ${clean(c.name)} · Tel: ${clean(c.phone||'Sin teléfono')}</div><div class="field"><label>Mensaje previo</label><textarea id="prestamoYaProposalMessage" class="input" rows="3">Hola ${clean(c.name)}, te compartimos la propuesta de tu nuevo crédito. Quedamos atentos a tu confirmación.</textarea></div><div class="actionbar"><button type="button" class="btn green" id="prestamoYaProposalWhatsApp">💬 WhatsApp + pantallazo</button><button type="button" class="btn blue" id="prestamoYaProposalShare">📤 Compartir pantallazo</button></div>`;
 const action=m.querySelector('.actionbar');
 if(action)action.insertAdjacentElement('beforebegin',box);else m.querySelector('.sheet')?.appendChild(box);
 const send=()=>{const msg=document.getElementById('prestamoYaProposalMessage')?.value||'';return imageShare('proposal',c,'Crédito preaprobado · Préstamo Ya',source,msg)};
 document.getElementById('prestamoYaProposalWhatsApp')?.addEventListener('click',send);
 document.getElementById('prestamoYaProposalShare')?.addEventListener('click',send);
}

function run(){
 try{
   const id=window.selectedCredit||window.__selectedCreditForProposal||window.__prestamoYaPlannerSelectedCredit;
   if(id)installCreditDetail(id);
   const detail=document.getElementById('creditDetailBody');
   if(detail){
     const m=detail.closest('#creditDetail');
     const text=clean(detail.innerText||'');
     const match=(db().credits||[]).find(cr=>text.includes(String(cr.id)));
     if(match)installCreditDetail(match.id);
   }
   proposalShare();
 }catch(e){console.warn('Share center v6',e)}
}

let timer=0;
function schedule(){clearTimeout(timer);timer=setTimeout(run,150)}
function boot(){
 if(!document.body||window.__prestamoYaShareObserverV60)return;
 window.__prestamoYaShareObserverV60=true;
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 run();
 setTimeout(run,500);
 setTimeout(run,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.PrestamoYaShareCenter={version:'v6.0',share:imageShare,shareImage:imageShare};
})();
