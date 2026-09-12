const fs=require('fs');
const vm=require('vm');
const code=fs.readFileSync('tenant-context.js','utf8');
const sandbox={window:{}};
vm.runInNewContext(code,sandbox);
const t=sandbox.window.PrestamoYaTenant;

function assert(condition,message){if(!condition)throw new Error(message);}

const a=t.fromProfile({uid:'u-a',orgId:'empresa-a',role:'cobrador',routeIds:['r1']});
assert(a.orgId==='empresa-a','orgId A incorrecto');
assert(a.routeIds.length===1 && a.routeIds[0]==='r1','rutas A incorrectas');

t.setFromProfile(a);
assert(t.sameOrg('empresa-a'),'debe aceptar su tenant');
assert(!t.sameOrg('empresa-b'),'no debe aceptar otro tenant');
assert(t.canAccessRoute('r1'),'debe aceptar ruta asignada');
assert(!t.canAccessRoute('r2'),'no debe aceptar ruta no asignada');

const b=t.fromProfile({uid:'u-b',orgId:'empresa-b',role:'admin',routeIds:[]});
t.setFromProfile(b);
assert(t.sameOrg('empresa-b'),'debe cambiar al tenant B');
assert(!t.sameOrg('empresa-a'),'no debe conservar acceso al tenant A');
assert(t.canAccessRoute('cualquier-ruta'),'admin debe poder operar sus rutas');

let failed=false;
try{t.fromProfile({uid:'u-x',orgId:'empresa A'});}catch(e){failed=e.message==='TENANT_INVALID_ORG_ID';}
assert(failed,'debe rechazar orgId inválido');

t.clear();
let notReady=false;
try{t.requireActive();}catch(e){notReady=e.message==='TENANT_NOT_READY';}
assert(notReady,'debe impedir uso sin tenant activo');

console.log('Tenant context QA OK');
