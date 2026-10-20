'use strict';
// Administrative Firebase adapter: metadata reads, rules releases and V2 Hosting.
// No financial-document write API is exposed, including during recovery.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const C=require('./spark-native-publish.cjs'),control=require('./publication-control.cjs');
const {PROJECT,SITE,hash}=C,ORG='v2-mi-cartera-pilot';
const SHA256=/^[0-9a-f]{64}$/;
function need(ok,message){if(!ok)throw Error(message);}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
function assertProtectedContext(env){
 need(env.GITHUB_ACTIONS==='true'&&env.GITHUB_JOB==='deploy-spark-native'&&env.SPARK_NATIVE_PUBLISHING_ENABLED==='true'&&typeof env.FIREBASE_TOKEN==='string'&&env.FIREBASE_TOKEN.length>0,'PROTECTED_NATIVE_WORKFLOW_AND_CREDENTIAL_REQUIRED');
 control.validateRequest({event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,repository:env.GITHUB_REPOSITORY,sha:env.APPROVED_SHA,approval:env.APPROVAL_REFERENCE,enabled:env.PUBLISHING_ENABLED});
}
function assertLegacyCompatibility(stable,candidate){
 const tail=source=>{need(typeof source==='string','LEGACY_RULE_SOURCE_REQUIRED');const match=/match\s+\/users\/\{uid\}/.exec(source);need(match,'LEGACY_RULES_TAIL_REQUIRED');return source.slice(match.index).replace(/\s+/g,'');};
 need(tail(stable)===tail(candidate),'LEGACY_V1_RULES_CHANGED');
}
function validateBaselineAttestation(proof,manifest,snapshot,{record,now=Date.now()}={}){
 need(proof?.schemaVersion===1&&proof.projectId===PROJECT&&proof.orgId===ORG&&proof.backendMode==='spark-native'&&proof.status==='VERIFIED'&&proof.derivedOnly===true&&proof.originalFinancialRowsUnchanged===true&&proof.writeFenceVerified===true,'VERIFIED_DERIVED_BASELINE_REQUIRED');
 need(proof.sourceSHA256===manifest.sourceSHA256&&proof.rulesSHA256===manifest.artifacts.rules.sha256&&proof.writeFenceRulesSHA256===snapshot.rulesSHA256&&proof.hostingVersion===snapshot.hostingVersion&&proof.rulesetName===snapshot.rulesetName&&SHA256.test(proof.ledgerSnapshotSHA256||''),'BASELINE_SOURCE_OR_LIVE_SNAPSHOT_CHANGED');
 const at=typeof proof.checkedAt==='string'?Date.parse(proof.checkedAt):NaN;
 need(Number.isFinite(at)&&new Date(at).toISOString()===proof.checkedAt&&at<=now&&now-at<=300000,'FRESH_BASELINE_ATTESTATION_REQUIRED');
 need(proof.liveRecordPath==='orgs/'+ORG+'/financialControls/release'&&SHA256.test(proof.liveRecordSHA256||''),'BASELINE_METADATA_PATH_REQUIRED');
 need(record?.protocol==='SPARK_NATIVE_BASELINE'&&record.schemaVersion===1&&record.projectId===PROJECT&&record.orgId===ORG&&record.status==='FROZEN_VERIFIED'&&record.derivedOnly===true&&record.originalFinancialRowsUnchanged===true&&record.writeFenceVerified===true&&record.sourceSHA256===manifest.sourceSHA256&&record.ledgerSnapshotSHA256===proof.ledgerSnapshotSHA256&&record.verifiedAt===proof.checkedAt&&hash(canonical(record))===proof.liveRecordSHA256,'CURRENT_DERIVED_BASELINE_RECORD_NOT_VERIFIED');
 return {verified:true,readOnly:true,originalFinancialRowsUnchanged:true,ledgerSnapshotSHA256:proof.ledgerSnapshotSHA256,checkedAt:proof.checkedAt};
}
function decodeValue(value){
 if('stringValue'in value)return value.stringValue;if('booleanValue'in value)return value.booleanValue;if('nullValue'in value)return null;
 if('integerValue'in value){const n=Number(value.integerValue);need(Number.isSafeInteger(n),'UNSAFE_BASELINE_METADATA_INTEGER');return n;}
 if('doubleValue'in value){need(Number.isFinite(value.doubleValue),'INVALID_BASELINE_METADATA_NUMBER');return value.doubleValue;}
 if('timestampValue'in value)return value.timestampValue;
 if('arrayValue'in value)return (value.arrayValue.values||[]).map(decodeValue);
 if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([key,item])=>[key,decodeValue(item)]));
 throw Error('UNSUPPORTED_BASELINE_METADATA_VALUE');
}
async function createAdapter({candidateRoot,manifest,approvedSha,env=process.env,cliLibRoot,recoveryInspector}={}){
 need(process.versions.node.split('.')[0]==='22','NODE22_ADMINISTRATIVE_RUNTIME_REQUIRED');
 C.validateManifest(manifest,{approvedSha});C.verifyArtifacts(candidateRoot,manifest);
 const lib=cliLibRoot||path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'firebase-tools');
 need(JSON.parse(fs.readFileSync(path.join(lib,'package.json'),'utf8')).version==='15.30.1','PINNED_FIREBASE_CLI_REQUIRED');
 control.assertDestination(JSON.parse(fs.readFileSync(path.join(candidateRoot,'.firebaserc'),'utf8')),JSON.parse(fs.readFileSync(path.join(candidateRoot,'firebase.v2.json'),'utf8')));
 const {Client}=require(path.join(lib,'lib/apiv2')),auth=require(path.join(lib,'lib/auth'));
 const options={project:PROJECT,projectId:PROJECT,nonInteractive:true,...(auth.getProjectDefaultAccount(candidateRoot)||{})};
 await require(path.join(lib,'lib/requireAuth')).requireAuth(options);
 const client=url=>new Client({urlPrefix:url,apiVersion:'v1',auth:true});
 const billing=client('https://cloudbilling.googleapis.com'),crm=client('https://cloudresourcemanager.googleapis.com'),firestore=client('https://firestore.googleapis.com');
 const hosting=require(path.join(lib,'lib/hosting/api')),rules=require(path.join(lib,'lib/gcp/rules'));
 const cli=path.join(lib,'lib/bin/firebase.js'),journal=env.V2_NATIVE_RELEASE_JOURNAL||path.join(env.RUNNER_TEMP||candidateRoot,'v2-native-release-journal.json');
 let canMutate=false,ready=false,activeRuleset=null,recoveryInstalled=false,decision=null;
 const source=role=>fs.readFileSync(C.fileInside(candidateRoot,manifest.artifacts[role].path),'utf8');
 const assertMutation=()=>{assertProtectedContext(env);need(canMutate&&ready,'NATIVE_MUTATION_GATES_NOT_PASSED');};
 async function liveHost(){const channel=await hosting.getChannel(PROJECT,SITE,'live');need(channel?.release?.version?.status==='FINALIZED','FINALIZED_HOSTING_RELEASE_REQUIRED');return channel.release.version.name;}
 async function liveRules(){const releases=await rules.listAllReleases(PROJECT),release=releases.find(row=>row.name==='projects/'+PROJECT+'/releases/cloud.firestore');need(release,'DEFAULT_RULES_RELEASE_REQUIRED');const files=await rules.getRulesetContent(release.rulesetName);need(files.length===1&&files[0].name==='firestore.rules','SINGLE_STABLE_RULE_SOURCE_REQUIRED');return {rulesetName:release.rulesetName,rulesFiles:files,sha256:hash(files[0].content)};}
 async function readPublished(file){const response=await fetch('https://'+SITE+'.web.app/'+file,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});need(response.ok,'PUBLISHED_ASSET_UNAVAILABLE: '+file);return Buffer.from(await response.arrayBuffer());}
 async function productionBuild(){return JSON.parse((await readPublished('app/release.json')).toString('utf8')).build;}
 async function readBaselineRecord(proof){need(proof.liveRecordPath==='orgs/'+ORG+'/financialControls/release','BASELINE_METADATA_PATH_REQUIRED');const resource='/projects/'+PROJECT+'/databases/(default)/documents/'+proof.liveRecordPath;
  const doc=(await firestore.get(resource)).body;need(doc?.fields,'DERIVED_BASELINE_METADATA_MISSING');return Object.fromEntries(Object.entries(doc.fields).map(([key,value])=>[key,decodeValue(value)]));}
 async function baseline(snapshot){const bytes=fs.readFileSync(C.fileInside(candidateRoot,manifest.baseline.proofPath));need(hash(bytes)===manifest.baseline.sha256,'BASELINE_ATTESTATION_CHANGED');const proof=JSON.parse(bytes.toString('utf8'));return validateBaselineAttestation(proof,manifest,snapshot,{record:await readBaselineRecord(proof)});}
 async function verifyPolicy(){await control.checkPolicy?.();if(typeof control.checkPolicy!=='function'){const child=cp.spawnSync(process.execPath,[path.join(__dirname,'publication-control.cjs'),'policy'],{env,stdio:'inherit'});need(child.status===0,'PRODUCTION_REVIEW_POLICY_NOT_VERIFIED');}}
 async function compile(content){const tested=await rules.testRuleset(PROJECT,[{name:'firestore.rules',content}]);need(!(tested.body?.issues||[]).some(issue=>issue.severity==='ERROR'),'NATIVE_RULES_COMPILATION_FAILED');}
 async function releaseRules(content){assertMutation();const name=await rules.createRuleset(PROJECT,[{name:'firestore.rules',content}]);need(typeof name==='string'&&name.startsWith('projects/'+PROJECT+'/rulesets/'),'UNEXPECTED_RULESET_DESTINATION');await rules.updateRelease(PROJECT,name,'cloud.firestore');return name;}
 async function command(args){assertMutation();const permitted=args.length===5&&args[0]==='deploy'&&args[1]==='--only'&&args[2]==='hosting:v2'&&args[3]==='--config'&&args[4]==='firebase.v2.json'||args.length===3&&args[0]==='hosting:clone'&&new RegExp('^'+SITE+'@[A-Za-z0-9_-]+$').test(args[1])&&args[2]===SITE+':live';need(permitted,'ADMINISTRATIVE_COMMAND_OUTSIDE_NATIVE_SCOPE');
  await new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,[cli,...args,'--project',PROJECT,'--non-interactive','--json'],{cwd:candidateRoot,env,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',buffer=>{output+=buffer});child.stderr.resume();child.on('error',()=>reject(Error('FIREBASE_NATIVE_COMMAND_UNAVAILABLE')));child.on('close',code=>{if(code!==0)return reject(Error('FIREBASE_NATIVE_COMMAND_FAILED: '+args[0]));try{need(JSON.parse(output).status==='success','CLI_RESULT_NOT_SUCCESS');resolve();}catch{reject(Error('INVALID_FIREBASE_NATIVE_COMMAND_RESULT'));}});});}
 return {
  async fence({publish}){if(publish){assertProtectedContext(env);await verifyPolicy();canMutate=true;}return {readOnly:true,exclusive:publish,protectedWorkflow:publish,reviewGateVerified:publish,publishingEnabled:publish,approvedSha,projectId:PROJECT,site:SITE};},
  async snapshot(){const info=(await billing.get('/projects/'+PROJECT+'/billingInfo')).body,r=await liveRules();return {projectId:PROJECT,site:SITE,billingEnabled:info.billingEnabled===true,hostingVersion:await liveHost(),hostingStatus:'FINALIZED',productionBuild:await productionBuild(),stableSha:manifest.stable.sha,rulesetName:r.rulesetName,rulesFiles:r.rulesFiles,rulesSHA256:r.sha256,capturedAt:new Date().toISOString()};},
  async preflight(_,snapshot){
   C.verifyArtifacts(candidateRoot,manifest);C.validateSnapshot(snapshot,manifest);
   const granted=(await crm.post('/projects/'+PROJECT+':testIamPermissions',{permissions:['firebasehosting.sites.update','firebaserules.rulesets.create','firebaserules.releases.get','firebaserules.releases.update','datastore.entities.get']})).body.permissions||[];
   need(['firebasehosting.sites.update','firebaserules.rulesets.create','firebaserules.releases.get','firebaserules.releases.update','datastore.entities.get'].every(permission=>granted.includes(permission)),'NATIVE_DEPLOY_OR_RECOVERY_PERMISSIONS_MISSING');
   assertLegacyCompatibility(snapshot.rulesFiles[0].content,source('rules'));assertLegacyCompatibility(snapshot.rulesFiles[0].content,source('recoveryRules'));
   await compile(source('rules'));await compile(source('recoveryRules'));await baseline(snapshot);
   const current=await liveRules();need(current.rulesetName===snapshot.rulesetName&&await liveHost()===snapshot.hostingVersion,'PRODUCTION_CHANGED_DURING_NATIVE_PREFLIGHT');
   ready=true;return {readOnly:true,ready:true,baselineVerified:true,compatibilityVerified:true,recoveryVerified:true,sourceSHA256:manifest.sourceSHA256,rulesSHA256:manifest.artifacts.rules.sha256,recoveryRulesSHA256:manifest.artifacts.recoveryRules.sha256};
  },
  async persist(value){fs.mkdirSync(path.dirname(journal),{recursive:true});const next=journal+'.tmp';fs.writeFileSync(next,JSON.stringify({...value,at:new Date().toISOString(),financialDataRestored:false},null,2));fs.renameSync(next,journal);},
  async assertFence(_,snapshot,phase){assertMutation();await verifyPolicy();C.verifyArtifacts(candidateRoot,manifest);const current=await liveRules();need(await liveHost()===snapshot.hostingVersion&&(phase==='BEFORE_RULES'?current.rulesetName===snapshot.rulesetName:current.sha256===manifest.artifacts.rules.sha256),'NATIVE_SOURCE_OR_LIVE_RELEASE_FENCE_CHANGED');if(phase==='BEFORE_RULES')await baseline(snapshot);},
  async deployRules(){activeRuleset=await releaseRules(source('rules'));},
  async verifyRules(){const current=await liveRules();need(current.rulesetName===activeRuleset&&current.sha256===manifest.artifacts.rules.sha256,'NATIVE_RULE_RELEASE_MISMATCH');return {rulesetName:current.rulesetName,sha256:current.sha256};},
  async deployHosting(){await command(['deploy','--only','hosting:v2','--config','firebase.v2.json']);},
  async verifyHosting(){const current=await liveRules();need(current.sha256===manifest.artifacts.rules.sha256&&await productionBuild()===manifest.build,'PUBLISHED_NATIVE_RELEASE_MISMATCH');for(const [role,item]of Object.entries(manifest.artifacts)){if(role==='rules'||role==='recoveryRules')continue;need(hash(await readPublished(item.path.slice(3)))===item.sha256,'PUBLISHED_NATIVE_ASSET_MISMATCH: '+item.path);}return {readOnly:true,projectId:PROJECT,site:SITE,build:manifest.build,backendMode:'spark-native',rulesSHA256:current.sha256};},
  async installRecoveryRules(){await releaseRules(source('recoveryRules'));const current=await liveRules();need(current.sha256===manifest.artifacts.recoveryRules.sha256,'READ_ONLY_RECOVERY_RULES_NOT_ACTIVE');recoveryInstalled=true;},
  async recoveryDecision(_,snapshot){need(recoveryInstalled,'READ_ONLY_FINANCIAL_FENCE_REQUIRED');decision=typeof recoveryInspector==='function'?await recoveryInspector({manifest,snapshot,readOnly:true}):{readOnly:true,proofVerified:false,writeFenceConfirmed:true,financialProtocolActive:'UNKNOWN',sourceSHA256:manifest.sourceSHA256};return decision;},
  async restoreStableRules(_,snapshot){need(recoveryInstalled&&manifest.recovery.allowStableRulesRestore===true&&decision?.readOnly===true&&decision.proofVerified===true&&decision.writeFenceConfirmed===true&&decision.financialProtocolActive===false&&decision.stableRulesSafeWithCurrentData===true&&decision.stableRulesRestoreApproved===true&&decision.sourceSHA256===manifest.sourceSHA256,'WEAKER_STABLE_RULE_RESTORE_NOT_PROVEN_SAFE');assertMutation();await rules.updateRelease(PROJECT,snapshot.rulesetName,'cloud.firestore');},
  async restoreHosting(_,snapshot){need(recoveryInstalled,'READ_ONLY_FINANCIAL_FENCE_REQUIRED');await command(['hosting:clone',SITE+'@'+snapshot.hostingVersion.split('/').at(-1),SITE+':live']);},
  async verifyRecovered(_,snapshot,mode){const current=await liveRules(),version=await liveHost();need(version===snapshot.hostingVersion&&await productionBuild()===snapshot.productionBuild&&current.sha256===(mode==='STABLE_RULES'?snapshot.rulesSHA256:manifest.artifacts.recoveryRules.sha256),'EXACT_NATIVE_RECOVERY_NOT_VERIFIED');return {readOnly:true,hostingVersion:version,rulesSHA256:current.sha256,financialWritesBlocked:mode!=='STABLE_RULES',financialDataRestored:false};}
 };
}
module.exports={PROJECT,SITE,ORG,canonical,assertProtectedContext,assertLegacyCompatibility,validateBaselineAttestation,decodeValue,createAdapter};
