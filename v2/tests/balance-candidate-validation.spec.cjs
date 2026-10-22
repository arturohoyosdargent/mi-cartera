const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const {Window} = require('happy-dom');
const repository = path.resolve(process.env.SOURCE || 'v2', '..');
const read = relative => fs.readFileSync(path.join(repository, relative), 'utf8');
const build = 'v2-pilot-20261021-caja-operativa-1';
const manual = 'tools/balance-validation/';

test('the new candidate entry, worker response and runtime guard identify the same Balance release', async () => {
  const release = JSON.parse(read('v2/app/release.json'));
  assert.equal(release.build, build);
  assert.equal(release.version, build);
  const elements = {build:{}, openV2:{addEventListener(_event, callback){this.activate = callback;}}};
  let destination;
  const context = {document:{getElementById:id=>elements[id]}, navigator:{}, URL,
    location:{href:'https://fictional.invalid/app/',assign:url=>{destination=url;}}};
  for (const script of read('v2/app/index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script[1], context);
  elements.openV2.activate({preventDefault(){}});
  assert.equal(new URL(destination).searchParams.get('v'),build);
  const listeners = {};
  let response;
  vm.runInNewContext(read('v2/app/service-worker.js'),{self:{addEventListener:(name,callback)=>{listeners[name]=callback;}}});
  listeners.message({data:{type:'GET_BUILD'},source:{postMessage:message=>{response=message;}}});
  assert.equal(response.build, build);
  const window = {dispatchEvent(){}};
  vm.runInNewContext(read('v2/app/version-guard.js'),{window,document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},navigator:{},CustomEvent:class {}});
  assert.equal((await window.MiCarteraV2VersionGuard.verify()).publishedBuild, build);
});

test('the local validation server serves only the fictional preview and exact read-only candidate assets', async () => {
  const server = path.join(repository,manual,'serve.py');
  assert.ok(fs.existsSync(server),'The isolated validation server must exist');
  const python = process.env.PYTHON_FOR_TESTS || 'python';
  const child = spawn(python,[server,'--port','0'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  try {
    const address = await new Promise((resolve,reject)=>{
      const timeout = setTimeout(()=>reject(Error('Preview server startup timeout')),8000);
      let output = '';
      child.stdout.on('data',chunk=>{output+=chunk; if(output.includes('\n')){clearTimeout(timeout);resolve(JSON.parse(output.split('\n')[0]));}});
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('exit',code=>{clearTimeout(timeout);reject(Error('Preview server exited: '+code));});
    });
    const base = 'http://127.0.0.1:'+address.port;
    const page = await fetch(base+'/');
    assert.equal(page.status,200);
    assert.match(page.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.match(page.headers.get('content-security-policy'),/worker-src 'none'/);
    assert.ok((await page.text()).includes(build));
    for(const forbidden of ['/app/','/source/app/firebase-bootstrap.js','/source/app/durable-actions-v2.js','/source/app/operation-sync-bridge.js','/../firestore.rules','/%2e%2e/firestore.rules']) {
      assert.equal((await fetch(base+forbidden)).status,404,forbidden);
    }
    assert.equal((await fetch(base+'/',{method:'POST',body:'fictional'})).status,405);
    for(const asset of ['app/cash-menu-v2.js','app/partner-loans-ui.js','app/dashboard-parity-v2.js']) {
      assert.equal(await (await fetch(base+'/source/'+asset)).text(),read('v2/'+asset));
    }
  } finally { child.kill(); }
});

test('the PC and Xiaomi preview drives actual Balance scripts with fictional fixtures, scenario controls and a native sign-out', async () => {
  assert.ok(fs.existsSync(path.join(repository,manual,'preview.html')),'The manual validation page must exist');
  const window = new Window({url:'http://localhost:8765/',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});
  try {
    const html = read(manual+'preview.html').replaceAll('__CANDIDATE_BUILD__',build);
    window.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));
    window.HTMLElement.prototype.scrollIntoView = function(){};
    const context = vm.createContext(window);
    for(const match of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)) {
      const relative = match[1].startsWith('/source/') ? 'v2/'+match[1].slice('/source/'.length) : manual+match[1];
      vm.runInContext(read(relative),context,{filename:relative});
    }
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const document = window.document;
    assert.equal(document.getElementById('candidateVersion').textContent,build);
    for(const scenario of ['deficit','reservation']) {
      document.querySelector('[data-fixture="'+scenario+'"]').click();
      document.getElementById('cashSimCalculate').click();
      assert.match(document.getElementById('cashSimulationResult').textContent,/2,200\.00/);
    }
    const before = window.localStorage.getItem('mi-cartera-v2-validation-state');
    document.getElementById('previewSignOut').click();
    assert.equal(document.getElementById('cashBalance').textContent,'—');
    assert.equal(document.getElementById('mCapitalAvailable').textContent,'—');
    assert.ok(!document.getElementById('cashSimRate'));
    assert.equal(window.localStorage.getItem('mi-cartera-v2-validation-state'),before);
    assert.equal(window.MiCarteraV2SyncBridge.submit,undefined);
    document.getElementById('previewRestore').click();
    assert.equal(document.getElementById('cashSimRate').value,'10');
    assert.equal(window.firebaseSdkV2,undefined);
  } finally { window.happyDOM.abort(); }
});
