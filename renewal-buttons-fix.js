// Hotfix de botones de renovación: elimina handlers inline y los conecta de forma segura.
(()=>{
  const $=id=>document.getElementById(id);
  const toastSafe=t=>{try{if(typeof window.toast==='function')window.toast(t)}catch(_){} };
  const wire=()=>{
    const m=$('renewalModal');
    if(!m)return false;
    const buttons=[...m.querySelectorAll('button')];
    for(const b of buttons){
      const label=(b.textContent||'').trim();
      if(label.includes('Aceptar y renovar')){
        const attr=b.getAttribute('onclick')||'';
        const mm=attr.match(/acceptRenewal\((\d+)\)/);
        const id=mm?mm[1]:window.__renewalId;
        b.removeAttribute('onclick');
        b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{window.__renewalId=id;if(typeof window.acceptRenewal!=='function')return toastSafe('Módulo de renovación no disponible. Recargue la aplicación.');await window.acceptRenewal(Number(id))}catch(err){console.error('Renovación:',err);toastSafe('No se pudo procesar la renovación: '+(err?.message||'revise los datos'))}};
      }else if(label==='Cancelar'||label==='✕'){
        b.removeAttribute('onclick');
        b.onclick=e=>{e.preventDefault();e.stopPropagation();m.remove()};
      }
    }
    for(const el of m.querySelectorAll('#renCap,#renRate,#renTerm,#renFirst,#renFreq')){
      el.removeAttribute('oninput');el.removeAttribute('onchange');
      el.addEventListener('input',()=>{try{window.previewRenewalAmounts?.()}catch(err){console.error(err)}});
      el.addEventListener('change',()=>{try{window.previewRenewalAmounts?.()}catch(err){console.error(err)}});
    }
    return true;
  };
  const obs=new MutationObserver(()=>wire());
  obs.observe(document.body,{childList:true,subtree:true});
  const start=()=>{if(wire())return;setTimeout(start,500)};start();
  window.__prestamoYaRenewalButtonsFix=true;
})();
