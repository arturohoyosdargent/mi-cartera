// Spark-native partner contracts. The legacy loan journal remains authoritative.
// No runtime registration: integration must opt in only after the rules/cash/index
// contracts have been certified. Multi-delivery settlement is explicitly closed.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../core/partner-loans.js'):root.MiCarteraPartnerLoans);if(typeof module==='object'&&module.exports)module.exports=api;else root.MiCarteraV2SparkPartners=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
const PROTOCOL='spark-partners-v1',INDEX='financialControls/partner-keys',TYPES=['PARTNER_LOAN_CREATED','PARTNER_INTEREST_PAID','PARTNER_CAPITAL_RETURNED','PARTNER_SETTLED','PARTNER_CONTACT_UPDATED'];
const clone=v=>JSON.parse(JSON.stringify(v)),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
function need(value,error){if(!value)throw Error(error)}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
function clean(v){const x=clone(v);delete x.__firestoreId;delete x.acceptedAt;return x}
function business(v){const x=clean(v);delete x.updatedAt;delete x.nativePartnerOperationId;return x}
function cents(v){need(typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&v===Math.round(v*100)/100&&Math.abs(v)<=9000000000,'INVALID_PARTNER_CENTS');return Math.round(v*100)}
const parts=date=>date.split('-').map(Number);
function naturalKey(l){return l.partner.toLowerCase()+'|'+l.date+'|'+cents(l.principal)}
function phone(v){need(typeof v==='string'&&/^(?:[1-9][0-9]{9,14})?$/.test(v),'INVALID_PARTNER_PHONE');return v}
function shape(op,actorId){
 need(C&&key(op?.id)&&TYPES.includes(op.type)&&op.actorId===actorId&&Array.isArray(op.writes),'INVALID_PARTNER_OPERATION');
 const masters=op.writes.filter(w=>/^entries\//.test(w.path)&&w.data?.partnerLoan),expenses=op.writes.filter(w=>/^expenses\//.test(w.path)),audits=op.writes.filter(w=>/^audit\//.test(w.path));
 if(op.type==='PARTNER_SETTLED'&&masters.length>1)throw Error('SPARK_PARTNER_MULTI_SETTLEMENT_CONTRACT_REQUIRED');
 need(masters.length===1&&audits.length===1,'INVALID_PARTNER_WRITES');
 const financial=op.type!=='PARTNER_CONTACT_UPDATED',created=op.type==='PARTNER_LOAN_CREATED',pays=financial&&!created;
 need(expenses.length===(pays?1:0)&&op.writes.length===2+(pays?1:0),'INVALID_PARTNER_WRITES');
 const master=masters[0],expense=expenses[0],audit=audits[0];
 for(const w of [master,expense,audit].filter(Boolean)){const collection=w===master?'entries':w===expense?'expenses':'audit';need(key(w.data.id)&&w.path===collection+'/'+w.data.id,'INVALID_PARTNER_PATH')}
 need(master.data.partnerLoan.id===master.data.id&&master.kind===(created?'create':'set')&&Number.isInteger(master.expectedVersion)&&master.expectedVersion===(created?0:master.data.version-1),'INVALID_PARTNER_VERSION');
 need(audit.kind==='create'&&audit.expectedVersion===0&&audit.data.actorId===actorId&&audit.data.action===op.type&&audit.data.entityType==='PARTNER_LOAN'&&audit.data.entityId===master.data.id&&audit.data.operationId===op.id,'INVALID_PARTNER_AUDIT');
 need(['admin','supervisor'].includes(String(audit.data.role||'').toLowerCase()),'PARTNER_MANAGER_REQUIRED');
 need(canonical([...audit.data.detail.ids].sort())===canonical([master.data.id,...(expense?[expense.data.id]:[])].sort()),'INVALID_PARTNER_AUDIT');
 if(expense)need(expense.kind==='create'&&expense.expectedVersion===0&&expense.data.version===1&&expense.data.type==='EGRESO'&&expense.data.ref===master.data.id&&expense.data.partnerLoanId===master.data.id&&expense.data.operationId===op.id,'INVALID_PARTNER_EXPENSE');
 return {master,expense,audit,financial,created,pays};
}
function proposal(op,actorId,before,today){
 const s=shape(op,actorId),requested=clean(s.master.data),l=requested.partnerLoan;
 need(typeof l.partner==='string'&&l.partner===l.partner.trim()&&l.partner.length>0&&l.partner.length<=200,'INVALID_PARTNER_NAME');
 const date=s.expense?s.expense.data.date:s.created?l.date:today;C.date(date);need(date<=today,'PARTNER_FUTURE_DATE_NOT_ALLOWED');
 let expected,journal=null,nextTerm=null;
 if(s.created){need(!before,'PARTNER_MASTER_EXISTS');const loan=C.create(l);need(cents(loan.terms[0].amount)>0,'PARTNER_ZERO_INTEREST_CONTRACT_UNSUPPORTED');expected=C.entry(loan);if(Object.hasOwn(requested,'partnerPhone'))expected.partnerPhone=phone(requested.partnerPhone)}
 else{
  need(before?.id===requested.id&&before.version===s.master.expectedVersion&&before.type==='INGRESO'&&before.partnerLoan&&!before.tombstone&&!before.noReplay&&!before.administrativeClosure?.noReplay,'PARTNER_MASTER_VERSION_OR_STATE_CHANGED');
  if(op.type==='PARTNER_CONTACT_UPDATED')expected={...clean(before),partnerPhone:phone(requested.partnerPhone),version:before.version+1};
  else{
   const e=s.expense.data;need(cents(e.amount)>0,'INVALID_PARTNER_AMOUNT');
   if(op.type==='PARTNER_INTEREST_PAID'){
    need(e.category==='INTERES_SOCIO'&&typeof e.interestDue==='string','INVALID_PARTNER_INTEREST');C.date(e.interestDue);
    expected={...clean(before),partnerLoan:C.payInterest(before.partnerLoan,{id:e.id,date,due:e.interestDue,amount:e.amount}),version:before.version+1};journal=expected.partnerLoan.interestPayments.at(-1);
   }else{
    need(e.category==='DEVOLUCION_CAPITAL_SOCIO','INVALID_PARTNER_RETURN');
    const input={id:e.id,date,amount:e.amount};if(requested.partnerLoan.terms.length===before.partnerLoan.terms.length+1)input.nextMonthlyInterest=requested.partnerLoan.terms.at(-1).amount;
    expected={...clean(before),partnerLoan:C.repay(before.partnerLoan,input),version:before.version+1};journal=expected.partnerLoan.repayments.at(-1);nextTerm=expected.partnerLoan.terms.length>before.partnerLoan.terms.length?expected.partnerLoan.terms.at(-1):null;
    if(op.type==='PARTNER_SETTLED')need(C.balance(expected.partnerLoan)===0,'PARTNER_SETTLEMENT_MUST_CLOSE_DELIVERY');
   }
  }
 }
 need(canonical(business(requested))===canonical(business(expected)),'FORGED_PARTNER_MASTER_OR_HISTORY');
 const master={...requested,nativePartnerOperationId:op.id},expense=s.expense?{...clean(s.expense.data),userId:actorId,cashAccountId:'leader'}:null,audit={...clean(s.audit.data),role:String(s.audit.data.role).toLowerCase(),version:1};
 const deltaCents=s.created?cents(master.amount):expense?-cents(expense.amount):0;
 return {id:op.id,protocol:PROTOCOL,type:op.type,actorId,loanId:master.id,expectedVersion:s.master.expectedVersion,financial:s.financial,date,dateParts:parts(date),loanDateParts:parts(l.date),firstDueParts:parts(l.firstDue),dueParts:journal?.due?parts(journal.due):null,nextTermParts:nextTerm?parts(nextTerm.from):null,deltaCents,registryKey:s.created?naturalKey(l):'',master,expense,audit,journal,nextTerm};
}
function initialState(){return {repaidCents:0,lastRepayDate:'',maxPaidDue:'',duplicateId:false,duplicateDue:false,termCents:0,termFound:false,eligibleRepayments:0}}
function scan(p,before,state,kind,row,rowIndex){
 const next=clone(state);need(row&&typeof row==='object','INVALID_PARTNER_HISTORY');
 if(kind==='repayment'){need(key(row.id)&&cents(row.amount)>0,'INVALID_PARTNER_HISTORY');C.date(row.date);next.repaidCents+=cents(row.amount);need(Number.isSafeInteger(next.repaidCents),'INVALID_PARTNER_HISTORY');next.lastRepayDate=next.lastRepayDate>row.date?next.lastRepayDate:row.date;next.eligibleRepayments+=row.date<=p.date?1:0;next.duplicateId=next.duplicateId||row.id===p.expense.id}
 else if(kind==='interest'){need(key(row.id)&&cents(row.amount)>=0,'INVALID_PARTNER_HISTORY');C.date(row.date);C.date(row.due);next.maxPaidDue=next.maxPaidDue>row.due?next.maxPaidDue:row.due;next.duplicateId=next.duplicateId||row.id===p.expense.id;next.duplicateDue=next.duplicateDue||row.due===p.journal.due}
 else{C.date(row.from);need(cents(row.amount)>=0,'INVALID_PARTNER_HISTORY');if(rowIndex<1+next.eligibleRepayments&&row.from<=String(p.journal?.due||'')){next.termCents=cents(row.amount);next.termFound=true}}
 return next;
}
function certificates(p,before){
 if(!p.expense)return [];
 const l=before.partnerLoan;need(Array.isArray(l.repayments)&&Array.isArray(l.interestPayments)&&Array.isArray(l.terms)&&l.terms.length>0,'INVALID_PARTNER_HISTORY');
 let state=initialState();const out=[];
 for(const [kind,rows]of [['repayment',l.repayments],['interest',l.interestPayments],['term',l.terms]])for(let i=0;i<rows.length;i++){state=scan(p,before,state,kind,rows[i],i);out.push({id:p.id+'--'+out.length,operationId:p.id,actorId:p.actorId,loanId:p.loanId,expectedVersion:p.expectedVersion,index:out.length,kind,rowIndex:i,state:clone(state)})}
 need(!state.duplicateId&&!state.duplicateDue,'DUPLICATE_PARTNER_PAYMENT');
 if(p.type==='PARTNER_INTEREST_PAID')need(state.termFound&&state.termCents===cents(p.expense.amount),'PARTNER_INTEREST_TERM_CHANGED');
 else{const pending=cents(l.principal)-state.repaidCents;need(pending>0&&cents(p.expense.amount)<=pending&&p.date>=state.lastRepayDate,'INVALID_PARTNER_CAPITAL_BALANCE');if(p.nextTerm)need(state.maxPaidDue<p.nextTerm.from,'FUTURE_PARTNER_INTEREST_ALREADY_PAID');else need(state.maxPaidDue<=p.date,'FUTURE_PARTNER_INTEREST_ALREADY_PAID')}
 return out;
}
function authorizations(p){return ['context','ledger','audit'].map(kind=>({id:p.id+'--'+kind,protocol:PROTOCOL,operationId:p.id,actorId:p.actorId,loanId:p.loanId,expectedVersion:p.expectedVersion,kind}))}
function certificateId(p){if(!p.expense)return '';const l=p.master.partnerLoan,count=l.repayments.length+l.interestPayments.length+l.terms.length-1-(p.nextTerm?1:0);return p.id+'--'+(count-1)}
function createSparkPartnerStore({adapter,actorId,stamp,today,cash,validateSession=()=>{}}={}){
 need(adapter&&typeof adapter.runAtomic==='function'&&key(actorId)&&typeof stamp==='function'&&typeof today==='function'&&cash&&typeof cash.prepare==='function','SPARK_PARTNER_ADAPTER_REQUIRED');
 const guard=op=>validateSession(op);
 async function registry(tx,p){const raw=await tx.get(INDEX),value=raw?clean(raw):null;need(value&&value.id==='partner-keys'&&value.recordType==='PARTNER_KEY_INDEX'&&value.protocol===PROTOCOL&&key(value.baselineId)&&Number.isInteger(value.version)&&value.version>=1&&value.claims&&typeof value.claims==='object'&&!Array.isArray(value.claims),'SPARK_PARTNER_INDEX_REQUIRED');need(!Object.hasOwn(value.claims,p.registryKey),'DUPLICATE_PARTNER_NATURAL_KEY');return {path:INDEX,data:{...value,claims:{...value.claims,[p.registryKey]:p.loanId},version:value.version+1,lastOperationId:p.id,acceptedAt:stamp()}}}
 function matchesRequest(p,s,op){need(p.id===op.id&&p.type===op.type&&p.actorId===actorId&&p.expectedVersion===s.master.expectedVersion&&canonical(p.master)===canonical({...clean(s.master.data),nativePartnerOperationId:op.id})&&canonical(p.expense)===canonical(s.expense?{...clean(s.expense.data),userId:actorId,cashAccountId:'leader'}:null)&&canonical(p.audit)===canonical({...clean(s.audit.data),role:String(s.audit.data.role).toLowerCase(),version:1}),'SPARK_PARTNER_OPERATION_COLLISION')}
 function response(record,p,status){need(record?.id===p.id&&record.type===p.type&&record.protocol===PROTOCOL&&record.actorId===actorId&&record.status==='APPLIED'&&record.proposalId===p.id&&record.appliedAt!=null&&record.writeCount===2+(p.expense?1:0)+(p.financial?1:0)+(p.expectedVersion===0?1:0)&&record.certificateId===certificateId(p)&&record.deltaCents===p.deltaCents&&record.cashAccountId===(p.financial?'leader':''),'SPARK_PARTNER_OPERATION_COLLISION');need(!record.noReplay&&!record.administrativeClosure?.noReplay,'PARTNER_OPERATION_CLOSED');return {status,operation:record,result:{master:p.master,expense:p.expense,audit:p.audit,entries:[p.master],expenses:p.expense?[p.expense]:[]}}}
 async function accepted(tx,record,p){const out=response(record,p,'ALREADY_APPLIED'),master=await tx.get('entries/'+p.loanId);need(master?.id===p.loanId&&Number.isInteger(master.version)&&master.version>=p.master.version,'SPARK_PARTNER_COMPANION_MISSING');if(master.version===p.master.version)need(canonical(clean(master))===canonical(p.master)&&canonical(master.acceptedAt)===canonical(record.appliedAt),'SPARK_PARTNER_COMPANION_MISSING');for(const [collection,target]of [['audit',p.audit],...(p.expense?[['expenses',p.expense]]:[])]){const row=await tx.get(collection+'/'+target.id);need(row&&canonical(clean(row))===canonical(target)&&row.acceptedAt!=null&&canonical(row.acceptedAt)===canonical(record.appliedAt),'SPARK_PARTNER_COMPANION_MISSING')}for(const proof of authorizations(p)){const saved=await tx.get('partnerAuthorizations/'+proof.id);need(saved&&canonical(clean(saved))===canonical(proof),'SPARK_PARTNER_AUTHORIZATION_MISSING')}if(p.expense){const cert=await tx.get('partnerCertificates/'+record.certificateId);need(cert?.id===record.certificateId&&cert.operationId===p.id&&cert.actorId===actorId&&cert.expectedVersion===p.expectedVersion,'SPARK_PARTNER_CERTIFICATE_MISSING')}return out}
 async function execute(op){try{
  guard(op);const s=shape(op,actorId),pp='partnerProposals/'+op.id,opPath='operations/'+op.id;
  const initial=await adapter.runAtomic(async tx=>{guard(op);const record=await tx.get(opPath),saved=await tx.get(pp),before=await tx.get(s.master.path);if(record){need(saved,'SPARK_PARTNER_PROPOSAL_MISSING');const original=clean(saved);matchesRequest(original,s,op);return {p:original,accepted:await accepted(tx,record,original)}}const p=proposal(op,actorId,before,today());if(saved)need(canonical(clean(saved))===canonical(p),'SPARK_PARTNER_OPERATION_COLLISION');const certs=certificates(p,before);if(s.created)await registry(tx,p);if(p.financial)await cash.prepare(tx,{operationId:p.id,actorId,accountId:'leader',deltaCents:p.deltaCents,date:p.date});guard(op);if(!saved)await tx.set(pp,p);return {p,certs}});
  guard(op);if(initial.accepted)return initial.accepted;const {p,certs}=initial;
  for(const proof of authorizations(p))await adapter.runAtomic(async tx=>{guard(op);const before=await tx.get('entries/'+p.loanId),saved=await tx.get('partnerAuthorizations/'+proof.id);need(p.expectedVersion===0?!before:before?.version===p.expectedVersion,'PARTNER_MASTER_VERSION_OR_STATE_CHANGED');if(saved)need(canonical(clean(saved))===canonical(proof),'SPARK_PARTNER_AUTHORIZATION_COLLISION');guard(op);if(!saved)await tx.set('partnerAuthorizations/'+proof.id,proof)});
  for(const part of certs)await adapter.runAtomic(async tx=>{guard(op);const before=await tx.get('entries/'+p.loanId),saved=await tx.get('partnerCertificates/'+part.id);need(before?.version===p.expectedVersion,'PARTNER_MASTER_VERSION_OR_STATE_CHANGED');if(saved)need(canonical(clean(saved))===canonical(part),'SPARK_PARTNER_CERTIFICATE_COLLISION');guard(op);if(!saved)await tx.set('partnerCertificates/'+part.id,part)});
  const out=await adapter.runAtomic(async tx=>{guard(op);const record=await tx.get(opPath),saved=await tx.get(pp);need(saved&&canonical(clean(saved))===canonical(p),'SPARK_PARTNER_OPERATION_COLLISION');if(record)return accepted(tx,record,p);const before=await tx.get('entries/'+p.loanId),audit=await tx.get('audit/'+p.audit.id),expense=p.expense?await tx.get('expenses/'+p.expense.id):null,cert=certs.length?await tx.get('partnerCertificates/'+certs.at(-1).id):null;
   need(p.expectedVersion===0?!before:before?.version===p.expectedVersion,'PARTNER_MASTER_VERSION_OR_STATE_CHANGED');need(!audit&&!expense,'PARTNER_DESTINATION_EXISTS');if(certs.length)need(cert&&canonical(clean(cert))===canonical(certs.at(-1)),'SPARK_PARTNER_CERTIFICATE_MISSING');need(p.date<=today(),'PARTNER_FUTURE_DATE_NOT_ALLOWED');const index=s.created?await registry(tx,p):null,position=p.financial?await cash.prepare(tx,{operationId:p.id,actorId,accountId:'leader',deltaCents:p.deltaCents,date:p.date}):null;guard(op);
   await tx.set('entries/'+p.loanId,{...p.master,acceptedAt:stamp()});if(p.expense)await tx.set('expenses/'+p.expense.id,{...p.expense,acceptedAt:stamp()});await tx.set('audit/'+p.audit.id,{...p.audit,acceptedAt:stamp()});if(index)await tx.set(index.path,index.data);if(position){if(typeof cash.commit==='function')await cash.commit(tx,position);else await tx.set(position.path,position.data);}
   const value={id:p.id,type:p.type,protocol:PROTOCOL,actorId,status:'APPLIED',proposalId:p.id,certificateId:cert?.id||'',writeCount:2+(p.expense?1:0)+(position?1:0)+(index?1:0),cashAccountId:p.financial?'leader':'',deltaCents:p.deltaCents,appliedAt:stamp()};await tx.set(opPath,value);guard(op);return response(value,p,'APPLIED');
  });guard(op);return out;
 }catch(error){throw Object.assign(error,{noQueue:!['unavailable','deadline-exceeded','network-request-failed'].includes(String(error?.code||'').replace(/^firestore\//,''))})}}
 return {execute};
}
return {PROTOCOL,TYPES,INDEX,cents,naturalKey,canonical,shape,proposal,initialState,scan,certificates,authorizations,createSparkPartnerStore};
});
