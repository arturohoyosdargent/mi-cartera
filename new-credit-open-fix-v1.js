// Préstamo Ya — apertura robusta de Nuevo crédito desde un cliente existente.
(()=>{
'use strict';
if(window.__prestamoYaNewCreditOpenFixV1)return;
const install=()=>{
  if(window.__prestamoYaNewCreditOpenFixV1)return;
  if(typeof window.newCredit!=='function'||!window.db||!Array.isArray(window.db.clients))return setTimeout(install,200);
  const raw=window.newCredit;
  window.newCredit=function(clientId,...rest){
    const clients=Array.isArray(window.db?.clients)?window.db.clients:[];
    let c=null;
    if(clientId!=null&&clientId!=='')c=clients.find(x=>x&&String(x.id)===String(clientId));
    if(!c&&window.selectedClient!=null)c=clients.find(x=>x&&String(x.id)===String(window.selectedClient));
    if(!c){
      if(typeof window.go==='function')window.go('clients');
      window.toast?.('Seleccione el cliente para registrar el crédito.');
      return;
    }
    // El formulario base consulta settings al abrir. En estados Cloud antiguos puede faltar
    // temporalmente el objeto; inicializarlo no modifica créditos, pagos ni saldos.
    if(!window.db.settings||typeof window.db.settings!=='object')window.db.settings={};
    if(window.db.settings.defaultRestDay==null)window.db.settings.defaultRestDay='none';
    try{return raw.call(this,c.id,...rest)}catch(e){
      console.error('Préstamo Ya · apertura Nuevo crédito:',e);
      window.toast?.('No se pudo abrir Nuevo crédito: '+(e?.message||'error de formulario'));
    }
  };
  window.__prestamoYaNewCreditOpenFixV1=true;
};
install();
})();
