# PRÉSTAMO YA — Cierre de producto y comercialización

Estado base: FINAL4 estable congelada en `stable-verified-final4-20260920`.
Desarrollo posterior: `post-final4-business`.

## Regla de liberación
La rama estable nunca se modifica. Todo cambio se desarrolla y valida aparte. Solo una versión que supera QA funcional PC + Android puede convertirse en nueva estable.

## Gate 1 — QA funcional antes de vender
Validar: alta/edición de cliente; búsqueda parcial; alta/eliminación de crédito; cronograma diario/semanal/quincenal/mensual; pago normal, parcial y adelantado; confirmación anti-error; vencidos; recibo CUOTA X DE Y; recordatorio editable; detalle gráfico; renovación capital; renovación solo interés; agenda; balance/caja; capital; egresos; respaldo; sincronización PC↔Android; funcionamiento offline/recuperación; actualización sin falsos bloqueos.

## Gate 2 — Operación comercial
Definir panel de propietario para: alta de organización, alta/baja de usuario, rol, plan, estado de suscripción, fecha de vencimiento y suspensión/reactivación. Mantener aislamiento de datos por organización.

## Gate 3 — Oferta comercial
Preparar planes y precios, límites por plan, onboarding, soporte, términos de servicio, política de privacidad y canal de cobro. No prometer publicación comercial hasta cerrar QA y administración de suscripciones.

## Gate 4 — Piloto
Incorporar un número reducido de usuarios piloto, sin acceso técnico a Firebase/GitHub. Medir incidencias de alta, cobro, sincronización, respaldo y soporte. Corregir antes de apertura general.

## Gate 5 — Lanzamiento
Liberar únicamente una build etiquetada y respaldada; conservar rollback inmediato a la estable anterior; documentación de instalación y recuperación; canal de soporte activo.
