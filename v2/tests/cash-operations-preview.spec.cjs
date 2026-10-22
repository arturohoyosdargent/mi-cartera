const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Window} = require('happy-dom');
const repository = path.resolve(process.env.SOURCE || 'v2','..');
const read = relative => fs.readFileSync(path.join(repository,relative),'utf8');

test('the prepared operational preview opens the business panel with linked fictional credits and receipts, not the simulator',()=>{
  const window = new Window({url:'http://localhost:8766/',settings:{disableJavaScriptFileLoading:true,disableJavaScriptEvaluation:true}});
  try{
    const build=JSON.parse(read('v2/app/release.json')).build;
    const html=read('tools/balance-validation/preview.html').replaceAll('__CANDIDATE_BUILD__',build);
    window.document.write(html.replace(/<script[\s\S]*?<\/script>/g,''));
    window.HTMLElement.prototype.scrollIntoView=function(){};
    const context=vm.createContext(window);
    for(const match of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)){
      const relative=match[1].startsWith('/source/')?'v2/'+match[1].slice('/source/'.length):'tools/balance-validation/'+match[1];
      vm.runInContext(read(relative),context,{filename:relative});
    }
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const document=window.document;
    assert.match(document.getElementById('cashOpPhysical').textContent,/1,635\.00/);
    assert.match(document.getElementById('cashOpAvailable').textContent,/1,560\.00/);
    assert.match(document.getElementById('cashPendingTotal').textContent,/825\.00/);
    assert.match(document.getElementById('cashHistory').textContent,/Cliente ficticio.*active-fictional/s);
    assert.equal(document.getElementById('cashProfitability').open,false);
    assert.equal(document.getElementById('previewInternalCases').open,false);
    assert.match(document.getElementById('previewStatus').textContent,/créditos.*pagos.*aporte/);
    assert.equal(window.firebaseSdkV2,undefined);
    assert.equal(window.MiCarteraV2SyncBridge.submit,undefined);
    assert.equal(window.V2UI,undefined);
  }finally{window.happyDOM.abort();}
});
