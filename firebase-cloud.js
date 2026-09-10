import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence, doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const cfg=window.MI_CARTERA_FIREBASE||{};
const orgCfg=window.MI_CARTERA_CLOUD||{orgId:'mi-cartera',cloudEnabled:false};
const ready=!!(orgCfg.cloudEnabled && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
let app=null,auth=null,fs=null,functions=null,currentProfile=null;
const el=id=>document.getElementById(id);
const orgId=orgCfg.orgId||'mi-cartera';
function status(t){if(el('cloudStatus'))el('cloudStatus').textContent=t;}
function msg(t){if(el('cloudLoginMsg'))el('cloudLoginMsg').textContent=t;}
function openLogin(){el('cloudLoginModal')?.classList.add('open');}
function closeLogin(){el('cloudLoginModal')?.classList.remove('open');}
window.openCloudLogin=openLogin; window.closeCloudLogin=closeLogin;
window.cloudLogin=async()=>{if(!ready)return msg('Firebase todavía no está configurado. Completa firebase-config.js.');const email=el('cloudEmail')?.value.trim(),pass=el('cloudPassword')?.value;if(!email||!pass)return msg('Ingrese correo y contraseña.');try{msg('Conectando...');await signInWithEmailAndPassword(auth,email,pass);closeLogin();}catch(e){console.error(e);msg('No se pudo iniciar sesión: '+(e.code||e.message));}};
window.cloudLogout=async()=>{if(auth)await signOut(auth);};
window.cloudSyncNow=async()=>{if(!ready||!auth?.currentUser)return toast('Inicia sesión en Cloud primero.');try{await pullCloud();await pushLocalAllowed();toast('Cloud sincronizado.');}catch(e){console.error(e);toast('Error Cloud: '+(e.code||e.message));}};

function collectionName(k){return ['clients','credits','payments','capital','entries','expenses','cashClosures','audit','approvals','routes'].includes(k)?k:null;}
function addMeta(obj){return {...obj,orgId,userId:auth.currentUser.uid,updatedAt:serverTimestamp()};}
async function getProfile(uid){const snap=await getDoc(doc(fs,'users',uid));return snap.exists()?snap.data():null;}
function role(){return currentProfile?.role||'consulta';}
function routeIds(){return Array.isArray(currentProfile?.routeIds)?currentProfile.routeIds:[];}
function canAll(){return ['admin','supervisor'].includes(role());}
async function pullCollection(name, constraints=[]){let q=collection(fs,`orgs/${orgId}/${name}`);let qq=constraints.length?query(q,...constraints):q;const snap=await getDocs(qq);return snap.docs.map(d=>d.data());}
async function pullCloud(){
  if(!currentProfile)return;
  const names=['routes','clients','credits','payments','cashClosures','approvals'];
  const data={};
  if(canAll()){
    for(const n of names)data[n]=await pullCollection(n);
    for(const n of ['capital','entries','expenses','audit'])data[n]=await pullCollection(n);
  }else{
    data.routes=await pullCollection('routes',[where('collectorId','==',auth.currentUser.uid)]);
    const rids=data.routes.map(x=>x.id);
    data.clients=[]; data.credits=[]; data.payments=[];
    // Firestore queries cannot use an arbitrary local filter as a security boundary; rules require route-constrained queries.
    // We therefore query each assigned route separately.
    for(const rid of rids){
      const cs=await pullCollection('clients',[where('routeId','==',rid)]); data.clients.push(...cs);
      const cr=await pullCollection('credits',[where('routeId','==',rid)]); data.credits.push(...cr);
      for(const crd of cr){const ps=await pullCollection('payments',[where('creditId','==',crd.id)]);data.payments.push(...ps);}
    }
    data.cashClosures=await pullCollection('cashClosures',[where('userId','==',auth.currentUser.uid)]);
    data.approvals=await pullCollection('approvals',[where('requestedByUid','==',auth.currentUser.uid)]);
  }
  for(const n of Object.keys(data))if(Array.isArray(data[n]))db[n]=data[n];
  db.currentUserId=currentProfile.localUserId||db.currentUserId;
  localStorage.setItem('mi_cartera_pro_v19',JSON.stringify(db));
  normalize();renderAll();
}
async function pushList(name,list){for(const item of list||[]){if(!item||item.id==null)continue;const payload=addMeta({...item});if(name==='payments'){payload.userId=payload.userId||auth.currentUser.uid; if(!payload.routeId){const cr=(db.credits||[]).find(c=>String(c.id)===String(payload.creditId));payload.routeId=cr?.routeId||null;} }await setDoc(doc(fs,`orgs/${orgId}/${name}`,String(item.id)),payload,{merge:true});}}
async function pushLocalAllowed(){
  if(!currentProfile)return;
  if(canAll()){
    for(const n of ['routes','clients','credits','payments','cashClosures','approvals','capital','entries','expenses','audit'])await pushList(n,db[n]);
  }else{
    await pushList('payments',(db.payments||[]).map(p=>{const cr=(db.credits||[]).find(c=>String(c.id)===String(p.creditId));return {...p,userId:auth.currentUser.uid,routeId:p.routeId||cr?.routeId||null};}).filter(p=>p.routeId));
    await pushList('cashClosures',(db.cashClosures||[]).filter(x=>x.userId===auth.currentUser.uid));
    await pushList('approvals',(db.approvals||[]).filter(x=>x.requestedByUid===auth.currentUser.uid));
  }
}

window.openCloudUserForm=()=>{
  if(!currentProfile||role()!=='admin')return toast('Solo el administrador puede crear accesos Cloud.');
  openForm('Crear acceso Cloud',`<div class="field"><label>Nombre</label><input class="input" id="cloudNewName"></div><div class="field"><label>Correo</label><input class="input" id="cloudNewEmail" type="email"></div><div class="field"><label>Contraseña temporal</label><input class="input" id="cloudNewPass" type="password" minlength="6"></div><div class="field"><label>Rol</label><select class="select" id="cloudNewRole"><option value="cobrador">Cobrador</option><option value="supervisor">Supervisor</option><option value="consulta">Consulta</option></select></div><div class="field"><label>Ruta ID (opcional)</label><input class="input" id="cloudNewRoute"></div><button class="btn green wide" onclick="cloudCreateUser()">Crear acceso</button>`);
};
window.cloudCreateUser=async()=>{if(!currentProfile||role()!=='admin')return toast('No autorizado');const name=el('cloudNewName').value.trim(),email=el('cloudNewEmail').value.trim(),password=el('cloudNewPass').value,rolev=el('cloudNewRole').value,route=el('cloudNewRoute').value.trim();if(!name||!email||password.length<6)return toast('Complete nombre, correo y contraseña de 6+ caracteres.');try{const fn=httpsCallable(functions,'createCarteraUser');const res=await fn({orgId,name,email,password,role:rolev,routeIds:route?[route]:[]});closeForm();toast('Usuario Cloud creado: '+(res.data?.email||email));}catch(e){console.error(e);toast('No se pudo crear: '+(e.code||e.message));}};

function updateUI(){
  if(!el('cloudStatus'))return;
  if(!ready){status('🟡 Cloud no configurado · modo local/offline');if(el('cloudUserInfo'))el('cloudUserInfo').textContent='Sin sesión';return;}
  if(auth?.currentUser){status('🟢 Cloud conectado · '+auth.currentUser.email);if(el('cloudUserInfo'))el('cloudUserInfo').textContent=auth.currentUser.email;if(el('cloudRoleInfo'))el('cloudRoleInfo').textContent='Rol: '+(currentProfile?.role||'pendiente')+' · Organización: '+orgId;if(el('cloudUserBtn'))el('cloudUserBtn').textContent='☁️ '+(currentProfile?.name||'Sesión');}
  else{status('🟡 Cloud configurado · inicia sesión');if(el('cloudUserInfo'))el('cloudUserInfo').textContent='Sin sesión';if(el('cloudUserBtn'))el('cloudUserBtn').textContent='☁️ Entrar';}
}

if(ready){
  try{
    app=getApps().length?getApp():initializeApp(cfg);auth=getAuth(app);fs=getFirestore(app);functions=getFunctions(app);
    enableIndexedDbPersistence(fs).catch(()=>{});
    onAuthStateChanged(auth,async user=>{
      if(!user){currentProfile=null;updateUI();return;}
      try{currentProfile=await getProfile(user.uid);if(!currentProfile||currentProfile.active===false){await signOut(auth);return msg('Usuario sin perfil activo en Mi Cartera.');}db.users=db.users||[];let lu=db.users.find(x=>x.id===user.uid);if(!lu){lu={id:user.uid,name:currentProfile.name||user.email,role:currentProfile.role||'consulta',active:true};db.users.push(lu);}currentUserId=user.uid;db.currentUserId=user.uid;localStorage.setItem('mi_cartera_pro_v19',JSON.stringify(db));updateUI();await pullCloud();await pushLocalAllowed();toast('Sesión Cloud iniciada');}catch(e){console.error(e);status('🔴 Error al cargar perfil Cloud');}
    });
  }catch(e){console.error(e);status('🔴 Error de configuración Firebase');}
}else updateUI();

window.addEventListener('online',()=>{if(auth?.currentUser)setTimeout(()=>window.cloudSyncNow(),700);});
