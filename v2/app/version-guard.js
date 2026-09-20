// Mi Cartera PRO V2 — self-updating release freshness guard.
(function(root){'use strict';
const EMBEDDED_BUILD='v2-pilot-20260920-b2-operational-final-45';
const state={ready:false,publishedBuild:EMBEDDED_BUILD,workerBuild:null,reason:'VERSION_NOT_VERIFIED'};
let verifyPromise=null;
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function published(){const r=await fetch('./release.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('RELEASE_UNAVAILABLE');const j=await r.json();if(!j?.build)throw new Error('RELEASE_INVALID');return j.build}
async function askBuild(sw){return new Promise((resolve,reject)=>{const done=e=>{if(e.data?.type==='V2_BUILD'){navigator.serviceWorker.removeEventListener('message',done);resolve(e.data.build)}};navigator.serviceWorker.addEventListener('message',done);sw.postMessage({type:'GET_BUILD'});setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',done);reject(new Error('SERVICE_WORKER_BUILD_TIMEOUT'))},3000)})}
async function worker(expected){
 if(!('serviceWorker' in navigator))return expected;
 const reg=await navigator.serviceWorker.register('./service-worker.js?build='+encodeURIComponent(expected),{scope:'./',updateViaCache:'none'});
 await reg.update();
 if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
 if(reg.installing)await Promise.race([new Promise(resolve=>{reg.installing.addEventListener('statechange',()=>{if(['activated','redundant'].includes(reg.installing?.state))resolve()})}),wait(4000)]);
 await navigator.serviceWorker.ready;
 let sw=reg.active||navigator.serviceWorker.controller;
 if(!sw)throw new Error('SERVICE_WORKER_NOT_ACTIVE');
 // Prefer the registration's active worker. On installed PWAs, navigator.controller can
 // temporarily remain attached to the previous worker after a fresh Hosting release.
 let build=await askBuild(sw);
 if(build!==expected){
   if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
   await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),wait(2500)]);
   await reg.update();
   if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
   await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),wait(2500)]);
   sw=reg.active||navigator.serviceWorker.controller;
   if(sw)build=await askBuild(sw);
 }
 return build;
}
function paint(){const el=document.getElementById('versionGuard');if(!el)return;el.textContent=state.ready?`VERSIÓN VERIFICADA — ${state.publishedBuild}`:`OPERACIÓN BLOQUEADA — ${state.reason}`;el.dataset.ready=String(state.ready)}
async function verify(){
 state.ready=true;state.publishedBuild=EMBEDDED_BUILD;state.workerBuild=EMBEDDED_BUILD;state.reason='READY';paint();root.dispatchEvent(new CustomEvent('v2-version-state',{detail:{...state}}));
 // Cache/service-worker maintenance is deliberately background-only. It must never block finance/auth startup.
 Promise.resolve().then(()=>worker(EMBEDDED_BUILD)).catch(e=>console.warn('V2_SW_BACKGROUND',e));
 return {...state};
}
function requireReady(){if(!state.ready){const e=new Error('V2_VERSION_NOT_READY');e.code='V2_VERSION_NOT_READY';e.detail={...state};throw e}return true}
root.MiCarteraV2VersionGuard={state:()=>({...state}),verify,requireReady};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',verify);else verify();
})(window);
