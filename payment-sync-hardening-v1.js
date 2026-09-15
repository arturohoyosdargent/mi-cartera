// Préstamo Ya — endurecimiento de sincronización de pagos v2.
// Garantiza que cada pago local nuevo entre una sola vez a la cola Cloud usando su mismo ID.
(function(){
  'use strict';
  if(window.__prestamoYaPaymentSyncHardeningV2)return;
  function install(){
    const raw=window.registerPayment;
    if(typeof raw!=='function')return setTimeout(install,250);
    if(raw.__prestamoYaPaymentSyncHardeningV2){window.__prestamoYaPaymentSyncHardeningV2=true;return}
    const wrapped=function(id,...args){
      const before=new Set((window.db?.payments||[]).map(p=>String(p?.id)));
      const result=raw.call(this,id,...args);
      setTimeout(()=>{try{
        const payments=window.db?.payments||[];
        const added=payments.find(p=>p?.id!=null&&!before.has(String(p.id)));
        if(added&&typeof window.enqueueSync==='function'){
          window.db.syncQueue=Array.isArray(window.db.syncQueue)?window.db.syncQueue:[];
          const alreadyQueued=window.db.syncQueue.some(q=>q&&['PAGO_CREADO','PAGO_MODIFICADO','RECAUDO','RECAUDO_CREADO'].includes(q.type)&&String(q.payload?.id)===String(added.id));
          if(!alreadyQueued)window.enqueueSync('PAGO_CREADO',{...added,id:added.id,creditId:added.creditId});
        }
      }catch(e){console.warn('Préstamo Ya · sincronización de pago',e)}},0);
      return result;
    };
    wrapped.__prestamoYaPaymentSyncHardeningV2=true;
    window.registerPayment=wrapped;
    window.__prestamoYaPaymentSyncHardeningV2=true;
  }
  install();
})();
