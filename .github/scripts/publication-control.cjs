'use strict';
// Administrative release controls only. Never connects to Firebase or handles
// application data. The publisher invokes these gates before exposing a secret.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const STABLE='43a7afa2ab629cdc7b4c7db9856dbd10eae61f71';
const REPOSITORY='arturohoyosdargent/mi-cartera';
const CONTROLLED_REF='refs/heads/reengineering-v2-final';
function requireCondition(value,message){if(!value)throw new Error(message);}
function validateRequest(input){
  requireCondition(input.event==='workflow_dispatch','Only explicit manual dispatch is permitted');
  requireCondition(input.repository===REPOSITORY,'Wrong repository');
  requireCondition(input.ref===CONTROLLED_REF,'Historical, default and tag refs cannot publish');
  requireCondition(typeof input.sha==='string'&&/^[0-9a-f]{40}$/.test(input.sha),'A complete immutable commit SHA is required');
  requireCondition(input.enabled==='true','Publication is administratively closed');
  requireCondition(typeof input.approval==='string'&&input.approval.includes(input.sha)&&input.approval.trim().length>40,'Explicit authorization must identify this exact SHA');
  requireCondition(!/[\x00-\x1f]/.test(input.approval),'Authorization contains control characters');
  return {sha:input.sha,approval:input.approval};
}
function assertEnvironment(policy){
  const rules=policy&&policy.protection_rules;
  requireCondition(Array.isArray(rules)&&rules.some(r=>r.type==='required_reviewers'&&Array.isArray(r.reviewers)&&r.reviewers.length>0),'Production environment must already have required reviewers');
}
function assertDestination(rc,config){
  requireCondition(config&&Object.keys(config).length===1&&config.hosting&&!Array.isArray(config.hosting),'Only isolated Hosting configuration is permitted');
  requireCondition(config.hosting.target==='v2'&&config.hosting.public==='v2','Unexpected Hosting target or public directory');
  const sites=rc&&rc.targets&&rc.targets['mi-cartera-d0d8c']&&rc.targets['mi-cartera-d0d8c'].hosting&&rc.targets['mi-cartera-d0d8c'].hosting.v2;
  requireCondition(Array.isArray(sites)&&sites.length===1&&sites[0]==='mi-cartera-pro-v2','Unexpected Hosting site');
}
function assertSourceHead(approved,actual){requireCondition(approved===actual,'Checkout differs from the approved immutable SHA');}
function assertQaResults(results){requireCondition(results.length>0&&results.every(r=>r.status===0),'QA failed, was interrupted or was not executed');}
function discoverSuites(dir){return fs.readdirSync(dir).filter(f=>f.endsWith('.spec.js')).sort().map(f=>path.join(dir,f));}
function javascriptFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.name==='node_modules'||e.name.startsWith('.')?[]:e.isDirectory()?javascriptFiles(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);}
function runQa(root){
  const suites=discoverSuites(path.join(root,'v2/tests'));
  const results=[];
  requireCondition(suites.length>=61,'Incomplete regression suite');
  for(const file of suites){const run=spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit'});results.push({file,status:run.status});assertQaResults(results);}
  const scripts=javascriptFiles(path.join(root,'v2'));
  for(const file of scripts){const run=spawnSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});results.push({file,status:run.status});assertQaResults(results);}
  console.log(JSON.stringify({suites:suites.length,syntax:scripts.length,result:'PASS'}));
}
async function checkPolicy(){
  requireCondition(process.env.GITHUB_TOKEN,'Read-only GitHub token missing');
  const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/environments/v2-production',{headers:{'Authorization':'Bearer '+process.env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','User-Agent':'Mi-Cartera-V2-Control'}});
  requireCondition(response.ok,'Production review environment is missing or unreadable');
  assertEnvironment(await response.json());
  console.log('Production required-reviewer gate: configured');
}
module.exports={STABLE,validateRequest,assertEnvironment,assertDestination,assertSourceHead,assertQaResults,discoverSuites};
if(require.main===module){
  (async()=>{
    const [command,dir]=process.argv.slice(2);
    if(command==='request')console.log(JSON.stringify(validateRequest({event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,repository:process.env.GITHUB_REPOSITORY,sha:process.env.APPROVED_SHA,approval:process.env.APPROVAL_REFERENCE,enabled:process.env.PUBLISHING_ENABLED})));
    else if(command==='policy')await checkPolicy();
    else if(command==='destination')assertDestination(JSON.parse(fs.readFileSync(path.join(dir,'.firebaserc'),'utf8')),JSON.parse(fs.readFileSync(path.join(dir,'firebase.v2.json'),'utf8')));
    else if(command==='qa')runQa(path.resolve(dir));
    else throw new Error('Unknown administrative control command');
  })().catch(error=>{console.error(error.message);process.exitCode=1;});
}
