(()=>{
'use strict';
const root=window, EPS=.005;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const sid=v=>String(v??'');
const paymentsFor=(db,creditId)=>(Array.isArray(db?.payments)?db.payments:[]).filter(p=>sid(p?.creditId)===sid(creditId)&&n(p?.amount)>0);
const ledgerPaid=(db,creditId)=>paymentsFor(db,creditId).reduce((s,p)=>s+n(p.amount),0);
const schedulePaid=cr=>(Array.isArray(cr?.schedule)?cr.schedule:[]).reduce((s,q)=>s+n(q?.paid),0);
const scheduleTotal=cr=>(Array.isArray(cr?.schedule)?cr.schedule:[]).reduce((s,q)=>s+n(q?.amount),0);
const derive=(db,cr)=>{
 const total=n(cr?.total)||scheduleTotal(cr);
 const ledger=ledgerPaid(db,cr?.id);
 const stored=n(cr?.paid), sched=schedulePaid(cr);
 const expectedPaid=Math.min(Math.max(0,ledger),Math.max(0,total));
 const expectedBalance=Math.max(0,total-expectedPaid);
 const mismatches=[];
 if(Math.abs(stored-ledger)>EPS)mismatches.push({field:'credit.paid',stored,ledger});
 if(Math.abs(sched-ledger)>EPS)mismatches.push({field:'schedule.paid',stored:sched,ledger});
 if(ledger>total+EPS)mismatches.push({field:'overpayment',ledger,total});
 return {creditId:cr?.id,total,ledgerPaid:ledger,storedPaid:stored,schedulePaid:sched,expectedPaid,expectedBalance,paymentCount:paymentsFor(db,cr?.id).length,status:expectedBalance<=EPS?'PAGADO':'ACTIVO',mismatches,consistent:mismatches.length===0};
};
const audit=db=>({generatedAt:new Date().toISOString(),sourceOfTruth:'payments-ledger',destructiveChanges:false,credits:(Array.isArray(db?.credits)?db.credits:[]).map(cr=>derive(db,cr))});
const repairPlan=(db,creditId)=>{const cr=(db?.credits||[]).find(x=>sid(x.id)===sid(creditId));if(!cr)return null;const r=derive(db,cr);return {...r,action:r.consistent?'NONE':'RECONCILE_REQUIRED',proposed:{creditPaid:r.expectedPaid,balance:r.expectedBalance,status:r.status},note:'Plan solamente. No modifica datos ni crea/elimina pagos.'}};
root.financialReconciliationV1={deriveCredit:id=>{const cr=(root.db?.credits||[]).find(x=>sid(x.id)===sid(id));return cr?derive(root.db,cr):null},audit:()=>audit(root.db),repairPlan:id=>repairPlan(root.db,id)};
try{root.__financialReconciliationAudit=audit(root.db)}catch(e){console.warn('Préstamo Ya · conciliación financiera',e)}
})();
