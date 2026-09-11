import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;
    const waitForFirebase=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>15000)return reject(new Error('Firebase no se inicializó a tiempo'));setTimeout(tick,150);};tick();});
    const app=await waitForFirebase(),auth=getAuth(app),fs=getFirestore(app),orgId=cloud.orgId||'mi-cartera';
    const read=async name=>getDocs(collection(fs,`orgs/${orgId}/${name}`));
    const norm=s=>String(s??'').trim().toLowerCase();
    const routeIdOf=r=>String(r?.id??r?.routeId??r?.docId??'');
    const uidOf=u=>String(u?.uid||u?.id||u?.docId||'');
    onAuthStateChanged(auth,async user=>{
      if(!user||window.__prestamoYaRouteMigrationDone)return;
      window.__prestamoYaRouteMigrationDone=true;
      try{
        const meSnap=await getDoc(doc(fs,'users',user.uid)),me=meSnap.exists()?meSnap.data():null;
        if(!me||me.role!=='admin')return;
        let routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        const clients=(await read('clients')).docs.map(d=>({docId:d.id,...d.data()}));
        const credits=(await read('credits')).docs.map(d=>({docId:d.id,...d.data()}));
        const payments=(await read('payments')).docs.map(d=>({docId:d.id,...d.data()}));
        const users=(await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)))).docs.map(d=>({docId:d.id,...d.data()}));
        const collectors=users.filter(u=>u.role==='cobrador'&&u.active!==false);
        // La ruta se identifica por ID. La asignación se normaliza a Firebase UID.
        for(const r of routes){
          const raw=String(r.collectorUid||r.collectorId||r.collectorUserId||'').trim();
          const match=collectors.find(u=>raw&&[uidOf(u),String(u.email||''),String(u.name||'')].map(norm).includes(norm(raw)));
          if(match){const uid=uidOf(match);await setDoc(doc(fs,`orgs/${orgId}/routes`,routeIdOf(r)),{orgId,routeId:routeIdOf(r),collectorUid:uid,collectorId:uid},{merge:true});r.collectorUid=uid;r.collectorId=uid;}
        }
        routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        const routeGroups=new Map();for(const r of routes){const name=norm(r.name);if(!name)continue;const a=routeGroups.get(name)||[];a.push(r);routeGroups.set(name,a);}
        const userAssignedIds=new Map();
        for(const u of collectors){const ids=new Set((Array.isArray(u.routeIds)?u.routeIds:[]).map(String));for(const r of routes)if(String(r.collectorUid||r.collectorId||'')===uidOf(u))ids.add(routeIdOf(r));userAssignedIds.set(uidOf(u),ids);}
        const canonicalByOldId=new Map();
        for(const [name,list] of routeGroups){
          if(list.length<2)continue;
          const scored=list.map(r=>{const rid=routeIdOf(r),assigned=collectors.some(u=>userAssignedIds.get(uidOf(u))?.has(rid)),c=clients.filter(x=>String(x.routeId)===rid).length,cr=credits.filter(x=>String(x.routeId)===rid).length,p=payments.filter(x=>String(x.routeId)===rid).length;return {rid,assigned,score:c*100000+cr*1000+p};});
          const assigned=scored.filter(x=>x.assigned);
          // Si hay dos rutas del mismo nombre legítimamente asignadas, NO se mezclan.
          if(assigned.length>1)continue;
          const pool=assigned.length?assigned:scored;pool.sort((a,b)=>Number(b.assigned)-Number(a.assigned)||b.score-a.score||a.rid.localeCompare(b.rid));
          const canonical=pool[0];if(!canonical)continue;
          for(const item of scored)if(item.rid!==canonical.rid)canonicalByOldId.set(item.rid,canonical.rid);
          console.log('Préstamo Ya: ruta canónica',{name,canonical:canonical.rid,duplicates:scored.filter(x=>x.rid!==canonical.rid).map(x=>x.rid)});
        }
        for(const c of clients){const next=canonicalByOldId.get(String(c.routeId??''));if(next)await setDoc(doc(fs,`orgs/${orgId}/clients`,c.docId),{orgId,routeId:next},{merge:true});}
        for(const c of credits){const next=canonicalByOldId.get(String(c.routeId??''));if(next)await setDoc(doc(fs,`orgs/${orgId}/credits`,c.docId),{orgId,routeId:next},{merge:true});}
        const freshCredits=(await read('credits')).docs.map(d=>d.data()),creditRoute=new Map(freshCredits.map(c=>[String(c.id),String(c.routeId??'')]));
        for(const p of payments){const rid=creditRoute.get(String(p.creditId));const next=canonicalByOldId.get(String(p.routeId??''))||rid;if(next)await setDoc(doc(fs,`orgs/${orgId}/payments`,p.docId),{orgId,routeId:next},{merge:true});}
        routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        for(const u of collectors){const ids=new Set();for(const value of Array.isArray(u.routeIds)?u.routeIds:[]){const raw=String(value);ids.add(canonicalByOldId.get(raw)||raw);}for(const r of routes)if(String(r.collectorUid||r.collectorId||'')===uidOf(u))ids.add(routeIdOf(r));const valid=[...ids].filter(id=>routes.some(r=>routeIdOf(r)===id));await setDoc(doc(fs,'users',u.docId),{routeIds:valid},{merge:true});}
        const verifyClients=(await read('clients')).docs.map(d=>d.data()),verifyCredits=(await read('credits')).docs.map(d=>d.data()),verifyPayments=(await read('payments')).docs.map(d=>d.data());
        for(const [oldId] of canonicalByOldId){const used=verifyClients.some(x=>String(x.routeId)===oldId)||verifyCredits.some(x=>String(x.routeId)===oldId)||verifyPayments.some(x=>String(x.routeId)===oldId);if(!used)await deleteDoc(doc(fs,`orgs/${orgId}/routes`,oldId));}
        const finalRoutes=(await read('routes')).docs.map(d=>({id:d.id,...d.data()}));
        if(window.db){window.db.routes=finalRoutes;(window.db.clients||[]).forEach(c=>{const next=canonicalByOldId.get(String(c.routeId));if(next)c.routeId=next;});(window.db.credits||[]).forEach(c=>{const next=canonicalByOldId.get(String(c.routeId));if(next)c.routeId=next;});(window.db.payments||[]).forEach(p=>{const cr=(window.db.credits||[]).find(c=>String(c.id)===String(p.creditId));if(cr?.routeId)p.routeId=cr.routeId;});if(typeof window.persist==='function')window.persist();if(typeof window.renderAll==='function')window.renderAll();}
        if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
        window.__prestamoYaRouteMigrationReport={routes:finalRoutes.map(r=>({id:r.id,name:r.name,code:r.code||null,collectorUid:r.collectorUid||r.collectorId||null})),moved:Object.fromEntries(canonicalByOldId)};
        console.log('Préstamo Ya: migración estructural de rutas completada',window.__prestamoYaRouteMigrationReport);
      }catch(e){window.__prestamoYaRouteMigrationDone=false;console.error('Préstamo Ya: migración estructural de rutas:',e);}
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar migración de rutas',e);}
})();