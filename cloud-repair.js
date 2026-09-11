import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{};
    const cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;

    const waitForFirebase=()=>new Promise((resolve,reject)=>{
      const started=Date.now();
      const tick=()=>{
        if(getApps().length)return resolve(getApp());
        if(Date.now()-started>15000)return reject(new Error('Firebase no se inicializó a tiempo'));
        setTimeout(tick,150);
      };
      tick();
    });

    const app=await waitForFirebase();
    const auth=getAuth(app);
    const fs=getFirestore(app);

    onAuthStateChanged(auth,async user=>{
      if(!user||window.__prestamoYaRepairDone)return;
      try{
        const orgId=cloud.orgId||'mi-cartera';
        const meSnap=await getDocs(query(collection(fs,'users'),where('uid','==',user.uid),where('orgId','==',orgId)));
        const me=meSnap.docs[0]?.data();
        if(!me||!['admin','supervisor'].includes(me.role))return;

        // Las colecciones dentro de /orgs/mi-cartera están protegidas por la ruta.
        // Para una reparación administrativa no debemos exigir que los documentos
        // antiguos ya tengan el campo orgId.
        const readOrgCollection=async name=>getDocs(collection(fs,`orgs/${orgId}/${name}`));
        const routesSnap=await readOrgCollection('routes');
        const routes=routesSnap.docs.map(d=>({docId:d.id,...d.data()}));
        const routeFor=value=>routes.find(r=>String(r.id??r.docId)===String(value)||String(r.name||'').trim().toLowerCase()===String(value||'').trim().toLowerCase());
        const routeIdOf=r=>String(r?.id??r?.docId);

        // Normaliza rutas de usuarios como texto para evitar que 123 y "123"
        // sean tratados como rutas distintas por Firestore Rules.
        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        for(const d of usersSnap.docs){
          const u=d.data();
          if(!Array.isArray(u.routeIds))continue;
          const fixed=[...new Set(u.routeIds.map(x=>routeIdOf(routeFor(x))||String(x)))];
          if(JSON.stringify(fixed)!==JSON.stringify(u.routeIds)){
            await setDoc(doc(fs,'users',d.id),{routeIds:fixed},{merge:true});
          }
        }

        const repairCollection=async name=>{
          const snap=await readOrgCollection(name);
          for(const d of snap.docs){
            const x=d.data();
            const r=routeFor(x.routeId);
            const fixedRoute=r?routeIdOf(r):(x.routeId==null?null:String(x.routeId));
            const patch={orgId};
            if(fixedRoute!==null&&String(x.routeId)!==String(fixedRoute))patch.routeId=fixedRoute;
            if(x.routeId!=null&&typeof x.routeId!=='string'&&!patch.routeId)patch.routeId=String(x.routeId);
            await setDoc(doc(fs,`orgs/${orgId}/${name}`,d.id),patch,{merge:true});
          }
        };

        await repairCollection('routes');
        await repairCollection('clients');
        await repairCollection('credits');
        window.__prestamoYaRepairDone=true;
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        console.log('Préstamo Ya: reparación Cloud completada');
      }catch(e){
        console.error('Préstamo Ya: reparación Cloud:',e);
        window.__prestamoYaRepairDone=false;
      }
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();