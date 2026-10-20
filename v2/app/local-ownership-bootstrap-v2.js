// First clean pilot login: establish technical ownership after verified hydration.
// Never adopt an existing portfolio, replace an owner, or alter data/Cloud/queues.
(function(root){'use strict';
if(root.MiCarteraV2SessionStorage){const storage=root.MiCarteraV2SessionStorage;root.MiCarteraV2LocalOwnershipBootstrap=Object.freeze({state:storage.state});root.addEventListener('mi-cartera-v2-rehydrated',event=>{const proof=storage.state(),scope=event.detail?.scope;if(event.detail?.ok===true&&proof.ready&&scope?.epoch===proof.epoch&&scope.uid===proof.uid&&scope.orgId===proof.orgId&&scope.projectId===proof.projectId)root.dispatchEvent(new root.CustomEvent('v2-local-owner-ready',{detail:proof}));});return;}

const OWNER='mi-cartera-v2-local-owner',KEY='mi-cartera-v2-validation-state',ORG='v2-mi-cartera-pilot';
const DATA_KEYS=['clients','credits','payments','cashMovements','audit','commercial'];
let status='WAITING_AUTH',reason='',candidate=null,proof=null,epoch=0,finalizing=false;
const role=value=>String(value||'').toLowerCase();
function owner(){return root.localStorage.getItem(OWNER)}
function local(){const raw=root.localStorage.getItem(KEY);return raw===null?{}:JSON.parse(raw)}
function noQueues(){
 for(let i=0;i<root.localStorage.length;i++){
  const key=root.localStorage.key(i);if(!key?.startsWith('mi-cartera-v2-cloud-operations'))continue;
  const rows=JSON.parse(root.localStorage.getItem(key));if(!Array.isArray(rows)||rows.length)return false;
 }
 return true;
}
function cleanStart(){
 try{if(owner()!==null||!noQueues())return false;const data=local();
  if(!data||typeof data!=='object'||Array.isArray(data)||data.session!=null)return false;
  if(Object.keys(data).some(key=>!DATA_KEYS.includes(key)&&key!=='session'))return false;
  return DATA_KEYS.every(key=>data[key]===undefined||(Array.isArray(data[key])&&data[key].length===0));
 }catch{return false}
}
const eligible=cleanStart();if(!eligible){status='BLOCKED';reason='INITIAL_OWNERSHIP_AMBIGUOUS'}
function stop(why){candidate=null;proof=null;epoch++;status='BLOCKED';reason=why}
function live(){
 try{const gate=root.MiCarteraV2AuthCloudGate,a=gate?.state?.(),v=gate?.requireReady?.(),firebaseUid=root.firebaseAuthV2?.auth?.currentUser?.uid;
  if(a?.ready!==true||a.authenticated!==true||a.member!==true||!a.uid||!['admin','supervisor','cobrador'].includes(role(a.role)))return null;
  if(v?.ready!==true||v.authenticated!==true||v.member!==true||v.uid!==a.uid||role(v.role)!==role(a.role)||firebaseUid!==a.uid||gate.ORG!==ORG)return null;
  return {uid:a.uid,role:role(a.role),orgId:gate.ORG};
 }catch{return null}
}
function same(a,b){return !!a&&!!b&&a.uid===b.uid&&a.role===b.role&&a.orgId===b.orgId}
function matchingSession(who){try{const s=local()?.session;return s?.actorId===who.uid&&role(s.role)===who.role}catch{return false}}
function validCandidate(expected){
 try{return status!=='BLOCKED'&&candidate===expected&&same(live(),expected)&&owner()===null&&noQueues()&&matchingSession(expected)}catch{return false}
}
function state(){
 if(proof){let current;try{current=live();if(!same(current,proof)||owner()!==proof.uid||!matchingSession(proof))stop('OWNERSHIP_CHANGED')}catch{stop('OWNERSHIP_UNAVAILABLE')}}
 return Object.freeze(proof?{ready:true,status:'READY',...proof}:{ready:false,status,reason});
}
function onAuth(event){
 if(!eligible||status==='BLOCKED')return;
 const who=live(),detail=event?.detail;
 if(candidate||proof){
  const expected=candidate||proof;
  if(!same(who,expected)||!detail||detail.ready!==true||detail.authenticated!==true||detail.member!==true||detail.uid!==expected.uid||role(detail.role)!==expected.role){stop('SESSION_CHANGED');return}
  try{if(owner()!==(proof?proof.uid:null))stop('OWNER_CHANGED')}catch{stop('OWNERSHIP_UNAVAILABLE')}
  return;
 }
 if(!who||!detail||detail.ready!==true||detail.authenticated!==true||detail.member!==true||detail.uid!==who.uid||role(detail.role)!==who.role)return;
 if(!cleanStart()){stop('INITIAL_OWNERSHIP_AMBIGUOUS');return}
 candidate={...who,epoch:++epoch};status='WAITING_HYDRATION';
}
async function onHydrated(event){
 if(!candidate||finalizing||status==='BLOCKED')return;
 if(event.detail?.ok!==true){stop('HYDRATION_NOT_CONFIRMED');return}
 const expected=candidate;
 if(!validCandidate(expected)){stop('HYDRATED_SCOPE_MISMATCH');return}
 const locks=root.navigator?.locks;if(typeof locks?.request!=='function'){stop('EXCLUSIVE_LOCK_UNAVAILABLE');return}
 finalizing=true;
 try{await locks.request('mi-cartera-v2-local-owner-bootstrap',{mode:'exclusive'},()=>{
  // The event has no UID/org/epoch. A changed attempt stays invalid even if the
  // same account returns; recheck all boundaries after the cross-tab lock wait.
  if(!validCandidate(expected)){stop('OWNERSHIP_CHANGED_DURING_LOCK');return}
  root.localStorage.setItem(OWNER,expected.uid);
  proof=Object.freeze({...expected});candidate=null;status='READY';reason='';
  const current=state();if(current.ready)root.dispatchEvent(new root.CustomEvent('v2-local-owner-ready',{detail:current}));
 })}catch{stop('OWNERSHIP_INITIALIZATION_FAILED')}
 finally{finalizing=false}
}
root.addEventListener('v2-auth-cloud-state',onAuth);
root.addEventListener('mi-cartera-v2-rehydrated',onHydrated);
root.addEventListener('storage',event=>{
 if(!candidate&&!proof)return;
 if(!event.key||event.key===OWNER||(candidate&&(event.key===KEY||event.key.startsWith('mi-cartera-v2-cloud-operations'))))stop('OTHER_TAB_STORAGE_CHANGED');
});
root.MiCarteraV2LocalOwnershipBootstrap=Object.freeze({state});
// Consume an already verified restored Firebase session without issuing Auth or
// hydration events. The protected producer runs after this module is installed.
if(eligible){const initial=root.MiCarteraV2AuthCloudGate?.state?.();if(initial?.ready)onAuth({detail:initial})}
})(window);
