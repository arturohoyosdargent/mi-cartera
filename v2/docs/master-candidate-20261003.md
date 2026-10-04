# Candidato maestro — SOCIOS y cartera

Base operativa/rollback: `ad0d899398d551294190005ad07249435dd146ba`, versión `v2-pilot-20261003-b2-commercial-consultation-1`. Se conserva además `d0df8a8` y el bundle de retorno operativo. Rama: `candidate/master-finance-socios-reports-20261003`.

Versión candidata: `v2-pilot-20261003-b2-master-socios-portfolio-1`. **Sin publicación ni integración en main.**

## Cambios

- SOCIOS existía desde `54fdcac`; se conserva capital/aportes, saldo, abonos y calendario. Se distingue de Usuarios autorizados. Confirmación tardía valida sesión/rol/propietario antes de aplicar. Al perder permisos se limpia la vista. Caja, deuda, intereses y agenda respetan la fecha de corte; pagos futuros permanecen reservados y no habilitan reenvío.
- Clientes abre reporte móvil buscable/filtrable, indicadores, último pago, historial y comportamiento automático. Franja compacta en consulta del crédito. El saldo utiliza el modelo comercial aprobado, incluso créditos heredados; renovaciones cuentan desembolso neto verificable. Se distinguen datos faltantes de cero y de buen comportamiento.
- Incobrable/no localizado requiere confirmación administrativa. Operación `CLIENT_CLASSIFICATION_UPDATED`, auditoría e idempotencia; parche exclusivo de metadatos preserva contacto, asignación y documentos financieros vigentes. Conflictos de versión y sesión impiden sobrescribir cambios de otro dispositivo. Regla candidata restringe los tres campos administrativos; **esta regla no se ha desplegado**.
- Consulta de gestores mantiene créditos autorizados, contactos concedidos e historial de cobros/auditoría propios. Versiones antiguas y eliminadas no reaparecen. Cobrador conserva consulta por rutas, sin edición administrativa. Un cambio de identidad/permisos limpia un historial previamente abierto.
- PWA incluye ambos módulos nuevos en caché. Instalación/activación modifica únicamente cachés de recursos; no accede al diario ni a IndexedDB.

## Validación

Regresión local: 114/114 suites. Casos nuevos: modelo8, UI11, metadata3, SOCIOS20, PWA1. SDK real Firebase10.14.1 sobre emuladores `demo-cartera-final`, loopback8380/9199: 25/25, ocho documentos financieros idénticos antes/después (SHA256 `e104a74ddf25b16ebd403ff004e8ea43b91a98c6e3661557e8d3b6ce8fbbc7d6`). Revisión independiente inicial28/28 y revisión focal de la limpieza final de sesión. Vista móvil393×873 con datos ficticios, sin desbordamiento. CI del candidato debe quedar verde antes de considerarlo aprobado.

No se ejecutaron operaciones ni escrituras financieras de producción. No se cambió el diseño/generador de imágenes ni la lógica de pagos/renovaciones/comisiones. Las seis operaciones protegidas reales permanecen para conciliación posterior; los dos cierres administrativos no se reabren ni se reprocesan. Las pruebas verifican byte a byte sus equivalentes ficticios: no afirman haber accedido al almacenamiento físico del Redmi.

## Continuidad

El candidato requiere revisión/publicación expresamente autorizadas posteriormente. Para conservar la restricción administrativa validada, la eventual entrega debe incluir la regla específica revisada junto con Hosting, sin Functions ni datos financieros. No limpiar datos, reinstalar ni forzar sincronización. La conciliación de las seis operaciones es una tarea independiente, con sus identificadores originales y sin reenvío automático.
