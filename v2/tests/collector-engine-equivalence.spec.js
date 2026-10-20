const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const core=require('../core/financial-engine'),server=require('../../functions/v2-financial-engine');
test('server vendored engine stays byte-equivalent to the approved V2 engine',()=>assert.equal(fs.readFileSync(path.join(__dirname,'../../functions/v2-financial-engine.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../core/financial-engine.js'),'utf8')));
test('server and browser allocate rounding, installments and complete payments identically',()=>{
 for(const [capital,total,paid,interestPaid,amount,balance] of [[100,120,0,0,20,120],[100,120,16.67,3.33,100,100],[99.99,113.37,0,0,37.79,113.37],[10,12,10,0,2,2]]){
  const credit={id:'credit',clientId:'client',capital,total,principalPaid:paid,interestPaid,status:'ACTIVO',version:1},input={id:'payment',amount,date:'2026-10-13'};
  assert.deepEqual(server.allocateInstallment(credit,input,balance),core.allocateInstallment(credit,input,balance));
 }
});
test('callable server business date follows America/Lima midnight',()=>{const {businessDate}=require('../../functions/v2-collector-callable');assert.equal(businessDate('2026-10-14T04:59:59.000Z'),'2026-10-13');assert.equal(businessDate('2026-10-14T05:00:00.000Z'),'2026-10-14')});
