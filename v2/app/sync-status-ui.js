(function(root){'use strict';
function render(){
  const auth=root.MiCarteraV2AuthCloudGate?.state?.(),cloud=root.MiCarteraV2CloudRehydration;
  const foreign=cloud?.foreignPending?.(auth?.uid),read=cloud?.state?.()||{};
  const s=root.MiCarteraV2SyncBridge?.status?.()||{},q=s.queue||[],conflicts=q.filter(x=>['CONFLICTO','BLOQUEADO'].includes(x.status)),pending=q.filter(x=>x.status!=='SINCRONIZADO');
  const quota=/RESOURCE[-_ ]EXHAUSTED|QUOTA/i.test([read.lastError,auth?.reason,...pending.map(x=>x.lastError)].join(' '));
  const unavailable=/V2_MEMBERSHIP_READ_FAILED:.*(unavailable|deadline-exceeded|aborted)/i.test(auth?.reason||'');
  let el=document.getElementById('v2SyncDetails');
  if(!el){el=document.createElement('div');el.id='v2SyncDetails';el.className='card';const main=document.querySelector('main');main?.insertBefore(el,main.firstChild)}
  const pendingText=pending.length?'Hay '+pending.length+' operación(es) guardada(s) en este dispositivo, pendientes de sincronizar. ':'';
  const inFlight=Number(s.pending||0)>pending.length;
  el.textContent=s.reviewRequired?'Hay '+pending.length+' operación(es) protegida(s) para revisión. No se sincronizan automáticamente. Consulta primero el diario local.':foreign?'Hay movimientos pendientes de otro usuario. Vuelve a esa sesión y sincronízalos antes de registrar nuevos movimientos.':conflicts.length?'Hay '+conflicts.length+' operación(es) que necesitan revisión. No repitas el registro. Los datos locales están conservados; exporta un respaldo antes de resolver el conflicto.':quota?'Firebase tiene la cuota agotada. Los datos de PC y Android pueden diferir hasta que se restablezca. '+pendingText+'Conserva los datos; la aplicación reintentará con una pausa.':unavailable?'No se pudo conectar con Firebase para verificar tu acceso. Tus datos se conservan. '+pendingText+'La aplicación reintentará en un minuto; no necesitas cerrar sesión.':pending.length?pendingText+'Conserva los datos de la aplicación.':inFlight?'Hay una operación en curso. Espera la confirmación; no cierres la aplicación ni repitas el registro.':navigator.onLine===false?'Sin internet. Puedes trabajar con la sesión previamente verificada; los cambios se enviarán al reconectar.':auth?.ready!==true?'La sesión de Cloud no está lista. Revisa Usuario / Seguridad; los datos locales se conservan.':read.lastError?'No se pudo completar la actualización de Cloud. Los datos mostrados son la copia local; pulsa Actualizar para reintentar.':'Sin operaciones pendientes en este dispositivo.';
  if(pending.length&&root.MiCarteraV2PendingReview?.open&&typeof el.appendChild==='function'&&typeof root.document?.createElement==='function'){
    const b=root.document.createElement('button');b.type='button';b.className='btn';b.dataset.pendingReview='true';b.textContent='Ver operaciones locales (solo lectura)';b.title='Muestra tipo, fecha, monto y referencia sin reenviar ni modificar operaciones';b.onclick=()=>root.MiCarteraV2PendingReview.open();el.appendChild(b);
  }
  el.style.borderColor=foreign||conflicts.length?'#b22':pending.length||inFlight||quota||read.lastError||auth?.ready!==true?'#c80':'#d4d9dd';
}
for(const event of ['DOMContentLoaded','online','offline','storage','mi-cartera-v2-sync','mi-cartera-v2-rehydrated','v2-auth-cloud-state'])root.addEventListener(event,render);
let running=false,lastAttemptAt=0,lastAuthAttemptAt=0;
async function refresh(reason='timer'){
  if(running||navigator.onLine===false||document.visibilityState==='hidden')return;
  const gate=root.MiCarteraV2AuthCloudGate,cloud=root.MiCarteraV2CloudRehydration;
  let auth=gate?.state?.();
  const now=Date.now();
  if(!auth?.ready){
    const error=String(auth?.reason||''),membershipQuota=/RESOURCE[-_ ]EXHAUSTED|QUOTA/i.test(error);
    const transient=membershipQuota||/V2_MEMBERSHIP_READ_FAILED:.*(unavailable|deadline-exceeded|aborted)/i.test(error);
    const wait=membershipQuota?300000:60000;
    if(transient&&now>=(auth.nextMembershipAttemptAt||0)&&now-lastAuthAttemptAt>=wait&&typeof gate?.refreshMembership==='function'){
      lastAuthAttemptAt=now;
      try{auth=await gate.refreshMembership()}catch(e){console.warn('La membresía de Cloud se reintentará',e);render();return}
    }
    if(!auth?.ready){render();return}
  }
  const read=cloud?.state?.()||{};
  if(read.nextAttemptAt>now){render();return}
  const last=Math.max(lastAttemptAt,read.lastSuccessAt||0),due=!last||now-last>=(reason==='focus'?60000:300000);
  const pending=(root.MiCarteraV2SyncBridge?.status?.().pending||0)>0;
  if(!pending&&!due)return;
  running=true;
  try{
    // Runtime's default flush also downloads. Disable that download here so
    // this refresh has exactly one owner for the collection reads.
    const sent=await root.MiCarteraV2CloudRuntime?.flush?.({rehydrate:false});
    if(sent?.status==='BUSY')return;
    if((due||sent?.applied>0)&&!(root.MiCarteraV2SyncBridge?.status?.().pending>0)){
      lastAttemptAt=now;await cloud?.rehydrate();
    }
    root.MiCarteraV2Refresh?.render();
  }catch(e){console.warn('La actualización de datos se reintentará',e)}
  finally{running=false;render()}
}
root.addEventListener('focus',()=>refresh('focus'));document.addEventListener('visibilitychange',()=>refresh('focus'));
root.addEventListener('online',()=>root.MiCarteraV2AuthCloudGate?.refreshMembership?.().catch(e=>console.warn(e)));
setInterval(()=>refresh('timer'),45000);
})(window);
