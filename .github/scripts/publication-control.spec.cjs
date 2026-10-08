// Breaks caught: unauthorized triggers/refs, symbolic or injected SHA, absent
// production approval gate, wrong Hosting target, and ignored failed QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const controlPath=path.join(__dirname,'publication-control.cjs');
const ready=fs.existsSync(controlPath);
const C=ready?require(controlPath):null;
const SHA='43a7afa2ab629cdc7b4c7db9856dbd10eae61f71';
const valid={event:'workflow_dispatch',ref:'refs/heads/reengineering-v2-final',repository:'arturohoyosdargent/mi-cartera',sha:SHA,approval:'Autorizacion explicita registrada para '+SHA,enabled:'true'};
const gate=()=>{assert.ok(ready,'publication validation gate missing');return C;};
test('manual controlled request accepts the exact approved SHA',()=>{assert.equal(gate().validateRequest(valid).sha,SHA);});
test('push, tags and historical workflow refs cannot authorize publication',()=>{for(const change of [{event:'push'},{event:'pull_request'},{ref:'refs/tags/stable-rollback-v2-20261008-43a7afa'},{ref:'refs/heads/main'},{repository:'other/repo'}])assert.throws(()=>gate().validateRequest({...valid,...change}));});
test('symbolic, shortened and injected revisions are rejected',()=>{for(const sha of ['main','43a7afa',SHA+'\n',SHA+'; echo unsafe',SHA.toUpperCase()])assert.throws(()=>gate().validateRequest({...valid,sha}));});
test('absent publishing switch or explicit authorization blocks production',()=>{for(const change of [{enabled:undefined},{enabled:'false'},{approval:''},{approval:'  '},{approval:'authorization for a different SHA'}])assert.throws(()=>gate().validateRequest({...valid,...change}));});
test('environment must have nonempty required reviewers before production',()=>{for(const policy of [null,{}, {protection_rules:[]},{protection_rules:[{type:'required_reviewers',reviewers:[]}]}])assert.throws(()=>gate().assertEnvironment(policy));assert.doesNotThrow(()=>gate().assertEnvironment({protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:7}}]}]}));});
test('only the isolated V2 Hosting destination is accepted',()=>{const rc={targets:{'mi-cartera-d0d8c':{hosting:{v2:['mi-cartera-pro-v2']}}}};const config={hosting:{target:'v2',public:'v2'}};assert.doesNotThrow(()=>gate().assertDestination(rc,config));for(const bad of [{hosting:{target:'v2',public:'.'}},{hosting:{target:'v1',public:'v2'}},{...config,firestore:{rules:'firestore.rules'}}])assert.throws(()=>gate().assertDestination(rc,bad));assert.throws(()=>gate().assertDestination({targets:{'mi-cartera-d0d8c':{hosting:{v2:['mi-cartera-d0d8c']}}}},config));});
test('a different checkout cannot inherit the approved QA result',()=>{assert.doesNotThrow(()=>gate().assertSourceHead(SHA,SHA));assert.throws(()=>gate().assertSourceHead(SHA,'1ed4f5d7632008a6523b35713e4edfd168e8ac96'));});
test('every failed, interrupted or missing QA result blocks release',()=>{assert.doesNotThrow(()=>gate().assertQaResults([{file:'payments.spec.js',status:0}]));for(const rows of [[],[{file:'payments.spec.js',status:1}],[{file:'payments.spec.js',status:null}]])assert.throws(()=>gate().assertQaResults(rows));});
test('QA discovers all existing suites without selecting a reduced subset',()=>{const suites=gate().discoverSuites(path.resolve(__dirname,'../../v2/tests'));assert.equal(suites.length,61);for(const file of ['app-functional-regression.spec.js','partner-pwa-session-recovery.spec.js','manager-management.spec.js','historical-sharing-recovery.spec.js'])assert.ok(suites.some(x=>path.basename(x)===file),file);});
