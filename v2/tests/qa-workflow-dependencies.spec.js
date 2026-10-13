const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/v2-greenfield-qa.yml'), 'utf8');
const dependencies = new Set(Object.keys(require('./package.json').dependencies));
const tests = fs.readdirSync(__dirname).filter(file => file.endsWith('.spec.js'));

// Follow local helpers without loading them: this guard must itself work before npm ci.
function requiresInstalledDependency(file, seen = new Set()) {
  if (seen.has(file)) return false;
  seen.add(file);
  const source = fs.readFileSync(file, 'utf8');
  for (const [, request] of source.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (dependencies.has(request)) return true;
    if (!request.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), request);
    const local = [base, base + '.js', base + '.cjs'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (local && /\.(?:js|cjs)$/.test(local) && requiresInstalledDependency(local, seen)) return true;
  }
  return false;
}

let installed = false;
let dependentRuns = 0;
for (const step of workflow.split(/^      - /m).slice(1)) {
  if (/\brun:\s*npm ci\b[^\n]*--prefix\s+v2\/tests\b/.test(step)) installed = true;
  const scheduled = [...step.matchAll(/\bnode\s+(v2\/tests\/[\w.-]+\.spec\.js)\b/g)].map(match => path.join(root, match[1]));
  if (/for\s+test\s+in\s+v2\/tests\/\*\.spec\.js/.test(step)) scheduled.push(...tests.map(file => path.join(__dirname, file)));
  for (const file of scheduled) {
    if (!requiresInstalledDependency(file)) continue;
    dependentRuns++;
    assert.ok(installed, `${path.basename(file)} requires installed test dependencies; npm ci --prefix v2/tests must run first`);
  }
}
assert.ok(installed, 'V2 QA must install the isolated test dependencies');
assert.ok(dependentRuns > 0, 'V2 QA must retain dependency-using DOM regression tests');
console.log('V2 QA workflow dependency ordering: PASS');
