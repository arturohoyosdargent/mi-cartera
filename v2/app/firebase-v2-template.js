// Mi Cartera PRO V2 — Firebase bootstrap configuration.
// V2 shares the Firebase project services but MUST write only under the isolated v2-* org namespace.
// Firebase web config values are public project/app identifiers; no service-account credential is stored here.
(function(root){'use strict';
const template=Object.freeze({
  apiKey:'AIzaSyC0Q--YUB9rKei3_CKz_txfYf8Y8a9Tdv8',
  authDomain:'mi-cartera-d0d8c.firebaseapp.com',
  projectId:'mi-cartera-d0d8c',
  storageBucket:'mi-cartera-d0d8c.firebasestorage.app',
  messagingSenderId:'718623808251',
  appId:'1:718623808251:web:a2e43ae5ceb6895efeee5e',
  measurementId:'G-PCJP5QYV27'
});
// Writes remain disabled until preflight + explicit pilot activation.
const pilot=Object.freeze({mode:'VALIDATION',cloudEnabled:false,allowRealWrites:false,orgId:'v2-mi-cartera-pilot',requireGreenQa:true});
root.MI_CARTERA_V2_FIREBASE_TEMPLATE=template;
root.MI_CARTERA_V2_PILOT_CONFIG=root.MI_CARTERA_V2_PILOT_CONFIG||pilot;
})(window);