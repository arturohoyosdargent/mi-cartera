const assert=require('assert');
const F=require('../core/financial-engine.js');
const S=require('../core/schedule-engine.js');
(()=>{
  assert.ok(F && F.STATUS && F.STATUS.ACTIVE==='ACTIVO');
  const schedule=S.generate({total:240,term:4,freq:'weekly',firstPaymentDate:'2026-09-20'});
  assert.deepEqual(schedule.map(x=>x.amount),[60,60,60,60]);
  console.log('V2 integrated branch smoke: PASS');
})();
