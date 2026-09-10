import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, deleteUser, initializeAuth, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const cfg=window.MI_CARTERA_FIREBASE||{};
const orgCfg=window.MI_CARTERA_CLOUD||{orgId:'mi-cartera',cloudEnabled:false};
const ready=!!(orgCfg.cloudEnabled && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
let app=null,auth=null,fs=null,currentProfile=null;
const el=id=>document.getElementById(id);
const orgId=orgCfg.orgId||'mi-cartera';
const DB_KEY='mi_cartera_pro_v21';
const SEED_KEY='prestamo_ya_cloud_seeded_'+orgId;
function status(t){if(el('cloudStatus'))el('cloudStatus').textContent=t;}
function msg(t){if(el('cloudLoginMsg'))el('cloudLoginMsg').textContent=t;}
function saveCloudDb(){try{const raw=JSON.stringify(db);localStorage.setItem(DB_KEY,raw);localStorage.setItem('mi_cartera_pro_v19',raw)}catch(e){console.error(e)}}
function openLogin(){el('cloudLoginModal')?.classList.add('open');}
function closeLogin(){el('cloudLoginModal')?.classList.remove('open');}
window.openCloudLogin=openLogin; window.closeCloudLogin=closeLogin;
window.cloudLogin=async()=>{if(!ready)return msg('Firebase todavía no está configurado. Completa firebase-config.js.');const email=el('cloudEmail')?.value.trim(),pass=el('cloudPassword')?.value;if(!email||!pass)return msg('Ingrese correo y contraseña.');try{msg('Conectando...');await signInWithEmailAndPassword(auth,email,pass);closeLogin();}catch(e){console.error(e);msg('No se pudo iniciar sesión: '+(e.code||e.message));}};
window.cloudLogout=async()=>{if(auth)await signOut(auth);};
window.cloudSyncNow=async()=>{if(!ready||!auth?.currentUser)return toast('Inicia sesión en Cloud primero.');try{await pullCloud();await pushLocalAllowed();localStorage.setItem(SEED_KEY,'1');toast('Cloud sincronizado.');}catch(e){console.error(e);toast('Error Cloud: '+(e.code||e.message));}};
function addMeta(obj){return {...obj,orgId,userId:auth.currentUser.uid,updatedAt:serverTimestamp()};}
async function getProfile(uid){const snap=await getDoc(doc(fs,'users',uid));return snap.exists()?snap.data():null;}
function role(){return currentProfile?.role||'consulta';}
function routeIds(){return Array.isArray(currentProfile?.routeIds)?currentProfile.routeIds:[];}
function canAll(){return ['admin','supervisor'].includes(role());}
function dedupeClients(cleanCloud=false){
  if(!Array.isArray(db.clients))return;
  const seen=new Map(), keep=[], duplicates=[];
  const keyOf=c=>{const dni=String(c?.dni||'').replace(/\D/g,'');if(dni)return 'dni:'+dni;const n=String(c?.name||'').trim().toLowerCase().replace(/\s+/g,' ');const p=String(c?.phone||'').replace(/\D/g,'');return 'np:'+n+'|'+p};
  for(const c of db.clients){const k=keyOf(c);if(!seen.has(k)){seen.set(k,c);keep.push(c)}else{const main=seen.get(k);['address','guarantor','guarantorPhone','reference','location','routeId'].forEach(f=>{if(!main[f]&&c[f])main[f]=c[f]});db.credits?.forEach(cr=>{if(String(cr.clientId)===String(c.id))cr.clientId=main.id});duplicates.push(c)}}
  if(duplicates.length){db.clients=keep;duplicates.forEach(c=>audit('CLIENTE_DUPLICADO_ELIMINADO',`${c.name} #${c.id}`));saveCloudDb();try{renderAll()}catch(_){}if(cleanCloud&&canAll()&&fs){Promise.all(duplicates.map(c=>deleteDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id))).catch(()=>null))).then(()=>{pushList('clients',keep).catch(()=>{})})}}
}
async function pullCollection(name,constraints=[]){let q=collection(fs,`orgs/${orgId}/${name}`);let qq=constraints.length?query(q,...constraints):q;const snap=await getDocs(qq);return snap.docs.map(d=>d.data());}
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
    for(const rid of rids){const cs=await pullCollection('clients',[where('routeId','==',rid)]);data.clients.push(...cs);const cr=await pullCollection('credits',[where('routeId','==',rid)]);data.credits.push(...cr);for(const crd of cr){const ps=await pullCollection('payments',[where('creditId','==',crd.id)]);data.payments.push(...ps);}}
    data.cashClosures=await pullCollection('cashClosures',[where('userId','==',auth.currentUser.uid)]);
    data.approvals=await pullCollection('approvals',[where('requestedByUid','==',auth.currentUser.uid)]);
  }
  const firstCloudMigration=localStorage.getItem(SEED_KEY)!=='1';
  for(const n of Object.keys(data)){
    if(!Array.isArray(data[n]))continue;
    const local=Array.isArray(db[n])?db[n]:[];
    if(firstCloudMigration&&local.length&&['payments','cashClosures','approvals'].includes(n)){
      const m=new Map(data[n].map(x=>[String(x.id),x]));
      for(const x of local)m.set(String(x.id),x);
      data[n]=Array.from(m.values());
    }
    if(firstCloudMigration&&canAll()&&data[n].length===0&&local.length)data[n]=local;
    db[n]=data[n];
  }
  dedupeClients(true);
  db.currentUserId=currentProfile.localUserId||db.currentUserId;
  saveCloudDb();
  normalize();renderAll();
}
async function pushList(name,list){for(const item of list||[]){if(!item||item.id==null)continue;const payload=addMeta({...item});if(name==='payments'){payload.userId=payload.userId||auth.currentUser.uid;if(!payload.routeId){const cr=(db.credits||[]).find(c=>String(c.id)===String(payload.creditId));payload.routeId=cr?.routeId||null;}}await setDoc(doc(fs,`orgs/${orgId}/${name}`,String(item.id)),payload,{merge:true});}}
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
window.cloudCreateUser=async()=>{
  if(!currentProfile||role()!=='admin')return toast('No autorizado');
  const name=el('cloudNewName').value.trim(),email=el('cloudNewEmail').value.trim().toLowerCase(),password=el('cloudNewPass').value,rolev=el('cloudNewRole').value,route=el('cloudNewRoute').value.trim();
  if(!name||!email||password.length<6)return toast('Complete nombre, correo y contraseña de 6+ caracteres.');
  let creatorApp=null,creatorAuth=null,createdUser=null;
  try{
    creatorApp=getApps().find(a=>a.name==='prestamoYaUserCreator')||initializeApp(cfg,'prestamoYaUserCreator');
    try{creatorAuth=getAuth(creatorApp);}catch(_){creatorAuth=initializeAuth(creatorApp,{persistence:inMemoryPersistence});}
    const cred=await createUserWithEmailAndPassword(creatorAuth,email,password);
    createdUser=cred.user;
    await setDoc(doc(fs,'users',createdUser.uid),{uid:createdUser.uid,orgId,name,email:createdUser.email,role:rolev,routeIds:route?[route]:[],active:true,createdAt:new Date().toISOString(),createdBy:auth.currentUser.uid});
    await signOut(creatorAuth);
    closeForm();
    toast('Usuario Cloud creado: '+(createdUser.email||email));
  }catch(e){
    console.error(e);
    if(createdUser){try{await deleteUser(createdUser);}catch(_){} }
    const code=e?.code||'';
    const detail=code==='auth/email-already-in-use'||code==='auth/email-already-exists'?'El correo ya está registrado en Firebase.':(e?.message||code||'Error desconocido');
    toast('No se pudo crear: '+detail);
  }
};
function updateUI(){
  if(!el('cloudStatus'))return;
  if(!ready){status('🟡 Cloud no configurado · modo local/offline');if(el('cloudUserInfo'))el('cloudUserInfo').textContent='Sin sesión';return;}
  if(auth?.currentUser){status('🟢 Cloud conectado · '+auth.currentUser.email);if(el('cloudUserInfo'))el('cloudUserInfo').textContent=auth.currentUser.email;if(el('cloudRoleInfo'))el('cloudRoleInfo').textContent='Rol: '+(currentProfile?.role||'pendiente')+' · Organización: '+orgId;if(el('cloudUserBtn'))el('cloudUserBtn').textContent='☁️ '+(currentProfile?.name||'Sesión');}
  else{status('🟡 Cloud configurado · inicia sesión');if(el('cloudUserInfo'))el('cloudUserInfo').textContent='Sin sesión';if(el('cloudUserBtn'))el('cloudUserBtn').textContent='☁️ Entrar';}
}
if(ready){
  try{
    app=getApps().length?getApp():initializeApp(cfg);auth=getAuth(app);fs=getFirestore(app);
    enableIndexedDbPersistence(fs).catch(()=>{});
    onAuthStateChanged(auth,async user=>{
      if(!user){currentProfile=null;updateUI();return;}
      try{
        currentProfile=await getProfile(user.uid);if(!currentProfile||currentProfile.active===false){await signOut(auth);return msg('Usuario sin perfil activo en Préstamo Ya.');}
        db.users=db.users||[];let lu=db.users.find(x=>x.id===user.uid);if(!lu){lu={id:user.uid,name:currentProfile.name||user.email,role:currentProfile.role||'consulta',active:true};db.users.push(lu);}currentUserId=user.uid;db.currentUserId=user.uid;saveCloudDb();updateUI();
        const firstCloudMigration=localStorage.getItem(SEED_KEY)!=='1';
        if(firstCloudMigration&&canAll())await pushLocalAllowed();
        await pullCloud();
        await pushLocalAllowed();
        localStorage.setItem(SEED_KEY,'1');
        toast('Sesión Cloud iniciada');
      }catch(e){console.error(e);status('🔴 Error al cargar perfil Cloud');}
    });
  }catch(e){console.error(e);status('🔴 Error de configuración Firebase');}
}else{updateUI();}
window.addEventListener('online',()=>{if(auth?.currentUser)setTimeout(()=>window.cloudSyncNow(),700);});
