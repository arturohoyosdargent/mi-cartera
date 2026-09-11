import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{};
    const cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;
    const waitForFirebase=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>15000)return reject(new Error('Firebase no se inicializó a tiempo'));setTimeout(tick,150);};tick();});
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
        const localRoutes=Array.isArray(window.db?.routes)?window.db.routes:[];
        const allRoutes=[...routes];
        for(const lr of localRoutes){if(!allRoutes.some(r=>String(r.id??r.docId)===String(lr.id)))allRoutes.push(lr);}
        const routeFor=value=>allRoutes.find(r=>String(r.id??r.docId)===String(value)||String(r.name||'').trim().toLowerCase()===String(value||'').trim().toLowerCase());
        const routeIdOf=r=>String(r?.id??r?.docId);
        for(const r of localRoutes){
          if(r?.id==null)continue;
          const payload={...r,orgId,routeId:String(r.id)};
          if(payload.collectorId)payload.collectorId=String(payload.collectorId);
          await setDoc(doc(fs,`orgs/${orgId}/routes`,String(r.id)),payload,{merge:true});
        }
        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        for(const d of usersSnap.docs){
          const u=d.data();
          const uname=String(u.name||'').trim().toLowerCase();
          const fixed=new Set(Array.isArray(u.routeIds)?u.routeIds.map(x=>routeIdOf(routeFor(x))||String(x)):[]);
          const matchesUser=r=>{
            const cid=String(r.collectorId||r.collectorUid||'');
            const cname=String(r.collectorName||r.cobrador||r.collector||'').trim().toLowerCase();
            return (cid&&cid===String(u.uid||d.id))||(cname&&uname&&cname===uname);
          };
          for(const r of allRoutes){if(matchesUser(r))fixed.add(routeIdOf(r));}
          // Si existe una sola ruta en la organización y el cobrador aún no tiene ruta,
          // esa es la asignación inequívoca para el escenario inicial de Préstamo Ya.
          if(fixed.size===0 && allRoutes.length===1 && u.role==='cobrador')fixed.add(routeIdOf(allRoutes[0]));
          const next=[...fixed].filter(Boolean);
          if(JSON.stringify(next)!==JSON.stringify(u.routeIds||[]))await setDoc(doc(fs,'users',d.id),{routeIds:next},{merge:true});
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
        const localClients=Array.isArray(window.db?.clients)?window.db.clients:[];
        for(const c of localClients){
          if(c?.id==null)continue;
          const r=routeFor(c.routeId);
          const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));
          if(routeId==null)continue;
          await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),{...c,orgId,routeId},{merge:true});
        }
        const localCredits=Array.isArray(window.db?.credits)?window.db.credits:[];
        for(const c of localCredits){
          if(c?.id==null)continue;
          const r=routeFor(c.routeId);
          const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));
          if(routeId==null)continue;
          await setDoc(doc(fs,`orgs/${orgId}/credits`,String(c.id)),{...c,orgId,routeId},{merge:true});
        }
        window.__prestamoYaRepairDone=true;
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        console.log('Préstamo Ya: reparación Cloud completada',{routes:allRoutes.length,clients:localClients.length,credits:localCredits.length});
      }catch(e){console.error('Préstamo Ya: reparación Cloud:',e);window.__prestamoYaRepairDone=false;}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();