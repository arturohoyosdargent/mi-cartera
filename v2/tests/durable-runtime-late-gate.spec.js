const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('v2/app/durable-actions-stable6.js','utf8');
const document={getElementById:()=>null,addEventListener:()=>{},querySelector:()=>null,body:{appendChild:()=>{}}};
const root={MiCarteraV2Financial:{money:n=>Number(n)||0,STATUS:{ACTIVE:'ACTIVO'}},MiCarteraV2Schedule:{generate:()=>[]},MiCarteraV2AccessAudit:{ROLES:{ADMIN:'ADMIN'},requirePermission:()=>true,event:x=>x},MiCarteraV2AuthCloudGate:{},addEventListener:()=>{}};
root.window=root;root.document=document;root.localStorage={getItem:()=>null,setItem:()=>{}};root.alert=()=>{};root.confirm=()=>false;root.prompt=()=>null;root.Date=Date;root.Math=Math;root.JSON=JSON;
vm.runInNewContext(code,root);
assert.equal(typeof root.MiCarteraV2DurableActions?.renewInterest,'function');
assert.equal(typeof root.MiCarteraV2DurableActions?.refinance,'function');
assert.equal(typeof root.MiCarteraV2DurableActions?.setPromise,'function');
root.MiCarteraV2OperationCommitGate={submit:async()=>({status:'COMMITTED'})};
assert.equal(typeof root.MiCarteraV2DurableActions?.renewInterest,'function');
console.log('durable late commit-gate runtime: PASS');

// Shell must load durable actions as a real parser-blocking script before cards; no document.write loader.
{const shell=fs.readFileSync('v2/app/operational-shell.html','utf8');const d=shell.indexOf('src="durable-actions-stable6.js?v=');const cards=shell.indexOf('src="operational-cards-v2.js?v=');assert(d>0&&cards>d);assert(!/document\.write\([^\n]*durable-actions-v2/.test(shell));assert(shell.includes('v2-pilot-20260924-b2-stable-6'));}
console.log('deterministic durable shell order: PASS');

{const sw=fs.readFileSync('v2/app/service-worker.js','utf8'),shell=fs.readFileSync('v2/app/operational-shell.html','utf8');assert(shell.includes('durable-actions-stable6.js?v=v2-pilot-20260924-b2-stable-6'));assert(sw.includes("'./durable-actions-stable6.js'"));assert(!shell.includes('durable-actions-v2.js?v='));console.log('isolated cache key runtime: PASS');}
