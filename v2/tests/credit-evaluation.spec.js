const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const file='../app/credit-evaluation-v2.js',E=fs.existsSync(require('node:path').join(__dirname,file))?require(file):{};
const evaluate=(...args)=>{a.equal(typeof E.evaluate,'function','Read-only credit evaluation is not implemented');return E.evaluate(...args)};
const q=(date,balance=0)=>({amount:100,paid:100-balance,balance,date});
const cr=(schedule,extra={})=>({id:'cr1',clientId:'c1',status:'ACTIVE',capital:300,total:300,schedule,...extra});
const p=(id,number,date,extra={})=>({id,creditId:'cr1',concept:'CUOTA',date,amount:100,totalInstallments:3,installmentApplications:[{number,amount:100,balanceBefore:100,balanceAfter:0,status:'PAGADA'}],...extra});
const state=(credits,payments=[],client={id:'c1',name:'Cliente FICTICIO'})=>({clients:[client],credits,payments});

test('green requires three evidenced completed quotas, a genuinely paid credit, and no unknown/late/current overdue data',()=>{
 const d=state([cr([q('2026-09-01'),q('2026-09-02'),q('2026-09-03')],{status:'PAGADO'})],[p('p1',1,'2026-09-01'),p('p2',2,'2026-09-02'),p('p3',3,'2026-09-03')]);
 const before=JSON.stringify(d),r=evaluate(d,'c1','2026-10-09');a.equal(r.color,'GREEN');a.equal(r.paidInstallments,3);a.equal(r.punctuality,100);a.equal(r.punctualPayments,3);a.equal(r.latePayments,0);a.equal(r.averageDelay,0);a.equal(r.maxDelay,0);a.equal(r.suggestedCreditLine,300);a.equal(r.counts.paidCredits,1);a.equal(JSON.stringify(d),before);
});
test('missing historical dates/allocations remain unknown and never become evidence of punctuality',()=>{
 const r=evaluate(state([cr([q('2026-09-01'),q('2026-09-02'),q('2026-09-03')],{status:'PAGADO'})],[{id:'old',creditId:'cr1',amount:300,date:'2026-09-01',installmentFrom:1,installmentTo:3}]),'c1','2026-10-09');
 a.equal(r.color,'YELLOW');a.equal(r.unknownCompleted,3);a.equal(r.knownCompleted,0);a.equal(r.punctuality,null);a.equal(r.averageDelay,null);a.equal(r.maxDelay,null);
});
test('red derives from current recorded overdue >=7 days or >=2 overdue quotas',()=>{
 for(const schedule of [[q('2026-10-01',100)],[q('2026-10-07',100),q('2026-10-08',50)]]){const r=evaluate(state([cr(schedule)]),'c1','2026-10-09');a.equal(r.color,'RED');a.equal(r.suggestedCreditLine,null);a.equal(r.overdueBalance,schedule.reduce((n,x)=>n+x.balance,0));}
});
test('a single current overdue under seven days is yellow; quota due today is not overdue',()=>{
 a.equal(evaluate(state([cr([q('2026-10-08',100)])]),'c1','2026-10-09').color,'YELLOW');
 const r=evaluate(state([cr([q('2026-10-09',100)])]),'c1','2026-10-09');a.equal(r.overdueInstallments,0);a.equal(r.overdueBalance,0);a.equal(r.outstandingBalance,100);
});
test('partial and multi-quota payments use only persisted applications; delays are calendar days',()=>{
 const d=state([cr([q('2026-10-01'),q('2026-10-02',40),q('2026-10-20',100)])],[p('multi',1,'2026-10-03',{amount:160,installmentApplications:[{number:1,amount:100,balanceBefore:100,balanceAfter:0,status:'PAGADA'},{number:2,amount:60,balanceBefore:100,balanceAfter:40,status:'PARCIAL'}]})]);
 const r=evaluate(d,'c1','2026-10-04');a.equal(r.knownCompleted,1);a.equal(r.averageDelay,2);a.equal(r.maxDelay,2);a.equal(r.partialPayments,1);a.equal(r.partialInstallments,1);a.equal(r.latePayments,1);a.equal(r.punctualPayments,0);a.equal(r.overdueBalance,40);
});
test('invalid applications or conflicting duplicate IDs cannot contribute punctual/late history',()=>{
 const one=p('p1',1,'2026-09-01',{totalInstallments:1}),bad={...one,amount:50};
 for(const payments of [[bad],[one,{...one,date:'2026-09-05'}]]){const r=evaluate(state([cr([q('2026-09-01')])],payments),'c1','2026-10-09');a.equal(r.knownCompleted,0);a.equal(r.unknownCompleted,1);a.equal(r.punctualPayments,0);}
 const r=evaluate(state([cr([q('2026-09-01')])],[one,{...one}]),'c1','2026-10-09');a.equal(r.knownCompleted,1);a.equal(r.paymentRecords,1);
});
test('renewed/void credits are not current debt or genuinely paid credits and never justify a larger line',()=>{
 const r=evaluate(state([cr([q('2026-09-01',100)],{status:'RENOVADO',renewedTo:'cr2'}),cr([q('2026-09-01',100)],{id:'cr2',status:'ANULADO'})]),'c1','2026-10-09');a.equal(r.counts.finished,1);a.equal(r.counts.paidCredits,0);a.equal(r.counts.active,0);a.equal(r.outstandingBalance,0);a.equal(r.overdueInstallments,0);a.equal(r.suggestedCreditLine,null);
});
test('foreign clients, missing balances, unknown credit statuses and future payment dates cannot improve evaluation',()=>{
 const d=state([cr([{date:'2026-09-01'}]),cr([q('2026-09-01')],{id:'foreign',clientId:'other',status:'PAGADO'})],[p('future',1,'2026-11-01')]);
 const r=evaluate(d,'c1','2026-10-09');a.equal(r.counts.granted,1);a.equal(r.unknownCurrent,1);a.equal(r.punctuality,null);a.equal(r.color,'YELLOW');a.equal(r.outstandingBalance,null);
});
test('recorded current line is displayed without writing or approving it; suggestion never raises an existing cap',()=>{
 const d=state([cr([q('2026-09-01'),q('2026-09-02'),q('2026-09-03')],{status:'PAGADO'})],[p('p1',1,'2026-09-01'),p('p2',2,'2026-09-02'),p('p3',3,'2026-09-03')],{id:'c1',creditLine:200});
 const before=JSON.stringify(d),r=evaluate(d,'c1','2026-10-09');a.equal(r.currentCreditLine,200);a.equal(r.suggestedCreditLine,200);a.equal(JSON.stringify(d),before);a.equal(r.recommendationOnly,true);
});
test('historical delays above 14 days or at least half of 3+ evidenced completions are late gives red',()=>{
 const r=evaluate(state([cr([q('2026-09-01'),q('2026-09-02'),q('2026-09-03')],{status:'PAGADO'})],[p('p1',1,'2026-09-02'),p('p2',2,'2026-09-03'),p('p3',3,'2026-09-03')]),'c1','2026-10-09');a.equal(r.color,'RED');a.equal(r.punctuality,Math.round(100/3));
});
test('duplicate credit IDs cannot multiply one completion into a green history',()=>{
 const loan=cr([q('2026-09-01')],{status:'PAGADO'}),r=evaluate(state([loan,{...loan},{...loan}],[p('p1',1,'2026-09-01',{totalInstallments:1})]),'c1','2026-10-09');a.equal(r.counts.granted,1);a.equal(r.knownCompleted,1);a.equal(r.color,'YELLOW');
});
test('nominal paid status with positive debt, unknown status and renewed history never justify green or a credit line',()=>{
 const good=cr([q('2026-09-01'),q('2026-09-02'),q('2026-09-03')],{status:'PAGADO'}),payments=[p('p1',1,'2026-09-01'),p('p2',2,'2026-09-02'),p('p3',3,'2026-09-03')];
 let r=evaluate(state([good,cr([q('2026-09-01',100)],{id:'bad',status:'PAGADO',capital:5000})],payments),'c1','2026-10-09');a.notEqual(r.color,'GREEN');a.notEqual(r.suggestedCreditLine,5000);a.equal(r.outstandingBalance,100);
 r=evaluate(state([{...good,status:'HISTORICO_DESCONOCIDO'}],payments),'c1','2026-10-09');a.equal(r.color,'YELLOW');a.equal(r.suggestedCreditLine,null);
 r=evaluate(state([{...good,status:'RENOVADO',renewedTo:'new'},cr([],{id:'old',status:'PAGADO',capital:2000})],payments),'c1','2026-10-09');a.equal(r.color,'YELLOW');a.equal(r.suggestedCreditLine,null);
});
test('whitespace/invalid dates are unknown, and timestamp calendar dates are deterministic in America/Lima',()=>{
 const r=evaluate(state([cr([{amount:100,balance:' ',paid:0,date:'2026-09-01'}],{status:'PAGADO'})],[p('p',1,'2026-09-01',{totalInstallments:1})]),'c1','2026-10-09');a.notEqual(r.color,'GREEN');a.equal(r.paidInstallments,0);
 a.equal(E.date('2026-09-01Tgarbage'),'');a.equal(E.date({seconds:Date.parse('2026-09-02T01:00:00Z')/1000}),'2026-09-01');
});
test('contradictory quota fields or capital above evidenced total cannot imply green or a repaid credit line',()=>{
 const payments=[p('p1',1,'2026-09-01'),p('p2',2,'2026-09-02'),p('p3',3,'2026-09-03')],schedule=[q('2026-09-01'),q('2026-09-02'),q('2026-09-03')];
 let r=evaluate(state([cr(schedule.map(x=>({...x,paid:0,status:'PENDIENTE'})),{status:'PAGADO'})],payments),'c1','2026-10-09');a.notEqual(r.color,'GREEN');a.equal(r.suggestedCreditLine,null);
 r=evaluate(state([cr(schedule,{status:'PAGADO',capital:5000})],payments),'c1','2026-10-09');a.equal(r.suggestedCreditLine,null);
});
