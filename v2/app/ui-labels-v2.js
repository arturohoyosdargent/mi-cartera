// Presentation only: persisted roles, frequency keys and sync statuses stay unchanged.
(function(root){'use strict';
 const key=value=>String(value||'').toUpperCase();
 const role=value=>({ADMIN:'Administrador',SUPERVISOR:'Supervisor',COBRADOR:'Cobrador',COLLECTOR:'Cobrador',LECTOR:'Lector',VIEWER:'Lector'}[key(value)]||'Sin sesión autorizada');
 const syncStatus=value=>({COMMITTED:'CONFIRMADA',APPLIED:'CONFIRMADA',ALREADY_COMMITTED:'YA CONFIRMADA',ALREADY_APPLIED:'YA CONFIRMADA',DUPLICATE:'YA CONFIRMADA',OFFLINE:'SIN INTERNET',LOCAL_ONLY:'PENDIENTE DE CONFIRMACIÓN',QUEUED:'PENDIENTE DE CONFIRMACIÓN',ERROR:'ERROR DE SINCRONIZACIÓN'}[key(value)]||'ESTADO SIN CONFIRMAR');
 const authReason=value=>({V2_MEMBERSHIP_REQUIRED:'Membresía V2 pendiente de autorización',AUTH_NOT_READY:'Verificando sesión y permisos',V2_AUTH_REQUIRED:'Inicia sesión para continuar',V2_ROLE_NOT_ALLOWED:'Tu rol no permite este acceso'}[key(value)]||'Acceso pendiente de autorización');
 root.MiCarteraV2Labels={role,syncStatus,authReason};
})(window);
