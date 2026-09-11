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
        for(const lr of localRoutes){if(lr?.id==null)continue;const id=String(lr.id);if(!allRoutes.some(r=>String(r.id??r.docId)===id))allRoutes.push(lr);}
        const routeIdOf=r=>String(r?.id??r?.docId);
        const byId=new Map(allRoutes.map(r=>[routeIdOf(r),r]));
        const byName=new Map();
        for(const r of allRoutes){const n=String(r.name||'').trim().toLowerCase();if(!n)continue;const list=byName.get(n)||[];list.push(r);byName.set(n,list);}
        // Un nombre de ruta solo es válido como referencia si es único. Los IDs siempre tienen prioridad.
        const routeFor=value=>{const raw=String(value??'').trim();if(!raw)return null;if(byId.has(raw))return byId.get(raw);const matches=byName.get(raw.toLowerCase())||[];return matches.length===1?matches[0]:null;};

        for(const r of localRoutes){
          if(r?.id==null)continue;
          const payload={...r,orgId,routeId:String(r.id)};
          if(payload.collectorId)payload.collectorId=String(payload.collectorId);
          if(payload.collectorUid)payload.collectorUid=String(payload.collectorUid);
          await setDoc(doc(fs,`orgs/${orgId}/routes`,String(r.id)),payload,{merge:true});
        }

        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        const users=usersSnap.docs.map(d=>({docId:d.id,...d.data()}));
        for(const u of users){
          const uname=String(u.name||'').trim().toLowerCase();
          const fixed=new Set();
          const current=Array.isArray(u.routeIds)?u.routeIds:[];
          for(const value of current){const r=routeFor(value);if(r)fixed.add(routeIdOf(r));}
          for(const r of allRoutes){
            const cid=String(r.collectorId||r.collectorUid||'').trim();
            const cname=String(r.collectorName||r.cobrador||r.collector||'').trim().toLowerCase();
            if((cid&&cid===String(u.uid||u.docId))||(cname&&uname&&cname===uname))fixed.add(routeIdOf(r));
          }
          if(fixed.size===0&&allRoutes.length===1&&u.role==='cobrador')fixed.add(routeIdOf(allRoutes[0]));
          const next=[...fixed].filter(Boolean);
          if(JSON.stringify(next)!==JSON.stringify(current))await setDoc(doc(fs,'users',u.docId),{routeIds:next},{merge:true});
        }

        const repairCollection=async name=>{
          const snap=await readOrgCollection(name);
          for(const d of snap.docs){
            const x=d.data();const r=routeFor(x.routeId);const fixedRoute=r?routeIdOf(r):(x.routeId==null?null:String(x.routeId));const patch={orgId};
            if(fixedRoute!==null&&String(x.routeId)!==String(fixedRoute))patch.routeId=fixedRoute;
            if(x.routeId!=null&&typeof x.routeId!=='string'&&!patch.routeId)patch.routeId=String(x.routeId);
            await setDoc(doc(fs,`orgs/${orgId}/${name}`,d.id),patch,{merge:true});
          }
        };
        await repairCollection('routes');
        await repairCollection('clients');
        await repairCollection('credits');

        const localClients=Array.isArray(window.db?.clients)?window.db.clients:[];
        for(const c of localClients){if(c?.id==null)continue;const r=routeFor(c.routeId);const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));if(routeId==null)continue;await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),{...c,orgId,routeId},{merge:true});}
        const localCredits=Array.isArray(window.db?.credits)?window.db.credits:[];
        for(const c of localCredits){if(c?.id==null)continue;const r=routeFor(c.routeId);const routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));if(routeId==null)continue;await setDoc(doc(fs,`orgs/${orgId}/credits`,String(c.id)),{...c,orgId,routeId},{merge:true});}

        // Migración segura del caso observado: si un cobrador tiene una ruta vacía y existe
        // exactamente una ruta con el mismo nombre que contiene clientes, mueve esa cartera.
        const clientsSnap=await readOrgCollection('clients');
        const cloudClients=clientsSnap.docs.map(d=>({docId:d.id,...d.data()}));
        for(const u of users){
          if(u.role!=='cobrador')continue;
          const assigned=(Array.isArray(u.routeIds)?u.routeIds:[]).map(String).filter(x=>byId.has(x));
          for(const rid of assigned){
            const target=byId.get(rid);if(!target)continue;
            if(cloudClients.some(c=>String(c.routeId)===rid))continue;
            const name=String(target.name||'').trim().toLowerCase();if(!name)continue;
            const siblings=(byName.get(name)||[]).filter(r=>routeIdOf(r)!==rid);
            const populated=siblings.filter(r=>cloudClients.some(c=>String(c.routeId)===routeIdOf(r)));
            if(populated.length!==1)continue;
            const sourceId=routeIdOf(populated[0]);
            const moving=cloudClients.filter(c=>String(c.routeId)===sourceId);
            for(const c of moving){await setDoc(doc(fs,`orgs/${orgId}/clients`,c.docId),{orgId,routeId:rid},{merge:true});c.routeId=rid;}
            const creditsSnap=await readOrgCollection('credits');
            for(const d of creditsSnap.docs){const cr=d.data();if(String(cr.routeId)===sourceId)await setDoc(doc(fs,`orgs/${orgId}/credits`,d.id),{orgId,routeId:rid},{merge:true});}
            console.log('Préstamo Ya: cartera migrada a ruta del cobrador',{user:u.name,sourceRoute:sourceId,targetRoute:rid,clients:moving.length});
          }
        }
        window.__prestamoYaRepairDone=true;
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        console.log('Préstamo Ya: reparación Cloud completada',{routes:allRoutes.length,clients:localClients.length,credits:localCredits.length});
      }catch(e){console.error('Préstamo Ya: reparación Cloud:',e);window.__prestamoYaRepairDone=false;}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();
