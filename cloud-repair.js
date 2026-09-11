import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(async()=>{
  try{
    const cfg=window.MI_CARTERA_FIREBASE||{},cloud=window.MI_CARTERA_CLOUD||{};
    if(!cloud.cloudEnabled||!cfg.projectId)return;
    const waitForFirebase=()=>new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(getApps().length)return resolve(getApp());if(Date.now()-started>15000)return reject(new Error('Firebase no se inicializó a tiempo'));setTimeout(tick,150);};tick();});
    const app=await waitForFirebase(),auth=getAuth(app),fs=getFirestore(app);
    onAuthStateChanged(auth,user=>{
      if(!user||window.__prestamoYaRepairStarted)return;
      window.__prestamoYaRepairStarted=true;
      setTimeout(async()=>{
        try{
          const orgId=cloud.orgId||'mi-cartera';
          const meSnap=await getDoc(doc(fs,'users',user.uid));
          const me=meSnap.exists()?meSnap.data():null;
          if(!me||!['admin','supervisor'].includes(me.role)){window.__prestamoYaRepairDone=true;return;}
          const read=async name=>getDocs(collection(fs,`orgs/${orgId}/${name}`));
          const norm=s=>String(s??'').trim().toLowerCase();
          const routeIdOf=r=>String(r?.id??r?.routeId??r?.docId??'');
          const routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
          const groups=new Map();
          for(const r of routes){const n=norm(r.name);if(!n)continue;const a=groups.get(n)||[];a.push(r);groups.set(n,a);}

          // Primero consolidamos Cloud. La ruta asignada a un cobrador es la canónica.
          for(const [name,list] of groups){
            if(list.length<2)continue;
            const assigned=list.filter(r=>String(r.collectorId||r.collectorUid||r.collectorUserId||r.collectorName||r.cobrador||r.collector||'').trim());
            if(assigned.length!==1)continue;
            const canonical=assigned[0],canonicalId=routeIdOf(canonical);
            for(const r of list){
              const sourceId=routeIdOf(r);if(sourceId===canonicalId)continue;
              const clients=(await read('clients')).docs.map(d=>({docId:d.id,...d.data()})).filter(c=>String(c.routeId)===sourceId);
              const credits=(await read('credits')).docs.map(d=>({docId:d.id,...d.data()})).filter(c=>String(c.routeId)===sourceId);
              for(const c of clients)await setDoc(doc(fs,`orgs/${orgId}/clients`,c.docId),{orgId,routeId:canonicalId},{merge:true});
              for(const c of credits)await setDoc(doc(fs,`orgs/${orgId}/credits`,c.docId),{orgId,routeId:canonicalId},{merge:true});
              const verifyClients=(await read('clients')).docs.map(d=>d.data());
              const verifyCredits=(await read('credits')).docs.map(d=>d.data());
              if(!verifyClients.some(c=>String(c.routeId)===sourceId)&&!verifyCredits.some(c=>String(c.routeId)===sourceId))await deleteDoc(doc(fs,`orgs/${orgId}/routes`,sourceId));
            }
            console.log('Préstamo Ya: grupo de rutas consolidado',{name,canonicalRoute:canonicalId});
          }

          // Refrescamos las rutas después de la consolidación y corregimos la asignación del cobrador.
          const finalRoutes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
          const byId=new Map(finalRoutes.map(r=>[routeIdOf(r),r]));
          const byName=new Map();
          for(const r of finalRoutes){const n=norm(r.name);if(!n)continue;const a=byName.get(n)||[];a.push(r);byName.set(n,a);}
          const resolve=value=>{const raw=String(value??'').trim();if(!raw)return null;if(byId.has(raw))return byId.get(raw);const a=byName.get(norm(raw))||[];return a.length===1?a[0]:null;};
          const users=(await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)))).docs.map(d=>({docId:d.id,...d.data()}));
          for(const u of users){
            const fixed=new Set(),current=Array.isArray(u.routeIds)?u.routeIds:[],uuid=String(u.uid||u.docId),uname=norm(u.name),uemail=norm(u.email);
            for(const value of current){const r=resolve(value);if(r)fixed.add(routeIdOf(r));}
            for(const r of finalRoutes){
              const refs=[r.collectorId,r.collectorUid,r.collectorUserId].map(x=>String(x||'').trim()).filter(Boolean);
              const names=[r.collectorName,r.cobrador,r.collector].map(norm).filter(Boolean);
              if(refs.some(x=>x===uuid||norm(x)===uname||norm(x)===uemail)||names.some(x=>x===uname||x===uemail))fixed.add(routeIdOf(r));
            }
            const next=[...fixed].filter(Boolean);
            if(JSON.stringify(next)!==JSON.stringify(current)&&u.docId===u.uid)await setDoc(doc(fs,'users',u.docId),{routeIds:next},{merge:true});
          }

          // Publicamos solo la relación de los datos locales que ya tienen un ID de ruta resoluble.
          const localRoutes=Array.isArray(window.db?.routes)?window.db.routes:[];
          for(const r of localRoutes){if(r?.id==null)continue;const resolved=resolve(r.id)||resolve(r.routeId)||null;if(!resolved)continue;await setDoc(doc(fs,`orgs/${orgId}/routes`,routeIdOf(resolved)),{...r,orgId,routeId:routeIdOf(resolved)},{merge:true});}
          window.__prestamoYaRepairDone=true;
          if(typeof window.cloudSyncNow==='function')await window.cloudSyncNow();
          console.log('Préstamo Ya: reparación Cloud completada',{routes:finalRoutes.length});
        }catch(e){window.__prestamoYaRepairStarted=false;window.__prestamoYaRepairDone=false;console.error('Préstamo Ya: reparación Cloud:',e);}
      },2500);
    });
  }catch(e){console.error('Préstamo Ya: no se pudo iniciar reparación Cloud',e);}
})();