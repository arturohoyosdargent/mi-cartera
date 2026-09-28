const assert=require('assert');
const S=require('../core/schedule-engine');

// Monthly schedules must follow calendar months, not fixed 30-day blocks.
const monthly=S.generate({total:400,term:4,freq:'monthly',firstPaymentDate:'2026-01-31'});
assert.deepStrictEqual(monthly.map(x=>x.date),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
assert.strictEqual(monthly.reduce((sum,x)=>Math.round((sum+x.amount)*100)/100,0),400);

// A configured rest day must move that due date forward and preserve unique/increasing dates.
const daily=S.generate({total:30,term:3,freq:'daily',firstPaymentDate:'2026-09-20',restDay:0});
assert.deepStrictEqual(daily.map(x=>x.date),['2026-09-21','2026-09-22','2026-09-23']);
assert.strictEqual(new Set(daily.map(x=>x.date)).size,daily.length);

console.log('V2 credit schedule regression: PASS');
