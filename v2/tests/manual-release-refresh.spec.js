const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const scripts=['version-guard.js','refresh-controller-v2.js'].map(name=>[
  name,fs.readFileSync(path.join(__dirname,'../app',name),'utf8')
]);

function setup(){
  const button={disabled:false}, requests=[], alerts=[], timers=[];
  const fields=new Map([['manualRefreshButton',button],['fName',{value:''}],['cAccepted',{checked:false}]]);
  const state={page:'home', reloads:0, syncs:0, queued:false, inFlight:0,
    hydrated:{status:'REHYDRATED'}, authenticated:true};
  const root={
    dispatchEvent(){},
    location:{reload(){state.reloads++}},
    MiCarteraV2AuthCloudGate:{state:()=>({ready:state.authenticated})},
    MiCarteraV2CloudRehydration:{
      pending:()=>state.queued,
      async rehydrate(){state.syncs++;return state.hydrated}
    },
    MiCarteraV2SyncBridge:{status:()=>({pending:state.inFlight})}
  };
  const context=vm.createContext({
    window:root, navigator:{}, console,
    document:{
      readyState:'complete', head:{appendChild(){}}, createElement:()=>({}),
      getElementById:id=>fields.get(id),
      querySelector:sel=>sel==='header'?{}:sel==='.page.active'?{id:state.page}:null
    },
    CustomEvent:class {}, alert:message=>alerts.push(message),
    setTimeout:fn=>timers.push(fn),
    fetch:async (url,options)=>{
      requests.push({url,cache:options.cache});
      await state.onFetch?.();
      if(state.offline)throw Error('Sin conexión');
      return {ok:true,json:async()=>({build:state.published})};
    }
  });
  for(const [filename,src] of scripts)vm.runInContext(src,context,{filename});
  const gate=root.MiCarteraV2VersionGuard, running=gate.state().publishedBuild;
  state.published=running;
  return {state,gate,running,button,fields,requests,alerts,
    click:()=>button.onclick(),flushTimers:()=>timers.splice(0).forEach(fn=>fn())};
}

test('the manual button reloads once when the uncached published version differs',async()=>{
  const x=setup();
  assert.equal(x.requests.length,0);
  assert.equal(x.gate.requireReady(),true);
  x.state.published='published-next-build';
  await x.click();
  x.flushTimers();
  assert.equal(x.requests.length,1);
  assert.match(x.requests[0].url,/^\.\/release\.json\?ts=\d+$/);
  assert.equal(x.requests[0].cache,'no-store');
  assert.equal(x.state.syncs,1);
  assert.equal(x.state.reloads,1);
  assert.equal(x.gate.state().publishedBuild,x.running);
});

test('the same published version completes the refresh without reloading',async()=>{
  const x=setup();
  await x.click();
  assert.equal(x.requests.length,1);
  assert.equal(x.state.syncs,1);
  assert.equal(x.button.textContent,'✓ Actualizado');
  x.flushTimers();
  assert.equal(x.button.disabled,false);
  assert.equal(x.state.reloads,0);
});

test('a pending local operation blocks the refresh before reading cloud data',async()=>{
  const x=setup();
  x.state.published='published-next-build';
  x.state.queued=true;
  await x.click();
  assert.equal(x.button.textContent,'⚠ Pendiente');
  x.flushTimers();
  assert.equal(x.state.reloads,0);
  assert.equal(x.state.syncs,0);
  assert.equal(x.requests.length,0);
  assert.equal(x.button.disabled,false);
});

test('an operation that enters flight while checking the release prevents reload',async()=>{
  const x=setup();
  x.state.published='published-next-build';
  x.state.onFetch=()=>{x.state.inFlight=1};
  await x.click();
  assert.equal(x.requests.length,1);
  assert.equal(x.button.textContent,'⚠ Pendiente');
  x.flushTimers();
  assert.equal(x.state.reloads,0);
});

test('existing drafts and new edits during the release check prevent reload',async()=>{
  const x=setup();
  x.state.page='clientForm';
  x.fields.get('fName').value='Borrador inicial';
  x.state.published='published-next-build';
  await x.click();
  assert.equal(x.requests.length,0);
  assert.equal(x.state.syncs,0);
  assert.equal(x.alerts.length,1);
  x.state.page='home';
  x.fields.get('fName').value='';
  x.state.onFetch=()=>{
    x.state.page='clientForm';
    x.fields.get('fName').value='Borrador nuevo';
  };
  await x.click();
  assert.equal(x.requests.length,1);
  assert.equal(x.fields.get('fName').value,'Borrador nuevo');
  assert.equal(x.button.textContent,'⚠ Pendiente');
  x.flushTimers();
  assert.equal(x.state.reloads,0);
});

test('an unavailable or malformed release leaves the app usable and allows a retry',async()=>{
  const x=setup();
  x.state.authenticated=false;
  x.state.offline=true;
  await x.click();
  assert.equal(x.button.textContent,'⚠ Revisar');
  assert.equal(x.button.disabled,false);
  assert.equal(x.gate.requireReady(),true);
  x.state.offline=false;
  x.state.published={unexpected:true};
  await x.click();
  assert.equal(x.button.textContent,'⚠ Revisar');
  assert.equal(x.button.disabled,false);
  assert.equal(x.state.reloads,0);
  x.state.published=x.running;
  await x.click();
  assert.equal(x.button.textContent,'✓ Versión comprobada');
  assert.equal(x.requests.length,3);
  assert.equal(x.state.syncs,0);
  assert.equal(x.alerts.length,2);
});
