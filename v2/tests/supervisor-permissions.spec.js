const test=require('node:test'),assert=require('node:assert/strict');
for(const source of ['../core/access-audit.js','../app/core/access-audit.js']){
 const A=require(source);
 test(source+' supervisor can carry out manager financial work',()=>{
  for(const permission of ['CLIENT_WRITE','CREDIT_WRITE','PAYMENT_WRITE','CASH_WRITE','REPORT_READ','AUDIT_READ'])assert.doesNotThrow(()=>A.requirePermission('SUPERVISOR',permission),permission+' must be available to supervisor');
 });
 test(source+' supervisor cannot administer users and collector cannot bypass financial restrictions',()=>{
  assert.throws(()=>A.requirePermission('SUPERVISOR','USER_ADMIN'),/PERMISSION_DENIED/);
  for(const permission of ['CREDIT_WRITE','CASH_WRITE','USER_ADMIN'])assert.throws(()=>A.requirePermission('COBRADOR',permission),/PERMISSION_DENIED/);
  assert.doesNotThrow(()=>A.requirePermission('COBRADOR','PAYMENT_WRITE'));
 });
}
