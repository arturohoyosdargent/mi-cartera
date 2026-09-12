// Reparación de clientes v3.
// La colección local ya no se mezcla con una copia Cloud antigua. Firebase Cloud Core es la fuente de verdad y pullCloud reemplaza la vista autorizada.
// Este módulo solo conserva compatibilidad con el puente de sincronización y evita reintroducir clientes eliminados/antiguos.
(()=>{
 const wait=()=>{if(typeof window.db!=='object'||typeof window.cloudSyncNow!=='function')return setTimeout(wait,300);if(window.__prestamoYaClientRepairV3)return;window.__prestamoYaClientRepairV3=true;window.syncClientsNow=async()=>{try{window.updateSyncUI?.();return true}catch(_){return false}}};
 wait();
})();
