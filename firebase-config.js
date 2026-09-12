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

// El Service Worker se registra exclusivamente desde firebase-cloud.js.
// Mantener un único registro evita carreras entre versiones/cache del PWA.
