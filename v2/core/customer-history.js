// Read-only indicators from the available canonical schedule and payment evidence.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2CustomerHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const money=n=>Math.round((Number(n)||0)*100)/100,positive=n=>Math.max(0,Number(n)||0);
function day(value){const raw=String(value??'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return '';const d=new Date(raw+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===raw?raw:''}
function days(from,to){return Math.max(0,Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000))}
function unique(rows){const map=new Map();for(const x of rows||[])if(x&&(!map.has(String(x.id))||Number(x.version||0)>=Number(map.get(String(x.id)).version||0)))map.set(String(x.id),x);return [...map.values()].filter(x=>!x.tombstone)}
function remaining(q){return positive(q.balance??(positive(q.amount)-positive(q.paid)))}
function due(q){return day(q.date??q.dueDate??q.due_date??q.installmentDate??q.paymentDate??q.fecha??q.fechaPago??q.fecha_vencimiento??q.vencimiento??q.scheduledDate)}
function allocations(payment,schedule){
  const explicit=payment.allocations||payment.installmentAllocations||payment.scheduleAllocations;
  if(Array.isArray(explicit))return explicit.map(x=>({number:x.installmentNumber??x.installmentNo??x.number??x.n??(Number.isInteger(x.index)?schedule[x.index]?.number??x.index+1:null),amount:positive(x.amount??x.paidAmount??x.appliedAmount)})).filter(x=>x.number!=null&&x.amount>0);
  const first=payment.installmentFrom??payment.installmentNumber??payment.installmentNo,last=payment.installmentTo??first;
  // A range alone does not record how much reached each installment.
  if(first==null||String(first)!==String(last)||payment.concept&&payment.concept!=='CUOTA')return [];
  return [{number:first,amount:positive(Number(payment.amount||0)-Number(payment.penaltyAmount||0))}];
}
function summary(d,clientId,asOf){
  const date=day(asOf);if(!date)throw new Error('La fecha de consulta es inválida.');
  const credits=unique(d?.credits).filter(c=>String(c.clientId)===String(clientId)&&!['ANULADO','VOID'].includes(String(c.status||'').toUpperCase()));
  const reversed=new Set((d?.payments||[]).flatMap(p=>p.recordType==='PAYMENT_REVERSAL'?[String(p.reversesPaymentId)]:['REVERSED','REVERTIDO'].includes(String(p.status||'').toUpperCase())?[String(p.id)]:[]));
  const payments=unique(d?.payments).filter(p=>p.recordType!=='PAYMENT_REVERSAL'&&!['REVERSED','REVERTIDO'].includes(String(p.status||'').toUpperCase())&&!reversed.has(String(p.id)));
  const out={asOf:date,grantedCredits:credits.length,activeCredits:0,finishedCredits:0,totalInstallments:0,paidInstallments:0,datedPaidInstallments:0,unknownPaidInstallments:0,onTimeInstallments:0,lateInstallments:0,overdueInstallments:0,fulfilledPromises:0,overduePromises:0,pendingPromises:0,unknownPromises:0,balance:0,overdueBalance:0,averageDelayDays:null,maxDelayDays:0,punctualityRate:null,trend:null,trafficLight:null};
  const completed=[];
  for(const c of credits){
    const schedule=Array.isArray(c.schedule)?c.schedule:[],status=String(c.status||'').toUpperCase(),active=['ACTIVO','ACTIVE'].includes(status),balance=schedule.length?money(schedule.reduce((n,q)=>n+remaining(q),0)):money(positive(positive(c.total??c.capital)-positive(c.principalPaid)-(c.total==null?0:positive(c.interestPaid))));
    if(active&&balance>0){out.activeCredits++;out.balance=money(out.balance+balance)}else out.finishedCredits++;
    const promises=new Map();
    for(const p of [...(c.paymentPromiseHistory||[]),...(c.paymentPromise?[c.paymentPromise]:[])])if(p){const key=p.id||[p.createdAt||'',p.date||'',p.amount??'',p.note||'',p.paidAtCreation??''].join('|');promises.set(String(key),p)}
    for(const p of promises.values()){
      const state=String(p.status||'').toUpperCase(),when=day(p.date);
      if(['CANCELADO','REEMPLAZADO'].includes(state))continue;
      if(state==='CUMPLIDO'){if(p.fulfilledByPaymentId&&reversed.has(String(p.fulfilledByPaymentId)))out.unknownPromises++;else out.fulfilledPromises++}
      else if(['VIGENTE','INCUMPLIDO','VENCIDO'].includes(state)&&when&&balance>0){if(when<date){out.overduePromises++;out.maxDelayDays=Math.max(out.maxDelayDays,days(when,date))}else out.pendingPromises++}
      else out.unknownPromises++;
    }
    const evidence=new Map();
    for(const p of payments.filter(p=>String(p.creditId)===String(c.id)&&day(p.date)&&day(p.date)<=date).sort((a,b)=>day(a.date).localeCompare(day(b.date))))for(const x of allocations(p,schedule)){const key=String(x.number),items=evidence.get(key)||[];items.push({date:day(p.date),amount:x.amount});evidence.set(key,items)}
    schedule.forEach((q,i)=>{
      out.totalInstallments++;const paid=remaining(q)<=0.005,when=due(q),amount=positive(q.amount);
      if(paid){
        out.paidInstallments++;let applied=0,completedAt='';
        for(const p of evidence.get(String(q.number??q.n??i+1))||[]){applied=money(applied+p.amount);if(amount>0&&applied>=amount-0.005){completedAt=p.date;break}}
        if(when&&completedAt){const delay=days(when,completedAt);completed.push({date:when,delay});out.datedPaidInstallments++;if(delay)out.lateInstallments++;else out.onTimeInstallments++;out.maxDelayDays=Math.max(out.maxDelayDays,delay)}else out.unknownPaidInstallments++;
      }else if(active&&when&&when<date){const delay=days(when,date);out.overdueInstallments++;out.overdueBalance=money(out.overdueBalance+remaining(q));out.maxDelayDays=Math.max(out.maxDelayDays,delay)}
    });
  }
  if(completed.length){out.punctualityRate=money(out.onTimeInstallments/completed.length*100);const late=completed.filter(x=>x.delay>0);out.averageDelayDays=late.length?money(late.reduce((n,x)=>n+x.delay,0)/late.length):0}
  const issues=Math.max(out.lateInstallments+out.overdueInstallments,out.overduePromises),evaluated=Math.max(completed.length+out.overdueInstallments,out.fulfilledPromises+out.overduePromises);
  if(!evaluated)out.trafficLight={color:'gray',label:'Historial insuficiente',reason:'Sin cuotas con cumplimiento fechado, vencimientos ni compromisos verificables.'};
  else if(out.maxDelayDays>=30||issues>=3&&issues/evaluated>=0.3)out.trafficLight={color:'red',label:'Atrasos significativos o recurrentes',reason:out.maxDelayDays>=30?'Se observa un atraso de 30 días o más.':'Hay al menos tres cuotas o compromisos con atraso y representan el 30% o más de los evaluables.'};
  else if(issues)out.trafficLight={color:'yellow',label:'Atrasos aislados',reason:out.overduePromises?'Hay compromisos vencidos pendientes sin alcanzar el criterio de recurrencia o magnitud significativa.':'Se observan atrasos sin alcanzar el criterio de recurrencia o magnitud significativa.'};
  else out.trafficLight={color:'green',label:'Cumplimiento regular',reason:'Las cuotas o compromisos verificables muestran cumplimiento regular.'};
  if(completed.length>=6){const sorted=completed.slice().sort((a,b)=>a.date.localeCompare(b.date)),split=Math.floor(sorted.length/2),mean=rows=>rows.reduce((n,x)=>n+x.delay,0)/rows.length,change=mean(sorted.slice(split))-mean(sorted.slice(0,split)),direction=change<=-1?'improving':change>=1?'worsening':'stable';out.trend={direction,label:{improving:'Menor atraso reciente',worsening:'Mayor atraso reciente',stable:'Comportamiento estable'}[direction],sampleSize:sorted.length}}
  return out;
}
return {summary};
});
