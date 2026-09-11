import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{};
    const cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;
    const app=getApps().find(a=>a.name==='prestamoYaRepair')||initializeApp(cfg,'prestamoYaRepair');
    const auth=getAuth(app);
    const fs=getFirestore(app);
    onAuthStateChanged(auth,async user=>{
      if(!user||window.__prestamoYaRepairDone)return;
      try{
        const orgId=cloud.orgId||'mi-cartera';
        const meSnap=await getDocs(query(collection(fs,'users'),where('uid','==',user.uid),where('orgId','==',orgId)));
        const me=meSnap.docs[0]?.data();
        if(!me||!['admin','supervisor'].includes(me.role))return;
        window.__prestamoYaRepairDone=true;
        const routesSnap=await getDocs(query(collection(fs,`orgs/${orgId}/routes`),where('orgId','==',orgId)));
        const routes=routesSnap.docs.map(d=>d.data());
        const routeFor=value=>routes.find(r=>String(r.id)===String(value)||String(r.name||'').trim().toLowerCase()===String(value||'').trim().toLowerCase());
        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        for(const d of usersSnap.docs){
          const u=d.data();
          if(!Array.isArray(u.routeIds))continue;
          const fixed=[...new Set(u.routeIds.map(x=>routeFor(x)?.id??x))];
          if(JSON.stringify(fixed)!==JSON.stringify(u.routeIds))await setDoc(doc(fs,'users',d.id),{routeIds:fixed},{merge:true});
        }
        const repairCollection=async name=>{
          const snap=await getDocs(query(collection(fs,`orgs/${orgId}/${name}`),where('orgId','==',orgId)));
          for(const d of snap.docs){
            const x=d.data();
            const r=routeFor(x.routeId);
            if(r&&String(x.routeId)!==String(r.id)){
              await setDoc(doc(fs,`orgs/${orgId}/${name}`,d.id),{routeId:r.id},{merge:true});
            }
          }
        };
        await repairCollection('clients');
        await repairCollection('credits');
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        console.log('Préstamo Ya: reparación de asignaciones Cloud completada');
      }catch(e){console.error('Préstamo Ya: reparación Cloud:',e);}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();
