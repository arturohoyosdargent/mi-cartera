'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'spark-native-firebase-adapter.cjs');const C=fs.existsSync(file)?require(file):null;
const NOW=Date.parse('2026-10-19T15:00:00.000Z');
function gate(){assert.ok(C,'native Firebase adapter missing');return C;}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function fixture(){
 const manifest={sourceSHA256:'a'.repeat(64),artifacts:{rules:{sha256:'b'.repeat(64)}}};
 const snapshot={hostingVersion:'projects/mi-cartera-d0d8c/sites/mi-cartera-pro-v2/versions/stable',rulesetName:'projects/mi-cartera-d0d8c/rulesets/stable',rulesSHA256:'c'.repeat(64)};
 const checkedAt=new Date(NOW-1000).toISOString();
 const record={protocol:'SPARK_NATIVE_BASELINE',schemaVersion:1,projectId:'mi-cartera-d0d8c',orgId:'v2-mi-cartera-pilot',status:'FROZEN_VERIFIED',derivedOnly:true,originalFinancialRowsUnchanged:true,writeFenceVerified:true,sourceSHA256:manifest.sourceSHA256,ledgerSnapshotSHA256:'d'.repeat(64),verifiedAt:checkedAt};
 const proof={schemaVersion:1,projectId:'mi-cartera-d0d8c',orgId:'v2-mi-cartera-pilot',backendMode:'spark-native',status:'VERIFIED',derivedOnly:true,originalFinancialRowsUnchanged:true,writeFenceVerified:true,sourceSHA256:manifest.sourceSHA256,rulesSHA256:manifest.artifacts.rules.sha256,writeFenceRulesSHA256:snapshot.rulesSHA256,hostingVersion:snapshot.hostingVersion,rulesetName:snapshot.rulesetName,checkedAt,ledgerSnapshotSHA256:'d'.repeat(64),liveRecordPath:'orgs/v2-mi-cartera-pilot/financialControls/release',liveRecordSHA256:hash(canonical(record))};
 return {manifest,snapshot,proof,record};
}
test('a derived baseline is tied to the source, exact live release, write fence and metadata record',()=>{
 const f=fixture();assert.equal(gate().validateBaselineAttestation(f.proof,f.manifest,f.snapshot,{record:f.record,now:NOW}).verified,true);
});
test('missing, stale, changed or financial-row-mutating baseline evidence is rejected before deployment',()=>{
 for(const change of [p=>p.originalFinancialRowsUnchanged=false,p=>p.derivedOnly=false,p=>p.writeFenceVerified=false,p=>p.projectId='other',p=>p.rulesSHA256='f'.repeat(64),p=>p.checkedAt=new Date(NOW-300001).toISOString(),p=>p.liveRecordPath='orgs/v2-mi-cartera-pilot/credits/real-credit',p=>p.liveRecordSHA256='f'.repeat(64)]){
  const f=fixture();change(f.proof);assert.throws(()=>gate().validateBaselineAttestation(f.proof,f.manifest,f.snapshot,{record:f.record,now:NOW}));
 }
 const f=fixture();assert.throws(()=>gate().validateBaselineAttestation(null,f.manifest,f.snapshot,{record:f.record,now:NOW}));
});
test('a supplied JSON attestation cannot replace the matching current metadata record',()=>{
 const f=fixture();assert.throws(()=>gate().validateBaselineAttestation(f.proof,f.manifest,f.snapshot,{now:NOW}));
 f.record.writeFenceVerified=false;assert.throws(()=>gate().validateBaselineAttestation(f.proof,f.manifest,f.snapshot,{record:f.record,now:NOW}));
});
test('native and read-only recovery policies must preserve the actual legacy V1 tail',()=>{
 const stable='rules_version = 2; function helper() {} match /users/{uid} { allow get: if true; }';
 assert.doesNotThrow(()=>gate().assertLegacyCompatibility(stable,'new native match /users/{uid} {allow get: if true;}'));
 assert.throws(()=>gate().assertLegacyCompatibility(stable,'new native match /users/{uid} {allow write: if true;}'));
});
test('production adapter mutation context is unavailable to local CLI or an unreviewed workflow',()=>{
 const valid={GITHUB_ACTIONS:'true',GITHUB_JOB:'deploy-spark-native',GITHUB_REF:'refs/heads/reengineering-v2-final',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'arturohoyosdargent/mi-cartera',APPROVED_SHA:'a'.repeat(40),APPROVAL_REFERENCE:'Autorizacion explicita '+ 'a'.repeat(40),PUBLISHING_ENABLED:'true',SPARK_NATIVE_PUBLISHING_ENABLED:'true',FIREBASE_TOKEN:'fixture-token'};
 assert.doesNotThrow(()=>gate().assertProtectedContext(valid));
 for(const change of [{GITHUB_ACTIONS:undefined},{GITHUB_JOB:'qa'},{SPARK_NATIVE_PUBLISHING_ENABLED:'false'},{FIREBASE_TOKEN:''},{GITHUB_REF:'refs/heads/main'}])assert.throws(()=>gate().assertProtectedContext({...valid,...change}));
});
test('adapter source has no application financial mutator or another deployment platform',()=>{
 assert.ok(fs.existsSync(file));const text=fs.readFileSync(file,'utf8');
 assert.ok(!/v2-coordinated-publish|cloudfunctions\.googleapis|cloudbuild\.googleapis|run\.googleapis|firebase-admin|\.set\(/.test(text));
 assert.ok(text.includes("'hosting:v2'"));assert.ok(text.includes('installRecoveryRules'));
});
