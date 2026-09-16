const CACHE='mi-cartera-pro-v2-shell-1';
const SHELL=['./','./index.html','./self-check.js','./manifest.webmanifest','../core/financial-engine.js','../core/transaction-store.js','../core/operation-builders.js','../core/offline-operation-queue.js','../core/runtime.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mi-cartera-pro-v2-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));});
