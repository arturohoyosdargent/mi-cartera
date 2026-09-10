const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

exports.createCarteraUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated','Debe iniciar sesión.');
  const caller = await db.doc(`users/${request.auth.uid}`).get();
  if (!caller.exists || caller.data().role !== 'admin') throw new HttpsError('permission-denied','Solo el administrador puede crear usuarios.');
  const callerData = caller.data();
  const { orgId, name, email, password, role, routeIds=[] } = request.data || {};
  if (!orgId || orgId !== callerData.orgId) throw new HttpsError('permission-denied','La organización no coincide con la del administrador.');
  if (!name || !email || !password || password.length < 6) throw new HttpsError('invalid-argument','Datos incompletos.');
  if (!['cobrador','supervisor','consulta'].includes(role)) throw new HttpsError('invalid-argument','Rol no permitido.');
  const safeRouteIds=Array.isArray(routeIds)?routeIds.filter(x=>typeof x==='string'&&x.trim()).slice(0,50):[];
  let user;
  try { user = await getAuth().createUser({email:email.trim().toLowerCase(),password,displayName:name.trim()}); }
  catch(e) { throw new HttpsError(e?.code==='auth/email-already-exists'?'already-exists':'internal', e.message||'No se pudo crear el usuario.'); }
  try {
    await db.doc(`users/${user.uid}`).set({uid:user.uid,orgId,name:name.trim(),email:user.email,role,routeIds:safeRouteIds,active:true,createdAt:new Date().toISOString(),createdBy:request.auth.uid});
  } catch(e) {
    try { await getAuth().deleteUser(user.uid); } catch(_) {}
    throw new HttpsError('internal','No se pudo guardar el perfil del usuario.');
  }
  return {uid:user.uid,email:user.email,name:name.trim(),role};
});
