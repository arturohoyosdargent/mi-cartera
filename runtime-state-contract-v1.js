// Préstamo Ya — contrato defensivo de estado runtime v1.
// Normaliza únicamente estructura en memoria; no inventa movimientos ni altera importes.
(function(){
  'use strict';
  if(window.__prestamoYaRuntimeStateContractV1)return;
  window.__prestamoYaRuntimeStateContractV1=true;

  const critical=['clients','credits','payments','users','routes','syncQueue'];
  const normalize=(source)=>{
    const db=source||window.db;
    if(!db||typeof db!=='object')return {ok:false,missingDb:true,normalized:[]};
    const normalized=[];
    for(const key of critical){
      if(!Array.isArray(db[key])){
        db[key]=[];
        normalized.push(key);
      }
    }
    return {ok:true,missingDb:false,normalized};
  };

  window.ensureRuntimeStateContract=normalize;
  try{normalize()}catch(e){console.warn('Préstamo Ya · contrato de estado',e)}

  let attempts=0;
  const duringStartup=()=>{
    attempts+=1;
    try{normalize()}catch(e){console.warn('Préstamo Ya · contrato de estado',e)}
    if(attempts<40)setTimeout(duringStartup,250);
  };
  setTimeout(duringStartup,0);

  window.addEventListener('online',()=>{try{normalize()}catch(_){}},true);
})();