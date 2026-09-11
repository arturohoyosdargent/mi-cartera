import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
        const routeFor=value=>{const raw=String(value??'').trim();if(!raw)return null;if(byId.has(raw))return byId.get(raw);const matches=byName.get(raw.toLowerCase())||[];return matches.length===1?matches[0]:null;};
        for(const r of localRoutes){if(r?.id==null)continue;const payload={...r,orgId,routeId:String(r.id)};if(payload.collectorId)payload.collectorId=String(payload.collectorId);if(payload.collectorUid)payload.collectorUid=String(payload.collectorUid);await setDoc(doc(fs,`orgs/${orgId}/routes`,String(r.id)),payload,{merge:true});}
        const usersSnap=await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)));
        const users=usersSnap.docs.map(d=>({docId:d.id,...d.data()}));
        const norm=s=>String(s||'').trim().toLowerCase();
        for(const u of users){
          const uname=norm(u.name),uemail=norm(u.email),uuid=String(u.uid||u.docId),fixed=new Set(),current=Array.isArray(u.routeIds)?u.routeIds:[];
          for(const value of current){const r=routeFor(value);if(r)fixed.add(routeIdOf(r));}
          for(const r of allRoutes){const refs=[r.collectorId,r.collectorUid,r.collectorUserId].map(x=>String(x||'').trim()).filter(Boolean);const names=[r.collectorName,r.cobrador,r.collector].map(norm).filter(Boolean);if(refs.some(x=>x===uuid||norm(x)===uname||norm(x)===uemail)||names.some(x=>x===uname||x===uemail))fixed.add(routeIdOf(r));}
          if(fixed.size===0&&allRoutes.length===1&&u.role==='cobrador')fixed.add(routeIdOf(allRoutes[0]));
          const next=[...fixed].filter(Boolean);if(JSON.stringify(next)!==JSON.stringify(current))await setDoc(doc(fs,'users',u.docId),{routeIds:next},{merge:true});
        }
        const repairCollection=async name=>{const snap=await readOrgCollection(name);for(const d of snap.docs){const x=d.data(),r=routeFor(x.routeId),fixedRoute=r?routeIdOf(r):(x.routeId==null?null:String(x.routeId)),patch={orgId};if(fixedRoute!==null&&String(x.routeId)!==String(fixedRoute))patch.routeId=fixedRoute;if(x.routeId!=null&&typeof x.routeId!=='string'&&!patch.routeId)patch.routeId=String(x.routeId);await setDoc(doc(fs,`orgs/${orgId}/${name}`,d.id),patch,{merge:true});}};
        await repairCollection('routes');await repairCollection('clients');await repairCollection('credits');
        const localClients=Array.isArray(window.db?.clients)?window.db.clients:[];
        for(const c of localClients){if(c?.id==null)continue;const r=routeFor(c.routeId),routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));if(routeId==null)continue;await setDoc(doc(fs,`orgs/${orgId}/clients`,String(c.id)),{...c,orgId,routeId},{merge:true});}
        const localCredits=Array.isArray(window.db?.credits)?window.db.credits:[];
        for(const c of localCredits){if(c?.id==null)continue;const r=routeFor(c.routeId),routeId=r?routeIdOf(r):(c.routeId==null?null:String(c.routeId));if(routeId==null)continue;await setDoc(doc(fs,`orgs/${orgId}/credits`,String(c.id)),{...c,orgId,routeId},{merge:true});}
        const freshRoutes=(await readOrgCollection('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        const freshClients=(await readOrgCollection('clients')).docs.map(d=>({docId:d.id,...d.data()}));
        const freshCredits=(await readOrgCollection('credits')).docs.map(d=>({docId:d.id,...d.data()}));
        const groups=new Map();
        for(const r of freshRoutes){const n=norm(r.name);if(!n)continue;const list=groups.get(n)||[];list.push(r);groups.set(n,list);}
        for(const [name,list] of groups){
          if(list.length<2)continue;
          const assigned=list.filter(r=>String(r.collectorId||r.collectorUid||r.collectorUserId||r.collectorName||r.cobrador||r.collector||'').trim());
          if(assigned.length!==1)continue;
          const canonical=assigned[0],canonicalId=routeIdOf(canonical),extras=list.filter(r=>routeIdOf(r)!==canonicalId);
          for(const r of extras){
            const sourceId=routeIdOf(r);
            const movingClients=freshClients.filter(c=>String(c.routeId)===sourceId);
            const movingCredits=freshCredits.filter(c=>String(c.routeId)===sourceId);
            for(const c of movingClients)await setDoc(doc(fs,`orgs/${orgId}/clients`,c.docId),{orgId,routeId:canonicalId},{merge:true});
            for(const c of movingCredits)await setDoc(doc(fs,`orgs/${orgId}/credits`,c.docId),{orgId,routeId:canonicalId},{merge:true});
            // Los snapshots anteriores siguen conteniendo la cartera antigua; por eso verificamos Cloud otra vez.
            const verifyClients=(await readOrgCollection('clients')).docs.map(d=>d.data());
            const verifyCredits=(await readOrgCollection('credits')).docs.map(d=>d.data());
            const stillUsed=verifyClients.some(c=>String(c.routeId)===sourceId)||verifyCredits.some(c=>String(c.routeId)===sourceId);
            if(!stillUsed)await deleteDoc(doc(fs,`orgs/${orgId}/routes`,sourceId));
          }
          console.log('Préstamo Ya: ruta duplicada consolidada',{name,canonicalRoute:canonicalId,removed:extras.map(routeIdOf)});
        }
        window.__prestamoYaRepairDone=true;
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        console.log('Préstamo Ya: reparación Cloud completada',{routes:allRoutes.length,clients:localClients.length,credits:localCredits.length});
      }catch(e){console.error('Préstamo Ya: reparación Cloud:',e);window.__prestamoYaRepairDone=false;}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();
