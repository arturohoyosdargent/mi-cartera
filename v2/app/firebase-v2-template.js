// Mi Cartera PRO V2 — Firebase bootstrap configuration.
// V2 shares the Firebase project services but MUST write only under the isolated v2-* org namespace.
// Firebase web config values are public project/app identifiers; no service-account credential is stored here.
(function(root){'use strict';
const template=Object.freeze({
  apiKey:'$p=(Get-Clipboard).Trim(); $f="v2\app\firebase-v2-template.js"; $c=Get-Content $f -Raw; $c=$c -replace "apiKey\s*:\s*'[^']*'","apiKey:'$p'"; Set-Content $f $c -NoNewline; Remove-Variable p; Write-Host "OK - nueva API key aplicada a V2"',
  authDomain:'mi-cartera-d0d8c.firebaseapp.com',
  projectId:'mi-cartera-d0d8c',
  storageBucket:'mi-cartera-d0d8c.firebasestorage.app',
  messagingSenderId:'718623808251',
  appId:'1:718623808251:web:a2e43ae5ceb6895efeee5e',
  measurementId:'G-PCJP5QYV27'
});
// Pilot activation: isolated V2 namespace only. The Firestore rules still deny writes to the pilot marker;
// financial writes remain subject to the V2 cloud adapter/rules and must not target the V1 namespace.
const pilot=Object.freeze({mode:'PILOT',cloudEnabled:true,allowRealWrites:true,orgId:'v2-mi-cartera-pilot',requireGreenQa:true});
root.MI_CARTERA_V2_FIREBASE_TEMPLATE=template;
root.MI_CARTERA_V2_PILOT_CONFIG=root.MI_CARTERA_V2_PILOT_CONFIG||pilot;
})(window);