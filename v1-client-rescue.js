// Mi Cartera V1 — non-destructive rescue of clients from legacy localStorage snapshots.
(function(root){
  'use strict';

  const KEYS=[
    'mi_cartera_pro_v21',
    'mi_cartera_pro_v20',
    'mi_cartera_pro_v19',
    'mi_cartera_pro_v18'
  ];

  function read(key){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return null;
      const data=JSON.parse(raw);
      return data&&typeof data==='object'?data:null;
    }catch(_){
      return null;
    }
  }

  function inspect(){
    return KEYS.map(key=>{
      const data=read(key);
      return {
        key,
        valid:!!data,
        clients:Array.isArray(data?.clients)?data.clients.length:0,
        credits:Array.isArray(data?.credits)?data.credits.length:0,
        payments:Array.isArray(data?.payments)?data.payments.length:0,
        data
      };
    }).sort((a,b)=>b.clients-a.clients||b.credits-a.credits||b.payments-a.payments);
  }

  function download(data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='mi-cartera-rescate-clientes-'+new Date().toISOString().slice(0,10)+'.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function rescue(){
    const snapshots=inspect();
    const best=snapshots[0];
    const detail=snapshots.map(x=>`${x.key.replace('mi_cartera_pro_','')}: ${x.clients} clientes`).join(' · ');
    if(!best||best.clients===0){
      alert('No se encontraron clientes en las cuatro copias locales de este navegador.\n\n'+detail+'\n\nNo se modificó ningún dato.');
      return;
    }
    download(best.data);
    alert(`Rescate listo: ${best.clients} clientes encontrados en ${best.key}.\n\nSe descargó una copia sin modificar V1.`);
  }

  root.MiCarteraV1ClientRescue={inspect,rescue};
})(window);
