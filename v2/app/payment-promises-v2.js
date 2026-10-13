// Installment commitments are metadata. They never move the due date or settle debt.
(function(root){'use strict';
const KEY='mi-cartera-v2-validation-state',OWNER='mi-cartera-v2-local-owner',pending=new Set(),clone=v=>JSON.parse(JSON.stringify(v));
const load=()=>JSON.parse(localStorage.getItem(KEY)||'{}'),uid=p=>p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['updatedAt','__firestoreId'].includes(k)).map(k=>[k,canonical(v[k])]));return v}
const print=v=>JSON.stringify(canonical(v));
function identity(){const s=root.MiCarteraV2AuthCloudGate?.state?.()||{};return print([s.uid,s.role,s.ready,s.workerId,s.routeIds,root.firebaseAuthV2?.auth?.currentUser?.uid,localStorage.getItem(OWNER)])}
let epoch=0,lastIdentity=identity(),draft=null;
function observe(){const next=identity();if(next!==lastIdentity){lastIdentity=next;epoch++}}
function scope(d){observe();const h=root.MiCarteraV2AuthCloudGate,a=h?.state?.()||{};if(!a.ready||!a.uid||a.authenticated===false||a.member===false||String(d.session?.actorId||'')!==String(a.uid)||String(d.session?.role||'').toLowerCase()!==String(a.role||'').toLowerCase()||localStorage.getItem(OWNER)!==String(a.uid)||root.firebaseAuthV2?.auth?.currentUser?.uid!==String(a.uid))throw Error('La sesión y la cartera no coinciden. Sincroniza antes de continuar.');h.requireReady();return print([lastIdentity,epoch,d.session])}
const balance=q=>Math.max(0,Number(q.balance??(Number(q.amount||0)-Number(q.paid||0))));
function credit(d,id){const rows=(d.credits||[]).filter(c=>String(c.id)===String(id));if(rows.length!==1||!['ACTIVE','ACTIVO'].includes(String(rows[0].status).toUpperCase())||rows[0].renewedTo)throw Error('El crédito no está activo.');return rows[0]}
function summary(c){return (c.schedule||[]).map((q,i)=>q.paymentPromise?.status==='ACTIVE'&&balance(q)>0?{...q.paymentPromise,installmentNumber:i+1,amount:balance(q)}:null).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.installmentNumber-b.installmentNumber)[0]||null}
function auditKey(a){return print([a.id,a.at,a.actorId,a.role,a.action,a.entityType,a.entityId,a.operationId,a.detail])}
function validDate(date){const d=new Date(String(date)+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(String(date))&&!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===date}
async function mutate(creditId,installmentNumber,input,cancel){
 const key=String(creditId);if(pending.has(key))throw Error('Este compromiso ya se está guardando. Espera un momento.');pending.add(key);
 try{
  const d=load(),expectedScope=scope(d),A=root.MiCarteraV2AccessAudit,G=root.MiCarteraV2OperationCommitGate;A.requirePermission(String(d.session.role).toUpperCase(),'CREDIT_WRITE');
  const current=credit(d,creditId),revision=print(current),number=Number(installmentNumber),row=current.schedule?.[number-1];
  if(!Number.isInteger(number)||number<1||!row)throw Error('Selecciona una cuota válida.');
  const old=row.paymentPromise;if(cancel&&(!old||old.status==='CANCELLED'))return old||null;
  if(!(balance(row)>0))throw Error('La cuota ya está pagada.');
  const date=String(input?.date||''),observation=String(input?.observation||'').trim();if(!cancel&&!validDate(date))throw Error('Fecha de compromiso inválida.');
  if(!cancel&&old?.status==='ACTIVE'&&old.date===date&&old.observation===observation&&old.amount===balance(row))return clone(old);
  const next=clone(current),q=next.schedule[number-1],at=new Date().toISOString();
  if(current.paymentPromise&&!(current.schedule||[]).some(q=>q.paymentPromise)){next.paymentPromiseHistory=next.paymentPromiseHistory||[];next.paymentPromiseHistory.push(clone(current.paymentPromise));}
  if(old){q.paymentPromiseHistory=q.paymentPromiseHistory||[];q.paymentPromiseHistory.push(clone(old));}
  const record=cancel?{...old,status:'CANCELLED',cancelledAt:at,cancelledBy:d.session.actorId}:{...(old?.status==='ACTIVE'?old:{}),id:old?.status==='ACTIVE'?old.id:uid('promise'),installmentNumber:number,date,observation,amount:balance(row),status:'ACTIVE',createdAt:old?.status==='ACTIVE'?old.createdAt:at,actorId:d.session.actorId};
  q.paymentPromise=record;next.paymentPromise=summary(next);next.version=Number(current.version||1)+1;
  const type=cancel?'CREDIT_PAYMENT_PROMISE_CANCEL':'CREDIT_PAYMENT_PROMISE_SET',op=uid('op'),audit=A.event({id:uid('audit'),actorId:d.session.actorId,role:d.session.role,action:type,entityType:'CREDIT',entityId:current.id,operationId:op,detail:{installmentNumber:number,promiseId:record.id,date:record.date,amount:record.amount,observation:record.observation}});
  const before=load();if(scope(before)!==expectedScope)throw Error('La sesión cambió. Abre de nuevo el compromiso.');if(print(credit(before,creditId))!==revision)throw Error('El crédito cambió. Revisa el compromiso.');
  const ack=await G.submit({bridge:root.MiCarteraV2SyncBridge,versionGuard:root.MiCarteraV2VersionGuard,authGate:root.MiCarteraV2AuthCloudGate,operation:{operationId:op,type,entities:[{collection:'credits',kind:'set',data:clone(next)}],audit}});
  if(!['COMMITTED','APPLIED','ALREADY_APPLIED'].includes(String(ack?.status||'')))throw Error('El compromiso todavía no fue confirmado.');
  for(const ackId of [ack?.operationId,ack?.operation?.id,ack?.operation?.operationId])if(ackId&&String(ackId)!==op)throw Error('La confirmación pertenece a otra operación.');
  const latest=load();if(scope(latest)!==expectedScope)throw Error('La sesión cambió. No se modificó la cartera actual.');
  const actual=credit(latest,creditId),audits=(latest.audit||[]).filter(a=>a.id===audit.id||a.operationId===op);
  if(audits.some(a=>auditKey(a)!==auditKey(audit)))throw Error('La auditoría presenta un conflicto. Sincroniza antes de continuar.');
  if(print(actual)===print(next)&&audits.length)return clone(record);
  if(print(actual)!==revision)throw Error('El crédito cambió mientras se guardaba. Se conservó la revisión actual.');
  latest.credits[latest.credits.findIndex(c=>String(c.id)===key)]=next;latest.audit=latest.audit||[];if(!audits.length)latest.audit.push(audit);
  localStorage.setItem(KEY,JSON.stringify(latest));root.V2UI?.render?.();root.MiCarteraV2Cards?.render?.();root.MiCarteraV2Agenda?.render?.();decorate();return clone(record);
 }finally{pending.delete(key)}
}
const set=(id,number,input)=>mutate(id,number,input,false),cancel=(id,number)=>mutate(id,number,null,true);
function canWrite(){try{const d=load();scope(d);return root.MiCarteraV2AccessAudit.can(String(d.session.role).toUpperCase(),'CREDIT_WRITE')}catch{return false}}
function open(creditId){
 try{
  if(!canWrite())throw Error('No tienes permiso para registrar compromisos.');
  const d=load(),c=credit(d,creditId),capturedScope=scope(d),revision=print(c);document.getElementById('v2PromiseForm')?.remove();
  const panel=document.createElement('div');panel.id='v2PromiseForm';panel.className='card';panel.style.cssText='position:fixed;inset:0;overflow:auto;z-index:10002;background:#f5f8fa;padding:18px';
  panel.innerHTML='<div style="max-width:640px;margin:auto"><h2>Compromiso de pago</h2><label>Cuota<select class="select" id="v2PromiseInstallment"></select></label><div class="metric" id="v2PromiseOriginal"></div><label>Fecha prometida<input class="input" id="v2PromiseDate" type="date"></label><label>Observación<textarea class="input" id="v2PromiseObservation"></textarea></label><p class="metric">Este compromiso no cambia el vencimiento, la morosidad ni el saldo de la cuota.</p><button class="btn green" id="v2PromiseSave">Guardar compromiso</button><button class="btn" id="v2PromiseCancel">Anular compromiso</button><button class="btn" id="v2PromiseClose">Cerrar</button></div>';
  document.body.appendChild(panel);draft={panel,scope:capturedScope};const get=id=>panel.querySelector('#'+id),select=get('v2PromiseInstallment');
  c.schedule.forEach((q,i)=>{if(balance(q)>0){const option=document.createElement('option');option.value=String(i+1);option.textContent='Cuota '+(q.number??q.n??i+1)+(q.extra?' · ADICIONAL':'')+' · S/ '+balance(q).toFixed(2);select.appendChild(option)}});
  const display=()=>{const q=c.schedule[Number(select.value)-1],p=q?.paymentPromise;get('v2PromiseOriginal').textContent='Vencimiento original: '+(q?.date||'')+' · Saldo S/ '+balance(q||{}).toFixed(2);get('v2PromiseDate').value=p?.status==='ACTIVE'?p.date:(root.MiCarteraV2Dates?.today?.()||new Date().toISOString().slice(0,10));get('v2PromiseObservation').value=p?.status==='ACTIVE'?p.observation||'':'';get('v2PromiseCancel').disabled=p?.status!=='ACTIVE';};select.onchange=display;display();
  let saving=false;const save=async cancelled=>{if(saving)return;try{if(!panel.isConnected||scope(load())!==capturedScope)throw Error('La sesión cambió. Abre de nuevo el formulario.');if(print(credit(load(),creditId))!==revision)throw Error('El crédito cambió. Revisa el compromiso.');saving=true;get('v2PromiseSave').disabled=true;await (cancelled?cancel(creditId,select.value):set(creditId,select.value,{date:get('v2PromiseDate').value,observation:get('v2PromiseObservation').value}));panel.remove();draft=null;}catch(e){root.alert(e.message)}finally{saving=false;get('v2PromiseSave').disabled=false;}};
  get('v2PromiseSave').onclick=()=>save(false);get('v2PromiseCancel').onclick=()=>save(true);get('v2PromiseClose').onclick=()=>{if(!saving){panel.remove();draft=null}};
 }catch(e){root.alert(e.message)}
}
function decorate(){
 const allowed=canWrite(),d=load();for(const card of document.querySelectorAll('[data-credit-card][data-credit-id]')){
  const c=(d.credits||[]).find(c=>String(c.id)===card.dataset.creditId),button=card.querySelector('[data-payment-promise-credit]');
  if(!allowed||!c||!['ACTIVE','ACTIVO'].includes(String(c.status).toUpperCase())||c.renewedTo||!(c.schedule||[]).some(q=>balance(q)>0)){button?.remove();continue}
  if(!button){const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.paymentPromiseCredit=String(c.id);b.textContent='Compromiso de pago';b.onclick=()=>open(c.id);(card.querySelector('.row')||card).appendChild(b)}
 }
}
function install(){const cards=root.MiCarteraV2Cards;if(cards&&!cards.__paymentPromises){for(const name of ['render','renderCredits']){const original=cards[name];if(typeof original==='function')cards[name]=function(){const result=original.apply(this,arguments);decorate();return result};}cards.__paymentPromises=true}decorate()}
root.addEventListener('v2-auth-cloud-state',()=>{observe();if(draft){try{if(scope(load())!==draft.scope){draft.panel.remove();draft=null}}catch{draft.panel.remove();draft=null}}decorate()});
for(const event of ['storage','mi-cartera-v2-rehydrated'])root.addEventListener(event,decorate);
root.MiCarteraV2PaymentPromises={set,cancel,summary,open,install};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window);
