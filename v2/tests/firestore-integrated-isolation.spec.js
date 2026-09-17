const assert=require('assert');
const fs=require('fs');
const path=require('path');

(()=>{
  const rules=fs.readFileSync(path.join(__dirname,'../../firestore.rules'),'utf8');
  const pilot='v2-mi-cartera-pilot';

  // Exact pilot marker remains read-only and V1 remains present.
  assert.ok(rules.includes(`match /orgs/${pilot} {`),'pilot marker rule missing');
  assert.ok(rules.includes('allow write: if false;'),'pilot marker must remain non-writable');
  assert.ok(rules.includes('match /users/{uid} {'),'V1 user rules missing');
  assert.ok(rules.includes('match /orgs/{orgId}/clients/{id} {'),'shared client path missing');

  // Integrated rules must define an explicit V2 boundary so legacy V1 allows cannot
  // grant access to the pilot namespace through Firestore match OR semantics.
  assert.ok(rules.includes(`orgId != '${pilot}'`),'V1 namespace exclusion missing');
  assert.ok(/function\s+v2Member\s*\(/.test(rules),'V2 membership function missing');
  assert.ok(/function\s+v2Manager\s*\(/.test(rules),'V2 manager function missing');
  assert.ok(rules.includes(`/orgs/${pilot}/members/`),'V2 membership document path missing');

  // V2 destructive financial operations are forbidden.
  for(const collection of ['clients','credits','payments','audit']){
    const marker=`match /orgs/${pilot}/${collection}/{id} {`;
    const start=rules.indexOf(marker);
    assert.ok(start>=0,`V2 ${collection} rule missing`);
    const next=rules.indexOf('\n    match /',start+marker.length);
    const block=rules.slice(start,next<0?rules.length:next);
    assert.ok(block.includes('allow delete: if false;'),`V2 ${collection} delete must be denied`);
  }

  // Payments and audit are append-only in V2.
  for(const collection of ['payments','audit']){
    const marker=`match /orgs/${pilot}/${collection}/{id} {`;
    const start=rules.indexOf(marker);
    const next=rules.indexOf('\n    match /',start+marker.length);
    const block=rules.slice(start,next<0?rules.length:next);
    assert.ok(block.includes('allow update, delete: if false;'),`V2 ${collection} must be append-only`);
  }

  // Never introduce a global allow-all while integrating V2.
  assert.ok(!/match\s+\/\{document=\*\*\}[\s\S]*?allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(rules),'global allow-all detected');
  console.log('Integrated Firestore V1/V2 isolation guards: PASS');
})();
