# Cierre integral Mi Cartera PRO V2

Objetivo: una candidata verificada sobre main 2a93b85, preservando cartera real y mejoras válidas.
Arquitectura: recuperar módulos financieros de socios-08 sobre las colecciones entries/expenses existentes; conservar Cloud autoritativo del main actual. Cola durable con identidad de operación y confirmación del servidor; datos reales nunca se usan como fixtures.
Ejecución autónoma autorizada por el usuario, sin revisión intermedia del plan.

- [x] Clonar historial completo y aislar rama cierre-integral-20261001.
- [x] Ejecutar todas las pruebas existentes: 45/50 archivos pasan; evidencia ../baseline-qa.json.
- [x] Corregir pruebas obsoletas conservando intención funcional y comprobantes gráficos aprobados.
- [x] Recuperar core/partner-loans.js, core/partner-interest-agenda.js y ambas UI desde candidata socios-08; ejecutar pruebas heredadas y prueba financiera atómica de aporte/interés/devolución/caja.
- [x] Integrar cola durable antes del envío y preservar cola concurrente, orden, errores y conflictos. Prueba roja antes de rescate.
- [ ] Verificar sesión y shell offline, actualización/caché, reconexión y PC-móvil sin duplicados usando fixtures.
- [x] QA integral de UI y Firestore con fixtures aisladas, más revisión de seguridad.
- [ ] Solo después de todos los gates, publicar hosting:v2 una vez y validar URL real; conservar rollback.

Riesgos a cubrir: aporte histórico no suma caja; interés no amortiza capital; devolver capital no se trata como gasto de beneficio; pago fallido permanece durable; una PC desfasada no revive eliminados; usuario/organización no heredan operaciones ajenas; conflictos detienen sucesoras.
No asumir Android físico validado por viewport móvil. Si faltan credenciales o acceso al dispositivo, registrar exactamente el bloqueo y conservar trabajo.

Regresión final: 76/76 suites aprobadas, sintaxis de app/core/cloud/vendor y git diff --check aprobados. Pendiente únicamente confirmación física limitada de reapertura PWA y publicación final.
