// Préstamo Ya — flujo seguro para el botón + Nuevo.
(()=>{
'use strict';
if(window.__prestamoYaQuickNewFixV1)return;
window.__prestamoYaQuickNewFixV1=true;
const validClients=()=>Array.isArray(window.db?.clients)?window.db.clients.filter(c=>c&&c.id!=null&&String(c.status||'Activo').toLowerCase()!=='eliminado'):[];
window.quickNew=function(){
 const clients=validClients();
 if(!clients.length){
   window.selectedClient=null;
   window.__selectedClientForProposal=null;
   if(typeof window.newClient==='function')return window.newClient();
   return window.go?.('clientForm');
 }
 const selected=clients.find(c=>String(c.id)===String(window.selectedClient??window.__selectedClientForProposal??''));
 if(selected&&typeof window.newCredit==='function')return window.newCredit(selected.id);
 // Sin una selección válida, no adivinar cliente: abrir Clientes para elegir o crear.
 if(typeof window.go==='function')window.go('clients');
 window.toast?.('Seleccione un cliente o cree uno nuevo para registrar el crédito.');
};
})();
