(()=>{
'use strict';
const root=window, EPS=.005;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const sid=v=>String(v??'');
const paymentsFor=(db,creditId)=>(Array.isArray(db?.payments)?db.payments:[]).filter(p=>sid(p?.creditId)===sid(creditId)&&n(p?.amount)>0);
const isInterest=p=>String(p?.concept||'').toUpperCase()==='INTERES'||String(p?.type||'').toLowerCase()==='interest_renewal';
const capitalPart=p=>isInterest(p)?Math.max(0,n(p?.capitalAmount)):p?.capitalAmount!=null?Math.max(0,n(p.capitalAmount)):Math.max(0,n(p?.amount));
const interestPart=p=>isInterest(p)?(p?.interestAmount!=null?Math.max(0,n(p.interestAmount)):Math.max(0,n(p?.amount))):Math.max(0,n(p?.interestAmount));
const ledgerBreakdown=(db,creditId)=>paymentsFor(db,creditId).reduce((a,p)=>{a.cash+=n(p.amount);a.capital+=capitalPart(p);a.interest+=interestPart(p);return a},{cash:0,capital:0,interest:0});
const schedulePaid=cr=>(Array.isArray(cr?.schedule)?cr.schedule:[]).reduce((s,q)=>s+n(q?.paid),0);
const scheduleTotal=cr=>(Array.isArray(cr?.schedule)?cr.schedule:[]).reduce((s,q)=>s+n(q?.amount),0);
const derive=(db,cr)=>{
 const total=n(cr?.total)||scheduleTotal(cr), ledger=ledgerBreakdown(db,cr?.id), stored=n(cr?.paid), sched=schedulePaid(cr);
 const expectedPaid=Math.min(Math.max(0,ledger.capital),Math.max(0,total)), expectedBalance=Math.max(0,total-expectedPaid), mismatches=[];
 if(Math.abs(stored-expectedPaid)>EPS)mismatches.push({field:'credit.paid',stored,expectedCapitalPaid:expectedPaid});
 if(Math.abs(sched-expectedPaid)>EPS)mismatches.push({field:'schedule.paid',stored:sched,expectedCapitalPaid:expectedPaid});
 if(ledger.capital>total+EPS)mismatches.push({field:'capitalOverpayment',capitalPaid:ledger.capital,total});
 return {creditId:cr?.id,total,ledgerPaid:ledger.cash,capitalPaid:ledger.capital,interestPaid:ledger.interest,storedPaid:stored,schedulePaid:sched,expectedPaid,expectedBalance,paymentCount:paymentsFor(db,cr?.id).length,status:expectedBalance<=EPS?'PAGADO':'ACTIVO',mismatches,consistent:mismatches.length===0};
};
const audit=db=>({generatedAt:new Date().toISOString(),sourceOfTruth:'concept-aware-payments-ledger',destructiveChanges:false,credits:(Array.isArray(db?.credits)?db.credits:[]).map(cr=>derive(db,cr))});
const repairPlan=(db,creditId)=>{const cr=(db?.credits||[]).find(x=>sid(x.id)===sid(creditId));if(!cr)return null;const r=derive(db,cr);return {...r,action:r.consistent?'NONE':'RECONCILE_REQUIRED',proposed:{creditPaid:r.expectedPaid,balance:r.expectedBalance,status:r.status},note:'Plan solamente. Los pagos de interés no reducen capital.'}};
root.financialReconciliationV1={deriveCredit:id=>{const cr=(root.db?.credits||[]).find(x=>sid(x.id)===sid(id));return cr?derive(root.db,cr):null},audit:()=>audit(root.db),repairPlan:id=>repairPlan(root.db,id)};
try{root.__financialReconciliationAudit=audit(root.db)}catch(e){console.warn('Préstamo Ya · conciliación financiera',e)}
})();
