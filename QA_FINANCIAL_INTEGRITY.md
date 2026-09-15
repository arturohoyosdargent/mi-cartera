# Mi Cartera PRO — QA de integridad financiera

Fecha de revisión: 2026-09-15
Rama: repair-audit-2026-09-15

## Objetivo
Validar el circuito pago → crédito → cronograma → saldo → Cloud sin modificar ni eliminar cobros reales durante el diagnóstico.

## Invariantes obligatorias
1. Cada pago debe tener `id` único y `creditId` válido.
2. Cada crédito debe tener `id` único y `clientId` válido.
3. Un `pullCloud` no puede romper `credit.clientId`, `credit.routeId`, `payment.creditId` ni `payment.routeId` válidos existentes.
4. La creación de un crédito debe encolar/sincronizar el ID real generado, nunca `null`.
5. La lectura de Firestore debe conservar el ID del documento cuando el campo `id` no exista.
6. Ningún proceso de reparación puede borrar pagos o alterar importes automáticamente para hacer cuadrar saldos.
7. Antes de corregir una inconsistencia financiera se debe identificar el movimiento fuente y dejar trazabilidad en auditoría.

## Reparaciones ya verificadas en main
- `saveCredit()` incorpora el crédito final al payload antes de `enqueueSync`, conservando su ID real.
- `pullCollection()` conserva el ID de Firestore mediante `id:d.data()?.id??d.id` y `__firestoreId`.
- `pullCloud()` fusiona local/Cloud preservando relaciones válidas de créditos y pagos.
- Loader publicado actualizado para cargar la versión Cloud corregida.

## Riesgos que requieren datos operativos / E2E
- Duplicados históricos de pagos con IDs distintos pero mismo movimiento económico.
- Pagos huérfanos cuyo `creditId` no exista en la cartera descargada.
- Créditos huérfanos cuyo `clientId` no exista en clientes descargados.
- Diferencias entre `credit.paid`, suma de pagos y suma aplicada al cronograma.
- Movimientos pendientes en dispositivos offline todavía no subidos a Cloud.

## Política de reparación
Los riesgos anteriores se detectan y reportan primero. No se eliminan, reasignan ni recalculan movimientos reales automáticamente sin evidencia suficiente de su origen.

## Criterio de cierre
PASS requiere prueba con datos controlados de: crear crédito → registrar pago → recargar → pull Cloud → verificar cliente/crédito/pago → verificar cronograma/saldo → repetir sin duplicar el pago → probar offline/online.
