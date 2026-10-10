const {test}=require('node:test');
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Window}=require('happy-dom');
const APP=path.join(__dirname,'../app'),KEY='mi-cartera-v2-support-tickets',OWNER='mi-cartera-v2-local-owner';
const auth=(uid='fixture-user',role='cobrador')=>({ready:true,authenticated:true,member:true,uid,email:uid+'@example.test',role});
const ticket=(id,uid,orgId='fixture-org',status='NUEVO')=>({id:'SOP-'+id,type:'ERROR',status,description:'Descripción ficticia '+id,uid,orgId,createdAt:'2026-10-07T12:00:00Z',updatedAt:'2026-10-07T12:00:00Z',build:'fixture-build'});
function setup(rows=[],session=auth(),org='fixture-org'){
 const w=new Window({url:'https://local.test/app/',settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true}});
 w.document.write(fs.readFileSync(path.join(APP,'operational-shell.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,''));
 let current=session,currentOrg=org;const alerts=[],initial=JSON.stringify(rows);
 w.localStorage.setItem(KEY,JSON.stringify(rows));
 w.localStorage.setItem(OWNER,session.uid||'');w.firebaseAuthV2={auth:{currentUser:session.uid?{uid:session.uid}:null}};
 w.MiCarteraV2AuthCloudGate={state:()=>({...current}),get ORG(){return currentOrg;}};
 w.alert=x=>alerts.push(String(x));w.HTMLElement.prototype.scrollIntoView=function(){};
 w.show=id=>w.document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
 vm.runInContext(fs.readFileSync(path.join(APP,'support-center-v2.js'),'utf8'),vm.createContext(w));
 return {w,alerts,api:w.MiCarteraV2Support,get:()=>JSON.parse(w.localStorage.getItem(KEY)),unchanged:()=>a.equal(w.localStorage.getItem(KEY),initial),
  switch(session,nextOrg=org,emit=true){current=session;currentOrg=nextOrg;w.firebaseAuthV2.auth.currentUser=session.uid?{uid:session.uid}:null;w.localStorage.setItem(OWNER,session.uid||'');if(emit)w.dispatchEvent(new w.CustomEvent('v2-auth-cloud-state',{detail:current}));},
  boundaries(firebaseUid,owner){w.firebaseAuthV2.auth.currentUser=firebaseUid?{uid:firebaseUid}:null;w.localStorage.setItem(OWNER,owner||'');},
  setOrg(nextOrg){currentOrg=nextOrg;},
  close:()=>w.happyDOM.abort()};
}
test('normal users see only their own reports in their authenticated organization',async()=>{
 const h=setup([ticket('mine','fixture-user'),ticket('colleague','other'),ticket('foreign','fixture-user','foreign-org'),ticket('unscoped','fixture-user','')]);
 try{h.api.render();a.deepEqual(Array.from(h.api.all(),x=>x.id),['SOP-mine']);
  const text=h.w.document.getElementById('supportList').textContent;a.match(text,/SOP-mine/);a.doesNotMatch(text,/SOP-colleague|SOP-foreign|SOP-unscoped/);
  a.equal(h.w.document.getElementById('v2SupportHomeAlert'),null);a.equal(h.w.document.getElementById('v2SupportInbox'),null);h.unchanged();
 }finally{await h.close();}
});
test('admin and owner get a discreet organization-only new-report alert that opens their inbox',async()=>{
 for(const role of ['admin','owner']){const h=setup([ticket('new','other'),ticket('mine','fixture-user','fixture-org','RESUELTO'),ticket('review','other','fixture-org','EN_REVISION'),ticket('foreign','other','foreign-org')],auth('fixture-user',role));
  try{h.api.render();const notice=h.w.document.getElementById('v2SupportHomeAlert');a.ok(notice,'a NEW organization report must alert its administrator');
   a.match(notice.textContent,/1 reporte nuevo/i);notice.click();a.ok(h.w.document.getElementById('support').classList.contains('active'));
   a.equal(h.w.document.getElementById('v2SupportInbox').open,true);a.match(h.w.document.getElementById('v2SupportInboxList').textContent,/SOP-new/);
   a.doesNotMatch(h.w.document.getElementById('v2SupportInboxList').textContent,/SOP-foreign/);a.match(h.w.document.getElementById('supportList').textContent,/SOP-mine/);
   a.doesNotMatch(h.w.document.getElementById('supportList').textContent,/SOP-new/);a.ok(Array.from(h.w.document.querySelectorAll('#support h3')).some(x=>x.textContent==='Mis reportes'));h.unchanged();
  }finally{await h.close();}}
});
test('only NEW reports alert; previous status and other organizations do not',async()=>{
 for(const role of ['admin','owner','supervisor','cobrador']){const h=setup([ticket('review','fixture-user','fixture-org','EN_REVISION'),ticket('legacy','fixture-user','fixture-org','EN_PROCESO'),ticket('done','fixture-user','fixture-org','RESUELTO'),ticket('foreign','other','foreign-org')],auth('fixture-user',role));
  try{h.api.render();a.equal(h.w.document.getElementById('v2SupportHomeAlert'),null);h.unchanged();}finally{await h.close();}}
});
test('report creation keeps SOP, ERROR and MEJORA with authenticated identity and local storage only',async()=>{
 const h=setup();try{const error=h.api.create('ERROR','Falla ficticia de prueba'),improvement=h.api.create('MEJORA','Mejora ficticia de prueba');
  for(const report of [error,improvement]){a.match(report.id,/^SOP-/);a.equal(report.uid,'fixture-user');a.equal(report.orgId,'fixture-org');a.equal(report.status,'NUEVO');a.equal(report.role,'cobrador');}
  a.equal(h.get().length,2);const before=JSON.stringify(h.get());a.throws(()=>h.api.setStatus(error.id,'RESUELTO'),/PERMISO|AUTORIZ|FORBIDDEN/);a.equal(JSON.stringify(h.get()),before);
 }finally{await h.close();}
});
test('a ticket records the exact published V2 release identity independently of the visible badge caption',async()=>{
 const h=setup();try{h.w.MiCarteraV2VersionGuard={state:()=>({ready:true,publishedBuild:'v2-fixture-20261009-controlled-improvements-1'})};
  h.w.document.getElementById('versionGuard').textContent='VERSIÓN ACTIVA — Presentación profesional';
  const report=h.api.create('ERROR','Falla ficticia de prueba');a.equal(report.build,'v2-fixture-20261009-controlled-improvements-1');a.equal(h.get()[0].build,'v2-fixture-20261009-controlled-improvements-1');
 }finally{await h.close();}
});
test('authorized older fixtures retain the badge fallback when a V2 release identity is unavailable',async()=>{
 for(const publishedBuild of [undefined,'unknown-build']){const h=setup();try{h.w.MiCarteraV2VersionGuard={state:()=>({publishedBuild})};h.w.document.getElementById('versionGuard').textContent='VERSIÓN ACTIVA — legacy-fixture-caption';a.equal(h.api.create('MEJORA','Mejora ficticia de prueba').build,'legacy-fixture-caption');}finally{await h.close();}}
});
test('creating a report preserves existing foreign and legacy records in the shared local ticket store',async()=>{
 const existing=[ticket('foreign','other','foreign-org'),{id:'legacy',description:'Registro antiguo sin identidad'},null],h=setup(existing);
 try{h.api.create('MEJORA','Mejora ficticia adicional');a.deepEqual(h.get().slice(1),existing);a.equal(h.api.all().length,1);}finally{await h.close();}
});
test('administrator updates only same-organization reports and keeps all supported statuses',async()=>{
 const h=setup([ticket('local','other'),ticket('foreign','other','foreign-org')],auth('fixture-user','admin'));
 try{for(const status of ['EN_REVISION','EN_PROCESO','RESUELTO','NUEVO'])a.equal(h.api.setStatus('SOP-local',status).status,status);
  a.throws(()=>h.api.setStatus('SOP-foreign','RESUELTO'),/PERMISO|AUTORIZ|FORBIDDEN|NO_ENCONTRADO/);a.equal(h.get().find(x=>x.id==='SOP-foreign').status,'NUEVO');
  const before=JSON.stringify(h.get());a.throws(()=>h.api.setStatus('SOP-local','BORRADO'),/ESTADO_INVALIDO/);a.equal(JSON.stringify(h.get()),before);
 }finally{await h.close();}
});
test('missing or rejected authenticated identity never reveals or mutates reports',async()=>{
 const cases=[[{...auth(),uid:''},'fixture-org'],[auth(),''],[{...auth(),ready:false},'fixture-org'],[{...auth(),authenticated:false},'fixture-org'],[{...auth(),member:false},'fixture-org'],[{},'fixture-org']];
 for(const [session,org] of cases){const h=setup([ticket('secret','fixture-user')],session,org);
  try{h.api.render();a.equal(h.api.all().length,0);a.doesNotMatch(h.w.document.getElementById('supportList').textContent,/SOP-secret/);
   a.throws(()=>h.api.create('ERROR','Falla ficticia de prueba'),/AUTH|AUTORIZ|IDENTIDAD/);a.throws(()=>h.api.setStatus('SOP-secret','RESUELTO'),/AUTH|AUTORIZ|IDENTIDAD/);h.unchanged();
  }finally{await h.close();}}
});
test('switching identities clears the old report view and a stale admin control cannot change its old organization',async()=>{
 const h=setup([ticket('old','other'),ticket('next','next-user','next-org')],auth('fixture-user','admin'));
 try{h.api.render();const oldSelect=h.w.document.querySelector('#v2SupportInboxList select');a.ok(oldSelect);
  h.switch(auth('next-user','admin'),'next-org');a.doesNotMatch(h.w.document.querySelector('#support').textContent,/SOP-old/);
  oldSelect.value='RESUELTO';oldSelect.dispatchEvent(new h.w.Event('change'));a.equal(h.get().find(x=>x.id==='SOP-old').status,'NUEVO');h.unchanged();a.ok(h.alerts.length);
  h.switch({...auth('next-user','admin'),ready:false},'next-org');a.doesNotMatch(h.w.document.querySelector('#support').textContent,/SOP-next/);a.equal(h.w.document.getElementById('v2SupportHomeAlert'),null);
 }finally{await h.close();}
});
test('a stale ready admin gate cannot reveal reports after Firebase or the local owner has changed or disappeared',async()=>{
 for(const [firebaseUid,owner] of [['new-cobrador','new-cobrador'],['new-cobrador','fixture-user'],['fixture-user','new-cobrador'],[null,'fixture-user'],['fixture-user','']]){
  const h=setup([ticket('admin-secret','other')],auth('fixture-user','admin'));try{h.api.render();a.match(h.w.document.getElementById('v2SupportInboxList').textContent,/SOP-admin-secret/);
   h.boundaries(firebaseUid,owner);a.equal(h.api.all().length,0);h.api.render();a.doesNotMatch(h.w.document.getElementById('support').textContent,/SOP-admin-secret/);a.equal(h.w.document.getElementById('v2SupportInbox'),null);a.equal(h.w.document.getElementById('v2SupportHomeAlert'),null);h.unchanged();
  }finally{await h.close();}}
});
test('a stale ready admin gate cannot attribute a new report to the previous Firebase user',async()=>{
 const h=setup([],auth('fixture-user','admin'));try{h.boundaries('new-cobrador','new-cobrador');a.throws(()=>h.api.create('ERROR','Reporte ficticio de cuenta nueva'),/AUTH|AUTORIZ|IDENTIDAD/);h.unchanged();}finally{await h.close();}
});
test('a stale ready admin gate and its existing status control cannot mutate a report after the Firebase owner changes',async()=>{
 const h=setup([ticket('admin-secret','other')],auth('fixture-user','admin'));try{h.api.render();const select=h.w.document.querySelector('#v2SupportInboxList select');a.ok(select);h.boundaries('new-cobrador','new-cobrador');
  a.throws(()=>h.api.setStatus('SOP-admin-secret','RESUELTO'),/AUTH|AUTORIZ|IDENTIDAD/);select.value='RESUELTO';select.dispatchEvent(new h.w.Event('change'));h.unchanged();a.ok(h.alerts.length);
 }finally{await h.close();}
});
test('changing the tenant getter without a validated ready event cannot reveal the new organization',async()=>{
 const h=setup([ticket('old-org','other'),ticket('new-org','other','new-org')],auth('fixture-user','admin'));try{a.equal(h.api.all()[0].id,'SOP-old-org');h.setOrg('new-org');a.equal(h.api.all().length,0);h.api.render();a.doesNotMatch(h.w.document.getElementById('support').textContent,/SOP-old-org|SOP-new-org/);h.unchanged();}finally{await h.close();}
});
test('changing the tenant getter without a validated ready event cannot attribute new reports to that tenant',async()=>{
 const h=setup([],auth('fixture-user','admin'));try{h.setOrg('new-org');a.throws(()=>h.api.create('ERROR','Falla ficticia no autorizada'),/AUTH|AUTORIZ|IDENTIDAD/);h.unchanged();}finally{await h.close();}
});
test('changing the tenant getter without a validated ready event cannot modify its report statuses',async()=>{
 const h=setup([ticket('new-org','other','new-org')],auth('fixture-user','admin'));try{h.setOrg('new-org');a.throws(()=>h.api.setStatus('SOP-new-org','RESUELTO'),/AUTH|AUTORIZ|IDENTIDAD/);h.unchanged();}finally{await h.close();}
});
test('a blocked auth event invalidates the previous ready identity and only an event matching the current gate can reauthorize',async()=>{
 const h=setup([ticket('old-org','other'),ticket('new-org','other','new-org')],auth('fixture-user','admin'));try{
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:{ready:false,uid:'fixture-user',role:'admin',authenticated:false,member:false}}));a.equal(h.api.all().length,0);
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:auth('different-user','admin')}));a.equal(h.api.all().length,0);
  h.switch(auth('fixture-user','admin'),'new-org');a.deepEqual(Array.from(h.api.all(),x=>x.id),['SOP-new-org']);a.equal(h.api.create('MEJORA','Mejora ficticia autorizada').orgId,'new-org');
 }finally{await h.close();}
});
