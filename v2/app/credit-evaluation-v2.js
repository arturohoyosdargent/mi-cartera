// Read-only evidence summary. Never allocates money, approves a credit or writes data.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2CreditEvaluation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const num=v=>v===null||v===undefined||typeof v==='string'&&!v.trim()||typeof v==='boolean'?null:Number.isFinite(Number(v))?Number(v):null;
const round=n=>Math.round(n*100)/100,ids=(a,b)=>String(a??'')===String(b??'');
function date(value){
 if(typeof value?.toDate==='function')value=value.toDate();if(value&&typeof value==='object'&&value.seconds!=null)value=new Date(Number(value.seconds)*1000);
 if(value instanceof Date){if(Number.isNaN(value.getTime()))return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value),part=k=>parts.find(p=>p.type===k).value;return `${part('year')}-${part('month')}-${part('day')}`;}
 const s=String(value??'').trim();if(s.includes('T')){const timestamp=/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(s);if(!timestamp||!date(s.slice(0,10)))return '';return date(new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(s)?s:s+'-05:00'));}
 const iso=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s),local=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
 if(!iso&&!local)return '';const [y,m,d]=iso?iso.slice(1).map(Number):[Number(local[3]),Number(local[2]),Number(local[1])],dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
const due=q=>date(q?.date??q?.dueDate??q?.due_date??q?.installmentDate??q?.paymentDate??q?.fecha??q?.fechaPago??q?.fecha_vencimiento??q?.vencimiento??q?.scheduledDate);
const days=(a,b)=>Math.max(0,Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000));
function balance(q){const value=num(q?.balance),amount=num(q?.amount),paid=num(q?.paid);let remaining=value!==null?value:amount!==null&&paid!==null?amount-paid:null;if(remaining===null||remaining<0||amount!==null&&(amount<0||remaining>amount+0.005)||paid!==null&&(paid<0||amount!==null&&(paid>amount+0.005||Math.abs(amount-paid-remaining)>0.005)))return null;const status=String(q?.status||'').toUpperCase();if(['PAGADA','PAGADO','PAID'].includes(status)&&remaining>0.005||['PENDIENTE','PENDING','PARCIAL'].includes(status)&&remaining<=0.005)return null;return remaining;}
function applications(p,cr){
 const rows=p?.installmentApplications,qs=cr?.schedule||[],total=num(p?.totalInstallments??qs.length),amount=num(p?.amount);
 if(!Array.isArray(rows)||!rows.length||total!==qs.length||!Number.isInteger(total)||amount===null||amount<=0)return [];
 let previous=0,sum=0;for(const q of rows){const n=num(q?.number),a=num(q?.amount),before=num(q?.balanceBefore),after=num(q?.balanceAfter),quotaAmount=num(qs[n-1]?.amount);
  if(!Number.isInteger(n)||n<=previous||n>total||a===null||a<=0||before===null||before<=0||after===null||after<0||Math.abs(before-after-a)>0.005||q.status!==(after<=0.005?'PAGADA':'PARCIAL')||quotaAmount!==null&&before>quotaAmount+0.005)return [];
  sum+=a;previous=n;
 }return Math.abs(sum-amount)<=0.005?rows:[];
}
function evaluate(data,clientId,asOf){
 const now=date(asOf);if(!now)throw Error('EVALUATION_DATE_REQUIRED');const client=(data.clients||[]).find(c=>ids(c.id,clientId));if(!client)throw Error('EVALUATION_CLIENT_NOT_FOUND');
 const uniqueCredits=new Map(),creditConflicts=new Set();for(const c of data.credits||[]){if(!ids(c.clientId,clientId)||c.tombstone||['VOID','ANULADO'].includes(String(c.status||'').toUpperCase()))continue;const key=String(c.id??'');if(!key){creditConflicts.add(key);continue;}if(uniqueCredits.has(key)&&JSON.stringify(uniqueCredits.get(key))!==JSON.stringify(c))creditConflicts.add(key);else uniqueCredits.set(key,c);}const credits=[...uniqueCredits.values()];
 const result={clientId:client.id,color:'YELLOW',label:'EN OBSERVACIÓN',counts:{granted:credits.length,finished:0,active:0,paidCredits:0,renewed:0},paidInstallments:0,partialInstallments:0,paymentRecords:0,punctualPayments:0,latePayments:0,unknownPaymentDates:0,partialPayments:0,knownCompleted:0,unknownCompleted:0,unknownCurrent:0,overdueInstallments:0,overdueBalance:0,outstandingBalance:0,currentMaxDelay:0,averageDelay:null,maxDelay:null,punctuality:null,currentCreditLine:null,suggestedCreditLine:null,recommendationOnly:true,asOf:now,reasons:[]};
 const seen=new Map(),conflicts=new Set();for(const p of data.payments||[]){if(!credits.some(c=>ids(c.id,p.creditId))||p.tombstone)continue;if(!p.id)continue;const key=String(p.id);if(seen.has(key)&&JSON.stringify(seen.get(key))!==JSON.stringify(p))conflicts.add(key);else seen.set(key,p);}
 const payments=[...seen].filter(([id])=>!conflicts.has(id)).map(([,p])=>p),completedDelays=[],paidCapitals=[];let qualifyingCompleted=0;result.paymentRecords=payments.length;result.unknownCurrent+=creditConflicts.size;
 for(const cr of credits){
  const qs=Array.isArray(cr.schedule)?cr.schedule:[],status=String(cr.status||'').toUpperCase(),renewed=['RENOVADO','RENEWED'].includes(status)||Boolean(cr.renewedTo),knownBalances=qs.map(balance),knownStatus=['PAGADO','PAID','ACTIVE','ACTIVO'].includes(status),conflicting=creditConflicts.has(String(cr.id)),settled=!renewed&&knownStatus&&!conflicting&&qs.length>0&&knownBalances.every(b=>b===0),active=!renewed&&!settled&&['ACTIVE','ACTIVO'].includes(status),currentDebt=!renewed&&!settled;
  if(renewed)result.counts.renewed++;if(renewed||settled)result.counts.finished++;if(settled)result.counts.paidCredits++;if(active)result.counts.active++;
  if(!active&&!renewed&&!settled)result.unknownCurrent++;
  if(currentDebt&&!qs.length){result.unknownCurrent++;result.outstandingBalance=null;}
  let eligibleCompletions=0;
  const evidence=new Map();for(const p of payments.filter(p=>ids(p.creditId,cr.id))){
   const rows=conflicting?[]:applications(p,cr),when=date(p.date);if(!rows.length||!when||when>now){result.unknownPaymentDates++;continue;}
   if(rows.some(row=>row.status==='PARCIAL'))result.partialPayments++;
   const dates=rows.map(row=>due(qs[row.number-1]));if(dates.every(Boolean)){const delay=Math.max(...dates.map(d=>days(when,d)));if(delay>0)result.latePayments++;else result.punctualPayments++;}else result.unknownPaymentDates++;
   for(const row of rows){const number=Number(row.number);if(!evidence.has(number))evidence.set(number,[]);evidence.get(number).push({row,when});}
  }
  qs.forEach((q,i)=>{
   const remaining=knownBalances[i],amount=num(q.amount),scheduled=due(q);if(remaining===0){
    result.paidInstallments++;const completions=(evidence.get(i+1)||[]).filter(e=>Number(e.row.balanceAfter)<=0.005);
    if(completions.length===1&&scheduled){result.knownCompleted++;completedDelays.push(days(completions[0].when,scheduled));if(!renewed&&knownStatus&&!conflicting)eligibleCompletions++;}else result.unknownCompleted++;
   }else if(remaining!==null&&amount!==null&&remaining<amount)result.partialInstallments++;
   if(!currentDebt)return;
   if(remaining===null){result.unknownCurrent++;result.outstandingBalance=null;return;}
   if(result.outstandingBalance!==null)result.outstandingBalance=round(result.outstandingBalance+remaining);
   if(remaining>0&&!scheduled)result.unknownCurrent++;
   if(remaining>0&&scheduled&&scheduled<now){result.overdueInstallments++;result.overdueBalance=round(result.overdueBalance+remaining);result.currentMaxDelay=Math.max(result.currentMaxDelay,days(now,scheduled));}
  });
  qualifyingCompleted+=eligibleCompletions;if(settled&&eligibleCompletions===qs.length){const capital=num(cr.capital),total=num(cr.total),amounts=qs.map(q=>num(q.amount)),observed=amounts.every(a=>a!==null&&a>0)?round(amounts.reduce((a,b)=>a+b,0)):null;if(capital!==null&&capital>0&&observed!==null&&capital<=observed+0.005&&(total===null||Math.abs(total-observed)<=0.005))paidCapitals.push(capital);else result.unknownCurrent++;}
 }
 if(completedDelays.length){result.averageDelay=round(completedDelays.reduce((a,b)=>a+b,0)/completedDelays.length);result.maxDelay=Math.max(...completedDelays);result.punctuality=Math.round(completedDelays.filter(n=>n===0).length/completedDelays.length*100);}
 const lateCompleted=completedDelays.filter(n=>n>0).length;
 const red=result.currentMaxDelay>=7||result.overdueInstallments>=2||(result.maxDelay??0)>14||completedDelays.length>=3&&lateCompleted/completedDelays.length>=0.5;
 const green=!red&&result.overdueInstallments===0&&result.unknownCurrent===0&&result.unknownCompleted===0&&result.unknownPaymentDates===0&&conflicts.size===0&&qualifyingCompleted>=3&&paidCapitals.length>=1&&lateCompleted===0;
 if(red){result.color='RED';result.label='REVISIÓN PRIORITARIA';result.reasons.push('Mora o retrasos comprobados requieren revisión administrativa.');}
 else if(green){result.color='GREEN';result.label='AL DÍA';result.reasons.push('Historial suficiente y puntualidad comprobada.');}
 else{result.reasons.push('Historial insuficiente, incompleto o con atrasos: requiere observación.');}
 if(result.unknownCompleted||result.unknownCurrent||result.unknownPaymentDates||conflicts.size)result.reasons.push('Los datos no determinados no se consideran pagos puntuales.');
 const current=num(client.creditLine??client.currentCreditLine??client.lineaCredito);if(current!==null&&current>=0)result.currentCreditLine=current;
 // A suggestion reuses observed repaid capital; it never invents an increase.
 if(!red&&paidCapitals.length){const observed=Math.max(...paidCapitals);result.suggestedCreditLine=result.currentCreditLine===null?observed:Math.min(observed,result.currentCreditLine);}
 return result;
}
return {evaluate,date,balance};
});
