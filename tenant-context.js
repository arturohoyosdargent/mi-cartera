/* Préstamo Ya — contexto multiempresa (comercial-v1)
 * Este módulo prepara el aislamiento por organización sin modificar todavía
 * el flujo estable de producción. La integración con Firebase Cloud se hará
 * después de validar el contrato con datos de dos organizaciones.
 */
(function(){
  'use strict';
  const clean=v=>String(v==null?'':v).trim();
  const validId=v=>/^[A-Za-z0-9_-]{2,80}$/.test(clean(v));
  let active=null;

  function fromProfile(profile){
    const orgId=clean(profile?.orgId);
    if(!validId(orgId)) throw new Error('TENANT_INVALID_ORG_ID');
    return Object.freeze({
      orgId,
      uid:clean(profile?.uid||profile?.id),
      role:clean(profile?.role||'consulta'),
      routeIds:Array.isArray(profile?.routeIds)?Object.freeze(profile.routeIds.map(clean).filter(Boolean)):Object.freeze([])
    });
  }

  function requireActive(){
    if(!active?.orgId) throw new Error('TENANT_NOT_READY');
    return active;
  }

  function setFromProfile(profile){
    active=fromProfile(profile);
    return active;
  }

  function clear(){active=null;}

  function sameOrg(orgId){
    return !!active?.orgId && clean(orgId)===active.orgId;
  }

  function canAccessRoute(routeId){
    const t=requireActive();
    return ['admin','supervisor'].includes(t.role) || t.routeIds.includes(clean(routeId));
  }

  window.PrestamoYaTenant=Object.freeze({
    fromProfile,
    setFromProfile,
    get:()=>active,
    requireActive,
    clear,
    sameOrg,
    canAccessRoute,
    version:'commercial-v1'
  });
})();
