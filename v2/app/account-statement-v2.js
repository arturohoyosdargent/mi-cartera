// Mi Cartera PRO V2 — read-only consolidated account statement.
(function(root){
  'use strict';

  const D=root.MiCarteraV2Dates;
  const share=root.MiCarteraV2ShareCard;
  const upcomingDays=7;
  const id=value=>String(value??'').trim();
  const toCents=value=>{
    const cents=Math.round(value*100);
    return Number.isSafeInteger(cents)&&cents>=0?cents:null;
  };
  function sum(cents){
    if(cents.some(value=>value===null))return null;
    const total=cents.reduce((acc,value)=>acc+value,0);
    return Number.isSafeInteger(total)?total/100:null;
  }
  function endOfWindow(date){
    const through=new Date(date+'T12:00:00Z');
    through.setUTCDate(through.getUTCDate()+upcomingDays-1);
    return through.toISOString().slice(0,10);
  }

  function project(credit,asOf,through,filter){
    const schedule=Array.isArray(credit.schedule)?credit.schedule:[];
    // Accepted payments already update these balances. Replaying payment records would deduct them twice.
    const pending=schedule.filter(row=>!D.isPaid(row)).map(row=>({
      date:D.fromInstallment(row),cents:toCents(D.balance(row))
    }));
    const legacyTotal=credit.total;
    const balance=schedule.length?sum(pending.map(row=>row.cents))
      :legacyTotal==null||legacyTotal===''||!Number.isFinite(Number(legacyTotal))
        ?null:sum([toCents(share.creditTotals(credit).balance)]);
    const dated=pending.filter(row=>row.date).sort((a,b)=>a.date.localeCompare(b.date));
    const upcoming=dated.filter(row=>row.date>=asOf&&row.date<=through);
    const installment=(filter==='upcoming'?upcoming:dated)[0];
    const complete=schedule.length>0&&pending.length===dated.length;
    const maturity=D.normalize(credit.maturity)||schedule.map(D.fromInstallment).filter(Boolean).sort().at(-1)||'';
    return {
      id:id(credit.id),maturity,installmentDate:installment?.date||'',
      installmentAmount:installment?sum([installment.cents]):null,balance,
      arrears:complete?sum(dated.filter(row=>row.date<asOf).map(row=>row.cents)):null,
      amountDue:complete?sum(dated.filter(row=>row.date<=asOf).map(row=>row.cents)):null,
      hasUpcoming:upcoming.length>0
    };
  }

  function latestPayments(payments,keyFor){
    const latest=new Map();
    for(const payment of payments){
      if(!payment||typeof payment!=='object')continue;
      const key=keyFor(payment);
      if(!key)continue;
      const previous=latest.get(key),version=Number(payment.version)||0;
      const previousVersion=Number(previous?.version)||0;
      if(!previous||version>previousVersion||
        (version===previousVersion&&(payment.tombstone||payment.deletedAt)))latest.set(key,payment);
    }
    return latest.values();
  }
  function collectedPenalties(payments,creditIds,asOf){
    const byId=latestPayments(payments,payment=>id(payment.id)?'id:'+id(payment.id):id(payment.operationId));
    const byOperation=latestPayments(byId,payment=>id(payment.operationId)?'op:'+id(payment.operationId):'id:'+id(payment.id));
    const penalties=new Map();
    for(const payment of byOperation){
      const creditId=id(payment.creditId),date=D.normalize(payment.date);
      if(!creditIds.has(creditId)||payment.tombstone||payment.deletedAt||!date||date>asOf)continue;
      const amount=toCents(payment.amount),penalty=toCents(payment.penaltyAmount??
        (String(payment.concept||'').toUpperCase()==='MORA'?payment.amount:0));
      if(penalty===null||amount===null||penalty<=0||penalty>amount)continue;
      const previous=penalties.has(creditId)?penalties.get(creditId):0;
      const total=previous===null?null:previous+penalty;
      penalties.set(creditId,Number.isSafeInteger(total)?total:null);
    }
    return penalties;
  }
  function build({client,credits=[],payments=[],asOf=D.today(),filter='all'}={}){
    const clientId=id(client?.id);
    if(!clientId)throw new Error('Selecciona un cliente para consultar su estado de cuenta.');
    asOf=D.normalize(asOf);
    if(!asOf)throw new Error('Fecha de corte no válida.');
    filter=filter==='upcoming'?'upcoming':'all';
    const through=endOfWindow(asOf);
    const creditIds=new Set(credits.filter(credit=>id(credit?.clientId)===clientId&&
      id(credit.id)&&!credit.deletedAt&&!credit.tombstone).map(credit=>id(credit.id)));
    const penalties=collectedPenalties(payments,creditIds,asOf);
    const seen=new Set();
    const active=[];
    for(const credit of credits){
      const creditId=id(credit?.id);
      if(!creditId||seen.has(creditId)||id(credit.clientId)!==clientId||credit.deletedAt||credit.tombstone||
        credit.renewedTo||!['ACTIVO','ACTIVE'].includes(String(credit.status).toUpperCase()))continue;
      seen.add(creditId);
      const row=project(credit,asOf,through,filter);
      if(row.balance!==0)active.push({...row,moraCollected:sum([penalties.has(creditId)?penalties.get(creditId):0])});
    }
    const rows=active.filter(row=>filter==='all'||row.hasUpcoming).sort((a,b)=>
      (a.installmentDate||'9999-12-31').localeCompare(b.installmentDate||'9999-12-31')||a.id.localeCompare(b.id));
    return {
      client,asOf,filter,through,rows,upcomingDays,activeCount:active.length,
      totalDebt:sum(active.map(row=>row.balance===null?null:toCents(row.balance))),
      amountDue:sum(active.map(row=>row.amountDue===null?null:toCents(row.amountDue))),
      totalArrears:sum(active.map(row=>row.arrears===null?null:toCents(row.arrears))),
      moraCollected:sum([...penalties.values()])
    };
  }

  root.MiCarteraV2AccountStatement={build,render:statement=>share.accountStatement(statement)};
})(window);
