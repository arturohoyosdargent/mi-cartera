const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
test('both V2 deploy configurations preserve the /app, /core and /cloud URLs used by the installed PWA',()=>{
 const sw=fs.readFileSync('v2/app/service-worker.js','utf8'),shell=sw.match(/const SHELL=\[([^\]]+)\]/)[1],assets=[...shell.matchAll(/'([^']+)'/g)].map(x=>x[1]);
 for(const configFile of ['firebase.json','firebase.v2.json']){
  const config=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,'')),hosting=Array.isArray(config.hosting)?config.hosting.find(x=>x.target==='v2'):config.hosting;
  assert.equal(hosting.target,'v2');
  for(const [source,destination] of [['/','/app/index.html'],['/index.html','/app/index.html'],['/operational-shell.html','/app/operational-shell.html']]){
   assert.ok(hosting.redirects.some(x=>x.source===source&&x.destination===destination&&x.type===302),configFile+': '+source+' must reach the canonical PWA path');
  }
  const publicRoot=path.resolve(hosting.public);
  assert.ok(fs.existsSync(path.join(publicRoot,'app/operational-shell.html')),configFile+': installed PWA /app/operational-shell.html must exist in Hosting');
  for(const rel of assets){const asset=path.resolve(publicRoot,'app',rel==='./'?'index.html':rel);assert.ok(asset.startsWith(publicRoot+path.sep)&&fs.existsSync(asset),configFile+': '+rel)}
  assert.ok(hosting.headers.some(x=>x.source==='/app/release.json'&&x.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('no-store'))),configFile+': release must not stay in HTTP cache');
 }
});
