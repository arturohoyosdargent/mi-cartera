# Validación de cobro autoritativo V2 — 24/11/2026

Rama: development/v2-authoritative-payments-20261120. Base: cb171236c53618705984c5601e540fde9287554a. Candidato de desarrollo; sin despliegue ni acceso a datos financieros reales.

- Regresión recuperada: 138 archivos, 964 pruebas PASS, 0 FAIL/skip/cancel; hashes de las 14 fuentes financieras/reglas coinciden.
- Firestore Emulator: 248 casos de reglas y 2 flujos de integración ya aprobados se conservan. El flujo de cuota+mora se corrigió a fecha de negocio posterior al vencimiento y pasa por administrador, supervisor y cobrador (sin mora para cobrador). Pasan además renovación solo interés y créditos múltiples de un cliente con vencimiento idéntico: 253 casos distintos aprobados en total.
- Renovación: backend recalcula con motores existentes, valida conciliación/centavos/cronograma/versiones/permisos, crea cadena+pago INTERES+caja+auditoría en una transacción y verifica reintentos. UI integra exclusivamente el resultado canónico en B2; transportes existentes preservados.
- Cobros: cliente envía intención mínima, backend decide asignación y reparto, prohíbe duplicados y mora subcentavo; reglas cierran pagos, caja y comprobantes financieros directos. La cola recupera IDs originales y respeta cierres administrativos/cambios de usuario.
- Mora: registro separado con capital/interés cero, asiento COBRO_MORA y enlace al pago normal; no recalcula capital, intereses ni cronogramas. Caja, Balance, historial, estado de cuenta y comprobantes/PNG aprobados en regresión.

## Reproducir únicamente integraciones pendientes

Emulador local de Firestore, proyecto ficticio demo-mi-cartera-v2, puerto 18086. Para evitar el error de recursos de traducción del emulador en es_PE, iniciar Java con -Duser.language=en -Duser.country=US. El runner restringe host a loopback, puerto a 18085/18086 y no hace deploy. Usar V2_EMULATOR_PORT=18086 y V2_REPOSITORY_ROOT apuntando al checkout.

    node --test --test-name-pattern="Admin transaction service|interest-only backend|multiple active credits for one" v2/tests/authoritative-payment-firestore-emulator.cjs

## Límites para publicación

NO LISTO PARA PUBLICAR: falta validación física PC/Android/PWA, queda el caso conocido de contacto de cliente con créditos asignados a rutas distintas y falta procedimiento autorizado de despliegue coordinado de Functions+Rules+Hosting (el workflow protegido actual publica Hosting). No se amplían permisos ni se aplica una corrección parcial que quite acceso a otra ruta. Requiere resolver estos límites antes de comercialización; no habilitar Hosting aislado con el nuevo cliente.
