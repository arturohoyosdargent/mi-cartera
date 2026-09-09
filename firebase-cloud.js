// Adaptador Cloud opcional. Requiere configurar firebase-config.js y publicar por HTTPS.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const cfg = window.MI_CARTERA_FIREBASE || {};
const ready = cfg.apiKey && cfg.projectId && cfg.appId;
const status = document.getElementById('cloudStatus');
if (!ready) {
  if (status) status.textContent = '🟡 Nube no configurada · la aplicación funciona en modo local/offline';
} else {
  try {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app);
    enableIndexedDbPersistence(db).catch(()=>{});
    onAuthStateChanged(auth, user => {
      if (status) status.textContent = user ? `🟢 Cloud conectado · ${user.email || user.uid}` : '🟡 Cloud configurado · usuario no autenticado';
    });
    // El listener real por tenant/ruta se añadirá con las reglas definitivas.
    window.MiCarteraCloud = { app, auth, db, collection, onSnapshot };
  } catch (e) {
    if (status) status.textContent = '🔴 Error de configuración Cloud';
    console.error(e);
  }
}
