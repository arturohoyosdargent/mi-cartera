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

        const readOrgCollection=async name=>getDocs(collection(fs,`orgs/${orgId}/${name}`));
        const routesSnap=await readOrgCollection('routes');
        const routes=routesSnap.docs.map(d=>({docId:d.id,...d.data()}));
        const routeFor=value=>routes.find(r=>String(r.id??r.docId)===String(value)||String(r.name||'').trim().toLowerCase()===String(value||'').trim().toLowerCase());
        const routeIdOf=r=>String(r?.id??r?.docId);

        // 1) Normaliza y completa las rutas publicadas en Cloud.
        for(const d of routesSnap.docs){
          const r=d.data();
          const rid=routeIdOf({id:r.id,docId:d.id});
          const patch={orgId,routeId:rid};
          if(r.id==null)patch.id=rid;
          await setDoc(doc(fs,`orgs/${orgId}/routes`,d.id),patch,{merge:true});
        }

        // 2) Si el administrador ya tiene rutas/clientes/créditos locales,
        // publícalos explícitamente para que Cloud no dependa de una migración parcial.
        const localRoutes=Array.isArray(window.db?.routes)?window.db.routes:[];
        for(const r of localRoutes){
          if(r?.id==null)continue;
          await setDoc(doc(fs,`orgs/${orgId}/routes`,String(r.id)),{...r,orgId,id:r.id},{merge:true});
        }
        const localClients=Array.isArray(window.db?.clients)?window.db.clients:[];
        for(const c of localClients){
          if(c?.id==null)continue;
          const r=routeFor(c.routeId);
          const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));
          const payload={...c,orgId};
          if(routeId!==null)payload.routeId=String(routeId);
          await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),payload,{merge:true});
        }
        const localCredits=Array.isArray(window.db?.credits)?window.db.credits:[];
        for(const c of localCredits){
          if(c?.id==null)continue;
          const r=routeFor(c.routeId);
          const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));
          const payload={...c,orgId};
          if(routeId!==null)payload.routeId=String(routeId);
          await setDoc(doc(fs,`orgs/${orgId}/credits`,String(c.id)),payload,{merge:true});
        }

        // 3) Normaliza usuarios y, sobre todo, asigna al cobrador las rutas
        // cuyo collectorId corresponde a su UID.
        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        const routesByCollector=new Map();
        for(const r of routes){
          if(r.collectorId){
            const key=String(r.collectorId);
            if(!routesByCollector.has(key))routesByCollector.set(key,[]);
            routesByCollector.get(key).push(routeIdOf(r));
          }
        }
        for(const d of usersSnap.docs){
          const u=d.data();
          const fromProfile=Array.isArray(u.routeIds)?u.routeIds:[];
          const fromRoutes=routesByCollector.get(String(u.uid||d.id))||[];
          const fixed=[...new Set([...fromProfile,...fromRoutes].map(x=>routeIdOf(routeFor(x))||String(x)))];
          const patch={routeIds:fixed};
          if(JSON.stringify(fixed)!==JSON.stringify(fromProfile)){
            await setDoc(doc(fs,'users',d.id),patch,{merge:true});
          }
        }

        // 4) Relee y normaliza clientes/créditos existentes en Cloud, incluso
        // los documentos antiguos que no tenían orgId o tenían routeId numérico.
        const repairCollection=async name=>{
          const snap=await readOrgCollection(name);
          for(const d of snap.docs){
            const x=d.data();
            const r=routeFor(x.routeId);
            const fixedRoute=r?routeIdOf(r):(x.routeId==null?null:String(x.routeId));
            const patch={orgId};
            if(fixedRoute!==null)patch.routeId=String(fixedRoute);
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