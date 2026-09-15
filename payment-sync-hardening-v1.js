// Préstamo Ya — endurecimiento de sincronización de pagos v1.
// Garantiza que cada pago local nuevo entre una sola vez a la cola Cloud usando su mismo ID.
(function(){
  'use strict';
  if(window.__prestamoYaPaymentSyncHardeningV1)return;
  function install(){
    const raw=window.registerPayment;
    if(typeof raw!=='function')return setTimeout(install,250);
    if(raw.__prestamoYaPaymentSyncHardeningV1){window.__prestamoYaPaymentSyncHardeningV1=true;return}
    const wrapped=function(id,...args){
      const before=new Set((window.db?.payments||[]).map(p=>String(p?.id)));
      const result=raw.call(this,id,...args);
      try{
        const payments=window.db?.payments||[];
        const added=payments.find(p=>p?.id!=null&&!before.has(String(p.id)));
        if(added&&typeof window.enqueueSync==='function'){
          window.db.syncQueue=Array.isArray(window.db.syncQueue)?window.db.syncQueue:[];
          const alreadyQueued=window.db.syncQueue.some(q=>q&&['PAGO_CREADO','PAGO_MODIFICADO','RECAUDO','RECAUDO_CREADO'].includes(q.type)&&String(q.payload?.id)===String(added.id));
          if(!alreadyQueued)window.enqueueSync('PAGO_CREADO',{...added,id:added.id,creditId:added.creditId});
        }
      }catch(e){console.warn('Préstamo Ya · sincronización de pago',e)}
      return result;
    };
    wrapped.__prestamoYaPaymentSyncHardeningV1=true;
    window.registerPayment=wrapped;
    window.__prestamoYaPaymentSyncHardeningV1=true;
  }
  install();
})();
