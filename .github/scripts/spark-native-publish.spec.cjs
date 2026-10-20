'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const moduleFile=path.join(__dirname,'spark-native-publish.cjs');
const C=fs.existsSync(moduleFile)?require(moduleFile):null;
const SHA='a'.repeat(40),PROJECT='mi-cartera-d0d8c',SITE='mi-cartera-pro-v2';
const CONTRACTS=['PAYMENT','CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE','CASH_MOVEMENT','PARTNER_LOAN_CREATED','PARTNER_INTEREST_PAID','PARTNER_CAPITAL_RETURNED','PARTNER_SETTLED'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function manifest(){
 const artifacts={rules:{path:'v2/cloud/firestore-spark-native.rules',sha256:'1'.repeat(64)},recoveryRules:{path:'v2/cloud/firestore-spark-native-recovery.rules',sha256:'2'.repeat(64)},nativeBootstrap:{path:'v2/app/firebase-bootstrap.js',sha256:'3'.repeat(64)},nativeModule:{path:'v2/cloud/spark-native-payment.js',sha256:'4'.repeat(64)},hostingRelease:{path:'v2/app/release.json',sha256:'5'.repeat(64)},nativeConfig:{path:'v2/app/firebase-v2-template.js',sha256:'a'.repeat(64)}};
 const sourceSHA256=hash(JSON.stringify(Object.entries(artifacts).sort(([a],[b])=>a.localeCompare(b)).map(([role,item])=>({role,...item}))));
 return {schemaVersion:1,projectId:PROJECT,site:SITE,backendMode:'spark-native',billingEnabled:false,build:'v2-pilot-20261019-b3-spark-native-1',sourceSHA256,artifacts,
  stable:{sha:'7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5',build:'v2-pilot-20261013-b2-operations-integrity-2',hostingVersion:'projects/'+PROJECT+'/sites/'+SITE+'/versions/stable',rulesetName:'projects/'+PROJECT+'/rulesets/stable',rulesSHA256:hash('stable rules'),appBackupSHA256:'6'.repeat(64)},
  qa:{status:'PASS',sourceSHA256,requiredFinancialContracts:[...CONTRACTS],contracts:CONTRACTS.map(type=>({type,status:'PASS',sourceSHA256:artifacts.rules.sha256,evidenceSHA256:'7'.repeat(64)})),stableCompatibility:'PASS',rollbackReadOnly:'PASS',pcChrome:'PASS',androidChrome:'PASS',validationMode:'ISOLATED_AUTOMATED'},
  baseline:{proofPath:'.github/release/spark-native-baseline.json',sha256:'8'.repeat(64)},
  recovery:{mode:'READ_ONLY_B2',approvedCompatibility:true,evidenceSHA256:'9'.repeat(64),allowStableRulesRestore:false}};
}
function snapshot(){return {projectId:PROJECT,site:SITE,billingEnabled:false,hostingVersion:'projects/'+PROJECT+'/sites/'+SITE+'/versions/stable',hostingStatus:'FINALIZED',productionBuild:'v2-pilot-20261013-b2-operations-integrity-2',stableSha:'7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5',rulesetName:'projects/'+PROJECT+'/rulesets/stable',rulesFiles:[{name:'firestore.rules',content:'stable rules'}],rulesSHA256:hash('stable rules')};}
function gate(){assert.ok(C,'Spark-native publisher missing');return C;}
function adapter({failAt,active=true,stableApproved=false}={}){
 const calls=[],m=manifest(),s=snapshot(),record=name=>{calls.push(name);if(failAt===name)throw Error(name+'_FAILED');};
 return {calls,async fence(){record('fence');return {readOnly:true,exclusive:true,protectedWorkflow:true,reviewGateVerified:true,publishingEnabled:true,approvedSha:SHA,projectId:PROJECT,site:SITE}},
  async snapshot(){record('snapshot');return structuredClone(s)},
  async preflight(){record('preflight');return {readOnly:true,ready:true,baselineVerified:true,compatibilityVerified:true,recoveryVerified:true,sourceSHA256:m.sourceSHA256,rulesSHA256:m.artifacts.rules.sha256,recoveryRulesSHA256:m.artifacts.recoveryRules.sha256}},
  async persist(value){calls.push('persist:'+value.phase)},async assertFence(){record('assertFence')},
  async deployRules(){record('deployRules')},async verifyRules(){record('verifyRules');return {rulesetName:'projects/'+PROJECT+'/rulesets/native',sha256:m.artifacts.rules.sha256}},
  async deployHosting(){record('deployHosting')},async verifyHosting(){record('verifyHosting');return {readOnly:true,projectId:PROJECT,site:SITE,build:m.build,backendMode:'spark-native',rulesSHA256:m.artifacts.rules.sha256}},
  async installRecoveryRules(){record('installRecoveryRules')},
  async recoveryDecision(){record('recoveryDecision');return {readOnly:true,proofVerified:true,writeFenceConfirmed:true,financialProtocolActive:active,stableRulesSafeWithCurrentData:true,stableRulesRestoreApproved:stableApproved,sourceSHA256:m.sourceSHA256}},
  async restoreStableRules(){record('restoreStableRules')},async restoreHosting(){record('restoreHosting')},
  async verifyRecovered(_,__,mode){record('verifyRecovered');return {readOnly:true,hostingVersion:s.hostingVersion,rulesSHA256:mode==='STABLE_RULES'?s.rulesSHA256:m.artifacts.recoveryRules.sha256,financialWritesBlocked:mode!=='STABLE_RULES',financialDataRestored:false}}};
}
const run=(a,m=manifest(),publish=true)=>gate().run(a,{manifest:m,publish,approvedSha:SHA});

test('all nine current-hash financial contracts and compatible recovery are mandatory',()=>{
 const m=manifest();assert.equal(gate().validateManifest(m,{approvedSha:SHA}).backendMode,'spark-native');
 for(const change of [x=>x.qa.contracts.pop(),x=>x.qa.contracts[0].status='PENDING',x=>x.qa.contracts[0].sourceSHA256='f'.repeat(64),x=>x.qa.stableCompatibility='PENDING',x=>x.baseline=undefined,x=>x.recovery.approvedCompatibility=false]){const bad=structuredClone(m);change(bad);assert.throws(()=>gate().validateManifest(bad,{approvedSha:SHA}));}
});
test('destination, mode, billing and immutable source checks cannot accept another publication route',()=>{
 for(const change of [{projectId:'other'},{site:'other'},{backendMode:'external'},{billingEnabled:true}])assert.throws(()=>gate().validateManifest({...manifest(),...change},{approvedSha:SHA}));
 assert.throws(()=>gate().validateManifest(manifest(),{approvedSha:'main'}));
 const bad=manifest();bad.artifacts.rules.path='functions/index.js';assert.throws(()=>gate().validateManifest(bad,{approvedSha:SHA}));
});
test('the static native Firebase configuration is an indispensable approved artifact',()=>{
 const bad=manifest();delete bad.artifacts.nativeConfig;bad.sourceSHA256=gate().sourceFingerprint(bad.artifacts);bad.qa.sourceSHA256=bad.sourceSHA256;
 assert.throws(()=>gate().validateManifest(bad,{approvedSha:SHA}));
});
test('missing or changed backup prevents every production mutation',async()=>{
 for(const field of ['hostingVersion','rulesetName','rulesFiles','rulesSHA256']){const a=adapter(),original=a.snapshot;a.snapshot=async()=>{const s=await original();delete s[field];return s};await assert.rejects(()=>run(a));assert.ok(!a.calls.includes('deployRules'));}
 const a=adapter(),original=a.snapshot;a.snapshot=async()=>({...await original(),rulesSHA256:'f'.repeat(64)});await assert.rejects(()=>run(a));assert.ok(!a.calls.includes('deployHosting'));
});
test('fence, snapshot and readiness precede mutations; default execution is read only',async()=>{
 const a=adapter();const result=await gate().run(a,{manifest:manifest(),approvedSha:SHA});
 assert.equal(result.status,'READY');assert.equal(result.productionWrites,0);
 assert.deepEqual(a.calls.slice(0,3),['fence','snapshot','persist:SNAPSHOT']);assert.ok(a.calls.includes('preflight'));assert.ok(!a.calls.includes('deployRules'));
});
test('a missing baseline, reviewer gate or stale live fence blocks publication without partial deployment',async()=>{
 for(const mutate of [a=>{a.preflight=async()=>({ready:true})},a=>{a.fence=async()=>({readOnly:true})},a=>{a.assertFence=async()=>{throw Error('PRODUCTION_CHANGED')}}]){const a=adapter();mutate(a);await assert.rejects(()=>run(a));assert.ok(!a.calls.includes('deployRules'));assert.ok(!a.calls.includes('deployHosting'));}
});
test('success deploys only rules and Hosting and validates both before publication is acknowledged',async()=>{
 const a=adapter(),result=await run(a);assert.equal(result.status,'PUBLISHED');
 assert.ok(a.calls.indexOf('verifyRules')<a.calls.indexOf('deployHosting'));
 assert.ok(a.calls.indexOf('verifyHosting')<a.calls.indexOf('persist:PUBLISHED'));
 assert.ok(!a.calls.some(x=>/Function|billing|external/i.test(x)));
});
test('failed rules never activates Hosting and recovers through the certified read-only policy',async()=>{
 const a=adapter({failAt:'verifyRules'});await assert.rejects(()=>run(a),/verifyRules_FAILED/);
 assert.ok(!a.calls.includes('deployHosting'));assert.ok(a.calls.includes('installRecoveryRules'));
 assert.ok(!a.calls.includes('restoreHosting'));assert.ok(a.calls.includes('persist:ROLLED_BACK_READ_ONLY'));
});
test('Hosting failure freezes financial writes before restoring the exact B2 release',async()=>{
 const a=adapter({failAt:'verifyHosting'});await assert.rejects(()=>run(a));
 assert.ok(a.calls.indexOf('installRecoveryRules')<a.calls.indexOf('restoreHosting'));
 assert.ok(a.calls.indexOf('restoreHosting')<a.calls.indexOf('verifyRecovered'));
 assert.ok(!a.calls.includes('restoreStableRules'));
});
test('weaker stable rules are never restored after a native operation, even with an approval flag',async()=>{
 const a=adapter({failAt:'verifyHosting',active:true,stableApproved:true}),m=manifest();m.recovery.allowStableRulesRestore=true;
 await assert.rejects(()=>run(a,m));assert.ok(!a.calls.includes('restoreStableRules'));
});
test('full stable rules restoration requires explicit compatible approval and a verified inactive protocol after the write fence',async()=>{
 const a=adapter({failAt:'verifyHosting',active:false,stableApproved:true}),m=manifest();m.recovery.allowStableRulesRestore=true;
 await assert.rejects(()=>run(a,m));assert.ok(a.calls.includes('restoreStableRules'));assert.ok(a.calls.includes('persist:ROLLED_BACK_STABLE_RULES'));
});
test('an uncertain protocol or an unverified recovery decision keeps the read-only policy',async()=>{
 const a=adapter({failAt:'verifyHosting'});a.recoveryDecision=async()=>({financialProtocolActive:false});
 const m=manifest();m.recovery.allowStableRulesRestore=true;await assert.rejects(()=>run(a,m));assert.ok(!a.calls.includes('restoreStableRules'));
});
test('failed recovery is reported explicitly and never falls back to financial data restoration',async()=>{
 const a=adapter({failAt:'verifyHosting'});a.installRecoveryRules=async()=>{a.calls.push('installRecoveryRules');throw Error('RECOVERY_FAILED')};
 await assert.rejects(()=>run(a),/ROLLBACK_INCOMPLETE/);assert.ok(a.calls.includes('persist:ROLLBACK_INCOMPLETE'));assert.ok(!a.calls.includes('restoreStableRules'));
});
test('a registered explicit adapter is required and no unregistered transport is selected implicitly',async()=>{
 assert.throws(()=>gate().registerAdapter('external',()=>({})));await assert.rejects(()=>gate().createAdapter('missing',{}),/ADAPTER_NOT_REGISTERED/);
});
test('native workflow stays manual, protected and closed behind both publishing switches',()=>{
 const file=path.join(__dirname,'../workflows/deploy-v2-spark-native.yml');assert.ok(fs.existsSync(file),'native protected workflow missing');
 const text=fs.readFileSync(file,'utf8');for(const required of ['workflow_dispatch:','V2_PUBLISHING_ENABLED','V2_SPARK_NATIVE_PUBLISHING_ENABLED','v2-production','mi-cartera-pro-v2-production','cancel-in-progress: false','spark-native-publish.cjs'])assert.ok(text.includes(required),required);
 assert.ok(!/v2-coordinated-publish|functions:|firebase deploy --only functions|Blaze/.test(text));
});
module.exports={manifest,snapshot};
