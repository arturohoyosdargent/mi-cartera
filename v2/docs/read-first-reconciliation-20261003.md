# Conciliación de diario protegido

Base y rollback: `210d45d`, `v2-pilot-20261003-b2-unified-share-1`.

La prueba física de compartir está aprobada. Este cambio no toca su implementación, imágenes ni diseños, y no reabre los dos cierres administrativos anteriores.

## Diagnóstico verificable

- Una cola existente al configurar Cloud bloqueaba globalmente nuevos registros, pero no consultaba automáticamente sus marcadores para conciliar.
- Las operaciones con preparación diferida de caja o con otra fila pendiente devolvían `QUEUED` sin programar el seguimiento inmediato. Se agrega ese seguimiento, sujeto a las mismas protecciones.
- Un timeout de entrega no cancela necesariamente una transacción ya iniciada. No demuestra ausencia en servidor.
- Las continuaciones administrativas permitían reanudar filas al reabrir sin consultar antes su marcador. Ahora toda fila desconocida o incierta exige lectura antes de cualquier envío.

La evidencia Redmi muestra seis registros protegidos, pero no sus IDs/payloads. Por tanto no se afirma que los seis estén registrados en Cloud ni se atribuye cada caso al 429. La app consulta cada ID exacto en el dispositivo propietario cuando Cloud esté disponible.

## Protección y comportamiento

- `getDocFromServer` consulta exclusivamente marcadores en la organización V2 y sesión propietaria. ID, actor, tipo, huella, estado `APPLIED` y fecha de aplicación deben coincidir.
- Se reconoce únicamente el subconjunto demostrado. Antes del ACK se guarda y verifica una copia íntegra; WebLocks y comparación del origen evitan perder enqueues concurrentes. Payloads, intentos y errores originales se conservan. Ningún documento financiero se escribe al conciliar.
- `NOT_FOUND`, `UNKNOWN`, colisiones y filas ajenas/inválidas siguen protegidos. No hay botón de reenvío ni desbloqueo automático de registros ausentes. Un registro ausente requiere una decisión posterior basada en su revisión, fuera de esta entrega.
- Los cierres anteriores y su ledger no se modifican, no se consultan ni se reprocesan. Sus IDs siguen excluidos permanentemente. Tampoco pueden recrearse los IDs de pago/ingreso bajo otro ID de operación.
- Un nuevo cobro entrante puede conservarse localmente mientras hay revisión. Se muestra pendiente y permanece sin envío automático. Gastos, desembolsos, renovaciones y movimientos comerciales no obtienen esta excepción.
- Conflictos locales o colisiones verificadas aíslan el crédito correspondiente. Otros créditos pueden recibir nuevos cobros locales.
- Sólo un ID creado efectivamente por el runtime vigente tiene autorización para su primer envío. Filas de otra pestaña/restauración y runtimes sustituidos no pueden transmitir. Sesión, versión y guard se revalidan después de preparar caja y dentro de la transacción.
- HTTP 429 interrumpe el lote al primer fallo. El backoff por propietario y las evidencias de colisión se guardan en una clave de diagnóstico separada del diario/ledger, bajo WebLock. Recargar o abrir otra pestaña no reinicia la pausa de cinco minutos.

## QA

`read-first-reconciliation.spec.js` incluye datos exclusivamente ficticios: seis pendientes y dos cierres, ACK parcial, ausencia, cuota persistida, colisiones, nuevos cobros locales, exclusiones originales y IDs financieros repetidos, respuesta perdida usando el store atómico real, sesión/versión cambiadas durante preparación, runtime sustituido, pestaña antigua y transición PWA preservando diario/ledger/respaldo/cartera.

El fixture `tests/fixtures/read-first-mobile.html` usa la pantalla y el flujo real de cobro de la app en 393×873, sin Firebase de producción. Los diálogos nativos de pago se simulan porque el navegador de QA no admite `prompt`. Se comprueba un cobro ficticio local de S/9 con seis registros protegidos, respuesta visible del botón de servidor ante cuota y ACK parcial de dos coincidencias con cuatro ausentes conservadas. Cero transmisiones financieras en esos escenarios. La prueba física de compartir no se repite.

Los cambios a fixtures antiguos actualizan únicamente dos expectativas de reenvío de continuaciones al nuevo requisito de conciliación previa, y añaden tipo/fecha a respuestas ficticias del servidor. Los checks de autenticación se verifican por comportamiento en las pruebas de runtime, en lugar de imponer la sintaxis de un helper.

Publicación autorizada sólo después de QA/revisión/CI verde. Hosting V2 exclusivamente; sin despliegue de reglas, Functions ni escrituras de datos reales.
