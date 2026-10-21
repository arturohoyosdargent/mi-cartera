const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rules = fs.readFileSync(path.join(__dirname, '../cloud/recovered-production-20261004.rules'), 'utf8').replace(/\r\n/g, '\n');
assert.equal(crypto.createHash('sha256').update(rules).digest('hex'), '833c9c939eb81c70f3d5f0913b9c29108e61ceb563e74388e2b19a6107ecb8a6', 'The certified B2 production rules must remain unchanged');
const pilotStart = rules.indexOf('function v2Org(');
const legacyStart = rules.indexOf('match /users/{uid}');
assert.ok(pilotStart >= 0 && legacyStart > pilotStart, 'V2 and legacy rule boundaries must exist');
const pilotRules = rules.slice(pilotStart, legacyStart);
assert.ok(pilotRules.includes("function v2Org(orgId) { return orgId == 'v2-mi-cartera-pilot'; }"), 'Only the exact pilot organization is allowed');
assert.ok(pilotRules.includes('/members/$(request.auth.uid)'), 'V2 membership is required');
assert.ok(!/get\([^\n]*\/users\//.test(pilotRules), 'A V1 user profile cannot authorize V2');
assert.ok(pilotRules.includes('allow delete: if false'));
assert.ok(pilotRules.includes("collection in ['capital','entries','expenses','cashClosures','routes']"));
for (const collection of ['payments', 'audit']) {
  const collectionStart = pilotRules.indexOf('match /orgs/{orgId}/' + collection + '/{id} {');
  assert.ok(collectionStart >= 0, collection + ' must have an explicit rule');
  const collectionEnd = pilotRules.indexOf('\n    match ', collectionStart + 1);
  const collectionRules = pilotRules.slice(collectionStart, collectionEnd < 0 ? pilotRules.length : collectionEnd);
  assert.ok(collectionRules.includes('allow update, delete: if false;'), collection + ' must remain append-only');
}
assert.ok(rules.slice(legacyStart).includes('!v2Org(orgId)'), 'Legacy permissions must exclude the V2 pilot');
assert.ok(!/orgId\s*==\s*['"]mi-cartera['"]/.test(pilotRules));
console.log('V2 preserved B2 Firestore rules isolation: PASS');
