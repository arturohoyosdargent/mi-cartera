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
    const uidOf=u=>String(u?.uid||u?.id||u?.docId||'');
    const onRoute=r=>String(r?.docId||'');
    const aliases=r=>new Set([onRoute(r),String(r?.id||''),String(r?.routeId||'')].filter(Boolean));
    onAuthStateChanged(auth,async user=>{
      if(!user||window.__prestamoYaRouteMigrationV2Done)return;
      try{
        const meSnap=await getDoc(doc(fs,'users',user.uid)),me=meSnap.exists()?meSnap.data():null;
        if(!me||me.role!=='admin')return;
        window.__prestamoYaRouteMigrationV2Done=true;
        let routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        const clients=(await read('clients')).docs.map(d=>({docId:d.id,...d.data()}));
        const credits=(await read('credits')).docs.map(d=>({docId:d.id,...d.data()}));
        const payments=(await read('payments')).docs.map(d=>({docId:d.id,...d.data()}));
        const users=(await getDocs(query(collection(fs,'users'),where('orgId','==',orgId)))).docs.map(d=>({docId:d.id,...d.data()}));
        const collectors=users.filter(u=>u.role==='cobrador'&&u.active!==false);
        for(const r of routes){
          const rid=onRoute(r);if(!rid)continue;
          const raw=String(r.collectorUid||r.collectorId||r.collectorUserId||'').trim();
          const owner=collectors.find(u=>raw&&[uidOf(u),String(u.email||''),String(u.name||'')].map(norm).includes(norm(raw)));
          const patch={orgId,routeId:rid};
          if(owner){patch.collectorUid=uidOf(owner);patch.collectorId=uidOf(owner);}
          await setDoc(doc(fs,`orgs/${orgId}/routes`,rid),patch,{merge:true});
        }
        routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        const groups=new Map();
        for(const r of routes){const name=norm(r.name);if(!name)continue;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(r);}
        const aliasToCanonical=new Map(),canonicalOwners=new Map();
        for(const [name,list] of groups){
          if(list.length<2)continue;
          const scored=list.map(r=>{
            const a=aliases(r),cl=clients.filter(x=>a.has(String(x.routeId))).length,cr=credits.filter(x=>a.has(String(x.routeId))).length,pay=payments.filter(x=>a.has(String(x.routeId))).length;
            const owner=collectors.find(u=>String(r.collectorUid||r.collectorId||'')===uidOf(u))||collectors.find(u=>Array.isArray(u.routeIds)&&u.routeIds.map(String).some(x=>a.has(x)));
            return {r,rid:onRoute(r),a,cl,cr,pay,owner,score:cl*100000+cr*1000+pay};
          });
          const data=scored.filter(x=>x.cl||x.cr||x.pay);if(data.length>1)continue;
          const canonical=data[0]||scored.slice().sort((a,b)=>Number(!!b.owner)-Number(!!a.owner)||b.score-a.score||a.rid.localeCompare(b.rid))[0];if(!canonical)continue;
          for(const item of scored)for(const a of item.a)aliasToCanonical.set(a,canonical.rid);
          const preferredOwner=canonical.owner||scored.find(x=>x.owner)?.owner;
          if(preferredOwner)canonicalOwners.set(canonical.rid,uidOf(preferredOwner));
          console.log('Préstamo Ya V2: ruta canónica',name,canonical.rid,canonical.cl,canonical.cr,canonical.pay,'owner',uidOf(preferredOwner));
        }
        for(const c of clients){const next=aliasToCanonical.get(String(c.routeId||''));if(next&&next!==String(c.routeId))await setDoc(doc(fs,`orgs/${orgId}/clients`,c.docId),{orgId,routeId:next},{merge:true});}
        for(const c of credits){const next=aliasToCanonical.get(String(c.routeId||''));if(next&&next!==String(c.routeId))await setDoc(doc(fs,`orgs/${orgId}/credits`,c.docId),{orgId,routeId:next},{merge:true});}
        const freshCredits=(await read('credits')).docs.map(d=>({docId:d.id,...d.data()})),creditRoute=new Map(freshCredits.map(c=>[String(c.id||c.docId),String(c.routeId||'')]));
        for(const p of payments){const next=aliasToCanonical.get(String(p.routeId||''))||creditRoute.get(String(p.creditId||''));if(next&&next!==String(p.routeId))await setDoc(doc(fs,`orgs/${orgId}/payments`,p.docId),{orgId,routeId:next},{merge:true});}
        routes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()}));
        for(const u of collectors){
          const ids=new Set();for(const x of Array.isArray(u.routeIds)?u.routeIds:[])ids.add(aliasToCanonical.get(String(x))||String(x));
          for(const r of routes){if(String(r.collectorUid||r.collectorId||'')===uidOf(u))ids.add(aliasToCanonical.get(onRoute(r))||onRoute(r));}
          const valid=[...ids].filter(id=>routes.some(r=>onRoute(r)===id));
          await setDoc(doc(fs,'users',u.docId),{routeIds:[...new Set(valid)]},{merge:true});
        }
        for(const [rid,uid] of canonicalOwners)await setDoc(doc(fs,`orgs/${orgId}/routes`,rid),{orgId,routeId:rid,collectorUid:uid,collectorId:uid},{merge:true});
        const verifyRoutes=(await read('routes')).docs.map(d=>({docId:d.id,...d.data()})),verifyClients=(await read('clients')).docs.map(d=>d.data()),verifyCredits=(await read('credits')).docs.map(d=>d.data()),verifyPayments=(await read('payments')).docs.map(d=>d.data()),removed=[];
        for(const [candidate,canonical] of aliasToCanonical){if(candidate===canonical||!verifyRoutes.some(r=>onRoute(r)===candidate))continue;const used=verifyClients.some(x=>String(x.routeId)===candidate)||verifyCredits.some(x=>String(x.routeId)===candidate)||verifyPayments.some(x=>String(x.routeId)===candidate);if(!used){await deleteDoc(doc(fs,`orgs/${orgId}/routes`,candidate));removed.push(candidate);}}
        const finalRoutes=(await read('routes')).docs.map(d=>({id:d.id,...d.data(),routeId:d.id}));
        if(window.db){window.db.routes=finalRoutes;(window.db.clients||[]).forEach(c=>{const next=aliasToCanonical.get(String(c.routeId||''));if(next)c.routeId=next;});(window.db.credits||[]).forEach(c=>{const next=aliasToCanonical.get(String(c.routeId||''));if(next)c.routeId=next;});(window.db.payments||[]).forEach(p=>{const cr=(window.db.credits||[]).find(c=>String(c.id)===String(p.creditId));if(cr?.routeId)p.routeId=cr.routeId;});if(typeof window.persist==='function')window.persist();if(typeof window.renderAll==='function')window.renderAll();}
        window.__prestamoYaRouteMigrationReport={routes:finalRoutes.map(r=>({id:r.id,name:r.name,collectorUid:r.collectorUid||r.collectorId||null})),removed,moved:Object.fromEntries(aliasToCanonical)};
        console.log('Préstamo Ya V2: reparación terminada',window.__prestamoYaRouteMigrationReport);
      }catch(e){window.__prestamoYaRouteMigrationV2Done=false;console.error('Préstamo Ya V2: error de reparación',e);}
    });
  }catch(e){console.error('Préstamo Ya V2: no se pudo iniciar',e);}
})();