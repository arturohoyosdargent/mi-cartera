// Mi Cartera PRO V2 — Firebase bootstrap template.
// IMPORTANT: use a V2-specific orgId/namespace. Never point validation writes at V1 orgs/mi-cartera.
// Firebase web config values are project identifiers, not service-account credentials.
(function(root){'use strict';
const template=Object.freeze({apiKey:'',authDomain:'',projectId:'mi-cartera-d0d8c',storageBucket:'',messagingSenderId:'',appId:''});
// runtime-cloud.js deliberately accepts only orgIds beginning with "v2-".
const pilot=Object.freeze({mode:'VALIDATION',cloudEnabled:false,allowRealWrites:false,orgId:'v2-mi-cartera-pilot',requireGreenQa:true});
root.MI_CARTERA_V2_FIREBASE_TEMPLATE=template;
root.MI_CARTERA_V2_PILOT_CONFIG=root.MI_CARTERA_V2_PILOT_CONFIG||pilot;
})(window);