// Cuando Cloud está activo, elimina el flujo manual heredado que intentaba usar un servidor externo.
(()=>{
  const install=()=>{
    const section=document.getElementById('contingency');
    if(!section||typeof window.cloudSyncNow!=='function')return setTimeout(install,500);
    if(window.__prestamoYaContingencyCloud)return;window.__prestamoYaContingencyCloud=true;
    const cards=[...section.querySelectorAll('.card')];
    const manual=cards.find(c=>/Contingencia manual/i.test(c.textContent||''));
    if(manual)manual.innerHTML='<b>☁️ Sincronización Cloud activa</b><p class="small muted">El servidor central ya está configurado mediante Firebase Cloud. No necesitas exportar ni importar operaciones manualmente. Si hay operaciones pendientes, usa el botón <b>Intentar sincronizar ahora</b>.</p><button class="btn green wide" onclick="syncNow()">🔄 Sincronizar con Cloud</button>';
  };
  install();
})();
