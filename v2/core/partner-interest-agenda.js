(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./partner-loans.js'):root.MiCarteraPartnerLoans);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraPartnerAgenda=api})(globalThis,function(C){
'use strict';
function addDays(day,count){C.date(day);const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)}
function monthEnd(month){if(!/^\d{4}-\d{2}$/.test(month))throw Error('Mes inválido');C.date(month+'-01');const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0,12)).toISOString().slice(0,10)}
const sum=rows=>C.money(rows.reduce((n,r)=>n+r.amount,0));
function build(loans,asOf,month=asOf.slice(0,7)){
  C.date(asOf);const end=monthEnd(month),soon=addDays(asOf,7),monthRows=[],overdue=[],today=[],upcoming=[],nextRows=[];
  for(const loan of loans){
    const horizon=[end,C.anniversary(asOf,1),loan.firstDue].sort().at(-1);
    const rows=C.schedule(loan,horizon,asOf).map(r=>({...r,id:loan.id+':'+r.date,loanId:loan.id,partner:loan.partner,disbursedAt:loan.date,principal:loan.principal,status:r.paid?'PAGADO':r.date<asOf?'VENCIDO':r.date===asOf?'HOY':'PROGRAMADO'}));
    monthRows.push(...rows.filter(r=>r.date.startsWith(month)));
    overdue.push(...rows.filter(r=>r.status==='VENCIDO'));
    today.push(...rows.filter(r=>r.status==='HOY'));
    upcoming.push(...rows.filter(r=>!r.paid&&r.date>asOf&&r.date<=soon));
    const next=rows.find(r=>!r.paid&&r.date>asOf);if(next)nextRows.push(next);
  }
  const text=x=>String(x??'');
  const sort=rows=>rows.sort((a,b)=>text(a.date).localeCompare(text(b.date))||text(a.partner).localeCompare(text(b.partner))||text(a.loanId).localeCompare(text(b.loanId)));
  [monthRows,overdue,today,upcoming,nextRows].forEach(sort);
  return {month,asOf,monthRows,overdue,today,upcoming,next:nextRows[0]||null,overdueTotal:sum(overdue),todayTotal:sum(today),upcomingTotal:sum(upcoming),monthPending:sum(monthRows.filter(r=>!r.paid))};
}
return {build,addDays,monthEnd};
});
