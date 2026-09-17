const assert=require('assert');
const fs=require('fs');
const path=require('path');
const F=require('../core/financial-engine.js');
const S=require('../core/schedule-engine.js');

(()=>{
  assert.ok(F && F.STATUS && F.STATUS.ACTIVE==='ACTIVO');
  const schedule=S.generate({total:240,term:4,freq:'weekly',firstPaymentDate:'2026-09-20'});
  assert.deepEqual(schedule.map(x=>x.amount),[60,60,60,60]);

  // The canonical pilot shell is hosted from the repository root while
  // this smoke test lives under v2/tests. Validate the real release paths.
  const repoRoot=path.resolve(__dirname,'..','..');
  const required=['index.html','manifest.webmanifest','service-worker.js'];
  for(const file of required){
    assert.ok(fs.existsSync(path.join(repoRoot,file)),`missing canonical pilot asset: ${file}`);
  }

  const manifest=JSON.parse(fs.readFileSync(path.join(repoRoot,'manifest.webmanifest'),'utf8'));
  assert.ok(manifest.name && manifest.short_name,'pilot manifest identity is incomplete');
  assert.ok(manifest.start_url,'pilot manifest start_url is required');

  const sw=fs.readFileSync(path.join(repoRoot,'service-worker.js'),'utf8');
  assert.ok(sw.length>0,'canonical service worker must not be empty');

  console.log('V2 integrated branch smoke: PASS');
})();
