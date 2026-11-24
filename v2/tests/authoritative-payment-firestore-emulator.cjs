'use strict';
// Local only. Never auto-starts, connects to Firebase, or deploys rules.
// Run with a disposable loopback emulator and V2_RULES_FILE pointing to candidate or saved deployed source.
// Protocol: https://github.com/firebase/firebase-js-sdk/blob/main/packages/rules-unit-testing/src/impl/rules.ts
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const M=require('./authoritative-payment-rules.matrix.cjs');
const PORT=process.env.V2_EMULATOR_PORT||'18085';assert.ok(['18085','18086'].includes(PORT),'only the two explicitly authorized local emulator ports are allowed');
const HOST='http://127.0.0.1:'+PORT,PROJECT='demo-mi-cartera-v2',DB='projects/'+PROJECT+'/databases/(default)',DOCUMENTS=HOST+'/v1/'+DB+'/documents';
const repository=process.env.V2_REPOSITORY_ROOT||path.resolve(__dirname,'../..'),rulesPath=process.env.V2_RULES_FILE||path.join(repository,'firestore.rules');
function token(uid){const seconds=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+PROJECT,aud:PROJECT,sub:uid,user_id:uid,iat:seconds,exp:seconds+3600,auth_time:seconds,firebase:{sign_in_provider:'custom',identities:{}}})+'.'}
function value(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(value)}};if(typeof v==='object')return {mapValue:{fields:fields(v)}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return {stringValue:String(v)}}
function fields(record){return Object.fromEntries(Object.entries(record).map(([key,v])=>[key,value(v)]))}
function decoded(v){if('mapValue'in v)return data(v.mapValue.fields||{});if('arrayValue'in v)return (v.arrayValue.values||[]).map(decoded);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;return v.stringValue}
function data(record){return Object.fromEntries(Object.entries(record).map(([key,v])=>[key,decoded(v)]))}
async function request(url,{method='GET',body,actor='owner',timeoutMs=15000}={}){
 assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal(new URL(url).port,PORT);assert.ok(url.includes(PROJECT));
 let response;try{response=await fetch(url,{method,signal:AbortSignal.timeout(timeoutMs),headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+(actor==='owner'?'owner':token(actor))}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}catch(error){throw new Error('LOCAL_FIRESTORE_REQUEST_FAILED '+JSON.stringify({method,url,name:error.name,message:error.message,code:error.cause?.code,syscall:error.cause?.syscall,address:error.cause?.address,port:error.cause?.port}),{cause:error})}
 const text=await response.text();let bodyOut;try{bodyOut=JSON.parse(text)}catch{bodyOut=text}return {status:response.status,body:bodyOut};
}
const put=(suffix,record,actor='owner')=>request(DOCUMENTS+'/'+suffix,{method:'PATCH',body:{fields:fields(record)},actor});
const remove=suffix=>request(DOCUMENTS+'/'+suffix,{method:'DELETE'});
async function read(suffix,actor='owner'){const result=await request(DOCUMENTS+'/'+suffix,{actor});return {...result,data:result.status===200?data(result.body.fields||{}):null}}
const docWrite=(suffix,record)=>({update:{name:DB+'/documents/'+suffix,fields:fields(record)}});
const serial=v=>JSON.stringify(v);
async function ensure(result){assert.ok([200,404].includes(result.status),JSON.stringify(result.body));return result}
test.before(async()=>{
 const rules=fs.readFileSync(rulesPath,'utf8');
 const loaded=await request(HOST+'/emulator/v1/projects/'+PROJECT+':securityRules',{method:'PUT',timeoutMs:55000,body:{rules:{files:[{name:'firestore.rules',content:rules}]}},actor:null});assert.equal(loaded.status,200,JSON.stringify(loaded.body));
 for(const [suffix,record]of Object.entries(M.documents))assert.equal((await put(suffix,record)).status,200,suffix);
 console.log(JSON.stringify({projectId:PROJECT,host:HOST,rulesPath,rulesSHA256:createHash('sha256').update(rules).digest('hex'),fixtures:'synthetic-only',productionReads:0,productionWrites:0,matrixCases:M.cases.length}));
});
for(const c of M.cases)test(c.id,async()=>{
 const before=c.beforeDocuments[c.documentPath],extra=Object.entries(c.afterDocuments).filter(([suffix,record])=>suffix!==c.documentPath&&serial(record)!==serial(c.beforeDocuments[suffix]));
 // Reset only named synthetic documents. Never clear the emulator database.
 if(before!==undefined){const prepared=await put(c.documentPath,before);assert.equal(prepared.status,200,JSON.stringify({phase:'owner-fixture-reset',id:c.id,path:c.documentPath,response:prepared}))}else await ensure(await remove(c.documentPath));
 for(const [suffix]of extra)await ensure(await remove(suffix));
 let result;
 if(c.method==='get')result=await read(c.documentPath,c.actor);
 else if(extra.length){
  const writes=[...extra.map(([suffix,record])=>docWrite(suffix,record)),c.method==='delete'?{delete:DB+'/documents/'+c.documentPath}:docWrite(c.documentPath,c.data)];
  result=await request(DOCUMENTS+':commit',{method:'POST',actor:c.actor,body:{writes}});
 }else if(c.method==='delete')result=await request(DOCUMENTS+'/'+c.documentPath,{method:'DELETE',actor:c.actor});
 else result=await put(c.documentPath,c.data,c.actor);
 assert.equal(result.status,c.expectation==='ALLOW'?200:403,JSON.stringify({id:c.id,response:result}));
 if(c.expectation==='DENY'&&c.method!=='get'){
  const after=await read(c.documentPath);
  if(before===undefined)assert.equal(after.status,404,'denied create leaves no document');else assert.deepEqual(after.data,before,'denied update/delete preserves original');
  for(const [suffix]of extra)assert.equal((await read(suffix)).status,404,'denied batch has no partial future write');
 }
});
test('every browser role is denied a complete payment batch with no partial credit/cash/audit/receipt',async()=>{
 for(const role of M.roles){
  const uid=M.actors[role],id=M.ID+'atomic-'+role,paymentId='payment-'+id,entryId='entry-'+id,auditId='audit-'+id,operationId='op-'+id;
  const suffixes=['payments/'+paymentId,'entries/'+entryId,'audit/'+auditId,'operations/'+operationId];
  assert.equal((await put(M.PREFIX+'credits/'+M.CREDIT,M.credit)).status,200);
  for(const suffix of suffixes)await ensure(await remove(M.PREFIX+suffix));
  const next={...M.credit,principalPaid:16.67,interestPaid:3.33,schedule:[{...M.credit.schedule[0],paid:20,balance:100}],version:2};
  const payment={...M.payment,id:paymentId,userId:uid,cashMovementId:entryId};
  const entry={...M.entry,id:entryId,ref:paymentId,userId:uid};
  const records=[[M.PREFIX+'credits/'+M.CREDIT,next],[M.PREFIX+suffixes[0],payment],[M.PREFIX+suffixes[1],entry],[M.PREFIX+suffixes[2],{id:auditId,actorId:uid,action:'PAYMENT_RECORDED',operationId}],[M.PREFIX+suffixes[3],{id:operationId,actorId:uid,type:'PAYMENT',status:'APPLIED'}]];
  const response=await request(DOCUMENTS+':commit',{method:'POST',actor:uid,body:{writes:records.map(([suffix,record])=>docWrite(suffix,record))}});
  assert.equal(response.status,403,role+' browser batch must be denied');assert.deepEqual((await read(M.PREFIX+'credits/'+M.CREDIT)).data,M.credit);
  for(const suffix of suffixes)assert.equal((await read(M.PREFIX+suffix)).status,404,role+' no partial '+suffix);
 }
});
test('queries retain deployed manager, collector and worker read contracts',async()=>{
 assert.equal((await put(M.PREFIX+'payments/'+M.EXISTING_PAYMENT,M.payment)).status,200);
 const query=async(role,collection,field,operand)=>request(DOCUMENTS+'/'+M.PREFIX.slice(0,-1)+':runQuery',{method:'POST',actor:M.actors[role],body:{structuredQuery:{from:[{collectionId:collection}],...(field?{where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:value(operand)}}}:{}),limit:1000}}});
 for(const role of ['admin','supervisor'])assert.equal((await query(role,'payments')).status,200);
 assert.equal((await query('cobrador','payments','userId',M.actors.cobrador)).status,200);
 assert.equal((await query('cobrador','payments')).status,403,'collector cannot query all payments');
 assert.equal((await query('gestor','payments','workerId',M.WORKER)).status,200);
 assert.equal((await query('gestor','payments')).status,403,'worker cannot query unscoped payments');
 assert.equal((await query('cobrador','credits','routeId',M.ROUTE)).status,200);
 assert.equal((await query('gestor','credits','workerId',M.WORKER)).status,200);
});
test('Admin transaction service writes canonical state and exact retry is idempotent for each supported role',async()=>{
 const {createCollectorPaymentService}=require(path.join(repository,'functions/v2-collector-payment'));
 const service=createCollectorPaymentService({businessDate:()=> '2026-11-21',now:()=> '2026-11-21T17:00:00.000Z',runAtomic:firestoreAtomic}); for(const role of ['admin','supervisor','cobrador']){
  assert.equal((await put(M.PREFIX+'credits/'+M.CREDIT,M.credit)).status,200);
  const input={creditId:M.CREDIT,paymentId:M.ID+'server-'+role,operationId:M.ID+'operation-'+role,amount:20,expectedVersion:1,...(role==='cobrador'?{}:{moraAmount:5,moraPaymentId:M.ID+'server-mora-'+role})};
  const destinations=['payments/'+input.paymentId,'entries/entry-'+input.paymentId,'audit/audit-'+input.operationId,'operations/'+input.operationId];
  if(input.moraPaymentId)destinations.push('payments/'+input.moraPaymentId,'entries/entry-'+input.moraPaymentId);
  for(const suffix of destinations)await ensure(await remove(M.PREFIX+suffix));
  const out=await service.execute({uid:M.actors[role]},input);assert.equal(out.status,'APPLIED');
  const storedPayment=await read(M.PREFIX+'payments/'+input.paymentId,M.actors[role]);assert.equal(storedPayment.status,200);assert.equal(storedPayment.data.userId,M.actors[role]);assert.equal(storedPayment.data.workerId,M.WORKER);assert.equal(storedPayment.data.amount,20);
  assert.equal((await read(M.PREFIX+'credits/'+M.CREDIT)).data.principalPaid,16.67);assert.equal((await read(M.PREFIX+'entries/entry-'+input.paymentId)).data.amount,20);
  if(input.moraPaymentId){const mora=await read(M.PREFIX+'payments/'+input.moraPaymentId);assert.equal(mora.data.concept,'MORA');assert.equal(mora.data.amount,5);assert.equal((await read(M.PREFIX+'entries/entry-'+input.moraPaymentId)).data.concept,'COBRO_MORA');assert.equal((await read(M.PREFIX+'credits/'+M.CREDIT)).data.penaltyPaid,0)}
  const before=await read(M.PREFIX+'credits/'+M.CREDIT);assert.equal((await service.execute({uid:M.actors[role]},input)).status,'ALREADY_APPLIED');assert.deepEqual((await read(M.PREFIX+'credits/'+M.CREDIT)).data,before.data);
 }
});

async function firestoreAtomic(fn){
 const begin=await request(DOCUMENTS+':beginTransaction',{method:'POST',body:{options:{readWrite:{}}}});assert.equal(begin.status,200,JSON.stringify(begin.body));const transaction=begin.body.transaction,writes=[];
 try{
  const result=await fn({get:async suffix=>{const response=await request(DOCUMENTS+':batchGet',{method:'POST',body:{documents:[DB+'/documents/'+suffix],transaction}});assert.equal(response.status,200,JSON.stringify(response.body));const row=(Array.isArray(response.body)?response.body:[response.body])[0];return row.found?data(row.found.fields||{}):null},set:async(suffix,record)=>writes.push(docWrite(suffix,record)),create:async(suffix,record)=>writes.push({...docWrite(suffix,record),currentDocument:{exists:false}})});
  const commit=await request(DOCUMENTS+':commit',{method:'POST',body:{transaction,writes}});assert.equal(commit.status,200,JSON.stringify(commit.body));return result;
 }catch(error){await request(DOCUMENTS+':rollback',{method:'POST',body:{transaction}});throw error;}
}

test('interest-only backend renewal commits one credit chain, interest payment and cash; collector and forged amounts fail without writes',async()=>{
 const {createInterestRenewalService}=require(path.join(repository,'functions/v2-interest-renewal'));
 const service=createInterestRenewalService({now:()=> '2026-11-23T17:00:00.000Z',runAtomic:firestoreAtomic});
 for(const role of ['admin','supervisor','cobrador']){
  const key=M.ID+'renew-'+role,old={...M.credit,id:key,rate:20};assert.equal((await put(M.PREFIX+'credits/'+key,old)).status,200);
  const input={creditId:key,newCreditId:key+'-new',paymentId:key+'-interest',entryId:key+'-cash',operationId:key+'-operation',expectedVersion:1,date:'2026-11-23',rate:20,term:2,freq:'weekly',firstPaymentDate:'2026-11-30',restDay:''};
  const targets=['credits/'+input.newCreditId,'payments/'+input.paymentId,'entries/'+input.entryId,'audit/audit-'+input.operationId,'operations/'+input.operationId];for(const suffix of targets)await ensure(await remove(M.PREFIX+suffix));
  if(role==='cobrador'){await assert.rejects(service.execute({uid:M.actors[role]},input),e=>e.code==='permission-denied');assert.deepEqual((await read(M.PREFIX+'credits/'+key)).data,old);for(const suffix of targets)assert.equal((await read(M.PREFIX+suffix)).status,404);continue;}
  await assert.rejects(service.execute({uid:M.actors[role]},{...input,interestAmount:0.01}),e=>e.code==='invalid-argument');assert.deepEqual((await read(M.PREFIX+'credits/'+key)).data,old);
  const out=await service.execute({uid:M.actors[role]},input);assert.equal(out.status,'APPLIED');const result=out.result;
  assert.deepEqual(result.oldCredit.schedule,old.schedule);assert.equal(result.oldCredit.principalPaid,0);assert.equal(result.newCredit.capital,100);assert.equal(result.newCredit.total,120);assert.equal(result.payment.amount,20);assert.equal(result.payment.concept,'INTERES');assert.equal(result.entry.concept,'COBRO_INTERES');
  for(const [collection,row] of [['credits',result.oldCredit],['credits',result.newCredit],['payments',result.payment],['entries',result.entry],['audit',result.audit]])assert.deepEqual((await read(M.PREFIX+collection+'/'+row.id)).data,row);
  assert.equal((await service.execute({uid:M.actors[role]},input)).status,'ALREADY_APPLIED');
 }
});

test('multiple active credits for one client with identical due dates collect independently and sub-cent mora writes nothing',async()=>{
 const {createCollectorPaymentService}=require(path.join(repository,'functions/v2-collector-payment'));
 const service=createCollectorPaymentService({businessDate:()=> '2026-11-23',now:()=> '2026-11-23T17:00:00.000Z',runAtomic:firestoreAtomic});
 for(const number of [1,2]){
  const key=M.ID+'same-client-'+number,credit={...M.credit,id:key};assert.equal((await put(M.PREFIX+'credits/'+key,credit)).status,200);
  const input={creditId:key,paymentId:key+'-payment',operationId:key+'-operation',expectedVersion:1,amount:20};
  for(const suffix of ['payments/'+input.paymentId,'entries/entry-'+input.paymentId,'audit/audit-'+input.operationId,'operations/'+input.operationId])await ensure(await remove(M.PREFIX+suffix));
  await assert.rejects(service.execute({uid:M.actors.admin},{...input,moraAmount:0.001,moraPaymentId:key+'-mora'}),e=>e.code==='invalid-argument');assert.deepEqual((await read(M.PREFIX+'credits/'+key)).data,credit);
  const out=await service.execute({uid:M.actors.cobrador},input);assert.equal(out.status,'APPLIED');assert.equal(out.result.payment.clientId,M.CLIENT);assert.equal(out.result.credit.schedule[0].date,M.credit.schedule[0].date);assert.equal(out.result.credit.schedule[0].balance,100);assert.equal(out.result.credit.version,2);
 }
});
