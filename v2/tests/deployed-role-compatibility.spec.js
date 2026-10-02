const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(process.env.SOURCE||'v2');
const KEY='mi-cartera-v2-validation-state';

function fixture(role,online=true){
  const values=new Map(),commits=[],alerts=[];
  const fields=Object.fromEntries(['fName','fPhone','fDni','fAddress','fGuarantor','fGuarantorPhone','fReference','fRoute','fLocation'].map(id=>[id,{value:'',dataset:{}}]));
  Object.assign(fields.fName,{value:'Cliente de prueba'});Object.assign(fields.fPhone,{value:'999111333'});Object.assign(fields.fRoute,{value:'r1'});
  const auth={uid:'role-test-user',role,ready:true,routeIds:['r1']};
  const c={console,navigator:{onLine:online},document:{getElementById:id=>fields[id]||null,addEventListener(){}},addEventListener(){},alert:message=>alerts.push(String(message)),localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))}};
  c.window=c;vm.createContext(c);
  const load=file=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),c,{filename:file});
  for(const file of ['core/financial-engine.js','core/schedule-engine.js','core/access-audit.js'])load(file);
  c.MiCarteraV2VersionGuard={requireReady(){},ensureReady:async()=>true};
  c.MiCarteraV2AuthCloudGate={requireReady:()=>({...auth}),state:()=>({...auth})};
  c.MiCarteraV2SyncBridge={status:()=>({configured:true,queue:[]}),submit:async operation=>{commits.push(operation);return online?{status:'COMMITTED'}:{status:'QUEUED',durable:true}}};
  values.set(KEY,JSON.stringify({clients:[],credits:[],payments:[],cashMovements:[],audit:[],session:{actorId:auth.uid,role}}));
  load('app/operation-commit-gate.js');load('app/write-actions-stable12.js');
  return {c,commits,alerts,raw:()=>values.get(KEY),data:()=>JSON.parse(values.get(KEY)),submit:()=>c.MiCarteraV2OperationCommitGate.submit({versionGuard:c.MiCarteraV2VersionGuard,authGate:c.MiCarteraV2AuthCloudGate,bridge:c.MiCarteraV2SyncBridge,operation:{operationId:'role-operation',entities:[]}})};
}

test('supervisor saves a general cash operation with the existing administrative permissions',async()=>{
  const h=fixture('supervisor');
  await h.c.MiCarteraV2WriteActions.manualCash('INGRESO',{date:'2026-09-26',amount:100,category:'APORTE_CAPITAL',concept:'Prueba supervisor'});
  assert.equal(h.commits.length,1);assert.equal(h.commits[0].type,'CASH_MOVEMENT');
  assert.equal(h.data().cashMovements.length,1);assert.equal(h.data().cashMovements[0].amount,100);assert.equal(h.data().audit.length,1);
});

test('supervisor can use operational reports and audit without gaining user administration',()=>{
  const h=fixture('supervisor'),access=h.c.MiCarteraV2AccessAudit;
  for(const permission of ['CLIENT_WRITE','CREDIT_WRITE','PAYMENT_WRITE','CASH_WRITE','REPORT_READ','AUDIT_READ'])assert.doesNotThrow(()=>access.requirePermission('SUPERVISOR',permission));
  assert.throws(()=>access.requirePermission('SUPERVISOR','USER_ADMIN'),/PERMISSION_DENIED/);
});

for(const online of [true,false])test('cobrador is rejected before submission and local client changes '+(online?'online':'offline'),async()=>{
  const h=fixture('cobrador',online),before=h.raw();
  await assert.rejects(h.submit(),error=>error.code==='V2_WRITE_ROLE_NOT_SUPPORTED'&&/administrador|admin/i.test(error.message)&&/supervisor/i.test(error.message));
  assert.equal(h.commits.length,0);assert.equal(h.raw(),before);
  await h.c.MiCarteraV2WriteActions.addClient();
  assert.equal(h.commits.length,0);assert.equal(h.raw(),before);
  assert.ok(h.alerts.some(message=>/permisos actuales/i.test(message)));
  assert.doesNotThrow(()=>h.c.MiCarteraV2AccessAudit.requirePermission('COBRADOR','REPORT_READ'));
});
