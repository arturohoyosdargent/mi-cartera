const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8').replace(/^\uFEFF/,''));
if(cfg.hosting?.target!=='v2') throw new Error('hosting target must be v2');
if(cfg.hosting?.public!=='v2') throw new Error('hosting public must be v2 so /app and shared core/cloud are published together');
const redirect=(cfg.hosting.redirects||[]).find(x=>x.source==='/');
if(!redirect||redirect.destination!=='/app/') throw new Error('root must redirect to /app/');
for(const rel of ['v2/app/index.html','v2/app/service-worker.js','v2/app/release.json','v2/core/financial-engine.js','v2/core/transaction-store.js','v2/cloud/firestore-atomic-adapter.js','v2/cloud/operational-sync.js','v2/cloud/runtime-cloud.js']){
  if(!fs.existsSync(path.join(root,rel))) throw new Error('missing published runtime asset: '+rel);
}
const sw=fs.readFileSync(path.join(root,'v2/app/service-worker.js'),'utf8');
const m=sw.match(/const SHELL=\[(.*?)\];/s);
if(!m) throw new Error('service worker SHELL not found');
const entries=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
for(const entry of entries){
  if(/^https?:/.test(entry)) continue;
  const disk=path.resolve(root,'v2/app',entry.split('?')[0]);
  if(!fs.existsSync(disk)) throw new Error('service worker references unpublished/missing asset: '+entry);
}
console.log('V2 hosting layout OK: /app + core + cloud + service worker assets are publishable');
