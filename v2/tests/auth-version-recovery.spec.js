const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('v2/app/auth-cloud-gate.js','utf8');
async function tick(){await new Promise(r=>setTimeout(r,0))}
async function main(){
 const listeners={};let version=false,reads=0,configured=0;
 const user={uid:'u1',email:'a@b.com'};
 const root={addEventListener:(n,f)=>(listeners[n]??=[]).push(f),dispatchEvent(){},CustomEvent:function(n,o){this.type=n;this.detail=o?.detail},MiCarteraV2VersionGuard:{state:()=>({ready:version})},MiCarteraV2PilotConfig:{requestedOrg:()=>null,state:{config:{orgId:'v2-mi-cartera-pilot'}}},firestoreV2:{db:{},doc:(...x)=>x,getDoc:async()=>{reads++;return {exists:()=>true,data:()=>({active:true,role:'admin',routeIds:[]})}}},firebaseAuthV2:{auth:{currentUser:user},onAuthStateChanged:(auth,cb)=>{queueMicrotask(()=>cb(auth.currentUser));return()=>{}}},MiCarteraV2CloudRuntime:{configure(){configured++}}};
 root.window=root;root.queueMicrotask=queueMicrotask;
 vm.runInNewContext(code,{window:root,queueMicrotask});
 await tick();assert.equal(root.MiCarteraV2AuthCloudGate.state().ready,false);
 version=true;for(const fn of listeners['v2-version-state']||[])await fn({detail:{ready:true}});await tick();await tick();
 const st=root.MiCarteraV2AuthCloudGate.state();assert.equal(st.ready,true,'existing authenticated user must recover after version becomes ready');assert.equal(st.uid,'u1');assert.ok(reads>=1);assert.ok(configured>=1);
 console.log('PASS auth/version recovery dynamic regression');
}
main().catch(e=>{console.error(e);process.exit(1)});
