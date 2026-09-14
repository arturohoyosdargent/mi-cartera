// Préstamo Ya — Centro único de compartir v5
(()=>{
'use strict';
if(window.__prestamoYaShareConsistencyV5)return;
window.__prestamoYaShareConsistencyV5=true;

const db=()=>window.db||{clients:[],credits:[]};
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const clientById=id=>(db().clients||[]).find(c=>String(c.id)===String(id))||null;
const creditById=id=>(db().credits||[]).find(c=>String(c.id)===String(id))||null;
const clientOf=id=>{const cr=creditById(id);return cr&&clientById(cr.clientId)};

function phone(c){
 let p=String(c?.phone||'').replace(/\D/g,'');
 if(p.startsWith('00'))p=p.slice(2);
 if(p.length===9)p='51'+p;
 return p
}

function paymentCaption(c){
 const x=window.__prestamoYaLastPaymentShare;
 if(!x||Date.now()-Number(x.at||0)>86400000)return null;
 if(x.clientName&&String(c?.name||'')!==String(x.clientName))return null;
 const qs=x.paidQuotas||[];
 const ps=x.partialQuotas||[];
 if(qs.length)return `Préstamo Ya — Cuota${qs.length>1?'s':''} ${qs.join(', ')} pagada${qs.length>1?'s':''}`;
 if(ps.length)return `Préstamo Ya — Abono a cuota ${ps.join(', ')} registrado`;
 return 'Préstamo Ya — Pago registrado';
}

function captionFor(kind,c){
 if(kind==='payment')return paymentCaption(c)||'Préstamo Ya — Pago registrado';
 if(kind==='proposal')return 'Préstamo Ya — Crédito preaprobado';
 if(kind==='renewal')return 'Préstamo Ya — Renovación preaprobada';
 if(kind==='approved')return 'Préstamo Ya — Crédito aprobado';
 if(kind==='renewed')return 'Préstamo Ya — Crédito renovado';
 if(kind==='history')return 'Préstamo Ya — Historial del cliente';
 return 'Préstamo Ya — Detalle del crédito';
}

function directWhatsApp(kind,c,text,title){
 const caption=captionFor(kind,c);
 const p=phone(c);
 if(!p){
   window.toast?.('Este cliente no tiene teléfono válido.');
   return false
 }
 window.open(
   'https://wa.me/'+p+'?text='+encodeURIComponent(caption),
   '_blank',
   'noopener'
 );
 return true;
}

function shareImage(kind,c,text,title){
 const t=String(text||'');
 const caption=captionFor(kind,c);
 const engine=window.PrestamoYaShareImage;

 if(navigator.share&&engine?.imageFromText){
   engine.imageFromText(t).then(blob=>{
     if(!blob)return directWhatsApp(kind,c,t,title);

     const file=new File(
       [blob],
       'prestamo-ya.png',
       {type:'image/png'}
     );

     if(navigator.canShare?.({files:[file]})){
       return navigator.share({
         title:title||'Préstamo Ya',
         text:caption,
         files:[file]
       });
     }

     return directWhatsApp(kind,c,t,title);
   }).catch(()=>directWhatsApp(kind,c,t,title));

   return true;
 }

 return directWhatsApp(kind,c,t,title);
}

async function share(kind,c,title,text){
 const t=String(text||'');

 try{
   if(navigator.share){
     const engine=window.PrestamoYaShareImage;

     if(engine?.imageFromText){
       const blob=await engine.imageFromText(t);

       if(blob){
         const file=new File(
           [blob],
           'prestamo-ya.png',
           {type:'image/png'}
         );

         if(navigator.canShare?.({files:[file]})){
           await navigator.share({
             title:title||'Préstamo Ya',
             text:captionFor(kind,c),
             files:[file]
           });
           return true;
         }
       }
     }

     await navigator.share({
       title:title||'Préstamo Ya',
       text:captionFor(kind,c)
     });

     return true;
   }
 }catch(e){
   if(e?.name==='AbortError')return false
 }

 try{
   await navigator.clipboard.writeText(t);
   toast?.('Información copiada para compartir.');
   return true
 }catch(e){
   toast?.('No fue posible compartir la información.');
   return false
 }
}

function btn(bar,id,label,cls,fn){
 if(!bar||document.getElementById(id))return;

 const b=document.createElement('button');
 b.id=id;
 b.type='button';
 b.className='btn '+cls;
 b.textContent=label;
 b.onclick=fn;

 bar.appendChild(b);
}

function pair(bar,p){
 if(!bar)return;

 btn(
   bar,
   p.si,
   p.sl||'📤 Compartir',
   'blue',
   ()=>share(
     p.kind,
     p.client(),
     p.title,
     p.text()
   )
 );

 btn(
   bar,
   p.wi,
   p.wl||'💬 Enviar por WhatsApp',
   'green',
   ()=>directWhatsApp(
     p.kind,
     p.client(),
     p.text(),
     p.title
   )
 );
}

function creditText(cr,c){
 const rows=(cr.schedule||[]).map(q=>
   `${q.n}. ${q.date||'-'} · ${q.extra?'Pago adicional':'Cuota'} · ${money(q.amount)} · Saldo ${money(Math.max(0,Number(q.amount||0)-Number(q.paid||0)))}`
 );

 return [
   'PRÉSTAMO YA — DETALLE DEL CRÉDITO',
   `Cliente: ${c.name||'-'}`,
   `Teléfono: ${c.phone||'-'}`,
   `Capital: ${money(cr.capital)}`,
   `Interés: ${Number(cr.rate||0)}%`,
   `Total: ${money(cr.total)}`,
   `Pagado: ${money(cr.paid)}`,
   `Saldo: ${money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0)))}`,
   `Vencimiento: ${cr.maturity||'-'}`,
   '',
   'CRONOGRAMA',
   ...rows
 ].join('\n');
}

function installCredit(id){
 const cr=creditById(id);
 if(!cr)return;

 const c=clientById(cr.clientId);
 const body=document.getElementById('creditDetailBody');

 if(!c||!body)return;

 const bar=
   body.querySelector('.actionbar')||
   document.querySelector('#creditDetail .actionbar');

 if(!bar)return;

 pair(bar,{
   kind:'credit',
   si:'shareConsistencyCredit',
   wi:'shareConsistencyCreditWA',
   sl:'📤 Compartir detalle',
   wl:'💬 Enviar por WhatsApp',
   title:'Detalle del crédito · Préstamo Ya',
   client:()=>c,
   text:()=>creditText(cr,c)
 });
}

function installPayment(){
 const x=window.__prestamoYaLastPaymentShare;

 if(!x||Date.now()-Number(x.at||0)>86400000)return;

 const cr=creditById(x.creditId);
 const c=cr&&clientById(cr.clientId);
 const body=document.getElementById('collectBody');

 if(!cr||!c||!body)return;

 const bar=
   body.querySelector('.actionbar')||
   document.querySelector('#creditDetailBody .actionbar');

 if(!bar)return;

 const text=()=>[
   'PRÉSTAMO YA — CONFIRMACIÓN DE PAGO',
   `Cliente: ${c.name||'-'}`,
   `Pago recibido: ${money(x.paidAmount)}`,
   `Concepto: ${paymentCaption(c)?.replace(/^Préstamo Ya — /,'')||'Pago registrado'}`,
   Math.max(0,Number(cr.total||0)-Number(cr.paid||0))
     ?`Saldo pendiente: ${money(Math.max(0,Number(cr.total||0)-Number(cr.paid||0)))}`
     :'El crédito queda totalmente pagado.'
 ].join('\n');

 pair(bar,{
   kind:'payment',
   si:'shareConsistencyPayment',
   wi:'shareConsistencyPaymentWA',
   sl:'📤 Compartir comprobante',
   wl:'💬 Confirmar por WhatsApp',
   title:'Confirmación de pago · Préstamo Ya',
   client:()=>c,
   text
 });
}

function proposal(){
 const m=document.getElementById('creditWorkflowModal');
 if(!m)return;

 const box=document.getElementById('creditClientBox');
 const t=clean(box?.innerText||'');

 const c=(db().clients||[]).find(
   x=>x.name&&t.toLowerCase().includes(String(x.name).toLowerCase())
 );

 if(!c)return;

 const bar=m.querySelector('.actionbar');
 if(!bar)return;

 const text=()=>[
   'PRÉSTAMO YA',
   'PROPUESTA DE PRÉSTAMO',
   clean(box?.innerText||''),
   ...[...m.querySelectorAll('.card')]
     .map(x=>clean(x.innerText))
     .filter(Boolean),
   '',
   'Esta propuesta es informativa. El crédito NO queda registrado hasta que el cliente acepte y se guarde.'
 ].join('\n')
  .replace(
    /📤 Enviar al cliente|💬 Enviar por WhatsApp|✅ Cliente acepta y guardar|Volver/g,
    ''
  )
  .replace(/\n{3,}/g,'\n\n');

 pair(bar,{
   kind:'proposal',
   si:'shareConsistencyProposal',
   wi:'shareConsistencyProposalWA',
   sl:'📤 Compartir propuesta',
   wl:'💬 Enviar por WhatsApp',
   title:'Crédito preaprobado · Préstamo Ya',
   client:()=>c,
   text
 });
}

function renewal(){
 const m=document.getElementById('renewalModal');
 if(!m)return;

 const c=clientOf(window.__renewingCreditId);
 if(!c)return;

 const bar=m.querySelector('.actionbar');
 if(!bar)return;

 const text=()=>[
   'PRÉSTAMO YA',
   'PROPUESTA DE RENOVACIÓN',
   ...[...m.querySelectorAll('.card')]
     .map(x=>clean(x.innerText))
     .filter(Boolean),
   '',
   'La renovación queda registrada únicamente al confirmar y guardar.'
 ].join('\n');

 pair(bar,{
   kind:'renewal',
   si:'renewalShareConsistency',
   wi:'renewalWhatsAppConsistency',
   sl:'📤 Compartir propuesta',
   wl:'💬 Enviar propuesta por WhatsApp',
   title:'Renovación preaprobada · Préstamo Ya',
   client:()=>c,
   text
 });
}

function history(){
 const box=document.getElementById('reportBox');
 if(!box)return;

 const cards=[...box.querySelectorAll('.card')];

 const head=cards.find(
   x=>/Historial completo/i.test(x.innerText||'')
 );

 if(head){
   const t=clean(head.innerText);

   const c=(db().clients||[]).find(
     x=>x.name&&t.toLowerCase().includes(String(x.name).toLowerCase())
   );

   if(c){
     const bar=
       head.querySelector('.actionbar')||
       head.appendChild(
         Object.assign(
           document.createElement('div'),
           {className:'actionbar'}
         )
       );

     pair(bar,{
       kind:'history',
       si:'historyShareConsistency',
       wi:'historyWhatsAppConsistency',
       sl:'📤 Compartir historial',
       wl:'💬 Enviar historial por WhatsApp',
       title:'Historial del cliente · Préstamo Ya',
       client:()=>c,
       text:()=>clean(head.innerText)
     });
   }
 }

 cards
   .filter(x=>/💳 Crédito #/i.test(x.innerText||''))
   .forEach((card,i)=>{
     const m=card.innerText.match(
       /Crédito #([A-Za-z0-9_-]+)/i
     );

     const cr=m&&creditById(m[1]);
     const c=cr&&clientById(cr.clientId);

     if(!cr||!c)return;

     const bar=
       card.querySelector('.actionbar')||
       card.appendChild(
         Object.assign(
           document.createElement('div'),
           {className:'actionbar'}
         )
       );

     pair(bar,{
       kind:'credit',
       si:`historyCreditShareConsistency${i}`,
       wi:`historyCreditWAConsistency${i}`,
       sl:'📤 Compartir crédito',
       wl:'💬 WhatsApp',
       title:'Detalle del crédito · Préstamo Ya',
       client:()=>c,
       text:()=>clean(card.innerText)
     });
   });
}

function run(id){
 installCredit(
   id||
   window.selectedCredit||
   window.__selectedCreditForProposal||
   window.__prestamoYaPlannerSelectedCredit
 );

 installPayment();
 proposal();
 renewal();
 history();
}

const wrap=(name,after)=>{
 const old=window[name];

 if(typeof old!=='function'||old.__pyShareCenter)return;

 const f=function(...a){
   const r=old.apply(this,a);

   setTimeout(()=>after(a),100);
   setTimeout(()=>run(a[0]),350);

   return r;
 };

 f.__pyShareCenter=true;
 window[name]=f;
};

wrap('showCredit',a=>run(a[0]));
wrap('renderAll',()=>run());
wrap('go',()=>run());

new MutationObserver(()=>{
 clearTimeout(window.__pyShareTimer);
 window.__pyShareTimer=setTimeout(()=>run(),100)
}).observe(
 document.body,
 {childList:true,subtree:true}
);

if(document.readyState==='loading'){
 document.addEventListener(
   'DOMContentLoaded',
   ()=>run(),
   {once:true}
 );
}else{
 run();
}

setTimeout(run,500);
setTimeout(run,1500);

window.PrestamoYaShareCenter={
 version:'v5.1',
 whatsapp:directWhatsApp,
 share,
 shareImage
};

})();
