'use strict';
// In-memory SDK doubles only: no imports, network requests, Auth users or Firestore writes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/firebase-bootstrap.js'),'utf8');
const API='https://cartera-api.example.invalid',names=['recordV2Installment','recordV2CommissionTerms','settleV2Commission','requestV2CreditAdministrativeReview'];
const publicNames=['recordInstallment','saveCommissionTerms','settleCommission','requestCreditReview'];
const externalNames=[...names,'recordV2FinancialOperation'],externalPublicNames=[...publicNames,'recordFinancialOperation'];
async function boot({pilot={},projectId='mi-cartera-d0d8c',location='https://mi-cartera-pro-v2.example.invalid/app/?backendMode=external&backendBaseUrl=https://untrusted.example.invalid',qa,sdkFromUrl=true}={}){
 const calls={imports:[],initializations:[],functions:[],external:[],requests:[],events:[]};
 const app={name:'fictional-v2-app'},db={name:'fictional-db'},auth={name:'fictional-auth'},functions={app};
 const callable=(kind,name)=>async input=>{calls.requests.push({kind,name,input});return {data:{status:'APPLIED',canonical:true,input}};};
 const fsSdk={getFirestore:()=>db,doc:(...args)=>args,getDoc:async()=>({exists:()=>false}),setDoc(){throw Error('NO_FIRESTORE_WRITES_IN_BOOTSTRAP')},collection(){},getDocs(){},query(){},where(){},runTransaction(){throw Error('NO_FIRESTORE_TRANSACTIONS_IN_BOOTSTRAP')}};
 const appSdk={initializeApp:(cfg,name)=>{calls.initializations.push({cfg,name});return app;}};
 const authSdk={getAuth:()=>auth,onAuthStateChanged(){},signInWithEmailAndPassword(){},signOut(){}};
 const functionsSdk={getFunctions:(received,region)=>{assert.equal(received,app);assert.equal(region,'us-central1');return functions;},httpsCallable:(received,name)=>{assert.equal(received,functions);calls.functions.push(name);return callable('functions',name);}};
 if(sdkFromUrl)functionsSdk.httpsCallableFromURL=(received,url)=>{assert.equal(received,functions);calls.external.push(url);return callable('external',url);};
 const modules={'firebase-app.js':appSdk,'firebase-firestore.js':fsSdk,'firebase-auth.js':authSdk,'firebase-functions.js':functionsSdk};
 const w={MI_CARTERA_V2_FIREBASE_TEMPLATE:Object.freeze({projectId,apiKey:'fictional-public-config',appId:'fictional-app'}),MI_CARTERA_V2_PILOT_CONFIG:Object.freeze(pilot),MI_CARTERA_V2_QA:qa,location:new URL(location),localStorage:{getItem(){throw Error('BACKEND_MUST_NOT_READ_LOCAL_STORAGE')},setItem(){throw Error('BACKEND_MUST_NOT_WRITE_LOCAL_STORAGE')}},dispatchEvent:event=>calls.events.push({type:event.type,detail:event.detail})};
 const sandbox={window:w,URL,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},importSdk:async url=>{calls.imports.push(url);const module=modules[url.split('/').at(-1)];assert.ok(module,url);return module;}};
 await vm.runInNewContext(source.replace(/\bimport\s*\(/g,'importSdk('),sandbox,{filename:'firebase-bootstrap.js'});
 return {w,calls,app,db,auth};
}
const external=changes=>({backendMode:'external',backendBaseUrl:API,backendAllowedOrigins:[API],...changes});
function rejected(h){assert.match(h.w.firebaseV2BootstrapError,/^V2_EXTERNAL_BACKEND_|^V2_BACKEND_MODE_|^V2_EXTERNAL_CALLABLE_/);assert.equal(h.w.firebaseFunctionsV2,undefined);assert.equal(h.w.firestoreV2,undefined);assert.deepEqual(h.calls.functions,[],'never falls back to Functions');assert.deepEqual(h.calls.external,[]);assert.ok(h.calls.events.some(e=>e.type==='mi-cartera-v2-firebase-error'));assert.ok(!h.calls.events.some(e=>e.type==='mi-cartera-v2-firebase-ready'));}
test('default backend retains the four original Firebase Functions and ignores endpoint query/localStorage inputs',async()=>{
 const h=await boot();assert.equal(h.w.firebaseV2BootstrapError,undefined);assert.deepEqual(h.calls.functions,names);assert.deepEqual(h.calls.external,[]);assert.deepEqual(Object.keys(h.w.firebaseFunctionsV2),publicNames);
 assert.equal(h.w.firestoreV2.db,h.db);assert.equal(h.w.firebaseAuthV2.auth,h.auth);assert.ok(h.calls.events.some(e=>e.type==='mi-cartera-v2-firebase-ready'));
});
test('explicit Functions mode retains the original target even if an external URL is present',async()=>{
 const h=await boot({pilot:{backendMode:'functions',backendBaseUrl:'https://untrusted.example.invalid'}});assert.equal(h.w.firebaseV2BootstrapError,undefined);assert.deepEqual(h.calls.functions,names);assert.deepEqual(h.calls.external,[]);
});
test('approved static HTTPS origin selects exactly the four callable URLs and keeps canonical public wrappers',async()=>{
 const h=await boot({pilot:external()});assert.equal(h.w.firebaseV2BootstrapError,undefined);assert.deepEqual(h.calls.external,externalNames.map(name=>API+'/'+name));assert.deepEqual(h.calls.functions,[]);assert.deepEqual(Object.keys(h.w.firebaseFunctionsV2),externalPublicNames);
 for(const [i,key]of externalPublicNames.entries()){const input={operationId:'fictional-'+i,amount:10};const result=await h.w.firebaseFunctionsV2[key](input);assert.equal(result.canonical,true);assert.equal(result.input,input);assert.equal(h.calls.requests[i].name,API+'/'+externalNames[i]);}
 assert.equal(h.w.firestoreV2.db,h.db);assert.equal(h.w.firebaseAuthV2.auth,h.auth);
});
test('a sole trailing root slash is canonicalized without introducing endpoint path prefixes',async()=>{
 const h=await boot({pilot:external({backendBaseUrl:API+'/',backendAllowedOrigins:[API+'/']})});assert.equal(h.w.firebaseV2BootstrapError,undefined);assert.deepEqual(h.calls.external,externalNames.map(name=>API+'/'+name));
});
for(const [label,changes]of [
 ['relative URL',{backendBaseUrl:'/api'}],['protocol-relative URL',{backendBaseUrl:'//cartera-api.example.invalid'}],
 ['HTTP public origin',{backendBaseUrl:'http://cartera-api.example.invalid',backendAllowedOrigins:['http://cartera-api.example.invalid']}],
 ['credentials',{backendBaseUrl:'https://user:secret@cartera-api.example.invalid'}],['path prefix',{backendBaseUrl:API+'/api'}],
 ['query',{backendBaseUrl:API+'?token=fictional'}],['fragment',{backendBaseUrl:API+'#backend'}],
 ['unapproved host',{backendBaseUrl:'https://untrusted.example.invalid'}],['host suffix',{backendBaseUrl:API+'.attacker.example.invalid'}],
 ['unapproved port',{backendBaseUrl:API+':8443'}],['empty allowlist',{backendAllowedOrigins:[]}],['absent allowlist',{backendAllowedOrigins:undefined}],
 ['wildcard allowlist',{backendAllowedOrigins:['*']}],['non-array allowlist',{backendAllowedOrigins:API}],
 ['allowlist path',{backendAllowedOrigins:[API+'/api']}],['non-string endpoint',{backendBaseUrl:{url:API}}],
 ['whitespace endpoint',{backendBaseUrl:' '+API}],['unknown mode',{backendMode:'direct-firestore'}],['empty mode',{backendMode:''}]
])test('external backend fails closed for '+label,async()=>{const h=await boot({pilot:external(changes)});rejected(h);assert.equal(h.calls.initializations.length,0,'invalid configuration fails before Firebase app initialization');});
test('missing httpsCallableFromURL fails closed without silently choosing another transport',async()=>{rejected(await boot({pilot:external(),sdkFromUrl:false}));});
test('the existing isolated-demo marker permits an explicitly approved HTTP 127.0.0.1 backend',async()=>{
 const origin='http://127.0.0.1:18186';const h=await boot({projectId:'demo-mi-cartera-spark',pilot:external({backendBaseUrl:origin,backendAllowedOrigins:[origin]}),qa:Object.freeze({isolated:true,projectId:'demo-mi-cartera-spark'}),location:'http://127.0.0.1:18180/app/'});
 assert.equal(h.w.firebaseV2BootstrapError,undefined);assert.deepEqual(h.calls.external,externalNames.map(name=>origin+'/'+name));assert.deepEqual(h.calls.functions,[]);
});
for(const [label,changes]of [
 ['missing isolation marker',{qa:undefined}],['production project',{projectId:'mi-cartera-d0d8c',qa:{isolated:true,projectId:'mi-cartera-d0d8c'}}],
 ['mismatched marker project',{qa:{isolated:true,projectId:'demo-mi-cartera-v2'}}],['non-exact isolation flag',{qa:{isolated:'true',projectId:'demo-mi-cartera-spark'}}],
 ['remote browser origin',{location:'https://mi-cartera-pro-v2.example.invalid/app/'}],['localhost browser alias',{location:'http://localhost:18180/app/'}],
 ['localhost backend alias',{pilot:external({backendBaseUrl:'http://localhost:18186',backendAllowedOrigins:['http://localhost:18186']})}],
 ['other loopback address',{pilot:external({backendBaseUrl:'http://127.0.0.2:18186',backendAllowedOrigins:['http://127.0.0.2:18186']})}]
])test('HTTP external backend rejects '+label,async()=>{
 const origin='http://127.0.0.1:18186';rejected(await boot({projectId:'demo-mi-cartera-spark',pilot:external({backendBaseUrl:origin,backendAllowedOrigins:[origin]}),qa:{isolated:true,projectId:'demo-mi-cartera-spark'},location:'http://127.0.0.1:18180/app/',...changes}));
});
test('HTTPS loopback is also rejected outside the isolated demo',async()=>{const origin='https://127.0.0.1:18186';rejected(await boot({pilot:external({backendBaseUrl:origin,backendAllowedOrigins:[origin]})}));});
