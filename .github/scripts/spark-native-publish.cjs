'use strict';
// Protected Spark release coordinator. It never restores financial documents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const PROJECT='mi-cartera-d0d8c',SITE='mi-cartera-pro-v2';
const REQUIRED_FINANCIAL_CONTRACTS=Object.freeze(['PAYMENT','CREDIT_CREATE','INTEREST_RENEWAL','REFINANCE','CASH_MOVEMENT','PARTNER_LOAN_CREATED','PARTNER_INTEREST_PAID','PARTNER_CAPITAL_RETURNED','PARTNER_SETTLED']);
const MANIFEST_PATH='.github/release/spark-native-evidence.json';
const SHA=/^[0-9a-f]{40}$/,SHA256=/^[0-9a-f]{64}$/;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function need(ok,message){if(!ok)throw Error(message);}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function sourceFingerprint(artifacts){return hash(JSON.stringify(Object.entries(artifacts).sort(([a],[b])=>a.localeCompare(b)).map(([role,item])=>({role,path:item.path,sha256:item.sha256}))));}
function safePath(value){return typeof value==='string'&&value.length<300&&!value.includes('\\')&&!value.split('/').some(part=>!part||part==='.'||part==='..')&&!path.isAbsolute(value);}
function validateManifest(m,{approvedSha}={}){
 need(SHA.test(approvedSha||''),'APPROVED_IMMUTABLE_SHA_REQUIRED');
 need(object(m)&&m.schemaVersion===1&&m.projectId===PROJECT&&m.site===SITE&&m.backendMode==='spark-native'&&m.billingEnabled===false,'SPARK_NATIVE_DESTINATION_REQUIRED');
 need(typeof m.build==='string'&&/^v2-[A-Za-z0-9_-]{1,150}$/.test(m.build),'NATIVE_BUILD_REQUIRED');
 need(object(m.artifacts)&&['rules','recoveryRules','nativeBootstrap','nativeModule','nativeConfig','hostingRelease'].every(role=>object(m.artifacts[role])),'NATIVE_APPROVED_ARTIFACTS_REQUIRED');
 for(const [role,item] of Object.entries(m.artifacts)){
  need(/^[A-Za-z][A-Za-z0-9]{1,70}$/.test(role)&&safePath(item.path)&&item.path.startsWith('v2/')&&SHA256.test(item.sha256||''),'NATIVE_ARTIFACT_PATH_OR_HASH_INVALID');
  need(role==='rules'||role==='recoveryRules'?/^v2\/cloud\/[A-Za-z0-9_-]+\.rules$/.test(item.path):/^v2\/(?:app|cloud|core)\/[A-Za-z0-9_./-]+\.(?:js|json|html|css|webmanifest)$/.test(item.path),'NATIVE_ARTIFACT_SCOPE_INVALID');
 }
 need(m.artifacts.rules.path!==m.artifacts.recoveryRules.path&&m.artifacts.nativeBootstrap.path==='v2/app/firebase-bootstrap.js'&&m.artifacts.nativeConfig.path==='v2/app/firebase-v2-template.js'&&m.artifacts.hostingRelease.path==='v2/app/release.json','NATIVE_ARTIFACT_ROLES_INVALID');
 need(SHA256.test(m.sourceSHA256||'')&&m.sourceSHA256===sourceFingerprint(m.artifacts),'NATIVE_SOURCE_FINGERPRINT_MISMATCH');
 const qa=m.qa;
 need(object(qa)&&qa.status==='PASS'&&qa.sourceSHA256===m.sourceSHA256&&qa.stableCompatibility==='PASS'&&qa.rollbackReadOnly==='PASS'&&qa.pcChrome==='PASS'&&qa.androidChrome==='PASS'&&['ISOLATED_AUTOMATED','PHYSICAL_FICTITIOUS'].includes(qa.validationMode),'NATIVE_CURRENT_SOURCE_QA_REQUIRED');
 need(JSON.stringify(qa.requiredFinancialContracts)===JSON.stringify(REQUIRED_FINANCIAL_CONTRACTS)&&Array.isArray(qa.contracts)&&qa.contracts.length===REQUIRED_FINANCIAL_CONTRACTS.length,'ALL_NINE_FINANCIAL_CONTRACTS_REQUIRED');
 for(const [index,type]of REQUIRED_FINANCIAL_CONTRACTS.entries()){const row=qa.contracts[index];need(row?.type===type&&row.status==='PASS'&&row.sourceSHA256===m.artifacts.rules.sha256&&SHA256.test(row.evidenceSHA256||''),'FINANCIAL_CONTRACT_NOT_VERIFIED: '+type);}
 const stable=m.stable;
 need(object(stable)&&SHA.test(stable.sha||'')&&typeof stable.build==='string'&&/^v2-[A-Za-z0-9_-]+$/.test(stable.build)&&hostingVersion(stable.hostingVersion)&&ruleset(stable.rulesetName)&&SHA256.test(stable.rulesSHA256||'')&&SHA256.test(stable.appBackupSHA256||''),'EXACT_STABLE_BACKUP_REQUIRED');
 need(object(m.baseline)&&safePath(m.baseline.proofPath)&&m.baseline.proofPath.startsWith('.github/release/')&&m.baseline.proofPath.endsWith('.json')&&SHA256.test(m.baseline.sha256||''),'DERIVED_BASELINE_ATTESTATION_REQUIRED');
 need(m.recovery?.mode==='READ_ONLY_B2'&&m.recovery.approvedCompatibility===true&&SHA256.test(m.recovery.evidenceSHA256||'')&&typeof m.recovery.allowStableRulesRestore==='boolean','CERTIFIED_READ_ONLY_RECOVERY_REQUIRED');
 return {backendMode:m.backendMode,sourceSHA256:m.sourceSHA256,approvedSha};
}
function hostingVersion(value){return typeof value==='string'&&new RegExp('^(?:projects/'+PROJECT+'/)?sites/'+SITE+'/versions/[A-Za-z0-9_-]+$').test(value);}
function ruleset(value){return typeof value==='string'&&new RegExp('^projects/'+PROJECT+'/rulesets/[A-Za-z0-9_-]+$').test(value);}
function validateSnapshot(s,m){
 need(object(s)&&s.projectId===PROJECT&&s.site===SITE&&s.billingEnabled===false&&s.hostingStatus==='FINALIZED'&&hostingVersion(s.hostingVersion)&&ruleset(s.rulesetName),'EXACT_PRODUCTION_SNAPSHOT_REQUIRED');
 need(Array.isArray(s.rulesFiles)&&s.rulesFiles.length===1&&s.rulesFiles[0].name==='firestore.rules'&&typeof s.rulesFiles[0].content==='string'&&s.rulesFiles[0].content.length>0&&s.rulesSHA256===hash(s.rulesFiles[0].content),'EXACT_RULES_CONTENT_BACKUP_REQUIRED');
 need(s.hostingVersion===m.stable.hostingVersion&&s.rulesetName===m.stable.rulesetName&&s.rulesSHA256===m.stable.rulesSHA256&&s.productionBuild===m.stable.build&&s.stableSha===m.stable.sha,'PRODUCTION_DIFFERS_FROM_APPROVED_STABLE');
 return s;
}
function fileInside(root,relative){need(safePath(relative),'UNSAFE_RELEASE_PATH');const absolute=fs.realpathSync(path.join(root,relative)),base=fs.realpathSync(root);need(absolute.startsWith(base+path.sep),'RELEASE_FILE_ESCAPES_CHECKOUT');return absolute;}
function verifyArtifacts(root,m){
 for(const item of Object.values(m.artifacts))need(hash(fs.readFileSync(fileInside(root,item.path)))===item.sha256,'APPROVED_ARTIFACT_CHANGED: '+item.path);
 need(hash(fs.readFileSync(fileInside(root,m.baseline.proofPath)))===m.baseline.sha256,'BASELINE_ATTESTATION_CHANGED');
 const release=JSON.parse(fs.readFileSync(fileInside(root,m.artifacts.hostingRelease.path),'utf8'));need(release.build===m.build,'NATIVE_RELEASE_BUILD_MISMATCH');
 const config=fs.readFileSync(fileInside(root,m.artifacts.nativeConfig.path),'utf8');
 need((config.match(/backendMode\s*:/g)||[]).length===1&&/backendMode\s*:\s*['"]spark-native['"]/.test(config)&&new RegExp("projectId\\s*:\\s*['\"]"+PROJECT+"['\"]").test(config)&&!/backendBaseUrl|backendAllowedOrigins/.test(config),'NATIVE_STATIC_CONFIGURATION_REQUIRED');
 return true;
}
function validateFence(f,m,approvedSha,publish){need(f?.readOnly===true&&f.approvedSha===approvedSha&&f.projectId===PROJECT&&f.site===SITE,'READ_ONLY_SOURCE_FENCE_REQUIRED');if(publish)need(f.exclusive===true&&f.protectedWorkflow===true&&f.reviewGateVerified===true&&f.publishingEnabled===true,'PROTECTED_NATIVE_PUBLICATION_FENCE_REQUIRED');}
function validatePreflight(p,m){need(p?.ready===true&&p.readOnly===true&&p.baselineVerified===true&&p.compatibilityVerified===true&&p.recoveryVerified===true&&p.sourceSHA256===m.sourceSHA256&&p.rulesSHA256===m.artifacts.rules.sha256&&p.recoveryRulesSHA256===m.artifacts.recoveryRules.sha256,'NATIVE_PREFLIGHT_NOT_READY');}
const METHODS=['fence','snapshot','preflight','persist','assertFence','deployRules','verifyRules','deployHosting','verifyHosting','installRecoveryRules','recoveryDecision','restoreStableRules','restoreHosting','verifyRecovered'];
async function run(adapter,{manifest,publish=false,approvedSha}={}){
 validateManifest(manifest,{approvedSha});need(adapter&&METHODS.every(name=>typeof adapter[name]==='function'),'COMPLETE_REGISTERED_ADAPTER_REQUIRED');
 const fence=await adapter.fence({manifest,publish,approvedSha});validateFence(fence,manifest,approvedSha,publish);
 const snapshot=validateSnapshot(await adapter.snapshot(manifest),manifest);
 await adapter.persist({phase:'SNAPSHOT',approvedSha,sourceSHA256:manifest.sourceSHA256,snapshot});
 const ready=await adapter.preflight(manifest,snapshot,fence);validatePreflight(ready,manifest);
 await adapter.persist({phase:'READY',approvedSha,sourceSHA256:manifest.sourceSHA256,snapshot,ready});
 if(!publish)return {status:'READY',productionWrites:0,financialDataRestored:false};
 await adapter.assertFence(fence,snapshot,'BEFORE_RULES');
 let rulesAttempted=false,hostingAttempted=false;
 try{
  rulesAttempted=true;await adapter.deployRules(manifest,snapshot);
  const active=await adapter.verifyRules(manifest,snapshot);need(ruleset(active?.rulesetName)&&active.sha256===manifest.artifacts.rules.sha256,'NATIVE_RULES_VERIFICATION_FAILED');
  await adapter.persist({phase:'RULES_ACTIVE',approvedSha,snapshot,active});
  await adapter.assertFence(fence,snapshot,'BEFORE_HOSTING');hostingAttempted=true;await adapter.deployHosting(manifest,snapshot);
  const verified=await adapter.verifyHosting(manifest,snapshot);
  need(verified?.readOnly===true&&verified.projectId===PROJECT&&verified.site===SITE&&verified.build===manifest.build&&verified.backendMode==='spark-native'&&verified.rulesSHA256===manifest.artifacts.rules.sha256,'NATIVE_HOSTING_VERIFICATION_FAILED');
  await adapter.persist({phase:'PUBLISHED',approvedSha,sourceSHA256:manifest.sourceSHA256,snapshot,verified});
  return {status:'PUBLISHED',sourceSHA256:manifest.sourceSHA256,build:manifest.build,financialDataRestored:false};
 }catch(error){
  try{
   // Freeze with independently approved rules before changing the served code.
   if(rulesAttempted)await adapter.installRecoveryRules(manifest,snapshot);
   let decision;try{decision=await adapter.recoveryDecision(manifest,snapshot);}catch{decision=null;}
   const restoreStable=manifest.recovery.allowStableRulesRestore===true&&decision?.readOnly===true&&decision.proofVerified===true&&decision.writeFenceConfirmed===true&&decision.financialProtocolActive===false&&decision.stableRulesSafeWithCurrentData===true&&decision.stableRulesRestoreApproved===true&&decision.sourceSHA256===manifest.sourceSHA256;
   if(hostingAttempted)await adapter.restoreHosting(manifest,snapshot);
   if(restoreStable)await adapter.restoreStableRules(manifest,snapshot);
   const mode=restoreStable?'STABLE_RULES':'READ_ONLY_B2',recovered=await adapter.verifyRecovered(manifest,snapshot,mode);
   need(recovered?.readOnly===true&&recovered.hostingVersion===snapshot.hostingVersion&&recovered.rulesSHA256===(restoreStable?snapshot.rulesSHA256:manifest.artifacts.recoveryRules.sha256)&&recovered.financialDataRestored===false&&(restoreStable||recovered.financialWritesBlocked===true),'RECOVERY_STATE_NOT_VERIFIED');
   await adapter.persist({phase:restoreStable?'ROLLED_BACK_STABLE_RULES':'ROLLED_BACK_READ_ONLY',approvedSha,snapshot,recovered,error:error.message});
  }catch(recovery){await adapter.persist({phase:'ROLLBACK_INCOMPLETE',approvedSha,snapshot,error:error.message,recovery:recovery.message});throw Error('ROLLBACK_INCOMPLETE: '+recovery.message,{cause:error});}
  throw error;
 }
}
const registry=new Map();
function registerAdapter(id,factory){need(id==='firebase-spark-native-v1'&&typeof factory==='function'&&!registry.has(id),'ONLY_PINNED_NATIVE_ADAPTER_CAN_BE_REGISTERED');registry.set(id,factory);}
registerAdapter('firebase-spark-native-v1',options=>require('./spark-native-firebase-adapter.cjs').createAdapter(options));
async function createAdapter(id,options){need(registry.has(id),'ADAPTER_NOT_REGISTERED');return registry.get(id)(options);}
module.exports={PROJECT,SITE,REQUIRED_FINANCIAL_CONTRACTS,MANIFEST_PATH,hash,sourceFingerprint,validateManifest,validateSnapshot,verifyArtifacts,fileInside,run,registerAdapter,createAdapter};
if(require.main===module){(async()=>{
 const [mode,rootArg]=process.argv.slice(2);need(['validate','preflight','publish'].includes(mode)&&rootArg,'EXPLICIT_NATIVE_COMMAND_AND_CHECKOUT_REQUIRED');
 const root=fs.realpathSync(rootArg),approvedSha=process.env.APPROVED_SHA;
 const bytes=fs.readFileSync(fileInside(root,MANIFEST_PATH));need(SHA256.test(process.env.V2_NATIVE_EVIDENCE_SHA256||'')&&hash(bytes)===process.env.V2_NATIVE_EVIDENCE_SHA256,'APPROVED_EVIDENCE_MANIFEST_HASH_REQUIRED');
 const manifest=JSON.parse(bytes.toString('utf8'));validateManifest(manifest,{approvedSha});
 need(cp.execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()===approvedSha,'CHECKOUT_DIFFERS_FROM_APPROVED_SHA');
 need(cp.execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim()==='','CANDIDATE_CHECKOUT_NOT_CLEAN');
 require('./publication-control.cjs').assertDestination(JSON.parse(fs.readFileSync(path.join(root,'.firebaserc'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'firebase.v2.json'),'utf8')));
 verifyArtifacts(root,manifest);
 if(mode==='validate'){console.log(JSON.stringify({status:'SOURCE_VALIDATED',productionWrites:0,approvedSha,sourceSHA256:manifest.sourceSHA256}));return;}
 const adapter=await createAdapter('firebase-spark-native-v1',{candidateRoot:root,manifest,approvedSha,env:process.env});
 console.log(JSON.stringify(await run(adapter,{manifest,approvedSha,publish:mode==='publish'})));
})().catch(error=>{console.error(error.message);process.exitCode=1;});}
