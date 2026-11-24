# Correcciones acotadas de auditoría V2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir los defectos reproducidos de cobranza y reconexión sin modificar datos ni permisos de producción.
**Architecture:** Conservar los motores financieros y el transporte B2. Reutilizar el estado de cuenta consolidado y la revalidación de membresía existentes.
**Tech Stack:** JavaScript, Node test, happy-dom 20.14.5.
**Spec:** Solicitud del usuario 20/11/2026 y outputs/INFORME_INICIAL.txt del chat de auditoría.

## Global Constraints

- Base de aplicación cb171236c53618705984c5601e540fde9287554a, publicada por workflow 44015270671.
- No modificar ni eliminar información real de clientes, préstamos o pagos.
- No reconstruir módulos ni retomar B1.
- No cambiar reglas, backend, destinos de Firebase, tags estables ni configuración de importación.
- El usuario autorizó continuar correcciones sin confirmaciones innecesarias: ejecución directa y revisión independiente; publicación posterior sujeta a los controles existentes.

## Review Focus

- Varios créditos con fechas iguales: recordatorio grupal debe incluir todos y conservar acciones individuales.
- Cuotas de hoy no son vencidas; cuotas de ayer sí lo son.
- Reintentos online no conceden acceso desde cache ni reviven una membresía inactiva.
- Cambio de usuario/organización durante una lectura invalida el resultado.
- Repetir el evento online no duplica transporte ni escrituras.

## Task 1 — Cobranza y recordatorios

**Files:** v2/app/agenda-grouped-v2.js, v2/app/operational-cards-v2.js, v2/tests/collection-reminder-audit.spec.js.
**Interfaces:** MiCarteraV2Agenda.render(), MiCarteraV2Cards.render(), data-account-statement existente.

- [ ] Escribir pruebas DOM con dos créditos ficticios iguales: acción grupal abre consolidado con ambos IDs, cuotas individuales conservan ID y muestran referencia, HOY no VENCIDO y ayer sí.
- [ ] Ejecutar y guardar fallo anterior al cambio.
- [ ] Aplicar cambio mínimo: acción grupal reutiliza data-account-statement si hay varios créditos; mostrar referencia de crédito; distinguir fecha de hoy/ayer al etiquetar cobranza.
- [ ] Repetir pruebas focales financieras y revisar diff.

## Task 2 — Recuperación Auth después de arranque offline

**Files:** v2/app/auth-cloud-gate.js, v2/tests/auth-session-runtime-integration.spec.js.
**Interfaces:** evento window.online, refreshMembership(), authWork, authRevision existentes.

- [ ] Prueba: lectura de membresía unavailable, reconectar, relectura de servidor activa hidrata y configura transporte; cero escrituras financieras.
- [ ] Pruebas: server sigue caído, cache, inactive, logout/cambio identidad, eventos repetidos; mantener bloqueo correcto.
- [ ] Ejecutar y guardar fallos previos.
- [ ] Listener online acotado a fallo de lectura de membresía con usuario nativo y versión válida. Serializar y revalidar condición dentro de authWork; reutilizar evaluateUser.
- [ ] Repetir integración Auth/sesión y custodia.

## Task 3 — Verificación y entrega

- [ ] Ejecutar todas las suites spec.js y el contrato B2 spec.cjs; sintaxis V2.
- [ ] Revisión independiente del diff de tareas 1 y 2 y corrección de hallazgos materiales.
- [ ] Entregar informe actualizado, parche revisable y evidencia con limitaciones explícitas.
- [ ] No publicar ni promover estable sin cerrar verificación física/roles y el control de publicación existente.
