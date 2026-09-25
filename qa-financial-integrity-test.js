const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('financial-integrity-v1.js','utf8');
const sandbox={window:{},console:{table(){},info(){}}};vm.createContext(sandbox);vm.runInContext(code,sandbox);
const audit=sandbox.window.runFinancialIntegrityAudit;
function ok(x,m){if(!x)throw new Error(m)}
const db={clients:[{id:'c1'}],credits:[{id:'cr1',clientId:'c1',total:100,paid:20,schedule:[{paid:20}]}],payments:[{id:'p1',creditId:'cr1',amount:10},{id:'p2',creditId:'cr1',amount:10}]};
let r=audit(db);ok(r.duplicatePaymentIds.length===0,'same amount/date-like legitimate payments must survive when IDs differ');ok(r.balanceMismatches.length===0,'consistent ledger/credit/schedule must reconcile');ok(r.destructiveChanges===false&&r.policy==='report-only','auditor must remain non-destructive');
const dup={clients:[{id:'c1'}],credits:[{id:'cr1',clientId:'c1',total:100,paid:20,schedule:[{paid:20}]}],payments:[{id:'p1',creditId:'cr1',amount:10},{id:'p1',creditId:'cr1',amount:10}]};
r=audit(dup);ok(r.duplicatePaymentIds.length===1&&r.duplicatePaymentIds[0]==='p1','duplicate stable payment ID must be detected');
const bad={clients:[{id:'c1'}],credits:[{id:'cr1',clientId:'c1',total:100,paid:30,schedule:[{paid:20}]}],payments:[{id:'p1',creditId:'cr1',amount:20},{id:'orphan',creditId:'missing',amount:5}]};
r=audit(bad);ok(r.balanceMismatches.length===1,'ledger/stored/schedule mismatch must be detected');ok(r.orphanPayments.length===1,'orphan payment must be reported');
console.log('PASS financial integrity: stable-ID dedupe, reconciliation, orphan detection, non-destructive policy');
