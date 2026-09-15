// Préstamo Ya — diagnóstico seguro de errores de ejecución móvil v1
(function(){
  'use strict';
  if(window.__prestamoYaMobileDiagnosticsV1)return;
  window.__prestamoYaMobileDiagnosticsV1=true;
  const seen=new Set();
  const show=(kind,message,source,line,col)=>{
    const key=[kind,message,source,line,col].join('|');
    if(seen.has(key))return;
    seen.add(key);
    const file=source?String(source).split('/').pop():'';
    const where=[file,line||'',col||''].filter(Boolean).join(':');
    const text='Error de la aplicación: '+kind+': '+String(message||'Error desconocido')+(where?' · '+where:'');
    console.error('[Préstamo Ya diagnóstico]',{kind,message,source,line,col});
    try{if(typeof window.toast==='function')window.toast(text)}catch(_){}
  };
  window.addEventListener('error',e=>show(e.error?.name||'Error',e.message,e.filename,e.lineno,e.colno),true);
  window.addEventListener('unhandledrejection',e=>show(e.reason?.name||'Promise',e.reason?.message||e.reason,'',0,0));
})();
