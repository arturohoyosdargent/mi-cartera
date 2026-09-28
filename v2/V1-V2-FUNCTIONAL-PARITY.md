# Mi Cartera PRO V2 — Puerta de paridad funcional V1 → V2

V2 no se considera terminada solo por tener motor financiero, Cloud y QA verde. Debe conservar las funciones operativas aprobadas de V1, reconstruidas sobre la arquitectura segura V2.

## Pantalla / función obligatoria

### Panel de control
- Cobrar hoy.
- Cobrado hoy.
- Cartera pendiente.
- Mora.
- Capital disponible.
- Capital colocado.
- Clientes activos.
- Créditos activos.
- Alertas y control.
- Agenda automática.
- Cobranza de hoy.
- Balance.
- Opciones, respaldo, usuario/sesión y acción Nuevo.

### Clientes
- Buscar por nombre, DNI, teléfono o referencia.
- Nombre, teléfono, DNI/documento y dirección.
- Nombre y teléfono de fiador.
- Referencia del cliente.
- Ruta.
- Coordenadas/ubicación del cliente.
- Seleccionar ubicación.
- Navegar con Google Maps.
- Navegar con Waze.
- Guardar y continuar.

### Créditos
- Todos / activos / vencidos.
- Nuevo crédito y reporte.
- Fecha y primera fecha de pago.
- Capital, interés, plazo/cuotas y frecuencia.
- Día de descanso y vencimiento.
- Total a pagar y valor de cuota.
- Detalle completo y cronograma.
- Compartir propuesta/detalle/aceptación por los flujos aprobados.
- Renovación y refinanciamiento sobre el motor financiero V2.

### Cobranza / pagos
- Cobranza diaria por fecha y ruta.
- Recaudar y registrar pago con operación idempotente V2.
- Comprobante de pago.
- Compartir comprobante y confirmación por WhatsApp.
- Historial de pagos.

### Agenda automática
- Hoy, vencidos y próximos 7 días.
- Filtro desde/hasta, ruta y cliente.
- Recordatorio individual por WhatsApp.
- Exportación de agenda `.ics` para calendario.
- Acceso desde panel y cobranza.

### Navegación y administración
- Rutas.
- Usuarios y permisos.
- Autorizaciones de cambios sensibles.
- Capital.
- Balance y caja.
- Reportes.
- Historial de caja.
- Parámetros.
- Respaldo completo.
- Contingencia/offline y cola de sincronización.
- Auditoría.
- Empresa.

## Reglas de migración
1. No copiar parches financieros defectuosos de V1.
2. Portar comportamiento/UI útil de V1 hacia módulos V2.
3. Toda mutación financiera usa el motor/transacción/idempotencia V2.
4. Toda función Cloud respeta versión verificada, autenticación, membresía, namespace V2 y reglas Firestore.
5. V1 permanece intacta como producción/rollback durante la validación.
6. No desplegar V2 como final mientras exista una función obligatoria de esta matriz sin implementar o sin prueba.

## Evidencia base localizada en V1
- `index.html`: panel, clientes, créditos, cobranza, rutas, usuarios, capital, balance y demás áreas operativas.
- `address-navigation.js`: Google Maps/Waze desde dirección o coordenadas, disponible en formulario, cliente, crédito y cobranza.
- `agenda-cobranza.js`: agenda automática, filtros, recordatorios WhatsApp y exportación de calendario.
- `credit-detail-share-button-v1.js` / `credit-detail-share-fix.js`: compartir detalle del crédito.
- Flujos de compartir pago/crédito y respaldo existentes se portan conservando la experiencia, pero conectados al núcleo V2.

Esta matriz es un release gate: una versión V2 no puede marcarse 100% sin paridad funcional + QA financiero/Cloud + validación del build desplegado.
