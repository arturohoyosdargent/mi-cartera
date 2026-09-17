const assert=require('assert');
const fs=require('fs');
const path=require('path');

(()=>{
  const rules=fs.readFileSync(path.join(__dirname,'../../firestore.rules'),'utf8');
  const pilot='v2-mi-cartera-pilot';

  assert.ok(rules.includes(`match /orgs/${pilot} {`),'pilot marker rule missing');
  assert.ok(rules.includes('allow write: if false;'),'pilot marker must remain non-writable');
  assert.ok(rules.includes('match /users/{uid} {'),'V1 user rules missing');

  // V2 boundary: exact pilot org + separate membership, never the legacy /users profile alone.
  assert.ok(rules.includes(`function v2Org(orgId) { return orgId == '${pilot}'; }`),'exact V2 org boundary missing');
  assert.ok(/function\s+v2Member\s*\(/.test(rules),'V2 membership function missing');
  assert.ok(/function\s+v2Manager\s*\(/.test(rules),'V2 manager function missing');
  assert.ok(rules.includes('/documents/orgs/$(orgId)/members/$(request.auth.uid)'),'V2 membership document lookup missing');
  assert.ok(rules.includes('match /orgs/{orgId}/members/{uid} {'),'V2 membership rule missing');
  assert.ok(rules.includes('allow create, update, delete: if false;'),'browser must not provision V2 membership');

  // Every legacy V1 org collection rule must explicitly exclude the V2 pilot namespace.
  for(const collection of ['routes','clients','credits','payments','cashClosures','approvals']){
    const marker=`match /orgs/{orgId}/${collection}/{id} {`;
    const starts=[]; let pos=0;
    while((pos=rules.indexOf(marker,pos))>=0){starts.push(pos);pos+=marker.length;}
    assert.ok(starts.length>=1,`${collection} rules missing`);
    const legacyStart=starts[starts.length-1];
    const next=rules.indexOf('\n    match /',legacyStart+marker.length);
    const block=rules.slice(legacyStart,next<0?rules.length:next);
    assert.ok(block.includes('!v2Org(orgId)'),`V1 ${collection} must exclude V2 namespace`);
  }
  const genericMarker='match /orgs/{orgId}/{collection}/{id} {';
  const genericStart=rules.lastIndexOf(genericMarker);
  assert.ok(genericStart>=0,'legacy generic org rule missing');
  const genericBlock=rules.slice(genericStart);
  assert.ok(genericBlock.includes('!v2Org(orgId)'),'legacy generic org rule must exclude V2 namespace');

  // Explicit V2 financial paths use v2Org() and forbid destructive operations.
  for(const collection of ['clients','credits','payments','audit']){
    const marker=`match /orgs/{orgId}/${collection}/{id} {`;
    const start=rules.indexOf(marker);
    assert.ok(start>=0,`V2 ${collection} rule missing`);
    const next=rules.indexOf('\n    match /',start+marker.length);
    const block=rules.slice(start,next<0?rules.length:next);
    assert.ok(block.includes('v2Org(orgId)'),`V2 ${collection} must enforce pilot namespace`);
    assert.ok(block.includes('allow delete: if false;')||block.includes('allow update, delete: if false;'),`V2 ${collection} delete must be denied`);
  }

  for(const collection of ['payments','audit']){
    const marker=`match /orgs/{orgId}/${collection}/{id} {`;
    const start=rules.indexOf(marker);
    const next=rules.indexOf('\n    match /',start+marker.length);
    const block=rules.slice(start,next<0?rules.length:next);
    assert.ok(block.includes('allow update, delete: if false;'),`V2 ${collection} must be append-only`);
  }

  assert.ok(!/match\s+\/\{document=\*\*\}[\s\S]*?allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(rules),'global allow-all detected');
  console.log('Integrated Firestore V1/V2 isolation guards: PASS');
})();
