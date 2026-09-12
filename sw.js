const CACHE='prestamo-ya-v9';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./backup.js','./firebase-config.js','./firebase-cloud.js','./firebase-cloud-core.js','./cloud-repair-v2.js','./ownership-model.js','./session-switch.js','./data-integrity.js','./field-collection-sync.js','./credit-proposal.js','./client-sync-repair.js','./sync-queue-v3.js','./history-detail.js','./cloud-ui-fixes.js','./credit-share-v2.js','./sync-ui-fix.js','./renewal-buttons-fix.js','./renewal-schedule-correction.js','./address-navigation.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
 const isApp=u.pathname.endsWith('/index.html')||u.pathname.endsWith('/')||u.pathname.endsWith('.js');
 if(isApp){
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r&&r.ok){caches.open(CACHE).then(c=>c.put(e.request,r.clone())).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
  return;
 }
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{if(x&&x.ok){caches.open(CACHE).then(c=>c.put(e.request,x.clone())).catch(()=>{})}return x}).catch(()=>caches.match('./index.html'))));
});
