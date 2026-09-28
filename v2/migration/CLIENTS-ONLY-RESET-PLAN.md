# V2 — Plan alternativo de arranque limpio conservando clientes

Este plan es un **fallback controlado**, no una autorización automática para borrar producción.

## Objetivo
Si la conciliación de créditos/pagos legacy no alcanza un nivel confiable, V2 puede iniciar desde cero financieramente conservando únicamente la base maestra de clientes validada. Los créditos V2 se crearían nuevamente como operaciones nuevas bajo el motor V2.

## Lo que se conserva
- Clientes validados y sus identificadores estables cuando sean confiables.
- Datos maestros necesarios: nombre, documento/teléfono/dirección/ruta y demás campos de cliente que se auditen como válidos.
- Un respaldo inmutable/exportación de V1 antes de cualquier limpieza.

## Lo que NO se arrastra automáticamente
- Créditos legacy.
- Pagos legacy.
- Renovaciones legacy.
- Colas pendientes/error de V1.
- Estados locales de PC/celular.
- Snapshots o reparaciones históricas.

## Reglas de seguridad
1. Nunca borrar V1 antes de tener backup verificable y exportación legible.
2. V2 debe usar un namespace/base independiente durante validación.
3. Importar clientes primero y comprobar cantidad + IDs + campos críticos.
4. Crear cada crédito nuevamente mediante el runtime V2, nunca copiando documentos crediticios legacy.
5. Cada crédito nuevo nace con versionado V2 y `operationId` propio.
6. Los saldos iniciales deben provenir de una lista de apertura revisada; no inferirlos silenciosamente de registros corruptos.
7. No recrear pagos históricos para cuadrar cifras. Si se necesita historial, conservarlo como archivo histórico de solo lectura, separado del ledger V2.
8. No activar operación diaria hasta conciliar el total de capital de apertura contra la lista aprobada.
9. Mantener V1 como consulta/rollback durante el periodo de validación; cualquier eliminación definitiva requiere una decisión explícita posterior.

## Resultado esperado
Una V2 financieramente limpia: clientes heredados de forma controlada, cero créditos/pagos/colas legacy dentro del ledger nuevo y créditos recreados desde el motor V2 con controles de idempotencia, versión y transacción desde su origen.
