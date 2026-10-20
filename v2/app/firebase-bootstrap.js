// Mi Cartera PRO V2 — Firebase modular bootstrap for the isolated V2 pilot.
// Authentication and Firestore are exposed explicitly; no V1 globals are used.
(async function(root){'use strict';
const cfg=root.MI_CARTERA_V2_FIREBASE_TEMPLATE;
const pilot=root.MI_CARTERA_V2_PILOT_CONFIG;
if(!cfg||!cfg.projectId){root.firebaseV2BootstrapError='FIREBASE_CONFIG_MISSING';return;}
try{
  // Only the static release configuration may select a financial backend.
  // Endpoint values are never accepted from navigation, tenant storage or a form.
  const backendMode=pilot?.backendMode===undefined?'functions':pilot.backendMode;
  if(!['functions','external','spark-native','b2-compatible'].includes(backendMode))throw Error('V2_BACKEND_MODE_INVALID');
  function backendOrigin(value){
    if(typeof value!=='string'||!value||value.trim()!==value)throw Error('V2_EXTERNAL_BACKEND_INVALID_ORIGIN');
    let url;try{url=new URL(value);}catch(_){throw Error('V2_EXTERNAL_BACKEND_INVALID_ORIGIN');}
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(value!==url.origin&&value!==url.origin+'/'))throw Error('V2_EXTERNAL_BACKEND_INVALID_ORIGIN');
    const loopback=/^127\./.test(url.hostname)||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname==='[::1]'||url.hostname==='0.0.0.0';
    const qa=root.MI_CARTERA_V2_QA,isolated=qa?.isolated===true&&qa.projectId===cfg.projectId&&['demo-mi-cartera-spark','demo-mi-cartera-v2'].includes(cfg.projectId)&&root.location?.hostname==='127.0.0.1';
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&isolated&&url.hostname==='127.0.0.1'&&url.port))throw Error('V2_EXTERNAL_BACKEND_HTTPS_REQUIRED');
    if(loopback&&!(isolated&&url.hostname==='127.0.0.1'&&url.port))throw Error('V2_EXTERNAL_BACKEND_ISOLATION_REQUIRED');
    return url.origin;
  }
  let externalOrigin=null;
  if(backendMode==='external'){
    const allowed=pilot.backendAllowedOrigins;
    if(!Array.isArray(allowed)||!allowed.length||allowed.length>16)throw Error('V2_EXTERNAL_BACKEND_ALLOWLIST_REQUIRED');
    const approved=allowed.map(backendOrigin);externalOrigin=backendOrigin(pilot.backendBaseUrl);
    if(!approved.includes(externalOrigin))throw Error('V2_EXTERNAL_BACKEND_ORIGIN_NOT_APPROVED');
  }
  const [appSdk,fsSdk,authSdk]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js')
  ]);
  const app=appSdk.initializeApp(cfg,'mi-cartera-pro-v2-pilot');
  const db=fsSdk.getFirestore(app);
  const auth=authSdk.getAuth(app);
  root.firebaseSdkV2={appSdk,fsSdk,authSdk,app};
  if(['functions','external'].includes(backendMode)){
    const functionsSdk=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
    root.firebaseSdkV2.functionsSdk=functionsSdk;
  const functions=functionsSdk.getFunctions(app,'us-central1');
  if(externalOrigin&&typeof functionsSdk.httpsCallableFromURL!=='function')throw Error('V2_EXTERNAL_CALLABLE_SDK_REQUIRED');
  const callable=name=>externalOrigin?functionsSdk.httpsCallableFromURL(functions,externalOrigin+'/'+name):functionsSdk.httpsCallable(functions,name);
  const recordInstallment=callable('recordV2Installment');
  const saveCommissionTerms=callable('recordV2CommissionTerms');
  const settleCommission=callable('settleV2Commission');
  const requestCreditReview=callable('requestV2CreditAdministrativeReview');
  const recordFinancialOperation=externalOrigin?callable('recordV2FinancialOperation'):null;
  root.firebaseSdkV2={appSdk,fsSdk,authSdk,functionsSdk,app};
  root.firebaseFunctionsV2={recordInstallment:async input=>(await recordInstallment(input)).data,saveCommissionTerms:async input=>(await saveCommissionTerms(input)).data,settleCommission:async input=>(await settleCommission(input)).data,requestCreditReview:async input=>(await requestCreditReview(input)).data,...(recordFinancialOperation?{recordFinancialOperation:async input=>(await recordFinancialOperation(input)).data}:{})};
  }
  root.firestoreV2={
    db,
    doc:fsSdk.doc,
    getDoc:fsSdk.getDoc,
    setDoc:fsSdk.setDoc,
    collection:fsSdk.collection,
    getDocs:fsSdk.getDocs,
    query:fsSdk.query,
    where:fsSdk.where,
    runTransaction:fsSdk.runTransaction,
    serverTimestamp:fsSdk.serverTimestamp,
    increment:fsSdk.increment
  };
  root.firebaseAuthV2={
    auth,
    onAuthStateChanged:authSdk.onAuthStateChanged,
    signInWithEmailAndPassword:authSdk.signInWithEmailAndPassword,
    signOut:authSdk.signOut
  };
  root.readPilotMarkerV2=async function(orgId){
    if(!/^v2-/.test(String(orgId||''))||orgId==='mi-cartera')throw Object.assign(new Error('V2_NAMESPACE_REQUIRED'),{code:'V2_NAMESPACE_REQUIRED'});
    if(pilot?.orgId&&orgId!==pilot.orgId)throw Object.assign(new Error('V2_NAMESPACE_MISMATCH'),{code:'V2_NAMESPACE_MISMATCH'});
    const snap=await fsSdk.getDoc(fsSdk.doc(db,'orgs',orgId));
    return snap.exists()?snap.data():null;
  };
  root.dispatchEvent(new CustomEvent('mi-cartera-v2-firebase-ready'));
}catch(e){
  root.firebaseV2BootstrapError=e?.code||e?.message||String(e);
  root.dispatchEvent(new CustomEvent('mi-cartera-v2-firebase-error',{detail:root.firebaseV2BootstrapError}));
}
})(window);
