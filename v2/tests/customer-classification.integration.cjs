// Real Firebase SDK against loopback demo emulators ONLY. Never use real users/data.
// Run: node v2/tests/customer-classification.integration.cjs
'use strict';
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const T = require('../core/transaction-store');
const Adapter = require('../cloud/firestore-atomic-adapter');
const S = require('../cloud/operational-sync');
const Audit = require('../core/access-audit');
const {Window} = require('happy-dom');

const project = 'demo-cartera-final';
const org = 'v2-mi-cartera-pilot';
const firestoreHost = 'http://127.0.0.1:8380';
const authHost = 'http://127.0.0.1:9199';
const base = `${firestoreHost}/v1/projects/${project}/databases/(default)/documents/orgs/${org}`;
const runId = `classification-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const evidenceDir = path.resolve(__dirname, '../../../qaMasterSDK/evidencia');
const evidenceFile = path.join(evidenceDir, `${runId}.json`);
const startedAt = new Date().toISOString();
const passes = [];
const apps = [];
const evidence = {runId, project, org, LOCAL_QA_ONLY: true, startedAt,
  endpoints: {firestore: firestoreHost, auth: authHost}, passes,
  fixtures: 'Fictitious records in isolated demo emulator namespace',
  journalScope: 'Isolated fake localStorage only; no real phone or existing journal',
  newPayments: 0, newRenewals: 0, productionWrites: 0, deployments: 0};
let appSdk, sdk;

function writeEvidence() {
  fs.mkdirSync(evidenceDir, {recursive: true});
  fs.writeFileSync(evidenceFile, JSON.stringify({...evidence, passCount: passes.length}, null, 2) + '\n');
}
const watchdog = setTimeout(() => {
  evidence.status = 'FAILED'; evidence.error = 'QA_EMULATOR_TIMEOUT'; writeEvidence();
  console.error('QA_EMULATOR_TIMEOUT', evidenceFile); process.exit(1);
}, 90000);
watchdog.unref();
function localOnly(raw) {
  const u = new URL(typeof raw === 'string' ? raw : raw.url);
  a.equal(project, 'demo-cartera-final', 'LOCAL_QA_ONLY');
  a.ok(u.protocol === 'http:' && u.hostname === '127.0.0.1' && ['8380','9199'].includes(u.port), 'LOCAL_QA_ONLY');
  if (u.port === '8380' && u.pathname.includes('/projects/')) {
    a.ok(u.pathname.includes(`/projects/${project}/`), 'LOCAL_QA_ONLY');
  }
  return u.href;
}
const fetchLocal = global.fetch.bind(global);
global.fetch = (url, options) => { localOnly(url); return fetchLocal(url, options); };
const localWindow = new Window({url: firestoreHost});
global.XMLHttpRequest = class extends localWindow.XMLHttpRequest {
  open(method, url, ...args) { return super.open(method, localOnly(String(url)), ...args); }
};
global.MiCarteraV2Store = T;
const clone = v => JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' :
  v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
async function check(name, fn) { await fn(); passes.push(name); console.log('PASS', name); }
function value(v) {
  if (v === null) return {nullValue: null};
  if (typeof v === 'boolean') return {booleanValue: v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  if (Array.isArray(v)) return {arrayValue: {values: v.map(value)}};
  if (typeof v === 'object') return {mapValue: {fields: fields(v)}};
  return {stringValue: String(v)};
}
const fields = d => Object.fromEntries(Object.entries(d).map(([k,v]) => [k,value(v)]));
async function put(p, d) {
  const url = localOnly(`${base}/${p}`);
  const r = await global.fetch(url, {method:'PATCH', headers:{Authorization:'Bearer owner','Content-Type':'application/json'},
    body: JSON.stringify({fields: fields(d)}), signal: AbortSignal.timeout(10000)});
  a.ok(r.ok, await r.text());
}
const load = n => import(pathToFileURL(path.join(__dirname, `../app/vendor/${n}.js`)).href);
async function cleanup() {
  await Promise.race([Promise.allSettled(apps.map(async ({app,db}) => {
    if (db) await sdk.terminate(db); await appSdk.deleteApp(app);
  })), new Promise(resolve => setTimeout(resolve, 5000))]);
  await localWindow.happyDOM.close();
}
async function main() {
  const authSdk = (await Promise.all(['firebase-app','firebase-auth','firebase-firestore'].map(load))).reduce((auth,mod,index) => {
    if (index === 0) appSdk = mod; if (index === 2) sdk = mod; return index === 1 ? mod : auth;
  }, null);
  a.equal(appSdk.SDK_VERSION, '10.14.1'); evidence.actualSdk = appSdk.SDK_VERSION;
  async function account(label) {
    const app = appSdk.initializeApp({apiKey:'demo-local-only',projectId:project,appId:'demo-local'}, `${label}-${runId}`);
    const entry = {app,db:null}; apps.push(entry);
    const auth = authSdk.initializeAuth(app,{persistence:authSdk.inMemoryPersistence});
    authSdk.connectAuthEmulator(auth, localOnly(authHost), {disableWarnings:true});
    const user = (await authSdk.createUserWithEmailAndPassword(auth,`${label}-${runId}@mi-cartera.invalid`,'QA-Local-Classification-20261003!')).user;
    const db = sdk.initializeFirestore(app,{host:'127.0.0.1:8380',ssl:false,experimentalForceLongPolling:true,useFetchStreams:true});
    entry.db = db; return {app,user,db};
  }
  const mobile = await account('fictitious-mobile-admin');
  const pc = await account('fictitious-pc-admin');
  const stale = await account('fictitious-stale-admin');
  const worker = await account('fictitious-worker');
  const rid = `${runId}-route`, wid = `${runId}-worker`, foreignWid = `${runId}-foreign-worker`;
  const cid = `${runId}-client`, foreignCid = `${runId}-foreign-client`;
  const creditId = `${runId}-existing-credit`, foreignCreditId = `${runId}-existing-foreign-credit`;
  const paymentId = `${runId}-existing-payment`, cashEntryId = `${runId}-existing-entry`, expenseId = `${runId}-existing-expense`;
  for (const session of [mobile,pc,stale]) await put(`members/${session.user.uid}`,{uid:session.user.uid,role:'admin',routeIds:[rid],active:true});
  await put(`members/${worker.user.uid}`,{uid:worker.user.uid,role:'gestor',workerId:wid,routeIds:[rid],active:true});
  await put(`routes/${rid}`,{id:rid,recordType:'ROUTE',name:'Ruta local ficticia',active:true,version:1});
  await put(`routes/${wid}`,{id:wid,recordType:'WORKER',workerId:wid,routeId:rid,authUid:worker.user.uid,name:'Gestor ficticio',active:true,version:1});
  const initialAt = '2026-10-01T12:00:00.000Z';
  const client = {id:cid,name:'Contacto remoto vigente ficticio',phone:'900111222',address:'Domicilio ficticio actual',
    workerId:wid,routeId:rid,capital:650,version:1,portfolioClassification:'AUTO',
    portfolioClassificationReason:'Clasificación automática inicial',portfolioClassificationUpdatedAt:initialAt};
  const foreignClient = {...client,id:foreignCid,workerId:foreignWid,name:'Cliente ajeno ficticio'};
  const credit = {id:creditId,qaRunId:runId,clientId:cid,workerId:wid,routeId:rid,capital:100,total:120,
    principalPaid:20,interestPaid:5,balance:95,status:'ACTIVO',date:'2026-10-01',
    schedule:[{id:'installment-1',amount:120,balance:95,dueDate:'2026-10-03'}],version:1};
  const financial = {
    [`credits/${creditId}`]: credit,
    [`credits/${foreignCreditId}`]: {...credit,id:foreignCreditId,clientId:foreignCid,workerId:foreignWid},
    [`payments/${paymentId}`]: {id:paymentId,qaRunId:runId,creditId,clientId:cid,workerId:wid,routeId:rid,
      userId:worker.user.uid,amount:25,principal:20,interest:5,date:'2026-10-02',cashMovementId:cashEntryId,version:1},
    [`entries/${cashEntryId}`]: {id:cashEntryId,qaRunId:runId,workerId:wid,routeId:rid,cashAccountId:wid,
      type:'INGRESO',concept:'COBRO_CUOTA',ref:paymentId,amount:25,date:'2026-10-02',version:1},
    [`expenses/${expenseId}`]: {id:expenseId,qaRunId:runId,workerId:wid,routeId:rid,cashAccountId:wid,
      type:'EGRESO',concept:'DESEMBOLSO_CREDITO',ref:creditId,amount:100,date:'2026-10-01',version:1},
    [`capital/${runId}-capital`]: {id:`${runId}-capital`,qaRunId:runId,workerId:wid,routeId:rid,amount:100,version:1},
    [`cashClosures/${runId}-closure-1`]: {id:`${runId}-closure-1`,qaRunId:runId,workerId:wid,routeId:rid,
      opening:100,income:25,expenses:100,closing:25,date:'2026-10-02',version:1},
    [`cashClosures/${runId}-closure-2`]: {id:`${runId}-closure-2`,qaRunId:runId,workerId:wid,routeId:rid,
      opening:25,income:0,expenses:0,closing:25,date:'2026-10-03',version:1}
  };
  await put(`clients/${cid}`,client); await put(`clients/${foreignCid}`,foreignClient);
  for (const [p,d] of Object.entries(financial)) await put(p,d);
  const ref = (db,p) => sdk.doc(db,'orgs',org,...p.split('/'));
  const read = async (db,p) => (await sdk.getDocFromServer(ref(db,p))).data();
  const readFinancial = async () => Object.fromEntries(await Promise.all(Object.keys(financial).map(async p => [p,await read(pc.db,p)])));
  const financialBefore = await readFinancial(), financialBeforeBytes = canonical(financialBefore);
  a.equal(financialBeforeBytes,canonical(financial));
  const staleClient = await read(stale.db,`clients/${cid}`);
  const makeSync = session => S.createOperationalSync({store:T.createStore(Adapter.createFirestoreAtomicAdapter({
    db:session.db,doc:sdk.doc,runTransaction:sdk.runTransaction,orgId:org})),actorId:session.user.uid});
  const mobileSync = makeSync(mobile), staleSync = makeSync(stale), workerSync = makeSync(worker);
  function input(session,label,classification,before,version) {
    const operationId = `${runId}-${label}`, at = new Date().toISOString(), reason = classification === 'AUTO' ? '' : `Caso ficticio ${classification}`;
    return {operationId,type:'CLIENT_CLASSIFICATION_UPDATED',metadataOnly:true,createdAt:at,
      metadataBefore:{[`clients/${cid}`]:{portfolioClassification:before}},
      entities:[{collection:'clients',kind:'set',data:{...client,name:'Contacto obsoleto ficticio',phone:'000000000',
        address:'Dirección obsoleta ficticia',capital:0,total:0,payments:[],cashEntries:[],credits:[{...credit,principalPaid:0,balance:120}],
        version,portfolioClassification:classification,portfolioClassificationReason:reason,portfolioClassificationUpdatedAt:at}}],
      audit:Audit.event({id:`${operationId}-audit`,at,actorId:session.user.uid,role:'admin',action:'CLIENT_CLASSIFICATION_UPDATED',
        entityType:'CLIENT',entityId:cid,operationId,detail:{clientId:cid,classification,reason,at}})};
  }
  const first = input(mobile,'mobile-incobrable','INCOBRABLE','AUTO',2);
  await check('metadata payload strips obsolete contact and financial snapshot',async()=>{
    const op = mobileSync.operation(first); a.equal(T.isMetadataOperation(op),true);
    a.deepEqual(op.writes.map(w=>w.path),[`clients/${cid}`,`audit/${first.audit.id}`]);
    a.deepEqual(Object.keys(op.writes[0].data).sort(),T.metadataFields(first.type,'clients').slice().sort());
  });
  // Exercise journal preservation in a fake namespace. Six pending operations are
  // deliberately never replayed. Direct SDK protocol tests below use no real queue.
  const journalKey = 'local-qa-classification-six', closureKey = 'local-qa-classification-two';
  const protectedRows = Array.from({length:6},(_,i)=>({id:`protected-fictitious-${i}`,status:'PENDIENTE',payload:{amount:10+i}}));
  const protectedClosures = [{id:'protected-fictitious-closure-1'},{id:'protected-fictitious-closure-2'}];
  localWindow.localStorage.setItem(journalKey,JSON.stringify(protectedRows));
  localWindow.localStorage.setItem(closureKey,JSON.stringify(protectedClosures));
  const journalBefore = localWindow.localStorage.getItem(journalKey), closuresBefore = localWindow.localStorage.getItem(closureKey);
  const queue = {inspect:()=>JSON.parse(localWindow.localStorage.getItem(journalKey)),
    enqueue:async op=>localWindow.localStorage.setItem(journalKey,JSON.stringify([...queue.inspect(),{id:op.id,status:'PENDIENTE',operation:clone(op)}])),
    flush:async()=>{throw Error('LOCAL_QA_PROTECTED_JOURNAL_MUST_NOT_FLUSH')}};
  const journalSync = S.createOperationalSync({store:{execute:()=>{throw Error('LOCAL_QA_PROTECTED_JOURNAL_MUST_NOT_SEND')}},queue,actorId:mobile.user.uid});
  await check('six fake pending journal entries and two closures remain byte identical',async()=>{
    a.equal((await journalSync.submit(first)).status,'QUEUED');
    a.equal(JSON.stringify(queue.inspect().slice(0,6)),journalBefore);
    a.equal(localWindow.localStorage.getItem(closureKey),closuresBefore);
    a.equal(queue.inspect().length,7); a.deepEqual(await read(pc.db,`clients/${cid}`),client);
  });
  await check('mobile admin classification applies via real SDK atomic transaction',async()=>a.equal((await mobileSync.submit(first)).status,'APPLIED'));
  let afterFirst;
  await check('independent PC reads same classification reason timestamp and admin audit from Cloud',async()=>{
    afterFirst = await read(pc.db,`clients/${cid}`);
    for (const k of ['portfolioClassification','portfolioClassificationReason','portfolioClassificationUpdatedAt']) a.equal(afterFirst[k],first.entities[0].data[k]);
    a.equal(afterFirst.version,2); a.deepEqual(await read(pc.db,`audit/${first.audit.id}`),
      {...first.audit,version:1,updatedAt:afterFirst.updatedAt});
    a.equal((await read(pc.db,`operations/${first.operationId}`)).writeCount,2);
  });
  await check('current remote contact and client financial value survive obsolete mobile snapshot',async()=>{
    for (const k of ['name','phone','address','workerId','routeId','capital']) a.deepEqual(afterFirst[k],client[k]);
    for (const k of ['payments','cashEntries','credits','total']) a.equal(k in afterFirst,false);
  });
  await check('same operation ID is idempotent and independent PC observes no mutation',async()=>{
    a.equal((await mobileSync.submit(first)).status,'ALREADY_APPLIED');
    a.deepEqual(await read(pc.db,`clients/${cid}`),afterFirst);
  });
  const staleInput = input(stale,'stale-no-localizado','NO_LOCALIZADO',staleClient.portfolioClassification,staleClient.version+1);
  await check('separate stale admin session receives VERSION_CONFLICT without partial writes',async()=>{
    await a.rejects(staleSync.submit(staleInput),/VERSION_CONFLICT/);
    a.deepEqual(await read(pc.db,`clients/${cid}`),afterFirst);
    a.equal(await read(pc.db,`audit/${staleInput.audit.id}`),undefined);
    a.equal(await read(pc.db,`operations/${staleInput.operationId}`),undefined);
  });
  const workerInput = input(worker,'worker-forged-admin','NO_LOCALIZADO','INCOBRABLE',3);
  const denied = fn => a.rejects(fn,e=>e.code==='permission-denied');
  await check('worker SDK cannot forge admin classification protocol on own client',async()=>{
    await denied(()=>workerSync.submit(workerInput));
    a.deepEqual(await read(pc.db,`clients/${cid}`),afterFirst);
    a.equal(await read(pc.db,`audit/${workerInput.audit.id}`),undefined);
    a.equal(await read(pc.db,`operations/${workerInput.operationId}`),undefined);
  });
  const flags = {portfolioClassification:'NO_LOCALIZADO',portfolioClassificationReason:'Intento gestor ficticio',portfolioClassificationUpdatedAt:new Date().toISOString()};
  for (const [field,v] of Object.entries(flags)) {
    await check(`worker SDK cannot create own client containing ${field}`,async()=>{
      const id = `${runId}-denied-create-${field}`;
      await denied(()=>sdk.setDoc(ref(worker.db,`clients/${id}`),{id,name:'Cliente ficticio denegado',workerId:wid,routeId:rid,version:1,[field]:v}));
      a.equal(await read(pc.db,`clients/${id}`),undefined);
    });
    await check(`worker SDK cannot update own client ${field}`,async()=>await denied(()=>sdk.updateDoc(ref(worker.db,`clients/${cid}`),{[field]:v})));
    await check(`worker SDK cannot delete own client ${field}`,async()=>await denied(()=>sdk.updateDoc(ref(worker.db,`clients/${cid}`),{[field]:sdk.deleteField()})));
  }
  await check('worker SDK can edit own contact while all classification fields stay intact',async()=>{
    await sdk.updateDoc(ref(worker.db,`clients/${cid}`),{phone:'900333444'});
    const current = await read(pc.db,`clients/${cid}`); a.equal(current.phone,'900333444');
    for (const field of Object.keys(flags)) a.equal(current[field],afterFirst[field]);
  });
  await check('worker SDK cannot read or edit foreign contact',async()=>{
    await denied(()=>read(worker.db,`clients/${foreignCid}`));
    await denied(()=>sdk.updateDoc(ref(worker.db,`clients/${foreignCid}`),{phone:'900999888'}));
    a.deepEqual(await read(pc.db,`clients/${foreignCid}`),foreignClient);
  });
  await check('worker SDK cannot read or edit another worker loan',async()=>{
    await denied(()=>read(worker.db,`credits/${foreignCreditId}`));
    await denied(()=>sdk.updateDoc(ref(worker.db,`credits/${foreignCreditId}`),{principalPaid:999}));
  });
  const second = input(mobile,'mobile-no-localizado','NO_LOCALIZADO','INCOBRABLE',3);
  await check('mobile admin can set NO_LOCALIZADO and independent PC reads it',async()=>{
    a.equal((await mobileSync.submit(second)).status,'APPLIED');
    const current = await read(pc.db,`clients/${cid}`); a.equal(current.portfolioClassification,'NO_LOCALIZADO');
    a.equal(current.phone,'900333444'); a.equal(current.version,3);
  });
  const third = input(mobile,'mobile-auto','AUTO','NO_LOCALIZADO',4);
  await check('mobile admin can restore AUTO and independent PC reads it',async()=>{
    a.equal((await mobileSync.submit(third)).status,'APPLIED');
    const current = await read(pc.db,`clients/${cid}`); a.equal(current.portfolioClassification,'AUTO');
    a.equal(current.portfolioClassificationReason,''); a.equal(current.phone,'900333444'); a.equal(current.version,4);
  });
  const financialAfter = await readFinancial(), financialAfterBytes = canonical(financialAfter);
  await check('existing credits payment cash capital and two remote closures remain byte identical',async()=>{
    a.equal(financialAfterBytes,financialBeforeBytes);
    a.equal(hash(financialAfterBytes),hash(financialBeforeBytes));
  });
  await check('no new fictitious payment or credit was created by classification',async()=>{
    for (const [collection,count] of [['payments',1],['credits',2]]) {
      const snapshot = await sdk.getDocsFromServer(sdk.query(sdk.collection(pc.db,'orgs',org,collection),sdk.where('qaRunId','==',runId)));
      a.equal(snapshot.size,count);
    }
  });
  await check('six fake journal entries and two fake closures remain intact after all SDK operations',async()=>{
    a.equal(JSON.stringify(queue.inspect().slice(0,6)),journalBefore);
    a.equal(localWindow.localStorage.getItem(closureKey),closuresBefore);
  });
  evidence.financialProof = {serialization:'Sorted canonical JSON; no fields omitted',
    paths:Object.keys(financial),beforeSha256:hash(financialBeforeBytes),afterSha256:hash(financialAfterBytes),
    byteLength:Buffer.byteLength(financialBeforeBytes),before:financialBefore,after:financialAfter,identical:true};
  evidence.fakeJournalProof = {protectedEntries:6,protectedClosures:2,addedClassificationEntry:1,
    journalBeforeSha256:hash(journalBefore),journalProtectedAfterSha256:hash(JSON.stringify(queue.inspect().slice(0,6))),
    closuresBeforeSha256:hash(closuresBefore),closuresAfterSha256:hash(localWindow.localStorage.getItem(closureKey)),
    originalEntriesAndClosuresIdentical:true,realPhoneAccessed:false};
  evidence.operationIds = {applied:[first.operationId,second.operationId,third.operationId],staleRejected:staleInput.operationId,workerRejected:workerInput.operationId};
  evidence.status = 'PASSED'; evidence.completedAt = new Date().toISOString();
}
main().then(async()=>{
  await cleanup(); clearTimeout(watchdog); writeEvidence();
  console.log(JSON.stringify({status:evidence.status,passCount:passes.length,actualSdk:evidence.actualSdk,
    LOCAL_QA_ONLY:true,project,evidenceFile,newPayments:0,newRenewals:0,productionWrites:0})); process.exit(0);
}).catch(async error=>{
  evidence.status='FAILED'; evidence.error={code:error.code||null,message:error.message,stack:error.stack};
  await cleanup().catch(()=>{}); clearTimeout(watchdog); writeEvidence();
  console.error('CLASSIFICATION_EMULATOR_FAILED',error.code||error.message,evidenceFile,error.stack); process.exit(1);
});
