const fs=require('fs'),path=require('path'),vm=require('vm');
const {Window}=require('happy-dom');
const ROOT=path.resolve(process.env.SOURCE||'v2');
const KEY='mi-cartera-v2-validation-state';
async function boot(){const w=new Window({url:'https://local.test/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});w.document.write(fs.readFileSync(path.join(ROOT,'app/operational-shell.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,''));
const alerts=[],commits=[],remote=new Map();w.alert=x=>alerts.push(String(x));w.confirm=()=>true;w.prompt=()=>null;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
const c=vm.createContext(w);const load=f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
for(const f of ['core/financial-engine.js','core/schedule-engine.js','core/access-audit.js','app/date-utils-v2.js'])load(f);
w.MiCarteraV2VersionGuard={requireReady(){},ensureReady:async()=>true,state:()=>({ready:true})};w.MiCarteraV2AuthCloudGate={requireReady:()=>({uid:'test-admin',role:'admin'}),state:()=>({uid:'test-admin',role:'admin',ready:true})};
w.MiCarteraV2SyncBridge={status:()=>({configured:true,online:true}),submit:async op=>{commits.push(op);return {status:'COMMITTED'}}};
w.localStorage.setItem(KEY,JSON.stringify({clients:[{id:'c1',name:'Cliente Prueba',phone:'999111222',address:'Direccion',reference:'Referencia',routeId:'r1'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}}));
w.show=id=>{w.document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id))};
for(const f of ['app/operation-commit-gate.js','app/operational-controller.js','app/write-actions-stable12.js','app/renewal-actions-stable10.js','app/promise-actions-stable11.js','app/cash-menu-v2.js'])load(f);
w.MiCarteraV2WriteActions.install();w.MiCarteraV2CashMenu.install();
return {w,load,alerts,commits,get:()=>JSON.parse(w.localStorage.getItem(KEY)),set:d=>w.localStorage.setItem(KEY,JSON.stringify(d)),close:()=>w.happyDOM.abort()};}
module.exports={boot,KEY};
