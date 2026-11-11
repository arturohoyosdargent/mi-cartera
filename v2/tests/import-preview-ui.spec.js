const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const app=path.join(__dirname,'../app');
const source=name=>fs.readFileSync(path.join(app,name),'utf8');
const settled=()=>new Promise(resolve=>setImmediate(resolve));

async function setup(role='admin',{excel=false}={}){
  const {Window}=await import('happy-dom');
  const window=new Window();
  const {document}=window;
  const html=source('operational-shell.html');
  document.body.innerHTML=html.match(/<section id="clients"[^]*?<\/section>/)?.[0]||'';
  const panel=document.querySelector('#importPreviewPanel');
  assert.ok(panel,'Customers has a preview panel');
  const picker=panel.querySelector('input[type=file]');
  const status=panel.querySelector('[role=status]');
  const scope={uid:'uid-1',orgId:'v2-org-1',projectId:'pilot'};
  let auth={ready:true,authenticated:true,member:true,uid:scope.uid,role};
  const memory=new Map();
  let writes=0;
  let requests=0;
  const localStorage={
    getItem:key=>memory.get(key)??null,
    setItem(key,value){writes++;memory.set(key,String(value))},
    removeItem(key){writes++;memory.delete(key)}
  };
  const fetch=()=>{requests++;throw Error('Unexpected network request')};
  Object.defineProperty(window,'localStorage',{value:localStorage});
  Object.defineProperty(window.navigator,'locks',{value:{request:async (_name,_options,run)=>run()}});
  window.fetch=fetch;
  window.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:scope.projectId};
  window.firebaseAuthV2={auth:{currentUser:{uid:scope.uid}}};
  window.MiCarteraV2AuthCloudGate={ORG:scope.orgId,state:()=>auth,requireReady:()=>{
    if(!auth.ready)throw Error('Not signed in');
    return auth;
  }};
  const context=vm.createContext({
    window,globalThis:window,document,TextDecoder,console,fetch,localStorage,
    DOMParser:excel?require('./import-xlsx-fixtures.cjs').workbookDOMParser(window):window.DOMParser,
    ArrayBuffer,Blob,DecompressionStream
  });
  vm.runInContext(source('session-storage-v2.js'),context,{filename:'session-storage-v2.js'});
  const storage=window.MiCarteraV2SessionStorage;
  const token=storage.activate(scope);
  const wallet={
    session:{actorId:scope.uid,role},clients:[],credits:[{id:'cre-1',balance:123.45}],
    payments:[{id:'pay-1',amount:20}],cashMovements:[{id:'cash-1',amount:123.45}]
  };
  localStorage.setItem(storage.KEY,JSON.stringify(wallet));
  await storage.confirm(token);
  // A successful operation updates the active projection before its custody copy.
  wallet.clients.push({id:'cli-existing',name:'Clienta registrada',dni:'00123456'});
  localStorage.setItem(storage.KEY,JSON.stringify(wallet));
  const previewScripts=['import-preview-core-v2.js',...(excel?['import-xlsx-v2.js']:[]),'import-preview-ui-v2.js'];
  for(const name of previewScripts){
    assert.ok(html.includes('<script src="'+name+'"></script>'),name+' is loaded by the app');
    vm.runInContext(source(name),context,{filename:name});
  }
  if(document.readyState==='loading')document.dispatchEvent(new window.Event('DOMContentLoaded'));
  function choose(name,csv,load){
    const bytes=typeof csv==='string'?new TextEncoder().encode(csv).buffer:csv;
    Object.defineProperty(picker,'files',{configurable:true,value:[{
      name,size:bytes.byteLength,arrayBuffer:load||(()=>Promise.resolve(bytes))
    }]});
    picker.dispatchEvent(new window.Event('change'));
  }
  return {window,panel,picker,status,choose,
    snapshot:()=>({writes,requests,keys:[...memory]}),logout(){
    auth={ready:false,authenticated:false,member:false};
    window.firebaseAuthV2.auth.currentUser=null;
    window.dispatchEvent(new window.CustomEvent('v2-auth-cloud-state',{detail:{ready:false}}));
  }};
}

test('a CSV selection displays the validation summary and escaped row errors with a scoped read only',async()=>{
  const x=await setup();
  assert.equal(x.panel.hidden,false);
  const before=x.snapshot();
  x.choose('clientes.csv','Nombre;DNI;Teléfono\n<img src=x>;00123456;987654321\n;01234567;987654322\nAna;12345678;987654323');
  await settled();
  assert.deepEqual(x.snapshot(),before);
  assert.match(x.status.textContent,/3 filas.*1 válida.*1 duplicada.*1 con errores/i);
  assert.match(x.panel.textContent,/Fila 2.*<img src=x>/is);
  assert.match(x.panel.textContent,/cartera actual/i);
  assert.match(x.panel.textContent,/Fila 3.*nombre/is);
  assert.equal(x.panel.querySelector('img'),null);
});

test('an Excel selection shows the worksheet, reports omissions and keeps the current wallet untouched',async()=>{
  const {zip,workbook}=require('./import-xlsx-fixtures.cjs');
  const x=await setup('supervisor',{excel:true});
  const before=x.snapshot();
  const rows='<row r="1"><c r="A1" t="inlineStr"><is><t>Nombre</t></is></c>'+
    '<c r="B1" t="inlineStr"><is><t>DNI</t></is></c><c r="C1" t="inlineStr"><is><t>Teléfono</t></is></c></row>'+
    '<row r="4"><c r="A4" t="inlineStr"><is><t>Ana</t></is></c>'+
    '<c r="B4" t="inlineStr"><is><t>00123456</t></is></c><c r="C4"><f>1+2</f><v>3</v></c></row>';
  x.choose('clientes.xlsx',zip(workbook(rows)));
  for(let i=0;i<100&&x.status.textContent.startsWith('Leyendo');i++)await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(x.snapshot(),before);
  assert.match(x.status.textContent,/1 fila.*1 duplicada/i);
  assert.match(x.panel.textContent,/Hoja revisada: Clientes/);
  assert.match(x.panel.textContent,/Celdas omitidas.*1\./);
  assert.match(x.panel.textContent,/Fila 4.*00123456/is);
});

test('signing out while a file is being read removes the preview and prevents a scoped read',async()=>{
  const x=await setup();
  let finish;
  x.choose('clientes.csv','Nombre',()=>new Promise(resolve=>{finish=resolve}));
  await settled();
  assert.match(x.status.textContent,/Leyendo/);
  x.logout();
  const afterLogout=x.snapshot();
  finish(new TextEncoder().encode('Nombre\nDato confidencial').buffer);
  await settled();
  assert.equal(x.panel.hidden,true);
  assert.deepEqual(x.snapshot(),afterLogout);
  assert.doesNotMatch(x.panel.textContent,/Dato confidencial/);
});

test('a route-only user cannot read the portfolio for bulk duplicate comparison',async()=>{
  const x=await setup('cobrador');
  assert.equal(x.panel.hidden,true);
  assert.equal(x.picker.disabled,true);
  const before=x.snapshot();
  let selected=false;
  x.choose('clientes.csv','Nombre\nCliente de prueba',()=>{selected=true});
  await settled();
  assert.equal(selected,false);
  assert.deepEqual(x.snapshot(),before);
});
