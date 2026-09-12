// MI CARTERA PRO V21 - CONFIGURACIÓN FIREBASE
window.MI_CARTERA_FIREBASE = {
  apiKey: "AIzaSyCOQ--YUB9rKei3_CKz_txfYf8Y8a9Tdv8",
  authDomain: "mi-cartera-d0d8c.firebaseapp.com",
  projectId: "mi-cartera-d0d8c",
  storageBucket: "mi-cartera-d0d8c.firebasestorage.app",
  messagingSenderId: "718623808251",
  appId: "1:718623808251:web:a2e43ae5ceb6895efeee5e"
};
window.MI_CARTERA_CLOUD = {
  orgId: "mi-cartera",
  cloudEnabled: true
};

// Arranque offline-first: registrar el Service Worker desde el primer arranque
// y evitar que el adaptador Cloud limpie la caché local.
try {
  sessionStorage.setItem('prestamo_ya_cache_clean_v31', '1');
} catch (_) {}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=5', { updateViaCache: 'none' })
      .then(reg => reg.update().catch(() => {}))
      .catch(err => console.warn('Préstamo Ya: Service Worker no disponible', err));
  }, { once: true });
}
