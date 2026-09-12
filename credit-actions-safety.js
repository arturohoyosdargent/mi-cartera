// Préstamo Ya — protección de acciones de créditos.
// Normaliza IDs numéricos/string antes de entregar la acción al código original.
// Esto evita que Firestore/localStorage mezclen "123" con 123 y provoquen
// errores del tipo: Cannot read properties of undefined (reading 'clientId').
(()=>{
  'use strict';
  if(window.__prestamoYaCreditActionsSafety)return;
  window.__prestamoYaCreditActionsSafety=true;

  const wait=()=>{
    if(!window.db||!Array.isArray(window.db.credits))return setTimeout(wait,300);
    install();
  };
  const idOf=v=>{
    if(v==null||v==='')return null;
    if(typeof v==='object')return v.id??v.creditId??v.value??null;
    return v;
  };
  const findById=(list,id)=>{
    const k=idOf(id);
    if(k==null)return null;
    return (list||[]).find(x=>x!=null&&String(x.id)===String(k))||null;
  };
  const credit=id=>findById(window.db.credits,id);
  const client=id=>findById(window.db.clients,id);
  const notify=msg=>{try{if(typeof window.toast==='function')window.toast(msg);else console.warn(msg)}catch(_){}};

  const wrapCredit=(name)=>{
    const raw=window[name];
    if(typeof raw!=='function'||raw.__prestamoYaSafe)return;
    const safe=function(arg,...rest){
      const cr=credit(arg);
      if(!cr){
        const fallback=window.selectedCredit??window.__selectedCredit??null;
        const fc=credit(fallback);
        if(fc){try{return raw.call(this,fc.id,...rest)}catch(e){console.error(name,e);notify('No se pudo abrir el crédito seleccionado.')} }
        notify('El crédito seleccionado ya no existe en los datos locales.');
        return;
      }
      // CRÍTICO: pasar el ID real almacenado, no el argumento del HTML.
      // Así 123 y "123" llegan siempre con el mismo tipo que db.credits[].id.
      try{return raw.call(this,cr.id,...rest)}catch(e){
        console.error('Préstamo Ya '+name+':',e);
        if(/clientId/i.test(String(e?.message||''))){
          notify('Se detectó una referencia de crédito incompatible. Se corrigió la referencia y se protegió la operación.');
          try{if(typeof window.renderAll==='function')window.renderAll()}catch(_){}
        }else notify('No se pudo ejecutar la acción.');
      }
    };
    safe.__prestamoYaSafe=true;
    window[name]=safe;
  };

  const wrapNewCredit=()=>{
    const raw=window.newCredit;
    if(typeof raw!=='function'||raw.__prestamoYaSafeNew)return;
    const safe=function(arg,...rest){
      let cid=idOf(arg);
      if(cid!=null){
        const c=client(cid);
        if(!c){notify('El cliente seleccionado ya no existe en los datos locales.');return;}
        cid=c.id;
      }else if(window.selectedClient!=null){
        const c=client(window.selectedClient);
        if(c)cid=c.id;
      }
      try{return raw.call(this,cid,...rest)}catch(e){
        console.error('Préstamo Ya newCredit:',e);
        notify('No se pudo abrir Nuevo crédito.');
      }
    };
    safe.__prestamoYaSafeNew=true;
    window.newCredit=safe;
  };

  function install(){
    wrapCredit('showCredit');
    wrapCredit('openCollect');
    wrapCredit('editCredit');
    wrapCredit('refinance');
    wrapNewCredit();
  }

  const observer=new MutationObserver(()=>install());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  install();
  window.__prestamoYaCreditActionsSafetyVersion='v2';
  wait();
})();
