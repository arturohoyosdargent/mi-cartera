// Préstamo Ya — hardening definitivo de acciones de crédito.
// Todas las acciones reciben el ID canónico que realmente existe en db.
(()=>{
  'use strict';
  const ready=()=>window.db&&Array.isArray(window.db.credits)&&typeof window.toast==='function';
  const findCredit=v=>{
    const k=typeof v==='object'&&v?v.id??v.creditId??v.value:v;
    if(k==null||k==='')return null;
    return (window.db.credits||[]).find(c=>String(c?.id)===String(k))||null;
  };
  const findClient=v=>{
    const k=typeof v==='object'&&v?v.id??v.clientId??v.value:v;
    if(k==null||k==='')return null;
    return (window.db.clients||[]).find(c=>String(c?.id)===String(k))||null;
  };
  const install=()=>{
    if(!ready())return false;
    if(window.__prestamoYaCreditIdHardening)return true;
    const wrap=(name)=>{
      const raw=window[name];
      if(typeof raw!=='function')return;
      const safe=function(arg,...rest){
        const cr=findCredit(arg);
        if(!cr){window.toast('No se encontró el crédito seleccionado.');return;}
        try{return raw.call(this,cr.id,...rest)}catch(e){
          console.error('Credit action '+name,e);
          window.toast('No se pudo ejecutar la acción del crédito.');
        }
      };
      safe.__prestamoYaCreditIdHardening=true;
      window[name]=safe;
    };
    const wrapClient=()=>{
      const raw=window.newCredit;
      if(typeof raw!=='function'||raw.__prestamoYaCreditIdHardening)return;
      const safe=function(arg,...rest){
        const c=findClient(arg??window.selectedClient);
        if(!c){window.toast('No se encontró el cliente seleccionado.');return;}
        try{return raw.call(this,c.id,...rest)}catch(e){console.error('Credit action newCredit',e);window.toast('No se pudo abrir Nuevo crédito.');}
      };
      safe.__prestamoYaCreditIdHardening=true;
      window.newCredit=safe;
    };
    ['showCredit','openCollect','editCredit','refinance','registerPayment','printTicket'].forEach(wrap);
    const rawNew=window.newCredit;
    if(typeof rawNew==='function'&&!rawNew.__prestamoYaCreditIdHardening){
      const safe=function(arg,...rest){const c=findClient(arg??window.selectedClient);if(!c)return window.toast('No se encontró el cliente seleccionado.');try{return rawNew.call(this,c.id,...rest)}catch(e){console.error('Credit action newCredit',e);window.toast('No se pudo abrir Nuevo crédito.')}};
      safe.__prestamoYaCreditIdHardening=true;window.newCredit=safe;
    }
    window.__prestamoYaCreditIdHardening=true;
    return true;
  };
  const boot=()=>install()||setTimeout(boot,250);
  boot();
})();
