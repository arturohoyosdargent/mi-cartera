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
  const { orgId, name, email, password, role, routeIds=[] } = request.data || {};
  if (!orgId || !name || !email || !password || password.length < 6) throw new HttpsError('invalid-argument','Datos incompletos.');
  if (!['cobrador','supervisor','consulta'].includes(role)) throw new HttpsError('invalid-argument','Rol no permitido.');
  let user;
  try { user = await getAuth().createUser({email, password, displayName:name}); }
  catch(e) { throw new HttpsError('already-exists', e.message); }
  await db.doc(`users/${user.uid}`).set({uid:user.uid,orgId,name,email,role,routeIds:Array.isArray(routeIds)?routeIds:[],active:true,createdAt:new Date().toISOString(),createdBy:request.auth.uid});
  return {uid:user.uid,email:user.email,name,role};
});
