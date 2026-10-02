// Mi Cartera PRO V2 — self-updating release freshness guard.
(function(root){'use strict';
const state={ready:false,publishedBuild:null,workerBuild:null,reason:'VERSION_NOT_VERIFIED'};
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function published(){const r=await fetch('./release.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('RELEASE_UNAVAILABLE');const j=await r.json();if(!j?.build)throw new Error('RELEASE_INVALID');return j.build}
async function askBuild(sw){return new Promise((resolve,reject)=>{const done=e=>{if(e.data?.type==='V2_BUILD'){navigator.serviceWorker.removeEventListener('message',done);resolve(e.data.build)}};navigator.serviceWorker.addEventListener('message',done);sw.postMessage({type:'GET_BUILD'});setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',done);reject(new Error('SERVICE_WORKER_BUILD_TIMEOUT'))},3000)})}
async function worker(expected){
 if(!('serviceWorker' in navigator))throw new Error('SERVICE_WORKER_UNAVAILABLE');
 const installed=await navigator.serviceWorker.getRegistration('./');
 if(installed?.active&&await askBuild(installed.active)===expected){if(navigator.onLine!==false)installed.update().catch(()=>{});return expected;}
 const reg=navigator.onLine===false?await navigator.serviceWorker.getRegistration('./'):await navigator.serviceWorker.register('./service-worker.js?build='+encodeURIComponent(expected),{scope:'./',updateViaCache:'none'});if(!reg)throw new Error('Abre la aplicación con internet una vez antes de trabajar sin conexión.');
 if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
 const installing=reg.installing;
 if(installing)await Promise.race([new Promise(resolve=>{const changed=()=>{if(['activated','redundant'].includes(installing.state))resolve()};installing.addEventListener('statechange',changed);changed()}),wait(20000)]);
 await navigator.serviceWorker.ready;
 let sw=reg.active||navigator.serviceWorker.controller;
 if(!sw)throw new Error('SERVICE_WORKER_NOT_ACTIVE');
 let build=await askBuild(sw);
 if(build!==expected){
   if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
   await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),wait(2500)]);
   sw=reg.active||navigator.serviceWorker.controller;
   if(sw)build=await askBuild(sw);
 }
 return build;
}
function paint(){const el=document.getElementById('versionGuard');if(!el)return;el.textContent=state.ready?`VERSIÓN VERIFICADA — ${state.publishedBuild}`:`OPERACIÓN BLOQUEADA — ${state.reason}`;el.dataset.ready=String(state.ready)}
async function verify(){const wasReady=state.ready;if(!wasReady){state.reason='VERSION_CHECK_RUNNING';paint()}try{state.publishedBuild=await published();state.workerBuild=await worker(state.publishedBuild);if(root.MI_CARTERA_APP_BUILD&&root.MI_CARTERA_APP_BUILD!==state.publishedBuild){const pending=root.MiCarteraV2CloudRehydration?.pending?.()||root.MiCarteraV2OperationCommitGate?.isActionRunning?.(),unsaved=root.MiCarteraV2Refresh?.unsaved?.();if(state.workerBuild===state.publishedBuild&&!pending&&!unsaved)root.location?.reload?.();throw Error('Hay una nueva versión. Cierra y vuelve a abrir la aplicación.');}if(state.publishedBuild!==state.workerBuild)throw new Error(`VERSION_MISMATCH:${state.publishedBuild}:${state.workerBuild}`);state.ready=true;state.reason='READY'}catch(e){state.ready=false;state.reason=String(e?.message||e||'VERSION_CHECK_FAILED')}paint();root.dispatchEvent(new CustomEvent('v2-version-state',{detail:{...state}}));return {...state}}
async function ensureReady(){if(state.ready)return true;const checked=await verify();if(!checked.ready){const e=new Error('V2_VERSION_NOT_READY');e.code='V2_VERSION_NOT_READY';e.detail={...checked};throw e}return true}function requireReady(){if(!state.ready){const e=new Error('V2_VERSION_NOT_READY');e.code='V2_VERSION_NOT_READY';e.detail={...state};throw e}return true}
root.MiCarteraV2VersionGuard={state:()=>({...state}),verify,ensureReady,requireReady};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',verify);else verify();
})(window);
