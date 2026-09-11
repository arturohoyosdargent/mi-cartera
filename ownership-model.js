// Modelo de propiedad de cartera: distingue cartera del administrador de rutas de cobrador.
import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;
    const wait=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>15000)return reject(new Error('Firebase no se inicializó'));setTimeout(tick,150)}};tick()});
    const app=await wait(),auth=getAuth(app),fs=getFirestore(app),orgId=cloud.orgId||'mi-cartera';
    const read=name=>getDocs(collection(fs,`orgs/${orgId}/${name}`));
    onAuthStateChanged(auth,async user=>{
      if(!user||window.__prestamoYaOwnershipModelDone)return;
      const meSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
      const me=meSnap.docs.find(d=>d.id===user.uid)?.data();
      if(!me||me.role!=='admin')return;
      window.__prestamoYaOwnershipModelDone=true;
      try{
        const routes=(await read('routes')).docs.map(d=>({id:d.id,...d.data()}));
        const clients=(await read('clients')).docs.map(d=>d.data());
        const credits=(await read('credits')).docs.map(d=>d.data());
        const users=meSnap.docs.map(d=>({id:d.id,...d.data()}));
        const adminPortfolioRoutes=routes.filter(r=>{
          const name=String(r.name||'').trim().toLowerCase();
          const hasPortfolio=clients.some(c=>String(c.routeId)===String(r.id))||credits.some(c=>String(c.routeId)===String(r.id));
          return hasPortfolio&&name==='principal';
        });
        if(!adminPortfolioRoutes.length)return;

        const adminRouteIds=adminPortfolioRoutes.map(r=>String(r.id));
        for(const r of adminPortfolioRoutes){
          await setDoc(doc(fs,`orgs/${orgId}/routes`,r.id),{
            orgId,routeId:r.id,ownershipMode:'admin',ownerUid:user.uid,
            collectorUid:null,collectorId:null
          },{merge:true});
        }
        for(const u of users.filter(x=>x.id!==user.uid&&['cobrador','supervisor','consulta'].includes(x.role))){
          const ids=(Array.isArray(u.routeIds)?u.routeIds:[]).map(String).filter(id=>!adminRouteIds.includes(id));
          if(ids.length!==(Array.isArray(u.routeIds)?u.routeIds.length:0))await setDoc(doc(fs,'users',u.id),{routeIds:[...new Set(ids)]},{merge:true});
        }

        if(window.db){
          window.db.routes=(window.db.routes||[]).map(r=>adminRouteIds.includes(String(r.id))?{...r,collectorId:null,collectorUid:null,ownershipMode:'admin',ownerUid:user.uid}:r);
          (window.db.users||[]).forEach(u=>{if(u.id!==user.uid&&Array.isArray(u.routeIds))u.routeIds=u.routeIds.map(String).filter(id=>!adminRouteIds.includes(id));});
          window.db.currentUserId=user.uid;
          try{localStorage.setItem('mi_cartera_pro_v21',JSON.stringify(window.db));localStorage.setItem('mi_cartera_pro_v19',JSON.stringify(window.db));}catch(_){ }
          if(typeof window.renderAll==='function')window.renderAll();
        }
        console.log('Préstamo Ya: cartera administrativa separada de rutas de cobrador',adminRouteIds);
        if(typeof window.cloudSyncNow==='function')setTimeout(()=>window.cloudSyncNow().catch(()=>{}),500);
      }catch(e){window.__prestamoYaOwnershipModelDone=false;console.error('Préstamo Ya: error separando cartera administrativa',e)}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar ownership-model',e)}
  try{await import('./credit-share.js?v=1')}catch(e){console.warn('Módulo compartir crédito:',e)}
})();
