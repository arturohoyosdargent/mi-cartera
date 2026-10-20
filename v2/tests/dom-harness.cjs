const fs=require('fs'),path=require('path'),vm=require('vm');
const {Window}=require('happy-dom');
const ROOT=path.resolve(process.env.SOURCE||'v2');
const KEY='mi-cartera-v2-validation-state';
async function boot({fullShell=false,state,projectId='demo-mi-cartera-v2',legacyFixture=false}={}){const html=fs.readFileSync(path.join(ROOT,'app/operational-shell.html'),'utf8');const w=new Window({url:'https://local.test/app/operational-shell.html',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});w.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));
const alerts=[],commits=[],remote=new Map(),drawn=[];w.alert=x=>alerts.push(String(x));w.confirm=()=>true;w.prompt=()=>null;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
if(fullShell){
  // Happy DOM has no graphics backend. Keep the real renderer and replace only
  // its canvas boundary; visual geometry is checked separately in the browser.
  w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({fillText:text=>drawn.push(String(text)),measureText:text=>({width:String(text).length*8})},{get:(target,key)=>key in target?target[key]:(()=>{})});};
  w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['fictional-png-boundary'],{type:'image/png'}));};
}
const c=vm.createContext(w);const load=f=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
for(const f of ['core/financial-engine.js','core/schedule-engine.js','core/access-audit.js','app/date-utils-v2.js'])load(f);
w.MiCarteraV2VersionGuard={requireReady(){},ensureReady:async()=>true,state:()=>({ready:true})};
let fixtureAuth={uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};w.MiCarteraV2AuthCloudGate={ORG:'v2-mi-cartera-pilot',requireReady:()=>({...fixtureAuth}),state:()=>({...fixtureAuth})};
w.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId};w.MI_CARTERA_V2_PILOT_CONFIG={orgId:'v2-mi-cartera-pilot'};w.firebaseSdkV2={app:{options:{projectId}}};Object.defineProperty(w.navigator,'locks',{configurable:true,value:{request:async(_name,_options,callback)=>callback()}});
// Fictional authenticated identity boundaries, matching the local fixture owner.
w.firebaseAuthV2={auth:{currentUser:{uid:'test-admin'}}};w.localStorage.setItem('mi-cartera-v2-local-owner','test-admin');
w.MiCarteraV2SyncBridge={status:()=>({configured:true,online:true,pending:0}),submit:async op=>{commits.push(op);return {status:'COMMITTED'}}};
w.localStorage.setItem(KEY,JSON.stringify(state||{clients:[{id:'c1',name:'Cliente Prueba',phone:'999111222',address:'Direccion',reference:'Referencia',routeId:'r1'}],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:'test-admin',role:'ADMIN'}}));
const seeded=w.localStorage.getItem(KEY);
if(!legacyFixture){const scope={projectId,orgId:'v2-mi-cartera-pilot',uid:'test-admin'},key='mi-cartera-v2-scoped-state:'+encodeURIComponent(JSON.stringify([projectId,scope.orgId,scope.uid]));w.localStorage.setItem(key,JSON.stringify({version:1,scope,owner:'test-admin',raw:seeded,confirmed:true}));}
w.show=id=>{w.document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id))};
if(fullShell){
  // Load the actual shell order; only external Cloud/Auth/network boundaries are fictional.
  const excluded=new Set(['operation-sync-bridge.js','pilot-config.js','firebase-v2-template.js','firebase-bootstrap.js','version-guard.js','auth-cloud-gate.js','cloud-rehydration-v2.js','login-v2.js']);
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=match[1].match(/src="([^"]+)"/)?.[1];
    if(src){if(!excluded.has(src)&&!src.startsWith('./cloud/')){load('app/'+(src.startsWith('./')?src.slice(2):src));if(src==='session-storage-v2.js'&&!legacyFixture){w.MiCarteraV2SessionStorage.activate({projectId,orgId:'v2-mi-cartera-pilot',uid:'test-admin'});w.localStorage.setItem(KEY,seeded);if(JSON.parse(seeded).session?.actorId==='test-admin')await w.MiCarteraV2SessionStorage.confirm(w.MiCarteraV2SessionStorage.capture());}}}
    else if(!match[2].includes('serviceWorker'))vm.runInContext(match[2],c);
  }
  if(w.MiCarteraV2SessionStorage?.state?.().ready)w.dispatchEvent(new w.CustomEvent('v2-local-owner-ready',{detail:w.MiCarteraV2SessionStorage.state()}));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
}else for(const f of ['app/operation-commit-gate.js','app/operational-controller.js','app/durable-actions-v2.js','app/cash-menu-v2.js'])load(f);
w.MiCarteraV2DurableActions.install();w.MiCarteraV2CashMenu.install();
const setAuth=(next,emit=false)=>{fixtureAuth={...next};w.firebaseAuthV2.auth.currentUser=fixtureAuth.uid?{uid:fixtureAuth.uid}:null;if(emit)w.dispatchEvent(new w.CustomEvent('v2-auth-cloud-state',{detail:{...fixtureAuth}}));};
return {w,load,alerts,commits,drawn,setAuth,get:()=>JSON.parse(w.localStorage.getItem(KEY)),set:d=>w.localStorage.setItem(KEY,JSON.stringify(d)),close:()=>w.happyDOM.abort()};}
module.exports={boot,KEY};
