const fs=require('fs'),path=require('path'),vm=require('vm');
const {Window}=require('happy-dom');
const ROOT=path.resolve(process.env.SOURCE||'v2');
const KEY='mi-cartera-v2-validation-state';
async function boot({fullShell=false,state}={}){const html=fs.readFileSync(path.join(ROOT,'app/operational-shell.html'),'utf8');const w=new Window({url:'https://local.test/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});w.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));
const alerts=[],commits=[],remote=new Map(),drawn=[];w.alert=x=>alerts.push(String(x));w.confirm=()=>true;w.prompt=()=>null;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
if(fullShell){
  // Happy DOM has no graphics backend. Keep the real renderer and replace only
  // its canvas boundary; visual geometry is checked separately in the browser.
  w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({fillText:text=>drawn.push(String(text)),measureText:text=>({width:String(text).length*8})},{get:(target,key)=>key in target?target[key]:(()=>{})});};
  w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['fictional-png-boundary'],{type:'image/png'}));};
}
const c=vm.createContext(w);const load=f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
for(const f of ['core/financial-engine.js','core/schedule-engine.js','core/access-audit.js','app/date-utils-v2.js'])load(f);
w.MiCarteraV2VersionGuard={requireReady(){},ensureReady:async()=>true,state:()=>({ready:true})};w.MiCarteraV2AuthCloudGate={requireReady:()=>({uid:'test-admin',role:'admin'}),state:()=>({uid:'test-admin',role:'admin',ready:true})};
w.MiCarteraV2SyncBridge={status:()=>({configured:true,online:true}),submit:async op=>{commits.push(op);return {status:'COMMITTED'}}};
w.localStorage.setItem(KEY,JSON.stringify(state||{clients:[{id:'c1',name:'Cliente Prueba',phone:'999111222',address:'Direccion',reference:'Referencia',routeId:'r1'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}}));
w.show=id=>{w.document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id))};
if(fullShell){
  // Load the actual shell order; only external Cloud/Auth/network boundaries are fictional.
  const excluded=new Set(['operation-sync-bridge.js','pilot-config.js','firebase-v2-template.js','firebase-bootstrap.js','version-guard.js','auth-cloud-gate.js','cloud-rehydration-v2.js','login-v2.js']);
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=match[1].match(/src="([^"]+)"/)?.[1];
    if(src){if(!excluded.has(src)&&!src.startsWith('./cloud/'))load('app/'+src.replace(/^\.\//,''));}
    else if(!match[2].includes('serviceWorker'))vm.runInContext(match[2],c);
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
}else for(const f of ['app/operation-commit-gate.js','app/operational-controller.js','app/durable-actions-v2.js','app/cash-menu-v2.js'])load(f);
w.MiCarteraV2DurableActions.install();w.MiCarteraV2CashMenu.install();
return {w,load,alerts,commits,drawn,get:()=>JSON.parse(w.localStorage.getItem(KEY)),set:d=>w.localStorage.setItem(KEY,JSON.stringify(d)),close:()=>w.happyDOM.abort()};}
module.exports={boot,KEY};
