// MI CARTERA PRO V21 - CONFIGURACIÓN FIREBASE
window.MI_CARTERA_FIREBASE = {
  apiKey: "AIzaSyCOQ--YUB9rKei3_CKz_txfYf8Y8a9Tdv8",
  authDomain: "mi-cartera-d0d8c.firebaseapp.com",
  projectId: "mi-cartera-d0d8c",
  storageBucket: "mi-cartera-d0d8c.firebasestorage.app",
  messagingSenderId: "718623808251",
  appId: "1:718623808251:web:a2e43ae5ceb6895efeee5"
};
window.MI_CARTERA_CLOUD = { orgId: "mi-cartera", cloudEnabled: true };
(()=>{
 const load=(src)=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
 window.addEventListener('load',()=>{
   load('./credit-client-save-fix.js?v=3&b=20260915').catch(()=>{});
   load('./proposal-share-fix.js?v=4&b=20260915').catch(()=>{});
   load('./credit-detail-share-fix.js?v=4&b=20260915').catch(()=>{});
   load('./cloud-credit-consistency-v1.js?v=1&b=20260915').catch(()=>{});
   load('./cloud-route-credit-sync-v1.js?v=1&b=20260915').catch(()=>{});
   load('./credit-detail-share-button-v1.js?v=1&b=20260915').catch(()=>{});
   load('./credit-owner-repair-v1.js?v=1&b=20260915').catch(()=>{});
 });
})();
