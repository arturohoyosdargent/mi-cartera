# Cierre de implementación V2 — 24/11/2026

Rama existente: development/v2-authoritative-payments-20261120. Continuación de f141f73cde6f5ec953e308b18779ceafd800aa9c, sin despliegue ni cambios de datos reales.

## Finalizado

Cobro autoritativo, mora separada con precisión de centavos, recuperación de operaciones y renovación solo interés se conservan del commit anterior. Los motores financieros y de cronogramas y las reglas b0991f922eca2d9ad5d0e2cd1e478c2892b0e78987a13d7de4f92677dc74f947 permanecen iguales.

Se cierra el error de contacto entre rutas: una asignación individual conserva la ruta canónica del cliente; para cambiar de ruta se usa el traslado existente de cliente con toda su cartera. Otro gestor de la misma ruta sigue permitido. La edición simple del cliente con créditos tampoco puede moverlo de ruta. Ambos stores transaccionales comprueban la ruta canónica antes de aplicar una asignación individual con datos desactualizados; los reintentos aceptados conservan su idempotencia. No se amplían permisos ni se mueven datos reales. Esta corrección previene nuevas asignaciones inconsistentes; no regulariza registros productivos existentes.

## Verificación limitada al cambio

42 pruebas distintas afectadas aprobadas: gestión/asignación y sincronización de metadatos, protección del contacto, edición de clientes y confirmaciones de creación. RED reproducido y GREEN posterior. Siete archivos JavaScript modificados pasan sintaxis. La regresión anterior de 964 PASS y los 253 casos de Firestore Emulator se conservan como evidencia del commit anterior; no se repiten. Los otros 13 archivos críticos registrados en aquella regresión mantienen sus hashes. No se afirma una nueva regresión integral.

La única adaptación de fixtures sitúa cliente y créditos en la misma ruta antes de comprobar la asignación individual; el nuevo test cubre explícitamente el rechazo entre rutas, incluso con creditId más includeCredits. También se comprueba el traslado completo existente sin alterar capital, intereses, cuotas, cronograma, pagos ni Caja.

## Pendiente

NO LISTA PARA PUBLICAR: faltan validación física en PC/Android/PWA y procedimiento autorizado para desplegar conjuntamente Functions, Rules y Hosting (el workflow protegido actual sólo publica Hosting). No se despliega, no se amplían permisos y no se inicia ninguna funcionalidad adicional.
