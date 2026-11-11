const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {parseCsv,validate}=require('../app/import-preview-core-v2.js');

const app=path.join(__dirname,'../app');
const ledgerKey='mi-cartera-v2-validation-state';
const ownerKey='mi-cartera-v2-local-owner';
const fixtureRows=[
  {number:1,cells:['Nombre','DNI','Teléfono','Ruta']},
  {number:2,cells:['Ana de Prueba','00123456','987654321','Ruta externa']}
];

function setup({cloud=false,rows=fixtureRows,allowClientImport}={}){
  const scope={uid:'actor-1',orgId:'v2-mi-cartera-pilot',projectId:'demo-import',epoch:1};
  let liveScope=scope;
  let accepted=false;
  let network;
  let onConfirm;
  const confirmations=[],calls=[];
  const wallet={session:{actorId:scope.uid,role:'admin'},clients:[],credits:[{id:'credit-1',balance:42}],
    payments:[{id:'p-1',amount:12}],cashMovements:[{id:'m-1',amount:30}],audit:[]};
  const memory=new Map([[ledgerKey,JSON.stringify(wallet)],[ownerKey,scope.uid]]);
  const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const read=()=>JSON.parse(storage.getItem(ledgerKey));
  const update=fn=>{const d=read();fn(d);storage.setItem(ledgerKey,JSON.stringify(d))};
  const auth=()=>({ready:true,authenticated:true,member:true,uid:liveScope.uid,role:'admin',routeIds:[]});
  const window={
    localStorage:storage,crypto:webcrypto,addEventListener(){},
    MI_CARTERA_V2_PILOT_CONFIG:{backendMode:'b2-compatible',allowClientImport},
    MiCarteraV2VersionGuard:{requireReady:()=>true},
    MiCarteraV2AuthCloudGate:{state:auth,requireReady:auth,ORG:scope.orgId},
    firebaseAuthV2:{auth:{currentUser:{uid:scope.uid}}},
    MiCarteraV2SessionStorage:{
      state:()=>({ready:true,...liveScope,role:'admin'}),
      capture:()=>liveScope,
      assertCurrent(token){if(token!==liveScope)throw Error('Sesión cambiada')},
      readCurrentClients(token){
        if(token!==liveScope||read().session.actorId!==token.uid)throw Error('Sesión cambiada');
        return read().clients;
      }
    },
    MiCarteraV2SyncBridge:{
      status:()=>({configured:true}),
      async submit(op){
        calls.push(JSON.parse(JSON.stringify(op)));
        if(network)return network(op);
        return {status:'APPLIED',operation:{id:op.operationId,type:op.type,actorId:scope.uid}};
      }
    },
    confirm(message){confirmations.push(message);onConfirm?.();return accepted}
  };
  const document={addEventListener(){},getElementById(){return null}};
  const navigator={onLine:true};
  window.navigator=navigator;
  const context=vm.createContext({window,globalThis:window,document,localStorage:storage,navigator,TextDecoder,alert(){}});
  const loadScript=file=>{
    const filename=path.join(app,file);
    vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});
  };
  const remote=new Map(),collections=[];
  let failServerRead=false,runtime;
  if(cloud){
    window.TextEncoder=TextEncoder;
    window.MI_CARTERA_V2_FIREBASE_TEMPLATE={projectId:scope.projectId};
    window.MiCarteraV2PilotConfig={evaluate:()=>({ready:true})};
    const db={};
    const doc=(_db,...segments)=>segments.join('/');
    const snapshot=(ref,data)=>({exists:()=>data!==undefined,id:ref.split('/').at(-1),data:()=>data});
    window.firestoreV2={
      collection:doc,
      async getDocsFromServer(collection){
        collections.push(collection);
        if(failServerRead)throw Object.assign(Error('Lectura no disponible'),{code:'unavailable'});
        return {docs:[...remote].filter(([ref])=>ref.startsWith(collection+'/')).map(([ref,data])=>snapshot(ref,data))};
      }
    };
    const runTransaction=async (_db,fn)=>{
      const proposed=[];
      const result=await fn({
        get:async ref=>snapshot(ref,remote.get(ref)),
        set:(ref,data)=>proposed.push([ref,JSON.parse(JSON.stringify(data))])
      });
      for(const [ref,data] of proposed)remote.set(ref,data);
      return result;
    };
    for(const file of ['core/transaction-store.js','core/sync-errors.js','core/offline-operation-queue.js',
      'cloud/firestore-atomic-adapter.js','cloud/operational-sync.js','operation-sync-bridge.js',
      'cloud/client-import-store-v2.js','cloud/runtime-cloud.js'])loadScript(file);
    runtime=window.MiCarteraV2CloudRuntime.configure({db,doc,runTransaction,orgId:scope.orgId,actorId:scope.uid});
  }
  for(const file of ['core/access-audit.js','core/financial-engine.js','core/schedule-engine.js',
    'operation-commit-gate.js','import-preview-core-v2.js','client-import-core-v2.js','durable-actions-v2.js'])loadScript(file);
  const draft={rows,token:scope};
  return {draft,read,update,calls,confirmations,accept:()=>{accepted=true},
    onConfirm:fn=>{onConfirm=fn},respond:fn=>{network=fn},
    switchActor(){
      liveScope={...scope,uid:'actor-2',epoch:2};
      storage.setItem(ownerKey,liveScope.uid);
      window.firebaseAuthV2.auth.currentUser.uid=liveScope.uid;
      update(d=>{d.session.actorId=liveScope.uid;d.clients=[];d.audit=[]});
    },
    run:()=>window.MiCarteraV2DurableActions.importClients(draft),
    submit:op=>window.MiCarteraV2SyncBridge.submit(op),
    attachPreview(document){context.document=document;loadScript('import-preview-ui-v2.js')},
    remote,collections,runtime,failServerRead:value=>{failServerRead=value}
  };
}

test('canceling the confirmation never submits the import or mutates the wallet',async()=>{
  const x=setup(),before=x.read();
  assert.equal((await x.run()).status,'CANCELLED');
  assert.equal(x.confirmations.length,1);
  assert.match(x.confirmations[0],/1 cliente/i);
  assert.deepEqual(x.calls,[]);
  assert.deepEqual(x.read(),before);
});

test('a newly registered duplicate blocks all writes after the confirmation',async()=>{
  const x=setup();
  x.accept();
  x.onConfirm(()=>x.update(d=>d.clients.push({id:'existing',name:'Otra persona',dni:'00123456',phone:'999111222'})));
  await assert.rejects(x.run(),/duplicad|coincide|repetid/i);
  assert.equal(x.calls.length,0);
  assert.equal(x.read().clients[0].id,'existing');
});

test('confirmed import sends only creates and audit and preserves concurrent financial state',async()=>{
  const x=setup();
  x.accept();
  x.respond(async op=>{
    x.update(d=>{d.credits[0].balance=18;d.cashMovements.push({id:'other-cash',amount:24})});
    return {status:'APPLIED',operation:{id:op.operationId,type:op.type,actorId:'actor-1'}};
  });
  assert.equal((await x.run()).status,'IMPORTED');
  const [op]=x.calls;
  assert.equal(op.type,'CLIENT_IMPORT');
  assert.deepEqual(op.entities.map(x=>[x.collection,x.kind]),[['clients','create']]);
  assert.equal(op.entities[0].data.dni,'00123456');
  assert.equal(op.entities[0].data.routeId,'');
  assert.equal(op.audit.actorId,'actor-1');
  assert.equal(op.audit.action,'CLIENTS_IMPORTED');
  assert.deepEqual(op.audit.detail,{count:1,clientIds:[op.entities[0].data.id]});
  assert.deepEqual(x.read().clients,[op.entities[0].data]);
  assert.deepEqual(x.read().audit,[op.audit]);
  assert.deepEqual(x.read().credits,[{id:'credit-1',balance:18}]);
  assert.deepEqual(x.read().cashMovements,[{id:'m-1',amount:30},{id:'other-cash',amount:24}]);
});

test('a retry keeps the same operation after an ambiguous acknowledgment',async()=>{
  const x=setup();
  x.accept();
  x.respond(async ()=>{throw Error('Respuesta interrumpida')});
  await assert.rejects(x.run(),/interrumpida/);
  assert.deepEqual(x.read().clients,[]);
  x.respond(async op=>({status:'ALREADY_APPLIED',operation:{id:op.operationId,type:op.type,actorId:'actor-1'}}));
  assert.equal((await x.run()).status,'IMPORTED');
  assert.deepEqual(x.calls[0],x.calls[1]);
  assert.equal(x.read().clients.length,1);
});

test('an import retry recovers its receipt after the committed lot was rehydrated',async()=>{
  const x=setup();
  x.accept();
  x.respond(async op=>{
    x.update(d=>{
      d.clients=op.entities.map(entity=>({...entity.data,updatedAt:op.createdAt}));
      d.audit=[{...op.audit,version:1,updatedAt:op.createdAt}];
    });
    throw Error('Respuesta interrumpida');
  });
  await assert.rejects(x.run(),/interrumpida/);
  const hydrated=x.read();
  x.respond(async op=>({status:'ALREADY_APPLIED',operation:{id:op.operationId,type:op.type,actorId:'actor-1'}}));
  assert.equal((await x.run()).status,'IMPORTED');
  assert.deepEqual(x.calls[1],x.calls[0]);
  assert.equal(hydrated.clients.length,1);
  assert.equal(hydrated.audit.length,1);
  assert.deepEqual(x.read(),hydrated);
});

test('a receipt arriving after switching users is never applied to the new local wallet',async()=>{
  const x=setup();
  x.accept();
  x.respond(async op=>{
    x.switchActor();
    return {status:'APPLIED',operation:{id:op.operationId,type:op.type,actorId:'actor-1'}};
  });
  assert.equal((await x.run()).status,'CONFIRMED_REFRESH');
  assert.deepEqual(x.read().clients,[]);
  assert.deepEqual(x.read().audit,[]);
  assert.equal(x.read().session.actorId,'actor-2');
});

test('the Clientes preview saves only after confirmation and a failed server read never queues it',async()=>{
  const {Window}=await import('happy-dom');
  const dom=new Window();
  const document=dom.document;
  const shell=fs.readFileSync(path.join(app,'operational-shell.html'),'utf8');
  document.body.innerHTML=shell.match(/<section id="clients"[^]*?<\/section>/)[0];
  for(const name of ['client-import-core-v2.js','cloud/client-import-store-v2.js']){
    assert.ok(shell.includes('<script src="'+name+'"></script>'));
  }
  const x=setup({cloud:true});
  x.attachPreview(document);
  if(document.readyState==='loading')document.dispatchEvent(new dom.Event('DOMContentLoaded'));
  const picker=document.getElementById('importPreviewFile');
  const buffer=new TextEncoder().encode('Nombre,DNI,Teléfono\nAna de Prueba,00123456,987654321').buffer;
  Object.defineProperty(picker,'files',{value:[{name:'clientes.csv',size:buffer.byteLength,arrayBuffer:async()=>buffer}]});
  picker.dispatchEvent(new dom.Event('change'));
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  await tick();
  const button=document.getElementById('importClientsButton'),status=document.getElementById('importPreviewStatus');
  assert.match(button.textContent,/Importar 1 cliente/);
  assert.equal(x.confirmations.length,0);
  assert.equal(x.remote.size,0);
  const original=x.read();
  await button.onclick();
  assert.equal(x.remote.size,0);
  assert.deepEqual(x.read(),original);
  x.accept();
  x.failServerRead(true);
  await button.onclick();
  assert.match(status.textContent,/no disponible/i);
  assert.equal(x.remote.size,0);
  assert.equal(x.runtime.inspect().length,0);
  x.failServerRead(false);
  await button.onclick();
  assert.match(status.textContent,/1 cliente guardado/i);
  const paths=[...x.remote.keys()];
  const prefix='orgs/v2-mi-cartera-pilot/';
  assert.equal(paths.length,4);
  assert.ok(paths.every(key=>key.startsWith(prefix)));
  assert.deepEqual(paths.map(key=>key.slice(prefix.length).split('/')[0]).sort(),['audit','clients','operations','operations']);
  assert.deepEqual(x.collections,[prefix+'clients',prefix+'clients']);
  assert.deepEqual(x.read().credits,original.credits);
  assert.deepEqual(x.read().cashMovements,original.cashMovements);
});

test('Hosting keeps CSV preview while the isolated rules are required for writes',async()=>{
  const {Window}=await import('happy-dom'),dom=new Window(),document=dom.document;
  const shell=fs.readFileSync(path.join(app,'operational-shell.html'),'utf8');
  const cfg=fs.readFileSync(path.join(app,'firebase-v2-template.js'),'utf8');
  assert.match(cfg,/allowClientImport:false/);
  document.body.innerHTML=shell.match(/<section id="clients"[^]*?<\/section>/)[0];
  const x=setup({cloud:true,allowClientImport:false});
  x.attachPreview(document);
  if(document.readyState==='loading')document.dispatchEvent(new dom.Event('DOMContentLoaded'));
  const picker=document.getElementById('importPreviewFile');
  const buffer=new TextEncoder().encode('Nombre,DNI,Teléfono\nAna de Prueba,00123456,987654321').buffer;
  Object.defineProperty(picker,'files',{value:[{name:'clientes.csv',size:buffer.byteLength,arrayBuffer:async()=>buffer}]});
  picker.dispatchEvent(new dom.Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(document.getElementById('importPreviewResult').textContent,/Ana de Prueba/);
  assert.equal(document.getElementById('importClientsButton'),null);
  await assert.rejects(x.run(),/no está disponible/i);
  await assert.rejects(x.submit({operationId:'disabled-hosting-import',type:'CLIENT_IMPORT',entities:[]}),/no está disponible/i);
  assert.equal(x.confirmations.length,0);
  assert.equal(x.remote.size,0);
  assert.equal(x.runtime.inspect().length,0);
});

const bulkPrefix='orgs/v2-mi-cartera-pilot/';

function bulkCsv(count, changeLast=row=>row){
  const rows=Array.from({length:count},(_,index)=>{
    const ordinal=index+1;
    const row=['Cliente ficticio '+ordinal,String(ordinal).padStart(8,'0'),555000000+ordinal,'Ruta externa'];
    return (ordinal===count?changeLast(row):row).join(';');
  });
  return ['Nombre;DNI;Teléfono;Ruta',...rows].join('\r\n');
}

test('bulk CSV commits 100 clients together with one audit, receipt and lock',async()=>{
  const x=setup({cloud:true,rows:parseCsv(bulkCsv(100))});
  const before=x.read();
  const financial=new Map([
    [bulkPrefix+'credits/credit-1',{id:'credit-1',balance:42}],
    [bulkPrefix+'payments/p-1',{id:'p-1',amount:12}],
    [bulkPrefix+'entries/m-1',{id:'m-1',amount:30}]
  ]);
  for(const [key,value] of financial)x.remote.set(key,value);
  x.accept();

  assert.equal((await x.run()).status,'IMPORTED');
  assert.deepEqual(x.confirmations.map(text=>text.match(/100 clientes/i)?.[0]),['100 clientes']);
  assert.deepEqual(x.collections,[bulkPrefix+'clients']);
  const records=collection=>[...x.remote].filter(([key])=>key.startsWith(bulkPrefix+collection+'/')).map(([,record])=>record);
  const clients=records('clients');
  const audit=records('audit');
  const operations=records('operations');
  assert.equal(clients.length,100);
  assert.equal(new Set(clients.map(client=>client.id)).size,100);
  assert.equal(clients[0].dni,'00000001');
  assert.equal(clients.at(-1).dni,'00000100');
  assert.ok(clients.every(client=>client.routeId===''&&client.version===1));
  assert.equal(audit.length,1);
  assert.deepEqual(audit[0].detail,{count:100,clientIds:clients.map(client=>client.id)});
  assert.equal(operations.length,2);
  assert.equal(operations.find(op=>op.id===audit[0].operationId).auditId,audit[0].id);
  assert.equal(operations.find(op=>op.id==='client-import-lock-v1').version,1);
  assert.equal(x.remote.size,financial.size+103);
  for(const [key,value] of financial)assert.deepEqual(x.remote.get(key),value);
  const after=x.read();
  assert.equal(after.clients.length,100);
  assert.equal(after.audit.length,1);
  for(const collection of ['credits','payments','cashMovements'])assert.deepEqual(after[collection],before[collection]);
});

test('bulk CSV previews 5000 records but cannot confirm an oversized import',async()=>{
  const rows=parseCsv(bulkCsv(5000));
  const preview=validate(rows);
  assert.equal(preview.total,5000);
  assert.equal(preview.valid,5000);
  assert.throws(()=>parseCsv(bulkCsv(5001)),/5000 filas/i);

  const x=setup({cloud:true,rows}),before=x.read();
  x.accept();
  await assert.rejects(x.run(),/100 clientes/i);
  assert.deepEqual(x.confirmations,[]);
  assert.deepEqual(x.collections,[]);
  assert.equal(x.remote.size,0);
  assert.deepEqual(x.read(),before);
});

test('bulk CSV reports malformed rows and repeated identity at the end without partial writes',async()=>{
  const scenarios=[
    {rows:parseCsv(bulkCsv(100,row=>row.slice(0,3))),reason:/fila 101.*columnas/i},
    {rows:parseCsv(bulkCsv(100,row=>[row[0],'0000-0001',row[2],row[3]])),reason:/documento.*repetido/i}
  ];
  for(const {rows,reason} of scenarios){
    const x=setup({cloud:true,rows}),before=x.read();
    x.accept();
    await assert.rejects(x.run(),reason);
    assert.deepEqual(x.confirmations,[]);
    assert.deepEqual(x.collections,[]);
    assert.equal(x.remote.size,0);
    assert.deepEqual(x.read(),before);
  }
  assert.throws(()=>parseCsv(bulkCsv(100,row=>['"'+row[0],...row.slice(1)])),/fila 101.*comillas/i);
});

test('bulk CSV rejects all 100 clients when the final identity appears in cloud during confirmation',async()=>{
  const x=setup({cloud:true,rows:parseCsv(bulkCsv(100))}),before=x.read();
  const existing={id:'existing',name:'Cliente ficticio existente',documento:'000-00100',telefono:'555100500'};
  const key=bulkPrefix+'clients/'+existing.id;
  x.accept();
  x.onConfirm(()=>x.remote.set(key,existing));

  await assert.rejects(x.run(),/documento.*cartera actual/i);
  assert.equal(x.confirmations.length,1);
  assert.deepEqual(x.collections,[bulkPrefix+'clients']);
  assert.deepEqual([...x.remote],[[key,existing]]);
  assert.deepEqual(x.read(),before);
  assert.equal(x.runtime.inspect().length,0);
});
