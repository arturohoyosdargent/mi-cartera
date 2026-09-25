// Regression guard: pullCloud must persist, normalize and render the merged Cloud state.
const fs=require('fs');
const src=fs.readFileSync('firebase-cloud-core.js','utf8');
const m=src.match(/async function pullCloud\(\)\{([\s\S]*?)\n\}async function pushList/);
if(!m) throw new Error('pullCloud() not found');
const body=m[1];
const dedupe=body.lastIndexOf('dedupeClients(true);');
if(dedupe<0) throw new Error('pullCloud() does not finish client reconciliation');
const tail=body.slice(dedupe);
for(const required of ['saveCloudDb();','normalize();','renderAll();']){
  if(!tail.includes(required)) throw new Error('pullCloud persistence regression: missing '+required+' after dedupeClients(true)');
}
console.log('PASS pullCloud persists, normalizes and renders after Cloud merge');
