# Estado de reparación — Mi Cartera PRO

## Completado
- Rama aislada de reparación.
- Auditor financiero no destructivo.
- Reglas de integridad de créditos/pagos.
- Verificación de conservación de IDs Firestore.
- Verificación de conservación de relaciones `clientId`, `creditId`, `routeId` durante merge Cloud/local.
- Hallazgo documentado: persistencia/render posterior a `pullCloud()`.
- Hallazgo documentado: el parche de cronograma no valida contra el ledger de pagos.

## No permitido durante reparación automática
- borrar pagos reales;
- cambiar importes para cuadrar saldos;
- fusionar pagos distintos por coincidencia de fecha/importe;
- vaciar `localStorage` o la cola offline.

## Pendiente para cierre
- corregir persistencia del pull Cloud;
- integrar auditor al QA predeploy;
- validar idempotencia del registro de pagos;
- ejecutar Actions/QA;
- PR y revisión final antes de `main`.
