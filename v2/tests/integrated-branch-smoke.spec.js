const assert=require('assert');
const fs=require('fs');
const path=require('path');
const F=require('../core/financial-engine.js');
const S=require('../core/schedule-engine.js');

(()=>{
  assert.ok(F && F.STATUS && F.STATUS.ACTIVE==='ACTIVO');
  const schedule=S.generate({total:240,term:4,freq:'weekly',firstPaymentDate:'2026-09-20'});
  assert.deepEqual(schedule.map(x=>x.amount),[60,60,60,60]);

  // V2 pilot is intentionally isolated under v2/app. Validate that shell
  // instead of mixing it with the legacy root PWA (which uses sw.js).
  const appRoot=path.resolve(__dirname,'..','app');
  const required=['index.html','manifest.webmanifest','service-worker.js','release.json'];
  for(const file of required){
    assert.ok(fs.existsSync(path.join(appRoot,file)),`missing isolated V2 pilot asset: ${file}`);
  }

  const manifest=JSON.parse(fs.readFileSync(path.join(appRoot,'manifest.webmanifest'),'utf8'));
  assert.ok(manifest.name && manifest.short_name,'V2 pilot manifest identity is incomplete');
  assert.ok(manifest.start_url,'V2 pilot manifest start_url is required');

  const release=JSON.parse(fs.readFileSync(path.join(appRoot,'release.json'),'utf8'));
  assert.ok(release && Object.keys(release).length>0,'V2 canonical release metadata is required');

  const sw=fs.readFileSync(path.join(appRoot,'service-worker.js'),'utf8');
  assert.ok(sw.length>0,'V2 canonical service worker must not be empty');assert.ok(sw.includes(`const BUILD='${release.build}'`),'smoke: release and service worker builds must match');const shell=fs.readFileSync(path.join(appRoot,'operational-shell.html'),'utf8');for(const asset of ['version-guard.js','auth-cloud-gate.js','cloud-rehydration-v2.js','login-v2.js','durable-actions-stable6.js','renewal-actions-stable10.js','promise-actions-stable11.js'])assert.ok(new RegExp(`src="${asset.replace(/\\./g,'\\\\.')}((?:\\?v=[^\"]+)?)"`).test(shell),`smoke: operational shell missing ${asset}`);

  console.log('V2 integrated branch smoke: PASS');
})();
