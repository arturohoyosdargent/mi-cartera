// Préstamo Ya — eliminación manual controlada de un crédito v2
(()=>{
'use strict';
if(window.__prestamoYaManualDeleteV2)return;window.__prestamoYaManualDeleteV2=true;
const ALFREDO_OLD='1789432343734',ALFREDO_NEW='1789511824928',ALFREDO_PAYMENT='1789511824927';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sid=v=>String(v??'');
const getCredit=id=>(window.db?.credits||[]).find(c=>sid(c.id)===sid(id));
const getClient=cr=>(window.db?.clients||[]).find(c=>sid(c.id)===sid(cr?.clientId));
const getPayments=cr=>(window.db?.payments||[]).filter(p=>sid(p.creditId)===sid(cr?.id));
const notify=msg=>{try{if(typeof window.toast==='function')window.toast(msg);else alert(msg)}catch(_){alert(msg)}};
const isAlfredoLegacy=(cr,payments)=>sid(cr?.id)===ALFREDO_OLD&&payments.length===1&&sid(payments[0]?.id)===ALFREDO_PAYMENT&&!!getCredit(ALFREDO_NEW);
async function deleteCredit(id){
 const cr=getCredit(id);if(!cr){notify('❌ Crédito no encontrado.');return}
 const client=getClient(cr),payments=getPayments(cr),legacy=isAlfredoLegacy(cr,payments);
 if(payments.length&&!legacy){notify('❌ Este crédito tiene '+payments.length+' pago(s) asociado(s). Por seguridad no se puede eliminar.');return}
 const user=typeof window.currentUser==='function'?window.currentUser():null,role=user?.role||'';
 if(!['admin','supervisor'].includes(role)){notify('❌ Solo Administrador o Supervisor puede eliminar créditos.');return}
 const clientName=client?.name||'Cliente no vinculado';
 const ok=confirm(`⚠️ ELIMINAR CRÉDITO\n\nCrédito: #${cr.id}\nCliente: ${clientName}\nCapital: S/ ${Number(cr.capital||0).toFixed(2)}\nTotal: S/ ${Number(cr.total||0).toFixed(2)}\n\n${legacy?'Este es el período anterior renovado. El pago real S/120 se conservará en el historial y se vinculará al crédito renovado #'+ALFREDO_NEW+'.':'Se eliminará ÚNICAMENTE este crédito.'}\n\nNO se eliminará el cliente.\n\n¿CONFIRMAR ELIMINACIÓN?`);
 if(!ok)return;
 try{
  const index=(window.db.credits||[]).findIndex(x=>sid(x.id)===sid(cr.id));
  let paymentBackup=null;
  if(legacy){
   const p=payments[0];paymentBackup={...p};Object.assign(p,{creditId:Number(ALFREDO_NEW),renewedFrom:Number(ALFREDO_OLD),concept:'INTERES',type:'interest_renewal',capitalAmount:0,interestAmount:120,amount:120,repairTag:'legacy-credit-deleted-v2'});
  }
  if(index>=0)window.db.credits.splice(index,1);
  if(!legacy&&Array.isArray(window.db.payments))window.db.payments=window.db.payments.filter(p=>sid(p.creditId)!==sid(cr.id));
  if(typeof window.persist==='function')await window.persist();
  try{
   const firebaseApp=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
   const firebaseAuth=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
   const firebaseFirestore=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
   const apps=firebaseApp.getApps();if(!apps.length)throw new Error('Firebase no inicializado.');
   const app=firebaseApp.getApp(),auth=firebaseAuth.getAuth(app);if(!auth.currentUser)throw new Error('Sin sesión Firebase.');
   const fs=firebaseFirestore.getFirestore(app),orgId=(window.MI_CARTERA_CLOUD||{}).orgId||'mi-cartera';
   if(legacy){
    const p=payments[0];
    await firebaseFirestore.setDoc(firebaseFirestore.doc(fs,`orgs/${orgId}/payments`,ALFREDO_PAYMENT),JSON.parse(JSON.stringify(p)),{merge:true});
   }
   await firebaseFirestore.deleteDoc(firebaseFirestore.doc(fs,`orgs/${orgId}/credits`,sid(cr.id)));
  }catch(cloudError){
   console.error('Préstamo Ya · eliminación Cloud:',cloudError);if(index>=0)window.db.credits.splice(index,0,cr);
   if(legacy&&paymentBackup){const p=(window.db.payments||[]).find(x=>sid(x.id)===ALFREDO_PAYMENT);if(p){Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,paymentBackup)}}
   if(typeof window.persist==='function')await window.persist();notify('❌ Cloud rechazó la eliminación. No se realizó ningún cambio.');return;
  }
  try{if(typeof window.audit==='function')window.audit('CREDITO_ELIMINADO_MANUAL','#'+cr.id+' · '+clientName+(legacy?' · pago S/120 conservado en renovación':''))}catch(_){}
  try{if(typeof window.renderAll==='function')window.renderAll()}catch(_){}
  notify(legacy?'✅ Crédito anterior eliminado. El crédito renovado y el pago real S/120 se conservaron.':'✅ Crédito eliminado correctamente. El cliente se conservó.');
  setTimeout(()=>{try{if(typeof window.go==='function')window.go('credits')}catch(_){}},500);
 }catch(error){console.error('Préstamo Ya · eliminar crédito:',error);notify('❌ No se pudo eliminar el crédito: '+(error?.message||'Error desconocido'))}
}
window.__prestamoYaDeleteCredit=deleteCredit;
function addDeleteButtons(){try{document.querySelectorAll('#creditsList .card').forEach(card=>{if(card.dataset.manualDeleteAdded==='1')return;const buttons=card.querySelectorAll('button');let creditId=null;buttons.forEach(btn=>{const onclick=btn.getAttribute('onclick')||'',match=onclick.match(/(?:showCredit|openCollect|editCredit)\(\s*['"]?([^'\")]+)/);if(match&&!creditId)creditId=match[1]});if(!creditId)return;const cr=getCredit(creditId);if(!cr)return;const user=typeof window.currentUser==='function'?window.currentUser():null;if(!['admin','supervisor'].includes(user?.role))return;const del=document.createElement('button');del.type='button';del.className='btn red';del.textContent='🗑️ Eliminar este crédito';del.style.marginTop='8px';del.style.width='100%';del.onclick=()=>window.__prestamoYaDeleteCredit(cr.id);card.appendChild(del);card.dataset.manualDeleteAdded='1'})}catch(error){console.warn('Préstamo Ya · botones eliminar:',error)}}
function install(){addDeleteButtons();setTimeout(addDeleteButtons,500);setTimeout(addDeleteButtons,1500);setTimeout(addDeleteButtons,3000)}install();new MutationObserver(()=>addDeleteButtons()).observe(document.documentElement,{childList:true,subtree:true});
})();
