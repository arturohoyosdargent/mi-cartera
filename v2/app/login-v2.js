// Mi Cartera PRO V2 — login UI. Existing Firebase users only; never self-provisions V2 membership.
(function(root){'use strict';
const $=id=>document.getElementById(id);
function message(text,ok=false){const e=$('loginMessage');if(e){e.textContent=text;e.className=ok?'ready':'blocked'}}
function transitionBlocked(){return root.MiCarteraV2SessionStorage?.canTransition?.().allowed===false||root.MiCarteraV2CloudRehydration?.pending?.()||Number(root.MiCarteraV2SyncBridge?.status?.()?.pending||0)>0}
async function login(){try{
 if(transitionBlocked()){message('Hay operaciones pendientes o en curso. Sincroniza antes de cambiar de usuario.');return {status:'LOGIN_BLOCKED_PENDING_SYNC'}}
 const email=$('loginEmail')?.value,password=$('loginPassword')?.value;
 root.MiCarteraV2SessionStorage?.archiveActive?.();
 message('Verificando usuario y membresía V2…');const s=await root.MiCarteraV2AuthCloudGate.signIn(email,password);
 if(!s.ready){message(s.reason==='V2_MEMBERSHIP_REQUIRED'?'Usuario autenticado, pero sin membresía V2 autorizada.':s.reason);return}
 message('Sesión V2 autorizada: '+(root.MiCarteraV2Labels?.role?.(s.role)||s.role),true);$('loginPassword').value='';
}catch(e){message(e.code||e.message||'LOGIN_FAILED');return {status:'LOGIN_FAILED',error:e}}}
async function logout(){try{
 if(transitionBlocked()){message('Hay operaciones pendientes de sincronización. Conéctate y sincroniza antes de cerrar sesión.');return {status:'LOGOUT_BLOCKED_PENDING_SYNC'}}
 root.MiCarteraV2SessionStorage?.archiveActive?.();await root.MiCarteraV2AuthCloudGate.signOut();message('Sesión cerrada.');return {status:'SIGNED_OUT'};
}catch(e){message(e.code||e.message||'LOGOUT_FAILED');return {status:'LOGOUT_FAILED',error:e}}}
function state(s){const signed=!!s.authenticated;if($('loginIdentity'))$('loginIdentity').textContent=signed?`${s.email||s.uid} · ${root.MiCarteraV2Labels?.role?.(s.role)||s.role||'SIN MEMBRESÍA'}`:'Sin sesión V2';if($('loginLogout'))$('loginLogout').style.display=signed?'inline-block':'none';if(s.ready)message('Conexión a la nube V2 autorizada.',true)}
function install(){if($('loginButton'))$('loginButton').onclick=login;if($('loginLogout'))$('loginLogout').onclick=logout;state(root.MiCarteraV2AuthCloudGate?.state?.()||{})}
root.addEventListener('v2-auth-cloud-state',e=>state(e.detail||{}));document.addEventListener('DOMContentLoaded',install);root.MiCarteraV2Login={login,logout,state};
})(window);
