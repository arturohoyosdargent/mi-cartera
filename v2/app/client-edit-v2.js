// Mi Cartera PRO V2 — edit an existing client without replacing its linked credits.
(function(root){'use strict';
const K='mi-cartera-v2-validation-state';
const FIELDS=['fName','fPhone','fDni','fAddress','fGuarantor','fGuarantorPhone','fReference','fRoute','fLocation'];
const $=id=>document.getElementById(id);
const id=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
function notify(message){if(typeof root.alert==='function')root.alert(message);}
function load(){try{return JSON.parse(root.localStorage?.getItem(K)||'{}')}catch{return {}}}
function save(d){root.localStorage?.setItem(K,JSON.stringify(d));root.MiCarteraV2CreditFormParity?.refreshClientOptions?.();root.MiCarteraV2CreditFormParity?.updateClientTools?.();root.V2UI?.render?.();root.MiCarteraV2Cards?.render?.();root.MiCarteraV2AdminParity?.render?.()}
function form(){return $('clientForm')}
function setMode(editId){const section=form(),heading=section?.querySelector('h2'),button=$('saveClient');if(editId){if(section)section.dataset.editId=String(editId);if(heading)heading.textContent='Editar cliente';if(button)button.textContent='💾 Guardar cambios';}else{if(section)delete section.dataset.editId;if(heading)heading.textContent='Crear cliente';if(button)button.textContent='➡ Guardar y continuar';}}
function setCreateMode(){setMode('')}
function setField(field,value){const el=$(field);if(el)el.value=String(value??'')}
function openEdit(clientId){const d=load(),c=(d.clients||[]).find(x=>String(x.id)===String(clientId));if(!c)return notify('Cliente no encontrado.');setMode(c.id);const values={fName:c.name,fPhone:c.phone,fDni:c.dni,fAddress:c.address,fGuarantor:c.guarantor,fGuarantorPhone:c.guarantorPhone,fReference:c.reference,fRoute:c.route||c.routeId,fLocation:c.location};for(const field of FIELDS)setField(field,values[field]);root.show?.('clientForm');setTimeout(()=>$('fName')?.focus(),0)}
function decorate(){const list=$('clientsList');if(!list)return;for(const card of list.querySelectorAll('[data-client-card]')){const clientId=card.dataset.clientId;if(!clientId)continue;let row=card.querySelector('.v2-client-actions');if(!row){row=card.querySelector('.row');if(!row){row=document.createElement('div');row.className='row';row.style.marginTop='8px';card.appendChild(row)}row.classList.add('v2-client-actions')}if(!card.querySelector('.v2-edit-client-button')){const button=document.createElement('button');button.type='button';button.className='btn v2-edit-client-button';button.textContent='✏️ Editar';button.addEventListener('click',()=>openEdit(clientId));row.appendChild(button)}if(!card.querySelector('.v2-merge-client-button')){const d=load(),current=(d.clients||[]).find(x=>String(x.id)===String(clientId)),digits=v=>String(v||'').replace(/\D/g,''),dups=(d.clients||[]).filter(x=>String(x.id)!==String(clientId)&&current&&((String(current.dni||'').trim()&&String(x.dni||'').trim()===String(current.dni||'').trim())||(digits(current.phone)&&digits(x.phone)===digits(current.phone))));if(dups.length){const merge=document.createElement('button');merge.type='button';merge.className='btn v2-merge-client-button';merge.textContent='🔗 Consolidar duplicado';merge.addEventListener('click',()=>{const source=dups[0];if(root.confirm('Conservar '+current.name+' y consolidar/eliminar el duplicado '+source.name+'?'))mergeDuplicateClient(source.id,current.id)});row.appendChild(merge)}}if(!card.querySelector('.v2-delete-client-button')){const del=document.createElement('button');del.type='button';del.className='btn v2-delete-client-button';del.textContent='🗑️ Eliminar';del.addEventListener('click',()=>deleteClient(clientId));row.appendChild(del)}}}
function wrapCards(){const cards=root.MiCarteraV2Cards;if(!cards||cards.__v2ClientEditWrapped)return;if(typeof cards.render==='function'){const render=cards.render;cards.render=function(){const result=render.apply(this,arguments);setTimeout(decorate,0);return result}}cards.__v2ClientEditWrapped=true}
function bindCreate(){const buttons=[...document.querySelectorAll('button')].filter(button=>/crear cliente/i.test(String(button.textContent||'')));for(const button of buttons)if(!button.dataset.v2EditCreateBound){button.dataset.v2EditCreateBound='1';button.addEventListener('click',setCreateMode,true)}}
const deletingClients=new Set();
function canonicalClientDelete(value){if(Array.isArray(value))return value.map(canonicalClientDelete);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalClientDelete(value[key])]));return value}
const clientDeletePrint=value=>JSON.stringify(canonicalClientDelete(value));
function clientDeleteAuth(){const auth=root.MiCarteraV2AuthCloudGate?.state?.()||{};return clientDeletePrint([auth.uid,auth.role,auth.ready,auth.workerId,auth.routeIds,root.firebaseAuthV2?.auth?.currentUser?.uid])}
let clientDeleteEpoch=0,lastClientDeleteAuth=clientDeleteAuth();
function observeClientDeleteAuth(){const auth=clientDeleteAuth();if(auth!==lastClientDeleteAuth){lastClientDeleteAuth=auth;clientDeleteEpoch++}}
root.addEventListener?.('v2-auth-cloud-state',observeClientDeleteAuth);
function clientDeleteScope(d){observeClientDeleteAuth();const auth=root.MiCarteraV2AuthCloudGate?.state?.()||{},owner=root.localStorage?.getItem('mi-cartera-v2-local-owner'),nativeUid=root.firebaseAuthV2?.auth?.currentUser?.uid;if(!auth.ready||!auth.uid||String(d.session?.actorId||'')!==String(auth.uid)||String(d.session?.role||'').toLowerCase()!==String(auth.role||'').toLowerCase()||(owner&&owner!==String(auth.uid))||(nativeUid&&String(nativeUid)!==String(auth.uid)))throw new Error('La sesión y la cartera no coinciden. Espera a que termine la sincronización.');return clientDeletePrint([d.session,owner,lastClientDeleteAuth,clientDeleteEpoch])}
function assertClientDeleteScope(d,expected){if(clientDeleteScope(d)!==expected)throw new Error('La sesión cambió durante la eliminación. No se modificó la cartera actual.')}
function deletableClient(d,clientId){
 const current=(d.clients||[]).find(x=>String(x.id)===String(clientId));if(!current)throw new Error('CLIENT_NOT_FOUND');
 const linked=(d.credits||[]).filter(x=>String(x.clientId)===String(clientId)),payments=(d.payments||[]).filter(x=>String(x.clientId||'')===String(clientId));
 if(linked.length||payments.length)throw new Error('No se puede eliminar este cliente: tiene créditos o pagos asociados. Revisa su historial.');
 const dni=String(current.dni||'').trim(),phone=String(current.phone||'').replace(/\D/g,'');
 if((d.clients||[]).some(x=>String(x.id)!==String(clientId)&&((dni&&String(x.dni||'').trim()===dni)||(phone&&String(x.phone||'').replace(/\D/g,'')===phone))))throw new Error('Cliente duplicado detectado. Primero revisa y consolida sus relaciones.');
 return current;
}
function clientDeleteAuditPrint(audit){return clientDeletePrint([audit.id,audit.at,audit.actorId,audit.role,audit.action,audit.entityType,audit.entityId,audit.operationId,audit.detail])}
async function deleteClient(clientId){
 const key=String(clientId);if(deletingClients.has(key))return notify('Este cliente ya se está eliminando. Espera un momento.');deletingClients.add(key);
 try{
  const d=load(),expectedScope=clientDeleteScope(d),current=deletableClient(d,clientId),fingerprint=clientDeletePrint(current);
  const auditApi=root.MiCarteraV2AccessAudit,gate=root.MiCarteraV2OperationCommitGate;if(!auditApi||!gate)throw new Error('V2_CLIENT_DELETE_NOT_READY');
  const role=String(d.session.role).toUpperCase();auditApi.requirePermission(role,'CLIENT_WRITE');
  if(!root.confirm('¿Eliminar a '+current.name+'? Esta acción no se puede deshacer.'))return;
  const before=load();assertClientDeleteScope(before,expectedScope);if(clientDeletePrint(deletableClient(before,clientId))!==fingerprint)throw new Error('El cliente cambió. Vuelve a revisar su eliminación.');
  const op=id('op'),audit=auditApi.event({id:id('audit'),actorId:d.session.actorId,role:d.session.role,action:'CLIENT_DELETED',entityType:'CLIENT',entityId:current.id,operationId:op,detail:{name:current.name}});
  const ack=await gate.submit({bridge:root.MiCarteraV2SyncBridge,versionGuard:root.MiCarteraV2VersionGuard,authGate:root.MiCarteraV2AuthCloudGate,operation:{operationId:op,type:'CLIENT_DELETE',entities:[{collection:'clients',kind:'delete',data:{...current,version:Number(current.version||1)+1}}],audit},onStatus:status=>{const el=$('syncStatus');if(el)el.textContent=status}});
  for(const ackId of [ack?.operationId,ack?.operation?.id,ack?.operation?.operationId])if(ackId&&String(ackId)!==op)throw new Error('La confirmación pertenece a otra operación.');
  const latest=load();assertClientDeleteScope(latest,expectedScope);
  const audits=(latest.audit||[]).filter(row=>row.id===audit.id||row.operationId===op);if(audits.some(row=>clientDeleteAuditPrint(row)!==clientDeleteAuditPrint(audit)))throw new Error('La auditoría confirmada no coincide. Actualiza la cartera.');
  const present=(latest.clients||[]).find(row=>String(row.id)===key);
  if(!present){if(!audits.length)throw new Error('El cliente ya no está disponible. Actualiza la cartera.');notify('Cliente eliminado correctamente.');return true}
  if(clientDeletePrint(deletableClient(latest,clientId))!==fingerprint)throw new Error('El cliente cambió mientras se eliminaba. No se sobrescribieron sus datos.');
  latest.clients=latest.clients.filter(row=>String(row.id)!==key);latest.audit=latest.audit||[];if(!audits.length)latest.audit.push(audit);save(latest);notify('Cliente eliminado correctamente.');return true;
 }catch(error){notify(String(error?.message||error||'No se pudo eliminar el cliente.'));return false}
 finally{deletingClients.delete(key)}
}

function clientMergeEntityKey(value){function clean(v){if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['updatedAt','__firestoreId'].includes(k)).map(k=>[k,clean(v[k])]));return v}return JSON.stringify(clean(value))}
async function mergeDuplicateClient(sourceId,targetId){
 const keys=[String(sourceId),String(targetId)];if(new Set(keys).size!==2)return false;if(keys.some(k=>deletingClients.has(k))){notify('Uno de los clientes ya se está procesando.');return false}keys.forEach(k=>deletingClients.add(k));
 try{
  const d=load(),expectedScope=clientDeleteScope(d),source=d.clients.find(c=>String(c.id)===keys[0]),target=d.clients.find(c=>String(c.id)===keys[1]);
  if(!source||!target)throw Error('Cliente no encontrado.');
  const dni=v=>String(v||'').trim(),phone=v=>String(v||'').replace(/\D/g,'');
  if(!((dni(source.dni)&&dni(source.dni)===dni(target.dni))||(phone(source.phone)&&phone(source.phone)===phone(target.phone))))throw Error('Los clientes no coinciden por DNI o teléfono.');
  const A=root.MiCarteraV2AccessAudit,G=root.MiCarteraV2OperationCommitGate,role=String(d.session.role).toUpperCase();A.requirePermission(role,'CLIENT_WRITE');A.requirePermission(role,'CREDIT_WRITE');
  const prefer=(a,b)=>String(a??'').trim()?a:b,merged={...target,name:prefer(target.name,source.name),phone:prefer(target.phone,source.phone),dni:prefer(target.dni,source.dni),address:prefer(target.address,source.address),guarantor:prefer(target.guarantor,source.guarantor),guarantorPhone:prefer(target.guarantorPhone,source.guarantorPhone),reference:prefer(target.reference,source.reference),route:prefer(target.route,source.route),routeId:prefer(target.routeId||target.route,source.routeId||source.route),location:prefer(target.location,source.location),version:Number(target.version||1)+1};
  const affected=(d.credits||[]).filter(c=>String(c.clientId)===keys[0]),moved=affected.map(c=>({...c,clientId:target.id,version:Number(c.version||1)+1}));
  const verify=current=>{
   assertClientDeleteScope(current,expectedScope);
   for(const old of [source,target]){const rows=(current.clients||[]).filter(c=>String(c.id)===String(old.id));if(rows.length!==1||clientMergeEntityKey(rows[0])!==clientMergeEntityKey(old))throw Error('Un cliente cambió. Revisa la consolidación.');}
   const actual=(current.credits||[]).filter(c=>String(c.clientId)===keys[0]);if(actual.length!==affected.length||affected.some(c=>clientMergeEntityKey(actual.find(row=>row.id===c.id))!==clientMergeEntityKey(c)))throw Error('Los créditos cambiaron. Se conserva su revisión actual.');
  };
  if(!root.confirm('Consolidar los dos registros en '+merged.name+'? Se conservarán los datos y créditos asociados.'))return false;
  verify(load());const op=id('op'),audit=A.event({id:id('audit'),actorId:d.session.actorId,role:d.session.role,action:'CLIENT_DUPLICATE_MERGED',entityType:'CLIENT',entityId:target.id,operationId:op,detail:{sourceId:source.id,targetId:target.id,movedCredits:affected.length}});
  const entities=[{collection:'clients',kind:'set',data:merged},...moved.map(data=>({collection:'credits',kind:'set',data})),{collection:'clients',kind:'delete',data:{...source,version:Number(source.version||1)+1}}];
  const ack=await G.submit({bridge:root.MiCarteraV2SyncBridge,versionGuard:root.MiCarteraV2VersionGuard,authGate:root.MiCarteraV2AuthCloudGate,operation:{operationId:op,type:'CLIENT_DUPLICATE_MERGE',entities,audit},onStatus:status=>{const el=$('syncStatus');if(el)el.textContent=status}});
  for(const ackId of [ack?.operationId,ack?.operation?.id,ack?.operation?.operationId])if(ackId&&String(ackId)!==op)throw Error('La confirmación pertenece a otra operación.');
  const current=load();assertClientDeleteScope(current,expectedScope);const audits=(current.audit||[]).filter(a=>a.id===audit.id||a.operationId===op);
  if(audits.some(a=>clientDeleteAuditPrint(a)!==clientDeleteAuditPrint(audit)))throw Error('La auditoría presenta un conflicto.');
  if(audits.length&&!current.clients.some(c=>String(c.id)===keys[0])&&clientMergeEntityKey(current.clients.find(c=>String(c.id)===keys[1]))===clientMergeEntityKey(merged)&&moved.every(c=>clientMergeEntityKey(current.credits.find(row=>row.id===c.id))===clientMergeEntityKey(c)))return true;
  verify(current);current.clients=current.clients.map(c=>String(c.id)===keys[1]?merged:c).filter(c=>String(c.id)!==keys[0]);
  const replacements=new Map(moved.map(c=>[String(c.id),c]));current.credits=(current.credits||[]).map(c=>replacements.get(String(c.id))||c);current.audit=current.audit||[];if(!audits.length)current.audit.push(audit);
  save(current);notify('Clientes consolidados correctamente.');return true;
 }catch(e){notify(String(e?.message||e));return false}finally{keys.forEach(k=>deletingClients.delete(k))}
}

async function updateClient(){try{const d=load(),section=form(),clientId=section?.dataset.editId,current=(d.clients||[]).find(x=>String(x.id)===String(clientId));if(!current)throw new Error('CLIENT_NOT_FOUND');const auditApi=root.MiCarteraV2AccessAudit,gate=root.MiCarteraV2OperationCommitGate;if(!auditApi||!gate)throw new Error('V2_CLIENT_EDIT_NOT_READY');const role=String(d.session?.role||auditApi.ROLES.ADMIN).toUpperCase();auditApi.requirePermission(role,'CLIENT_WRITE');const name=String($('fName')?.value||'').trim(),phone=String($('fPhone')?.value||'').trim();if(!name||!phone)throw new Error('Nombre y teléfono son obligatorios.');const route=String($('fRoute')?.value||'').trim(),next={...current,id:current.id,name,phone,dni:String($('fDni')?.value||'').trim(),address:String($('fAddress')?.value||'').trim(),guarantor:String($('fGuarantor')?.value||'').trim(),guarantorPhone:String($('fGuarantorPhone')?.value||'').trim(),reference:String($('fReference')?.value||'').trim(),route,routeId:route,location:String($('fLocation')?.value||'').trim(),version:Number(current.version||1)+1},op=id('op'),audit=auditApi.event({id:id('audit'),actorId:d.session?.actorId||'admin-local-v2',role:d.session?.role||role,action:'CLIENT_UPDATED',entityType:'CLIENT',entityId:current.id,operationId:op,detail:{changed:['name','phone','dni','address','guarantor','guarantorPhone','reference','route','location'].filter(field=>String(current[field]??'')!==String(next[field]??''))}});await gate.submit({bridge:root.MiCarteraV2SyncBridge,versionGuard:root.MiCarteraV2VersionGuard,authGate:root.MiCarteraV2AuthCloudGate,operation:{operationId:op,type:'CLIENT_UPDATE',entities:[{collection:'clients',kind:'set',data:next}],audit},onStatus:status=>{const el=$('syncStatus');if(el)el.textContent=status}});const index=d.clients.findIndex(x=>String(x.id)===String(current.id));d.clients[index]=next;d.audit=Array.isArray(d.audit)?d.audit:[];d.audit.push(audit);save(d);setCreateMode();root.MiCarteraV2CustomerExperience?.resetClientForm?.();root.show?.('clients');notify('Cliente actualizado correctamente.')}catch(error){notify(String(error?.message||error||'No se pudo actualizar el cliente.'))}}
function bindSave(){const button=$('saveClient');if(!button||button.dataset.v2EditSaveBound)return;button.dataset.v2EditSaveBound='1';button.onclick=()=>form()?.dataset.editId?updateClient():root.MiCarteraV2DurableActions?.addClient?.()}
function install(){wrapCards();bindCreate();bindSave();decorate();setTimeout(decorate,0);const search=$('clientSearch');if(search&&!search.dataset.v2EditSearchBound){search.dataset.v2EditSearchBound='1';search.addEventListener('input',()=>setTimeout(decorate,0))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
root.MiCarteraV2ClientEditor={openEdit,setCreateMode,updateClient,deleteClient,mergeDuplicateClient,decorate,install};
})(window);
