(()=>{
'use strict';
const root=window, EPS=.005;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const sid=v=>String(v??'');
const getCredit=id=>(root.db?.credits||[]).find(c=>sid(c?.id)===sid(id));
const payments=id=>(root.db?.payments||[]).filter(p=>sid(p?.creditId)===sid(id)&&n(p?.amount)>0);
const duplicateIds=ps=>{const seen=new Set(),dups=new Set();for(const p of ps){const id=sid(p?.id);if(!id||seen.has(id))dups.add(id||'(sin id)');seen.add(id)}return [...dups]};
const pendingQueue=id=>(root.db?.syncQueue||[]).filter(x=>{const t=String(x?.type||'').toLowerCase();const p=x?.payload||{};return (t.includes('payment')||t.includes('pago'))&&sid(p?.creditId)===sid(id)&&x?.status!=='SINCRONIZADO'});
const inspect=id=>{
 const cr=getCredit(id);if(!cr)return {ok:false,reason:'CREDIT_NOT_FOUND',creditId:id};
 const ps=payments(id),dups=duplicateIds(ps),pending=pendingQueue(id);
 const total=n(cr.total)||((cr.schedule||[]).reduce((s,q)=>s+n(q?.amount),0));
 const ledger=ps.reduce((s,p)=>s+n(p.amount),0);
 const over=ledger>total+EPS;
 return {ok:true,creditId:cr.id,total,ledgerPaid:ledger,paymentCount:ps.length,duplicatePaymentIds:dups,pendingPaymentQueue:pending.length,storedPaid:n(cr.paid),schedulePaid:(cr.schedule||[]).reduce((s,q)=>s+n(q?.paid),0),safeToReconcile:dups.length===0&&pending.length===0&&!over,reason:dups.length?'DUPLICATE_PAYMENT_ID':pending.length?'PENDING_PAYMENT_SYNC':over?'OVERPAYMENT':'OK'};
};
const allocate=(cr,paid)=>{let rem=Math.max(0,paid);for(const q of (cr.schedule||[])){const amount=Math.max(0,n(q.amount));const x=Math.min(amount,rem);q.paid=x;rem-=x}return rem};
const reconcile=id=>{
 const check=inspect(id);if(!check.ok||!check.safeToReconcile)return {...check,changed:false};
 const cr=getCredit(id);const before={paid:n(cr.paid),status:cr.status,schedule:(cr.schedule||[]).map(q=>({amount:n(q.amount),paid:n(q.paid)}))};
 const paid=Math.min(check.ledgerPaid,check.total);allocate(cr,paid);cr.paid=paid;cr.status=check.total-paid<=EPS?'paid':'active';
 const after={paid:cr.paid,status:cr.status,schedule:(cr.schedule||[]).map(q=>({amount:n(q.amount),paid:n(q.paid)}))};
 const changed=JSON.stringify(before)!==JSON.stringify(after);
 if(changed){try{root.audit?.('CONCILIACION_FINANCIERA',`Crédito #${cr.id}: ledger S/${paid.toFixed(2)}; estado reconstruido sin crear/eliminar pagos`)}catch(_){};try{root.persist?.()}catch(_){};try{root.enqueueSyncV3?.('credit_update',cr)}catch(_){} }
 return {...check,changed,before,after};
};
const render=id=>{
 const r=inspect(id);if(!r.ok)return r;
 const host=document.getElementById('creditDetailBody');if(!host)return r;
 let box=document.getElementById('financialReconciliationBox');if(!box){box=document.createElement('div');box.id='financialReconciliationBox';box.className='card';host.appendChild(box)}
 const bad=!r.safeToReconcile||Math.abs(r.storedPaid-r.ledgerPaid)>EPS||Math.abs(r.schedulePaid-r.ledgerPaid)>EPS;
 box.innerHTML=`<b>Integridad de pagos</b><div class="info">Movimientos asociados: <b>${r.paymentCount}</b></div><div class="info">Total según movimientos: <b>S/ ${r.ledgerPaid.toFixed(2)}</b></div><div class="info">Crédito registra pagado: S/ ${r.storedPaid.toFixed(2)}</div><div class="info">Cronograma registra pagado: S/ ${r.schedulePaid.toFixed(2)}</div><div class="info"><b>${bad?'⚠️ REQUIERE CONCILIACIÓN':'✅ COINCIDE CON LEDGER'}</b></div>${r.safeToReconcile&&bad?`<button class="btn orange wide" id="reconcileCreditBtn">Corregir desde movimientos</button>`:''}`;
 const b=document.getElementById('reconcileCreditBtn');if(b)b.onclick=()=>{if(!confirm('Se reconstruirá el estado de este crédito usando únicamente los pagos asociados. No se crearán ni eliminarán pagos. ¿Continuar?'))return;const out=reconcile(id);if(out.changed){root.toast?.('Crédito conciliado desde movimientos');try{root.showCredit?.(id)}catch(_){};setTimeout(()=>render(id),50)}else root.toast?.('No fue necesario modificar el crédito')};
 return r;
};
root.financialReconciliationExecutableV1={inspect,reconcile,render};
const hook=()=>{if(typeof root.showCredit!=='function')return setTimeout(hook,250);if(root.__financialReconciliationShowHook)return;root.__financialReconciliationShowHook=true;const raw=root.showCredit;root.showCredit=function(id,...args){const out=raw.call(this,id,...args);setTimeout(()=>render(id),30);return out}};hook();
})();
