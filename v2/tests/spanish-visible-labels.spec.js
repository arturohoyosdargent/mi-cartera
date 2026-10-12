const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');

test('login and authentication banner present Spanish roles while auth stays machine-readable',async()=>{
 const h=await boot({fullShell:true});try{
  h.load('app/login-v2.js');
  const auth={uid:'test-admin',email:'fictitious@example.invalid',authenticated:true,ready:true,role:'admin'};
  h.w.MiCarteraV2Login.state(auth);
  a.match(h.w.document.getElementById('loginIdentity').textContent,/Administrador/);
  a.match(h.w.document.getElementById('loginMessage').textContent,/nube/i);
  h.w.dispatchEvent(new h.w.CustomEvent('v2-auth-cloud-state',{detail:auth}));
  a.match(h.w.document.getElementById('authCloudStatus').textContent,/Administrador/);
  a.equal(auth.role,'admin');
 }finally{await h.close();}
});

test('operational session and synchronization badges use Spanish without changing durable ACK statuses',async()=>{
 const h=await boot({fullShell:true});try{
  const role=h.w.document.createElement('b');role.id='sessionRole';h.w.document.body.appendChild(role);
  h.w.V2UI.render();
  a.equal(h.w.document.getElementById('sessionRole').textContent,'Administrador');
  a.equal(h.w.document.getElementById('syncStatus').textContent,'NUBE CONECTADA');
  for(const status of ['COMMITTED','APPLIED','ALREADY_COMMITTED','DUPLICATE']){
   let visible;
   const result=await h.w.MiCarteraV2OperationCommitGate.submit({
    bridge:{status:()=>({configured:true}),submit:async()=>({status})},
    versionGuard:{requireReady(){}},authGate:{requireReady(){}},operation:{operationId:'fictitious'},onStatus:value=>{visible=value;}
   });
   a.match(visible,/CONFIRMADA|YA CONFIRMADA/);a.equal(result.status,status);
  }
 }finally{await h.close();}
});
