// Préstamo Ya — protección de acciones de créditos.
// Evita que un crédito inexistente/argumento indefinido bloquee Ver, Recaudar o Modificar.
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
  const credit=id=>{
    const k=idOf(id);
    if(k==null)return null;
    return (window.db.credits||[]).find(x=>String(x.id)===String(k))||null;
  };
  const notify=msg=>{try{if(typeof window.toast==='function')window.toast(msg);else console.warn(msg)}catch(_){}};

  const wrap=(name,validator)=>{
    const raw=window[name];
    if(typeof raw!=='function'||raw.__prestamoYaSafe)return;
    const safe=function(arg,...rest){
      const id=idOf(arg);
      const cr=validator==='new'?null:credit(id);
      if(validator!=='new'&&!cr){
        const fallback=window.selectedCredit??window.__selectedCredit??null;
        const fc=credit(fallback);
        if(fc){try{return raw.call(this,fc.id,...rest)}catch(e){console.error(name,e);notify('No se pudo abrir el crédito seleccionado.')} }
        notify('El crédito seleccionado ya no existe en los datos locales.');
        return;
      }
      try{return raw.call(this,validator==='new'&&id==null?undefined:id,...rest)}catch(e){
        console.error('Préstamo Ya '+name+':',e);
        if(/clientId/i.test(String(e?.message||''))){
          notify('Se detectó un crédito con datos incompletos. Se protegió la operación para no perder información.');
          try{if(typeof window.renderAll==='function')window.renderAll()}catch(_){}
        }else notify('No se pudo ejecutar la acción.');
      }
    };
    safe.__prestamoYaSafe=true;
    window[name]=safe;
  };

  function install(){
    wrap('showCredit','credit');
    wrap('openCollect','credit');
    wrap('editCredit','credit');
    wrap('refinance','credit');
    wrap('newCredit','new');
  }

  const observer=new MutationObserver(()=>install());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  install();
  window.__prestamoYaCreditActionsSafetyVersion='v1';
  wait();
})();
