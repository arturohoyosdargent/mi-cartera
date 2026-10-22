// Mi Cartera PRO V2 — explicit capital/income and expense actions.
(function(root){
  'use strict';

  const KEY = 'mi-cartera-v2-validation-state';
  const $ = id => document.getElementById(id);
  const money = value => `S/ ${Number(value || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const localDate = date => { const d=date||new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

  function data(){
    try { const stored = JSON.parse(localStorage.getItem(KEY) || '{}'); return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}; }
    catch { return {}; }
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today = () => root.MiCarteraV2Dates?.today?.() || localDate();
  const cents = value => {
    if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
    const amount = Number(value), rounded = Math.round(amount * 100);
    return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(rounded) && Math.abs(amount * 100 - rounded) < 0.00001 ? rounded : null;
  };
  const dateOf = value => root.MiCarteraV2Dates?.normalize?.(value) || '';
  const removed = row => Boolean(row?.tombstone || row?.deletedAt);
  const cashCategory = row => String(row.category || row.concept || '').trim().toUpperCase();
  const collectionRow = row => row.type === 'INGRESO' && /^(COBRO_|PAGO_CUOTA)/.test(cashCategory(row));

  function analyze(snapshot, options = {}) {
    const warnings = [];
    let cashValid = true, portfolioValid = true, partnerValid = true;
    const asOf = dateOf(options.asOf || today());
    const month = options.month || asOf.slice(0, 7);
    if (!asOf || !/^\d{4}-\d{2}$/.test(month) || !dateOf(month + '-01')) throw Error('Fecha o mes inválido');
    const warn = (message, kind) => {
      warnings.push(message);
      if (kind === 'cash') cashValid = false;
      if (kind === 'portfolio') portfolioValid = false;
      if (kind === 'partner') partnerValid = false;
    };
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) { snapshot = {}; warn('Cartera inválida', 'cash'); }
    for (const [name, kind] of [['cashMovements','cash'],['payments','payment'],['credits','portfolio']]) {
      if (snapshot[name] !== undefined && !Array.isArray(snapshot[name])) warn('Colección inválida: ' + name, kind);
    }
    function unique(rows, keyFor, signature, kind) {
      const groups = new Map();
      for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
        if (!row || typeof row !== 'object') { warn('Registro inválido en ' + kind, kind); continue; }
        const key = keyFor(row);
        if (!key) warn('Registro sin identificador en ' + kind, kind);
        const groupKey = key || 'anonymous-' + index;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(row);
      }
      return [...groups.values()].flatMap(group => {
        const version = Math.max(...group.map(row => Number(row.version) || 0));
        const latest = group.filter(row => (Number(row.version) || 0) === version);
        if (new Set(latest.map(signature)).size > 1) { warn('Duplicados contradictorios en ' + kind, kind); return []; }
        return removed(latest[0]) ? [] : [latest[0]];
      });
    }
    const paymentSignature = row => JSON.stringify([dateOf(row.date), cents(row.amount), row.creditId,
      row.capitalAmount, row.interestAmount, row.penaltyAmount, row.concept, removed(row)]);
    const originalPayments = unique(snapshot.payments, row => row.id, paymentSignature, 'payment');
    const payments = unique(originalPayments, row => row.operationId || row.id, paymentSignature, 'payment');
    const paymentById = new Map();
    for (const row of originalPayments) {
      const canonical = payments.find(payment => payment.id === row.id || payment.operationId && payment.operationId === row.operationId);
      if (canonical) paymentById.set(String(row.id), canonical);
    }
    const cashSignature = row => JSON.stringify([dateOf(row.date), cents(row.amount), row.type, row.ref,
      row.category, row.concept, row.partnerLoan, row.cashAccountId, removed(row)]);
    const centralRows = (Array.isArray(snapshot.cashMovements) ? snapshot.cashMovements : []).filter(row => !row?.cashAccountId || row.cashAccountId === 'leader');
    const identifiedCash = unique(centralRows, row => row.id, cashSignature, 'cash');
    const receiptKey = row => row.type === 'INGRESO' && row.ref && (collectionRow(row) || paymentById.has(String(row.ref)))
      ? 'payment:' + (paymentById.get(String(row.ref))?.operationId || paymentById.get(String(row.ref))?.id || row.ref) : 'cash:' + row.id;
    const cashRows = unique(identifiedCash, receiptKey, row => JSON.stringify([dateOf(row.date), cents(row.amount), row.type, removed(row)]), 'cash');
    const ledger = cashRows.flatMap(row => {
      const amount = cents(row.amount), date = dateOf(row.date);
      if (amount === null || !date || !['INGRESO', 'EGRESO'].includes(row.type)) { warn('Movimiento con fecha, tipo o importe inválido: ' + (row.id || 'sin ID'), 'cash'); return []; }
      return [{...row, amount: amount / 100, cents: amount, normalizedDate: date}];
    });
    const actual = ledger.filter(row => row.normalizedDate <= asOf);
    const future = ledger.filter(row => row.normalizedDate > asOf);
    const signedCents = row => row.type === 'INGRESO' ? row.cents : -row.cents;
    const sum = (rows, predicate = () => true) => rows.filter(predicate).reduce((total, row) => total + row.cents, 0);
    const physical = actual.reduce((total, row) => total + signedCents(row), 0);
    const futureExpenses = sum(future, row => row.type === 'EGRESO');
    const from = options.from || '', to = options.to || '';
    const rangeValid = (!from || dateOf(from) === from) && (!to || dateOf(to) === to) && (!from || !to || from <= to);
    const selected = actual.filter(row => rangeValid && (!from || row.normalizedDate >= from) && (!to || row.normalizedDate <= to));
    const opening = actual.filter(row => from && row.normalizedDate < from).reduce((total, row) => total + signedCents(row), 0);
    const income = sum(selected, row => row.type === 'INGRESO'), expense = sum(selected, row => row.type === 'EGRESO');
    const monthly = actual.filter(row => row.normalizedDate.slice(0, 7) === month);
    const operating = new Set(['GASTO_OPERATIVO', 'SERVICIOS', 'SERVICIO_MOVIL', 'TRANSPORTE', 'ALQUILER', 'SUELDOS', 'COMISIONES']);
    const reconciled = new Set();
    function aggregate(rows) {
      const totals = {disbursed:0, principalRecovered:0, interestCollected:0, penaltiesCollected:0, operatingExpenses:0,
        partnerInterestPaid:0, partnerPrincipalReturned:0, otherOperatingIncome:0, unclassifiedCollections:0, unclassifiedIncome:0, unclassifiedExpense:0,
        collections:0, capitalContributions:0, partnerFunding:0};
      for (const row of rows) {
      const category = cashCategory(row);
      const payment = row.type === 'INGRESO' && row.ref ? paymentById.get(String(row.ref)) : null;
      if (payment || collectionRow(row)) {
        totals.collections += row.cents;
        let capital = cents(payment?.capitalAmount ?? (payment?.concept === 'CAPITAL' ? payment.amount : 0));
        let interest = cents(payment?.interestAmount ?? (payment?.concept === 'INTERES' ? payment.amount : 0));
        let penalty = cents(payment?.penaltyAmount ?? (payment?.concept === 'MORA' ? payment.amount : 0));
        if (!payment || dateOf(payment.date) !== row.normalizedDate || cents(payment.amount) !== row.cents ||
          [capital, interest, penalty].includes(null) || capital + interest + penalty > row.cents) {
          capital = 0; interest = 0; penalty = 0; warn('Cobro sin conciliación o distribución válida: ' + row.id);
        }
        if (payment) reconciled.add(payment.id);
        totals.principalRecovered += capital; totals.interestCollected += interest; totals.penaltiesCollected += penalty;
        totals.unclassifiedCollections += row.cents - capital - interest - penalty;
        if (row.cents !== capital + interest + penalty) warn('Cobro pendiente de clasificar: ' + row.id);
      } else if (row.type === 'INGRESO') {
        if (category === 'APORTE_CAPITAL') totals.capitalContributions += row.cents;
        else if (row.partnerLoan || category === 'PRESTAMO_SOCIO') totals.partnerFunding += row.cents;
        else if (['OTRO_INGRESO', 'INGRESO_OPERATIVO'].includes(category)) totals.otherOperatingIncome += row.cents;
        else if (!row.partnerLoan && !['APORTE_CAPITAL', 'PRESTAMO_SOCIO', 'TRANSFERENCIA_INTERNA', 'TRANSFERENCIA'].includes(category)) {
          totals.unclassifiedIncome += row.cents; warn('Ingreso pendiente de clasificar: ' + row.id);
        }
      } else if (category === 'INTERES_SOCIO') totals.partnerInterestPaid += row.cents;
      else if (category === 'DEVOLUCION_CAPITAL_SOCIO') totals.partnerPrincipalReturned += row.cents;
      else if (['DESEMBOLSO_CREDITO', 'DESEMBOLSO_REFINANCIAMIENTO'].includes(category)) totals.disbursed += row.cents;
      else if (operating.has(category)) totals.operatingExpenses += row.cents;
      else if (!['RETIRO_CAPITAL', 'RETIRO_PERSONAL', 'TRANSFERENCIA', 'TRANSFERENCIA_INTERNA'].includes(category)) {
        totals.unclassifiedExpense += row.cents; warn('Egreso pendiente de clasificar: ' + row.id);
      }
    }
      return totals;
    }
    const todayRows = actual.filter(row => row.normalizedDate === asOf);
    const totals = aggregate(monthly), periodTotals = aggregate(selected), todayTotals = aggregate(todayRows);
    for (const payment of payments) {
      const date = dateOf(payment.date);
      if (date && date <= asOf && date.slice(0, 7) === month && !reconciled.has(payment.id)) warn('Pago sin movimiento de caja conciliado: ' + payment.id);
    }
    let portfolio = 0, activeCredits = 0, contractedCapital = 0;
    const activeRecords = [];
    const credits = unique(snapshot.credits, row => row.id, row => JSON.stringify([row.capital, row.principalPaid, row.status, row.date, removed(row)]), 'portfolio');
    for (const credit of credits) {
      if (dateOf(credit.date) > asOf) continue;
      const futurePrincipal = payments.filter(payment => payment.creditId === credit.id && dateOf(payment.date) > asOf)
        .reduce((total, payment) => total + (cents(payment.capitalAmount ?? (payment.concept === 'CAPITAL' ? payment.amount : 0)) || 0), 0);
      const status = String(credit.status || '').toUpperCase();
      if (!['ACTIVO', 'ACTIVE'].includes(status) && !(futurePrincipal && ['PAGADO', 'PAID'].includes(status)) &&
        !(status === 'RENOVADO' && dateOf(credit.renewedAt) > asOf)) continue;
      const capital = cents(credit.capital), paid = cents(credit.principalPaid === undefined ? 0 : credit.principalPaid);
      if (!dateOf(credit.date) || capital === null || paid === null || paid > capital || futurePrincipal > paid) { warn('Capital de crédito inválido: ' + credit.id, 'portfolio'); continue; }
      portfolio += capital - paid + futurePrincipal; contractedCapital += capital; activeCredits++;
      activeRecords.push({credit, futurePrincipal});
    }
    let partnerPrincipal = 0, interestDue = 0, nextMonthlyCost = 0, reservedDueInterest = 0;
    const partnerRows = unique(cashRows.filter(row => row.partnerLoan), row => row.partnerLoan.id,
      row => JSON.stringify(row.partnerLoan), 'partner');
    for (const row of partnerRows) {
      const original = row.partnerLoan;
      if (dateOf(original.date) > asOf) continue;
      try {
        const domain = root.MiCarteraPartnerLoans;
        if (!domain || !dateOf(original.date) || !dateOf(original.firstDue) || !(cents(original.principal) > 0) ||
          ![original.repayments, original.interestPayments, original.terms].every(Array.isArray)) throw Error('Invalid partner loan');
        const signature = payment => JSON.stringify([dateOf(payment.date), dateOf(payment.due), cents(payment.amount)]);
        const repayments = unique(original.repayments, payment => payment.id, signature, 'partner');
        const interestPayments = unique(original.interestPayments, payment => payment.due, signature, 'partner');
        const terms = unique(original.terms, term => term.from, term => JSON.stringify([term.from, cents(term.amount)]), 'partner');
        if (!terms.length || [...repayments, ...interestPayments].some(payment => !dateOf(payment.date) || cents(payment.amount) === null) ||
          terms.some(term => !dateOf(term.from) || cents(term.amount) === null)) throw Error('Invalid partner history');
        const loan = {...original, repayments:repayments.map(payment=>({...payment, amount:cents(payment.amount)/100})),
          interestPayments, terms:terms.slice().sort((first,second)=>first.from.localeCompare(second.from))};
        const balance = cents(domain.balance(loan, asOf));
        if (balance === null) throw Error('Invalid partner balance');
        partnerPrincipal += balance;
        for (const due of domain.due(loan, asOf)) {
          const amount = cents(due.amount);
          if (amount === null) throw Error('Invalid partner interest');
          interestDue += amount;
          reservedDueInterest += Math.min(amount, sum(future, movement => movement.type === 'EGRESO' &&
            cashCategory(movement) === 'INTERES_SOCIO' && movement.partnerLoanId === loan.id && dateOf(movement.interestDue) === due.date));
        }
        if (balance > 0) {
          const next = domain.schedule(loan, domain.anniversary(asOf, 1), asOf).find(due => due.date > asOf);
          const nextAmount = cents(next?.amount || 0);
          if (nextAmount === null) throw Error('Invalid partner forecast');
          nextMonthlyCost += nextAmount;
        }
      } catch { warn('Obligación de socio pendiente de revisión: ' + (original.id || row.id), 'partner'); }
    }
    if (![physical, futureExpenses, opening, income, expense, ...Object.values(totals), ...Object.values(periodTotals), ...Object.values(todayTotals)].every(Number.isSafeInteger)) warn('Los movimientos exceden la precisión monetaria segura', 'cash');
    if (![portfolio, contractedCapital].every(Number.isSafeInteger)) warn('El capital excede la precisión monetaria segura', 'portfolio');
    if (![partnerPrincipal, interestDue, nextMonthlyCost, reservedDueInterest].every(Number.isSafeInteger)) warn('Las obligaciones exceden la precisión monetaria segura', 'partner');
    const monthResult = Object.fromEntries(Object.entries(totals).map(([name, value]) => [name, value / 100]));
    monthResult.netProfit = (totals.interestCollected + totals.penaltiesCollected + totals.otherOperatingIncome - totals.operatingExpenses - totals.partnerInterestPaid) / 100;
    monthResult.complete = warnings.length === 0;
    const valid = cashValid && partnerValid;
    const movements = movementAudit(snapshot, ledger, paymentById, credits, asOf, cashValid);
    const evolution = liquidityEvolution(movements.filter(row => row.normalizedDate <= asOf && rangeValid && (!from || row.normalizedDate >= from) && (!to || row.normalizedDate <= to)));
    const amounts = values => Object.fromEntries(Object.entries(values).map(([name,value])=>[name,value/100]));
    return {asOf, month:{...monthResult, label:month}, ledger, future, movements, evolution,
      receivables:pendingAccounts(activeRecords, asOf, portfolioValid), warnings:[...new Set(warnings)],
      today:{income:sum(todayRows,row=>row.type==='INGRESO')/100,expense:sum(todayRows,row=>row.type==='EGRESO')/100,activity:amounts(todayTotals)},
      cash:{physical:physical / 100, futureExpenses:futureExpenses / 100, valid,
        available:valid ? (physical - futureExpenses - interestDue + reservedDueInterest) / 100 : null},
      period:{valid:rangeValid, from, to, opening:opening / 100, income:income / 100, expense:expense / 100, closing:(opening + income - expense) / 100, rows:selected,activity:amounts(periodTotals)},
      portfolio:{principal:portfolio / 100, activeCredits, averageCredit:activeCredits ? contractedCapital / activeCredits / 100 : null, valid:portfolioValid},
      partners:{principal:partnerPrincipal / 100, interestDue:interestDue / 100, nextMonthlyCost:nextMonthlyCost / 100, valid:partnerValid},
      netCapital:valid && portfolioValid ? (physical + portfolio - partnerPrincipal - interestDue) / 100 : null};
  }

  function pendingAccounts(records, asOf, portfolioValid){
    const rows = [], warnings = [];
    let total = 0, overdue = 0, dueToday = 0;
    for(const {credit, futurePrincipal} of records){
      if(futurePrincipal || !Array.isArray(credit.schedule) || !credit.schedule.length){warnings.push('Calendario pendiente de revisar: '+credit.id);continue;}
      const seen = new Map();
      for(const [index, installment] of credit.schedule.entries()){
        const date = root.MiCarteraV2Dates?.fromInstallment?.(installment);
        const balance = installment?.balance === undefined ? cents(Number(installment?.amount)-Number(installment?.paid||0)) : cents(installment.balance);
        if(!date || balance === null){warnings.push('Cuota pendiente de revisar: '+credit.id);continue;}
        if(['PAGADA','PAGADO','PAID'].includes(String(installment.status||'').toUpperCase()) || balance === 0)continue;
        const key = String(installment.id ?? installment.n ?? index), signature = JSON.stringify([date,balance]);
        if(seen.has(key)){if(seen.get(key)!==signature)warnings.push('Cuota duplicada contradictoria: '+credit.id);continue;}
        seen.set(key,signature);
        total+=balance;if(date<asOf)overdue+=balance;else if(date===asOf)dueToday+=balance;
        rows.push({creditId:credit.id,clientId:credit.clientId,date,amount:balance/100});
      }
    }
    const valid = portfolioValid && !warnings.length && [total,overdue,dueToday].every(Number.isSafeInteger);
    return {valid,total:valid?total/100:null,overdue:valid?overdue/100:null,dueToday:valid?dueToday/100:null,
      rows:rows.sort((first,second)=>first.date.localeCompare(second.date)||String(first.creditId).localeCompare(String(second.creditId))),warnings};
  }

  function movementAudit(snapshot, ledger, paymentById, credits, asOf, valid){
    const clientRows = Array.isArray(snapshot.clients)?snapshot.clients:[], audits=Array.isArray(snapshot.audit)?snapshot.audit:[];
    const creditById = new Map(credits.map(credit=>[String(credit.id),credit]));
    const movements = ledger.map(row=>{
      const payment = row.ref?paymentById.get(String(row.ref)):null;
      const creditId = payment?.creditId || row.creditId || (/^DESEMBOLSO_/.test(cashCategory(row))?row.ref:'') || '';
      const credit = creditById.get(String(creditId));
      const clientId = credit?.clientId || payment?.clientId || row.clientId || '';
      const client = clientRows.filter(item=>item&&String(item.id)===String(clientId)).sort((first,second)=>(Number(second.version)||0)-(Number(first.version)||0))[0];
      const operationId = payment?.operationId || row.operationId || '';
      const audit = audits.find(item=>item&&!removed(item)&&(item.entityId===row.id || payment&&item.entityId===payment.id || operationId&&item.operationId===operationId));
      return {...row,creditId,clientId,clientName:client&&!removed(client)?String(client.name||clientId):String(clientId),paymentId:payment?.id||'',
        operationId:operationId||audit?.operationId||'',actorId:audit?.actorId||payment?.userId||row.userId||'',auditId:audit?.id||'',
        auditAt:String(audit?.at||row.createdAt||row.at||'')};
    }).sort((first,second)=>first.normalizedDate.localeCompare(second.normalizedDate)||first.auditAt.localeCompare(second.auditAt)||String(first.id).localeCompare(String(second.id)));
    let balance = 0;
    return movements.map(row=>{
      const scheduled = row.normalizedDate > asOf;
      if(!scheduled)balance+=row.type==='INGRESO'?row.cents:-row.cents;
      return {...row,scheduled,balanceAfter:!scheduled&&valid&&Number.isSafeInteger(balance)?balance/100:null};
    });
  }

  function liquidityEvolution(movements){
    const days = new Map();
    for(const row of movements){
      if(!days.has(row.normalizedDate))days.set(row.normalizedDate,{date:row.normalizedDate,
        opening:row.balanceAfter===null?null:Math.round((row.balanceAfter-(row.type==='INGRESO'?row.amount:-row.amount))*100)/100,income:0,expense:0,closing:null});
      const day=days.get(row.normalizedDate);
      if(row.type==='INGRESO')day.income+=row.cents;else day.expense+=row.cents;
      day.closing=row.balanceAfter;
    }
    return [...days.values()].map(day=>({...day,income:day.income/100,expense:day.expense/100}));
  }

  function simulate(input, balance) {
    const fail = reason => ({valid:false, reason});
    const amounts = ['operatingCosts', 'partnerCosts', 'averageCredit', 'variableCost', 'targetProfit'];
    const values = Object.fromEntries(amounts.map(name => [name, cents(input[name])]));
    const rates = ['monthlyRate', 'collectionPercent', 'lossPercent'];
    if (Object.values(values).includes(null) || rates.some(name => input[name] === null || input[name] === undefined || typeof input[name] === 'boolean' || String(input[name]).trim() === '' || !Number.isFinite(Number(input[name])))) return fail('Completa importes y porcentajes válidos. La tasa debe ser mensual, no por plazo del crédito.');
    const rate = Number(input.monthlyRate), collection = Number(input.collectionPercent), loss = Number(input.lossPercent);
    if (values.averageCredit <= 0 || rate <= 0 || collection < 0 || collection > 100 || loss < 0 || loss > 100) return fail('Revisa capital promedio, rendimiento mensual y porcentajes de cobranza/pérdida.');
    const gross = Math.round(values.averageCredit * rate / 100 * collection / 100);
    const contribution = gross - values.variableCost - Math.round(values.averageCredit * loss / 100);
    if (contribution <= 0 || !Number.isSafeInteger(gross)) return fail('No hay punto de equilibrio: el margen por crédito es cero o negativo.');
    const fixed = values.operatingCosts + values.partnerCosts;
    const breakEvenCredits = Math.ceil(fixed / contribution), targetCredits = Math.ceil((fixed + values.targetProfit) / contribution);
    const targetCapital = targetCredits * values.averageCredit, targetIncome = targetCredits * gross;
    const profit = targetCredits * contribution - fixed;
    if (![targetCapital, targetIncome, profit, breakEvenCredits * values.averageCredit].every(Number.isSafeInteger)) return fail('El escenario excede el límite de cálculo seguro.');
    const funding = balance?.cash?.valid && balance?.portfolio?.valid ? Math.max(0, targetCapital / 100 - balance.portfolio.principal - balance.cash.available) : null;
    return {valid:true, contributionPerCredit:contribution / 100, breakEvenCredits,
      breakEvenCapital:breakEvenCredits * values.averageCredit / 100, breakEvenIncome:Math.ceil(fixed * (gross / contribution) - 0.00000001) / 100,
      targetCredits, targetCapital:targetCapital / 100, targetIncome:targetIncome / 100, expectedProfit:profit / 100,
      additionalFunding:funding === null ? null : Math.round(funding * 100) / 100};
  }
  function ledger(){
    return analyze(data()).ledger;
  }
  function range(){
    const period = $('cashHistoryPeriod')?.value || 'ALL', date = today();
    if (period === 'TODAY') return {from:date, to:date};
    if (period === 'WEEK') {
      const start=new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,Number(date.slice(8,10)),12);
      start.setDate(start.getDate()-(start.getDay()+6)%7);
      const end=new Date(start);end.setDate(end.getDate()+6);
      return {from:localDate(start),to:localDate(end)};
    }
    if (period === 'MONTH') return {from:date.slice(0,7)+'-01', to:localDate(new Date(Number(date.slice(0,4)), Number(date.slice(5,7)), 0, 12))};
    if (period !== 'RANGE') return {from:'', to:''};
    const from = $('cashHistoryFrom')?.value || '', to = $('cashHistoryTo')?.value || '';
    const normalize = root.MiCarteraV2Dates?.normalize;
    return {from,to,invalid:(!from || !to || (normalize && (normalize(from)!==from || normalize(to)!==to)) || from>to)};
  }
  const movementDate = item => root.MiCarteraV2Dates?.normalize?.(item.date) || String(item.date || '').slice(0,10);
  const signed = item => Number(item.amount || 0) * (item.type === 'INGRESO' ? 1 : -1);
  function calculateLiquidity(rows,asOf=today()){
    const seen=new Set();let physicalCash=0,reserved=0,valid=true;
    for(const item of rows||[]){
      if(!item||item.tombstone||item.deletedAt||item.cashAccountId&&item.cashAccountId!=='leader')continue;
      if(item.id&&seen.has(item.id))continue;if(item.id)seen.add(item.id);
      if(!['INGRESO','EGRESO'].includes(item.type)||typeof item.amount!=='number'||!Number.isFinite(item.amount)||item.amount<0){valid=false;continue;}
      const date=movementDate(item)||asOf;
      if(item.type==='INGRESO'){if(date<=asOf)physicalCash+=item.amount;}
      else if(date<=asOf)physicalCash-=item.amount;else reserved+=item.amount;
    }
    const round=n=>Math.round(n*100)/100;
    return {physicalCash:round(physicalCash),reserved:round(reserved),available:valid?round(physicalCash-reserved):null,valid};
  }
  const inRange = (item, r) => !r.invalid && (!r.from || movementDate(item)>=r.from) && (!r.to || movementDate(item)<=r.to);
  function historyControls(){
    if ($('cashHistoryPeriod')) return;
    const filters = document.createElement('div');
    filters.className = 'card v2-cash-filters';
    filters.innerHTML = '<label>Periodo<select id="cashHistoryPeriod" class="input"><option value="TODAY">Hoy</option><option value="WEEK">Esta semana (lunes a domingo)</option><option value="MONTH">Este mes</option><option value="RANGE">Rango de fechas</option><option value="ALL">Todo</option></select></label><label>Desde<input id="cashHistoryFrom" class="input" type="date"></label><label>Hasta<input id="cashHistoryTo" class="input" type="date"></label><label>Movimiento<select id="cashHistoryType" class="input"><option value="ALL">Ingresos y egresos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select></label><div class="metric">El periodo aplica al resumen, evolución y detalle. El tipo sólo filtra el detalle; los saldos siempre incluyen ambos tipos.</div>';
    $('cashHistory')?.insertAdjacentElement('beforebegin',filters);
    $('cashHistoryFrom').value = today().slice(0,7)+'-01';
    $('cashHistoryTo').value = today();
    filters.querySelectorAll('input,select').forEach(input => input.addEventListener('change',()=>{renderSummary();renderHistory();}));
  }

  function renderSummary(){
    if (!canRead()) {
      for (const id of ['cashBalance','cashIncomeTotal','cashExpenseTotal','cashOpeningBalance','cashClosingBalance','cashMonthlyIncome','cashMonthlyExpense','cashMonthlyResult']) if ($(id)) $(id).textContent = '—';
      $('sparkCashLiquidity')?.remove();
      renderAnalysis(null);
      renderOperations(null);
      const partner = $('partnerBalanceSummary'); if (partner) { partner.hidden = true; partner.innerHTML = ''; }
      return;
    }
    historyControls();
    const r = range(), result = analyze(data(), {...r, month:$('cashAnalysisMonth')?.value || today().slice(0,7)});
    const movements = result.ledger, {income, expense, opening} = result.period;
    const ym = today().slice(0,7);
    const monthly = movements.filter(item => movementDate(item).slice(0, 7) === ym && movementDate(item) <= today());
    const monthlyIncome = monthly.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyExpense = monthly.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if ($('cashIncomeTotal')) $('cashIncomeTotal').textContent = result.cash.valid ? money(income) : 'Revisar datos';
    if ($('cashExpenseTotal')) $('cashExpenseTotal').textContent = result.cash.valid ? money(expense) : 'Revisar datos';
    if ($('cashBalance')) $('cashBalance').textContent = result.cash.valid ? money(result.cash.physical) : 'Revisar datos';
    if(root.MI_CARTERA_V2_PILOT_CONFIG?.backendMode==='external'){
      let notice=$('sparkCashLiquidity');
      if(!notice&&$('cash')){notice=document.createElement('p');notice.id='sparkCashLiquidity';notice.className='metric';$('cash').appendChild(notice);}
      if(notice)notice.textContent=result.cash.valid?'Caja central actual: '+money(result.cash.physical)+' · Reservado para egresos futuros: '+money(result.cash.futureExpenses)+' · Disponible: '+money(result.cash.available):'La caja contiene datos pendientes de revisión.';
    }else $('sparkCashLiquidity')?.remove();
    if ($('cashOpeningBalance')) $('cashOpeningBalance').textContent = !result.period.valid ? 'Rango inválido' : result.cash.valid ? money(opening) : 'Revisar datos';
    if ($('cashClosingBalance')) $('cashClosingBalance').textContent = !result.period.valid ? 'Rango inválido' : result.cash.valid ? money(result.period.closing) : 'Revisar datos';
    if ($('cashMonthlyIncome')) $('cashMonthlyIncome').textContent = money(monthlyIncome);
    if ($('cashMonthlyExpense')) $('cashMonthlyExpense').textContent = money(monthlyExpense);
    if ($('cashMonthlyResult')) $('cashMonthlyResult').textContent = money(monthlyIncome - monthlyExpense);
    renderOperations(result);
    renderAnalysis(result);
    root.MiCarteraPartners?.renderBalance?.();
  }

  function canRead(){
    if (typeof root.MiCarteraV2AuthCloudGate?.state !== 'function') return true;
    const session = data().session || {}, auth = root.MiCarteraV2AuthCloudGate.state() || {};
    const nativeUid = root.firebaseAuthV2?.auth?.currentUser?.uid, owner = localStorage.getItem('mi-cartera-v2-local-owner');
    return Boolean(auth.ready && auth.uid && String(session.actorId || '') === String(auth.uid) &&
      String(session.role || '').toLowerCase() === String(auth.role || '').toLowerCase() &&
      String(nativeUid || '') === String(auth.uid) && (!owner || owner === String(auth.uid)));
  }

  function analysisScope(){
    const session = data().session || {}, auth = root.MiCarteraV2AuthCloudGate?.state?.() || {};
    const nativeUid = root.firebaseAuthV2?.auth?.currentUser?.uid, owner = localStorage.getItem('mi-cartera-v2-local-owner');
    if (!canRead() || !auth.ready || !auth.uid || !['admin', 'supervisor'].includes(String(auth.role).toLowerCase()) ||
      String(session.actorId || '') !== String(auth.uid) || String(session.role || '').toLowerCase() !== String(auth.role).toLowerCase() ||
      nativeUid && String(nativeUid) !== String(auth.uid) || owner && owner !== String(auth.uid)) return '';
    return JSON.stringify([auth.uid, auth.role, nativeUid, owner, root.MiCarteraV2AuthCloudGate?.ORG]);
  }

  function renderOperations(result){
    let panel = $('cashOperations');
    if(!analysisScope()) {if(panel){panel.hidden=true;panel.innerHTML='';}return;}
    if(!$('cash')||!result)return;
    if(!panel){panel=document.createElement('section');panel.id='cashOperations';panel.className='card';
      const anchor=$('cashBalance')?.closest('.card');if(anchor)anchor.insertAdjacentElement('afterend',panel);else $('cash').prepend(panel);}
    if(!panel.innerHTML){
      const metrics = fields=>'<div class="v2-cash-summary">'+fields.map(([id,label])=>'<div class="card metric">'+label+'<b id="'+id+'"></b></div>').join('')+'</div>';
      panel.innerHTML='<h3>Control operativo de Caja</h3><p id="cashOperationalScope" class="metric"></p><p id="cashOperationsSync" class="metric" aria-live="polite"></p><h4>Hoy y posición actual</h4>'+metrics([
        ['cashOpAvailable','Disponible para prestar hoy (puede ser negativo)'],['cashOpPhysical','Saldo real de caja central'],
        ['cashTodayCollections','Cobranzas ingresadas hoy a caja central'],['cashTodayDisbursed','Desembolsos pagados hoy'],
        ['cashTodayExpenses','Gastos operativos pagados hoy'],['cashTodayIncome','Ingresos totales de hoy'],['cashTodayOutflow','Egresos totales de hoy'],
        ['cashOpPlaced','Capital pendiente colocado en créditos vigentes'],['cashPendingTotal','Cuotas pendientes según calendario (capital e interés)'],['cashPendingOverdue','Cuotas vencidas por cobrar']])+ 
        '<h4>Actividad del periodo seleccionado</h4>'+metrics([
          ['cashPeriodCollections','Cobranzas efectivamente ingresadas'],['cashPeriodDisbursed','Capital desembolsado (incluye entrega neta de renovación)'],
          ['cashPeriodRecovered','Capital recuperado'],['cashPeriodInterest','Intereses cobrados'],['cashPeriodPenalty','Mora cobrada'],
          ['cashPeriodOperating','Gastos operativos pagados'],['cashPeriodContributions','Aportes de capital'],['cashPeriodPartnerFunding','Financiamiento recibido de socios']])+
        '<p id="cashOperationalQuality" class="blocked"></p><h4>Evolución de la liquidez real por día</h4><div id="cashLiquidityEvolution" class="v2-cash-table-wrap"></div>'+
        '<details><summary>Cuotas pendientes de cobro</summary><p>No añade mora no registrada ni suma otra vez el capital pendiente. Son saldos actuales; no una reconstrucción histórica.</p><div id="cashReceivables" class="v2-cash-table-wrap"></div></details>';
    }
    panel.hidden=false;
    const filters=$('cashHistoryPeriod')?.closest('.card');if(filters)panel.before(filters);
    const actions=document.querySelector('[data-v2-cash-actions]');
    if(actions&&filters&&(actions.compareDocumentPosition(filters)&2))filters.before(actions);
    const sync=root.MiCarteraV2SyncBridge?.status?.()||{};
    $('cashOperationsSync').textContent=(sync.online===false?'SIN INTERNET':sync.configured?'NUBE CONECTADA':'LOCAL AISLADO')+
      ' · '+(Number(sync.pending)||0)+' pendiente(s) de sincronización. Lectura de la cartera actual de la sesión; los valores pueden cambiar al recibir datos.';
    const set=(id,value,valid=true)=>{$(id).textContent=!valid?'Revisar datos':value===null?'Revisar calendario':money(value);};
    const day=result.today.activity, activity=result.period.activity;
    for(const [id,value] of Object.entries({cashOpAvailable:result.cash.available,cashOpPhysical:result.cash.physical,
      cashTodayCollections:day.collections,cashTodayDisbursed:day.disbursed,cashTodayExpenses:day.operatingExpenses,
      cashTodayIncome:result.today.income,cashTodayOutflow:result.today.expense}))set(id,value,result.cash.valid);
    set('cashOpPlaced',result.portfolio.principal,result.portfolio.valid);
    set('cashPendingTotal',result.receivables.total);set('cashPendingOverdue',result.receivables.overdue);
    const fields={cashPeriodCollections:'collections',cashPeriodDisbursed:'disbursed',cashPeriodRecovered:'principalRecovered',cashPeriodInterest:'interestCollected',
      cashPeriodPenalty:'penaltiesCollected',cashPeriodOperating:'operatingExpenses',cashPeriodContributions:'capitalContributions',cashPeriodPartnerFunding:'partnerFunding'};
    for(const [id,field] of Object.entries(fields)){
      if(!result.period.valid)$(id).textContent='Rango inválido';else set(id,activity[field],result.cash.valid);
    }
    $('cashOperationalScope').textContent='Caja central de la sesión activa · Corte '+result.asOf+' · Periodo '+(result.period.from||'inicio')+' a '+(result.period.to||result.asOf)+'. Los cobros futuros no son ingresos reales; los egresos futuros quedan reservados. Déficit = saldo negativo.';
    $('cashOperationalQuality').textContent=[...result.warnings,...result.receivables.warnings].join(' · ');
    const amount=value=>value===null?'Revisar datos':money(value);
    $('cashLiquidityEvolution').innerHTML=!result.period.valid?'Rango inválido':!result.evolution.length?'Sin movimientos contabilizados en el periodo.':
      '<table class="v2-cash-table"><thead><tr><th>Fecha</th><th>Saldo inicial</th><th>Ingresos</th><th>Egresos</th><th>Saldo final</th></tr></thead><tbody>'+result.evolution.map(day=>
        '<tr><td>'+esc(day.date)+'</td><td>'+amount(day.opening)+'</td><td>'+money(day.income)+'</td><td>'+money(day.expense)+'</td><td>'+amount(day.closing)+'</td></tr>').join('')+'</tbody></table>';
    const clients=Array.isArray(data().clients)?data().clients:[];
    $('cashReceivables').innerHTML=(!result.receivables.valid?'<p>Información parcial: revisa los calendarios indicados; no se certifica deuda cero.</p>':'')+
      (result.receivables.rows.length?'<table class="v2-cash-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Crédito</th><th>Pendiente</th></tr></thead><tbody>'+result.receivables.rows.map(row=>{
        const client=clients.find(item=>item&&!removed(item)&&item.id===row.clientId);
        return '<tr><td>'+esc(row.date)+'</td><td>'+esc(client?.name||row.clientId||'Sin vínculo')+'</td><td>'+esc(row.creditId)+'</td><td>'+money(row.amount)+'</td></tr>';
      }).join('')+'</tbody></table>':'Sin cuotas pendientes verificables.');
  }

  function renderAnalysis(result){
    const scope = analysisScope();
    let panel = $('cashProfitability');
    if (!scope) { if (panel) { panel.hidden = true; panel.innerHTML = ''; delete panel.dataset.scope; } return; }
    if (!$('cash')) return;
    if (!panel) { panel = document.createElement('details'); panel.id = 'cashProfitability'; panel.className = 'card'; $('cash').appendChild(panel); }
    if (panel.dataset.scope !== scope) {
      panel.dataset.scope = scope;
      panel.innerHTML = '<summary>Análisis mensual y simulador interno de validación</summary><h3>Rentabilidad y punto de equilibrio</h3><p class="metric">REAL — lectura de la cartera local de la sesión activa. Caja central; no se crean ni modifican registros.</p><p id="cashDataStatus" class="metric"></p>'+
        '<label>Mes del resultado real<input id="cashAnalysisMonth" class="input" type="month" value="'+result.month.label+'"></label>'+
        '<div class="v2-cash-summary">'+[
          ['cashAvailable','Disponible para prestar hoy'],['cashFutureReserved','Egresos futuros reservados'],
          ['cashPortfolioPrincipal','Capital pendiente en créditos vigentes'],['cashPartnerPrincipal','Capital por devolver a socios'],
          ['cashPartnerOverdue','Interés vencido de socios'],['cashNetCapital','Capital neto antes de reservas futuras'],
          ['cashMonthCapitalOut','Capital desembolsado en el mes'],['cashMonthCapitalIn','Capital recuperado en el mes'],
          ['cashMonthInterest','Intereses efectivamente cobrados'],['cashMonthPenalty','Mora efectivamente cobrada'],
          ['cashOperatingExpenses','Gastos operativos pagados'],['cashPartnerInterestPaid','Intereses pagados a socios'],
          ['cashPartnerReturn','Capital devuelto a socios'],['cashRealizedProfit','Utilidad / pérdida realizada del mes']
        ].map(([id,label])=>'<div class="card metric">'+label+'<b id="'+id+'"></b></div>').join('')+'</div>'+
        '<p id="cashAnalysisQuality" class="metric"></p><p id="cashAnalysisWarnings" class="blocked"></p>'+
        '<h4>PROYECCIÓN — simulador mensual</h4><p class="metric">No es dinero cobrado ni una garantía. No se interpreta automáticamente la tasa por plazo de un crédito como tasa mensual.</p>'+
        '<div class="v2-cash-filters">'+[
          ['cashSimOperating','Gastos operativos mensuales (S/)'],['cashSimPartner','Costo mensual de socios (S/)'],
          ['cashSimTicket','Capital promedio por crédito (S/)'],['cashSimRate','Rendimiento mensual supuesto (%)'],
          ['cashSimCollection','Cobranza efectiva esperada (%)'],['cashSimLoss','Pérdida mensual prevista sobre capital (%)'],
          ['cashSimVariable','Costo variable adicional por crédito/mes (S/)'],['cashSimTarget','Utilidad mensual objetivo (S/)']
        ].map(([id,label])=>'<label>'+label+'<input id="'+id+'" class="input" type="number" min="0" step="0.01"></label>').join('')+'</div>'+
        '<button type="button" id="cashSimCalculate" class="btn blue">Calcular escenario</button><p id="cashSimulationResult" aria-live="polite"></p>'+
        '<p class="metric">Los costos iniciales usan gastos registrados del mes y el próximo interés pactado de socios; revísalos si el mes está incompleto. Costos fijos + utilidad objetivo, divididos por el margen mensual de cada crédito. Principal recuperado y préstamos de socios no son ingresos de rentabilidad. No añade impuestos, depreciación ni financiamiento nuevo no registrados. No cuentes dos veces un costo fijo y variable.</p>';
      $('cashAnalysisMonth').onchange = () => { if (!$('cashAnalysisMonth').value) $('cashAnalysisMonth').value = today().slice(0,7); renderSummary(); };
      $('cashSimCollection').value = '100'; $('cashSimLoss').value = '0'; $('cashSimVariable').value = '0'; $('cashSimTarget').value = '0';
      panel.querySelectorAll('input[type="number"]').forEach(input => input.addEventListener('input', () => { $('cashSimulationResult').textContent = 'Los supuestos cambiaron. Pulsa Calcular escenario para recalcular la proyección.'; }));
      $('cashSimCalculate').onclick = () => {
        if (analysisScope() !== panel.dataset.scope) { renderSummary(); return; }
        const current = analyze(data(), {month:$('cashAnalysisMonth').value});
        const projection = simulate({operatingCosts:$('cashSimOperating').value, partnerCosts:$('cashSimPartner').value,
          averageCredit:$('cashSimTicket').value, monthlyRate:$('cashSimRate').value, collectionPercent:$('cashSimCollection').value,
          lossPercent:$('cashSimLoss').value, variableCost:$('cashSimVariable').value, targetProfit:$('cashSimTarget').value}, current);
        $('cashSimulationResult').textContent = projection.valid ?
          'PROYECCIÓN · Margen mensual por crédito: '+money(projection.contributionPerCredit)+
          ' · Ingresos mínimos de intereses para cubrir costos: '+money(projection.breakEvenIncome)+
          ' · Equilibrio: '+projection.breakEvenCredits+' créditos · Capital productivo: '+money(projection.breakEvenCapital)+
          ' · Objetivo: '+projection.targetCredits+' créditos · Capital total requerido: '+money(projection.targetCapital)+
          ' · Intereses esperados: '+money(projection.targetIncome)+' · Utilidad proyectada: '+money(projection.expectedProfit)+
          ' · Financiamiento adicional tras cartera y caja disponibles: '+(projection.additionalFunding===null?'Revisar datos':money(projection.additionalFunding)) : projection.reason;
      };
    }
    panel.hidden = false;
    const sync = root.MiCarteraV2SyncBridge?.status?.() || {};
    $('cashDataStatus').textContent = (sync.online === false ? 'SIN INTERNET' : sync.configured ? 'NUBE CONECTADA' : 'LOCAL AISLADO') +
      ' · '+(Number(sync.pending) || 0)+' pendiente(s) de sincronización. Los valores pueden cambiar al recibir una cartera actualizada.';
    const set = (id, value) => { $(id).textContent = value === null ? 'Revisar datos' : money(value); };
    set('cashAvailable',result.cash.available); set('cashFutureReserved',result.cash.futureExpenses);
    set('cashPortfolioPrincipal',result.portfolio.valid ? result.portfolio.principal : null);
    set('cashPartnerPrincipal',result.partners.valid ? result.partners.principal : null);
    set('cashPartnerOverdue',result.partners.valid ? result.partners.interestDue : null); set('cashNetCapital',result.netCapital);
    const fields = {cashMonthCapitalOut:'disbursed',cashMonthCapitalIn:'principalRecovered',cashMonthInterest:'interestCollected',
      cashMonthPenalty:'penaltiesCollected',cashOperatingExpenses:'operatingExpenses',cashPartnerInterestPaid:'partnerInterestPaid',cashPartnerReturn:'partnerPrincipalReturned'};
    for (const [id, field] of Object.entries(fields)) set(id,result.month[field]);
    $('cashRealizedProfit').textContent = (result.month.complete ? '' : 'Parcial: ') + money(result.month.netProfit);
    $('cashAnalysisQuality').textContent = 'Mes '+result.month.label+' · Corte '+result.asOf+'. Utilidad realizada de caja: intereses + mora + otros ingresos operativos − gastos operativos − intereses pagados a socios. No incluye principal, deuda ni cobros futuros; no es utilidad contable devengada. '+
      'Por clasificar: cobros '+money(result.month.unclassifiedCollections)+', ingresos '+money(result.month.unclassifiedIncome)+', egresos '+money(result.month.unclassifiedExpense)+'.';
    $('cashAnalysisWarnings').textContent = result.warnings.join(' · ');
    const seeds = {cashSimOperating:result.month.operatingExpenses,cashSimPartner:result.partners.nextMonthlyCost,cashSimTicket:result.portfolio.averageCredit};
    for (const [id, value] of Object.entries(seeds)) {
      const input = $(id), next = value === null ? '' : Number(value).toFixed(2);
      if (input.dataset.seed === undefined || input.value === input.dataset.seed) input.value = next;
      input.dataset.seed = next;
    }
    if ($('cashSimulationResult').textContent) $('cashSimulationResult').textContent = 'Los datos o filtros se actualizaron. Pulsa Calcular escenario para recalcular la proyección.';
  }

  function partnerSummary(){
    const result = analyze(data());
    return {cash:result.cash.physical, portfolioPrincipal:result.portfolio.principal, partnerPrincipal:result.partners.principal,
      partnerInterestDue:result.partners.interestDue, partnerInterestPaid:result.ledger.filter(row=>row.type==='EGRESO'&&cashCategory(row)==='INTERES_SOCIO'&&row.normalizedDate<=result.asOf).reduce((total,row)=>total+row.cents,0)/100,
      netCapital:result.netCapital};
  }

  function renderHistory(){
    const element=$('cashHistory');if(!element)return;
    if(!canRead()||!analysisScope()){element.textContent='Espera a que la sesión y la cartera coincidan.';return;}
    historyControls();
    const selectedRange=range(),type=$('cashHistoryType')?.value||'ALL';
    if(selectedRange.invalid){element.textContent='Selecciona un rango válido: Desde debe ser anterior o igual a Hasta.';return;}
    const result=analyze(data(),selectedRange);
    const movements=result.movements.filter(row=>inRange(row,selectedRange)&&(type==='ALL'||row.type===type));
    if(!movements.length){element.textContent='Sin movimientos de caja V2 en este periodo.';return;}
    const cell=(label,value)=>'<td data-label="'+label+'">'+value+'</td>';
    element.innerHTML='<h3>Movimientos y auditoría — sólo lectura</h3><p class="metric">El saldo incluye todo el historial contabilizado y ambos tipos, aunque filtres el detalle. Orden diario por hora auditada; si falta, por identificador. Los programados no cambian la caja real.</p>'+
      '<div class="v2-cash-table-wrap"><table class="v2-cash-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Crédito / pago</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Saldo resultante</th><th>Trazabilidad</th></tr></thead><tbody>'+
      movements.map(row=>'<tr data-movement-id="'+esc(row.id)+'" class="'+(row.type==='INGRESO'?'v2-cash-income':'v2-cash-expense')+'">'+
        cell('Fecha',esc(row.normalizedDate))+
        cell('Cliente',esc(row.clientName||(row.partnerLoan?.partner)||'No aplica / sin vínculo'))+
        cell('Crédito / pago',esc(row.creditId||'No aplica')+(row.paymentId?'<small>Pago: '+esc(row.paymentId)+'</small>':''))+
        cell('Concepto',esc(String(row.category||row.concept||'SIN_CATEGORIA').replaceAll('_',' '))+
          (row.category&&row.concept?'<small>'+esc(row.concept)+'</small>':'')+(row.observation?'<small>'+esc(row.observation)+'</small>':''))+
        cell('Tipo',esc(row.type)+(row.scheduled?'<small>PROGRAMADO — no contabilizado</small>':''))+
        cell('Monto',money(row.amount))+
        cell('Saldo resultante',row.scheduled?'No contabilizado':row.balanceAfter===null?'Revisar datos':money(row.balanceAfter))+
        cell('Trazabilidad',esc(row.actorId||'Actor no registrado')+'<small>Operación: '+esc(row.operationId||'Sin vínculo')+'</small>'+
          '<small>Movimiento: '+esc(row.id)+'</small>'+(row.auditId?'<small>Auditoría: '+esc(row.auditId)+'</small>':'')+(row.auditAt?'<small>'+esc(row.auditAt)+'</small>':''))+'</tr>').join('')+'</tbody></table></div>';
  }


function formSession(){const s=root.MiCarteraV2AuthCloudGate?.state?.()||{},nativeUid=root.firebaseAuthV2?.auth?.currentUser?.uid;let d={};try{d=JSON.parse(root.localStorage.getItem('mi-cartera-v2-validation-state')||'{}')}catch{}if(nativeUid&&s.uid&&String(nativeUid)!==String(s.uid))return '';return JSON.stringify([s.uid,s.role,s.ready,s.workerId,s.routeIds,nativeUid,root.localStorage.getItem('mi-cartera-v2-local-owner'),d.session])}
let activeDraft=null;
function currentDraft(panel,scope){return Boolean(scope&&formSession()===scope&&panel.isConnected!==false)}
function invalidateDraft(){if(activeDraft&&!currentDraft(activeDraft.panel,activeDraft.scope)){activeDraft.panel.remove();activeDraft=null}}
root.addEventListener('v2-auth-cloud-state',invalidateDraft);

  function openForm(type, capitalOnly=false){
    if(capitalOnly&&!analysisScope())return alert('Espera una sesión administrativa validada para ingresar capital.');
    const draftScope=formSession();
    const old=$('v2CashForm'); if(old) old.remove();
    const income=type==='INGRESO';
    const panel=document.createElement('div'); panel.id='v2CashForm'; panel.className='card v2-cash-form';
    const cats=income?(capitalOnly?['APORTE_CAPITAL']:['APORTE_CAPITAL','OTRO_INGRESO']):['COLEGIO','SERVICIO_MOVIL','SERVICIOS','ALIMENTACION','TRANSPORTE','SALUD','GASTO_OPERATIVO','OTROS_GASTOS'];
    panel.innerHTML='<div class="v2-form-head"><b>'+(income?'Registrar capital / ingreso':'Registrar egreso / gasto')+'</b><button type="button" class="btn" data-close>✕ Cerrar</button></div>'+
      '<label>Fecha<input id="v2CashDate" type="date"></label><label>Monto (S/)<input id="v2CashAmount" type="number" min="0.01" step="0.01" placeholder="0.00"></label>'+
      '<label>'+(income?'Tipo de ingreso':'Tipo de egreso')+'<select id="v2CashCategory">'+cats.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('')+'</select></label>'+
      '<label>'+(capitalOnly?'Origen / aportante (obligatorio)':'Detalle')+'<input id="v2CashConcept" placeholder="'+(income?'Identifica el origen o aportante del capital':'Ej. Mensualidad colegio / plan móvil')+'"></label>'+
      '<label>Observación<textarea id="v2CashObservation" rows="2" placeholder="Opcional"></textarea></label><button type="button" class="btn '+(income?'green':'')+'" data-save>Guardar movimiento</button>';
    panel.querySelector('#v2CashDate').value=today();
    if(capitalOnly)panel.querySelector('#v2CashCategory').disabled=true;
    activeDraft={panel,scope:draftScope};
    let saving=false;
    panel.querySelector('[data-close]').onclick=()=>{if(!saving)panel.remove();};
    const saveButton=panel.querySelector('[data-save]');
    saveButton.onclick=async()=>{
      if(saving)return;
      if(!currentDraft(panel,draftScope)){panel.remove();return alert('La sesión cambió. Abre nuevamente el formulario.');}
      const action=root.V2UI?.manualCash;if(typeof action!=='function')return alert('Las acciones de caja V2 todavía no están disponibles.');
      const payload={date:panel.querySelector('#v2CashDate').value,amount:panel.querySelector('#v2CashAmount').value,category:capitalOnly?'APORTE_CAPITAL':panel.querySelector('#v2CashCategory').value,concept:panel.querySelector('#v2CashConcept').value.trim(),observation:panel.querySelector('#v2CashObservation').value};
      if(!payload.amount)return alert('Ingresa el monto.'); if(!payload.concept)return alert('Ingresa el detalle.');
      saving=true;saveButton.disabled=true;
      try{const result=await action(type,payload);if(result){panel.remove();renderSummary();renderHistory()}}catch(e){}finally{saving=false;saveButton.disabled=false;}
    };
    const actions=document.querySelector('[data-v2-cash-actions]'); actions?.insertAdjacentElement('afterend',panel); panel.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function invoke(type, capitalOnly=false){ openForm(type,capitalOnly); }

  function addStyles(){
    if ($('v2CashMenuStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2CashMenuStyles';
    style.textContent = `
      .v2-cash-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v2-cash-summary .metric{margin:0}
      .v2-cash-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v2-cash-actions>b,.v2-cash-actions>span{grid-column:1/-1}
      .v2-cash-actions .btn{width:100%;text-align:left}
      .v2-cash-income{border-left:5px solid #2e9d58}
      .v2-cash-expense{border-left:5px solid #c62828}
      .v2-cash-compact{display:flex;justify-content:space-between;gap:12px;align-items:center}.v2-cash-compact span{font-weight:600;text-align:right}
      .v2-cash-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v2-cash-filters label{min-width:0}.v2-cash-filters .metric{grid-column:1/-1}.v2-cash-detail{padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere}
      .v2-month-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v2-cash-table-wrap{overflow-x:auto}.v2-cash-table{width:100%;border-collapse:collapse;text-align:left}.v2-cash-table th,.v2-cash-table td{padding:10px;border-bottom:1px solid #dce3e8;vertical-align:top;overflow-wrap:anywhere}.v2-cash-table th{font-weight:700}.v2-cash-table td small{display:block;max-width:240px}#cashProfitability>summary{cursor:pointer;font-weight:700}#cashOperations h4{margin-top:24px}
      .v2-cash-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .v2-cash-form .v2-form-head,.v2-cash-form>button{grid-column:1/-1}.v2-form-head{display:flex;justify-content:space-between;align-items:center}
      .v2-cash-form label{display:flex;flex-direction:column;gap:5px;font-weight:600}.v2-cash-form input,.v2-cash-form select,.v2-cash-form textarea{padding:10px;border:1px solid #bbb;border-radius:8px;font:inherit}
      #more .v2-more-menu{display:flex;flex-direction:column;gap:10px}
      #more .v2-more-menu .btn{width:100%;min-height:52px;text-align:left;margin:0;white-space:normal;display:block;color:#163247!important;font-weight:700}.v2-cash-actions .btn.blue,.v2-cash-actions .btn.green{color:#163247!important;font-weight:700}
      @media(max-width:700px){.v2-month-summary{grid-template-columns:1fr}}
      @media(max-width:480px){.v2-cash-summary,.v2-cash-actions,.v2-cash-form,.v2-cash-filters{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    addStyles();
    const cash = $('cash');
    if (cash && !cash.querySelector('[data-v2-cash-actions]')) {
      const summary = document.createElement('div');
      summary.className = 'card v2-cash-summary';
      summary.innerHTML = '<div class="card metric v2-cash-income">Ingresos del periodo<b id="cashIncomeTotal">S/ 0.00</b></div><div class="card metric v2-cash-expense">Egresos del periodo<b id="cashExpenseTotal">S/ 0.00</b></div><div class="card metric">Saldo inicial del periodo<b id="cashOpeningBalance">S/ 0.00</b></div><div class="card metric">Saldo al cierre del periodo<b id="cashClosingBalance">S/ 0.00</b></div>';
      const monthly = document.createElement('div');
      monthly.className = 'card v2-month-summary';
      monthly.innerHTML = '<div class="metric">Ingresos del mes<b id="cashMonthlyIncome">S/ 0.00</b></div><div class="metric">Egresos del mes<b id="cashMonthlyExpense">S/ 0.00</b></div><div class="metric">Flujo neto del mes (no utilidad)<b id="cashMonthlyResult">S/ 0.00</b></div>';
      const actions = document.createElement('div');
      actions.className = 'card v2-cash-actions';
      actions.dataset.v2CashActions = '1';
      actions.innerHTML = '<b>Registrar movimiento</b><span>Se agrega un registro nuevo con su auditoría; no se alteran movimientos históricos.</span><button type="button" class="btn green" data-v2-cash-type="INGRESO" data-v2-cash-capital>＋ Ingresar capital</button><button type="button" class="btn" data-v2-cash-type="INGRESO">＋ Otros ingresos</button><button type="button" class="btn v2-cash-expense" data-v2-cash-type="EGRESO">− Registrar egreso / gasto</button>';
      actions.querySelectorAll('[data-v2-cash-type]').forEach(button => button.addEventListener('click', () => invoke(button.dataset.v2CashType,button.hasAttribute('data-v2-cash-capital'))));
      const metric = cash.querySelector('#cashBalance')?.closest('.card');
      if (metric) { metric.insertAdjacentElement('afterend', summary); summary.insertAdjacentElement('afterend', monthly); monthly.insertAdjacentElement('afterend', actions); }
      else { cash.insertBefore(summary, cash.firstChild); cash.insertBefore(monthly, summary.nextSibling); cash.insertBefore(actions, monthly.nextSibling); }
    }
    const moreCard = document.querySelector('#more .card');
    if (moreCard && !moreCard.querySelector('.v2-more-menu')) {
      const buttons = [...moreCard.children].filter(child => child.tagName === 'BUTTON');
      const menu = document.createElement('div');
      menu.className = 'v2-more-menu';
      buttons.forEach(button => menu.appendChild(button));
      moreCard.appendChild(menu);
    }
    renderHistory();
    renderSummary();
  }

  document.addEventListener('DOMContentLoaded', install);
  const refresh=()=>{renderSummary();renderHistory();};
  root.addEventListener?.('storage', refresh);
  root.addEventListener?.('mi-cartera-v2-rehydrated', refresh);
  root.addEventListener?.('v2-auth-cloud-state', refresh);
  root.addEventListener?.('mi-cartera-v2-sync', refresh);
  root.addEventListener?.('v2-local-owner-ready', refresh);
  root.MiCarteraV2CashMenu = {install, renderSummary, renderHistory, localDate, calculateLiquidity, analyze, simulate, partnerSummary, canRead};
})(window);
