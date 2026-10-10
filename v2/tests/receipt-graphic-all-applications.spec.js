const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
test('graphic retains every recorded full/partial application amount, including long multi-quota payments',async()=>{
 for(const count of [2,3,24]){const h=await boot({fullShell:true});try{const rows=Array.from({length:count},(_,i)=>({number:i+1,amount:40,balanceBefore:40,balanceAfter:0,status:'PAGADA'})),p={id:'proof',concept:'CUOTA',amount:40*count,date:'2026-10-09',totalInstallments:24,installmentApplications:rows,balanceAfterPayment:(24-count)*40},cr={total:960,schedule:Array.from({length:24},(_,i)=>({number:i+1,amount:40,date:'2026-10-10',balance:i<count?0:40}))};
 const snapshot=JSON.stringify(p),blob=await h.w.MiCarteraV2PaymentReceipt.image(p,{name:'Cliente FICTICIO'},cr);a.ok(blob.size>0);for(const row of rows)a.ok(h.drawn.includes('Cuota '+row.number+': S/ 40.00 · COMPLETADA'),'Real quota amount missing from PNG');a.equal(JSON.stringify(p),snapshot);a.equal(h.commits.length,0);
 }finally{await h.close();}}
});
