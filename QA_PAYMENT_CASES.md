# Matriz QA — pagos y sincronización

1. Registrar un pago con ID nuevo: debe existir una sola vez en `db.payments` y conservar `creditId`.
2. Reintentar sincronización del mismo ID: no debe crear un segundo movimiento.
3. Dos pagos del mismo importe y fecha con IDs distintos: ambos deben conservarse.
4. Pago offline pendiente: debe sobrevivir recarga y `pullCloud` hasta sincronizarse.
5. Pago Cloud existente + copia local mismo ID: merge único, conservando relación con crédito/ruta.
6. Pago con `creditId` inexistente: reportar huérfano; no eliminar ni reasignar automáticamente.
7. Crédito con `clientId` inexistente: reportar huérfano; no reasignar sin evidencia.
8. Comparar `credit.paid`, suma `db.payments` y suma `schedule[].paid`: toda diferencia debe reportarse.
9. Sincronizar, recargar y volver a sincronizar: conteo e importes de pagos deben permanecer idénticos.
10. Verificar saldo final únicamente contra movimientos válidos; nunca crear movimientos compensatorios automáticos.
