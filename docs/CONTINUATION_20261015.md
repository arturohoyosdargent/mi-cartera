# Continuidad de Mi Cartera PRO V2 — 15/10/2026

Registro local para retomar esta línea conservando las mejoras autorizadas.
Este documento no autoriza publicación, cambios remotos ni promoción a estable.

## Fuente y estado de partida

- Repositorio: `C:/Users/Advance/Documents/Codex/2026-10-07/trabaja-directamente-sobre-mi-cartera-pro/work/controlled-improvements`.
- HEAD inicial: `7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5`.
- Rama de continuidad: `candidate/continuation-20261015`.
- Los cambios locales anteriores se conservan; el HEAD inicial no representa todo el trabajo sin commit.
- No restaurar archivos desde una versión antigua ni eliminar cambios para obtener un árbol limpio.
- Build local preparado: `v2-pilot-20261015-b2-session-atomic-recovery-1`.
- El usuario prohibió nuevos commits en su ampliación del 15/10: HEAD permanece en `7b53fc1`; el candidato se identifica por manifiesto SHA256 de los archivos modificados y nuevos.

## Evidencia anterior reutilizada

El QA aprobado del 14/10 registró 102 suites, 449 casos y sintaxis de 187 archivos JavaScript.
Al comenzar esta continuidad, los 50 archivos del manifiesto coincidían con esa evidencia.
Se reutilizó ese resultado; no se ejecutó de nuevo el QA integral aprobado.
Las comprobaciones del 15/10 se limitan a cambios y consumidores afectados.
Las 15 validaciones Android del 13/10 se conservan como evidencia histórica.
No certifican automáticamente las modificaciones de esta fecha.

## Correcciones focalizadas del 15/10

### Confirmación de cobranza después de reasignar

Un pago aceptado podía perder su confirmación si cambiaba la ruta del crédito o del cobrador.
La asignación vigente se exigía antes de reconocer la operación ya aplicada.
Ahora el reintento exacto devuelve el recibo original antes de validar asignaciones para pagos nuevos.
Se mantienen actor, membresía activa, fingerprint, estado aplicado y bloqueo por cierre/noReplay.
No se reescriben saldos, pagos, caja, auditoría ni atribución histórica durante ese reintento.
El crédito ausente o tombstone sigue bloqueando la confirmación; este alcance no se amplió.
Evidencia: RED reproducido, endpoint 18/18 y consumidores afectados 26/26; sintaxis de ambos archivos válida.
Archivos: `functions/v2-collector-payment.js` y `v2/tests/collector-payment-endpoint.spec.js`.
Registros: `collector-retry-15-*` del directorio de trabajo del chat del 15/10.

### Confirmación de condiciones de comisión al día siguiente

Una condición aceptada se rechazaba al reintentar después de cambiar la fecha comercial.
La prohibición de condiciones retrospectivas se comprobaba antes de reconocer el recibo existente.
Ahora esa prohibición se aplica a operaciones nuevas; el reintento exacto conserva su resultado original.
Siguen rechazados otro actor, payload distinto, tipo distinto, organización inyectada y cierres históricos.
Una operación nueva con fecha pasada continúa inválida y no escribe.
Evidencia: RED reproducido, cinco casos nuevos verdes y 23/23 casos de consumidores afectados.
Archivos: `functions/v2-manager-commissions.js` y `v2/tests/commission-endpoint.spec.js`.
Registros: `commission-retry-*` y `commission-affected-15.log`.

## Sesiones y arranque: integración corregida localmente

La implementación local previa conserva custodia por proyecto Firebase, organización y UID.
Los cambios de cuenta, permisos o pestaña no deben reutilizar una cartera de otro ámbito.
No se adopta una cartera sin propietario acreditado ni se vacían datos para resolver un bloqueo.
La revisión integrada detectó un fallo nuevo al completar el primer login válido del administrador.
El runtime captura una sesión inactiva antes de emitirse el estado Auth listo.
Reproducción registrada: `V2_CLOUD_NOT_READY:V2_SESSION_OTHER_TAB_CHANGED`.
Se emite primero la autorización para activar e hidratar el perfil; el transporte espera custodia confirmada.
Una revisión de generación descarta respuestas tardías tras bloquear versión, perder Auth o cambiar UID/proyecto/organización.
Resultado: 11/11 casos de integración y 29/29 casos consumidores, con revisión independiente sin bloqueantes.
Los logs y hashes están en `auth-session-*` del trabajo del 15/10.
El ensayo físico y la ejecución durable de una cola recuperada siguen pendientes; conectar el transporte no los certifica.

## Comprobantes de socios

Intereses y devoluciones de capital confirmados abren la vista previa existente con imagen PRÉSTAMO YA.
Incluyen socio, concepto, importe, fecha, periodo, operación y referencia del movimiento.
WhatsApp abre texto al número registrado; la imagen se comparte o guarda con el botón separado.
El contacto es opcional y puede registrarse en cada entrega sin cambiar capital ni pagos.
Copiar, cancelar, compartir y consultar historial no generan movimientos financieros.
Un error gráfico conserva el pago; los registros futuros se identifican como tales.
Las validaciones cruzan el egreso con el historial del socio y rechazan importes o periodos inconsistentes.
Resultado: 7/7 casos nuevos; la corrida inicial de regresiones afectadas pasó 48/48.
Sin inspección visual física: el navegador de la herramienta bloqueó la URL local `file:` por política.

## Panel financiero

La auditoría de código/fixtures y el diseño están en `FINANCIAL_HEALTH_DESIGN_20261015.md`.
No se auditaron carteras reales ni se implementaron cálculos definitivos.
Faltan políticas de devengo, cuentas físicas conciliadas, clasificación de gastos y cobertura histórica.
La propuesta separa tres módulos, componentes verificables y proyecciones; no convierte campos ausentes en cero.

## Eliminación y evidencia física conservada

Tres fixtures de eliminación pasan por botón real, confirmación, gate, sincronización y store.
Cubren eliminación elegible, cancelación y bloqueo de un crédito con pagos.
El caso elegible aplica tombstone solo al crédito y su desembolso; se usaron datos ficticios.
Resultado local: 3/3; registro `protected-deletion-flow.log`.
Las 15 validaciones Android del 13/10 permanecen conservadas y no se repitieron.

## Prioridades para continuar

| Área | Estado | Paso siguiente |
| --- | --- | --- |
| Retry de cobranza tras reasignación | Terminado local | Conservar pruebas y revisar en la próxima matriz física autorizada. |
| Retry de comisión al día siguiente | Terminado local | Conservar recibo exacto y bloqueo de nuevas retrospectivas. |
| Eliminación con protección de pagos | Terminado local | Conservar los tres fixtures y sus resultados. |
| Custodia de sesión por proyecto/org/UID | Integración local corregida | Validación física y replay durable del mismo dueño en entorno aislado. |
| Comprobantes de socios | Implementado y probado localmente | Confirmar vista móvil, WhatsApp y archivo PNG en Android/PC aislados. |
| Rentabilidad y salud financiera | Auditoría de fuente y diseño preparados | Revisar diseño y una copia histórica autorizada antes de cálculos definitivos. |
| Login, cambio de cuenta y pestañas PC/PWA | Pendiente físico | Validar el candidato exacto en entorno aislado antes de producción. |
| Rutas, gestores, líderes y asignaciones | Código previo conservado; aceptación física pendiente | Completar RG-A–I con datos ficticios, sin crear cuentas en el piloto. |
| Renovaciones de capital, intereses y quinta cuota | Código y QA previos conservados | No reabrir las pruebas aprobadas sin cambio o regresión concreta. |
| Caja, capital y conciliación | Código y QA previos conservados | Los retries corregidos no crean nuevos ingresos o egresos; conciliación física pendiente del ensayo. |
| Operaciones pendientes y revisión administrativa | CERRADO_ADMIN/noReplay conservados; revisión local sin anulación financiera | No reenviar ni cambiar pagos reales para cerrar incidencias. |
| Android, actualización PWA y reconexión | Pendiente físico | Ensayar en un backend aislado; las 15 pruebas del 13/10 siguen conservadas. |
| Alta de cuentas V2 y permisos por comprador | No implementado | El endpoint V1 de usuarios no provisiona membresías V2. |
| Instalación comercial por comprador | No implementado | Diseñar provisión y configuración confiable antes de habilitarla. |
| Licencias comerciales | No implementado | Definir el alcance en una fase posterior. |
| Importador de otra cartera | No implementado | Seguir `FUTURE_PORTFOLIO_MIGRATION.md`; AGENTS excluye implementarlo ahora. |

## Arquitectura comercial preparada para una fase posterior

La propuesta reserva un proyecto Firebase independiente por comprador, con su propia instalación y datos.
La selección del destino requerirá configuración confiable mediante manifiesto o allowlist administrada.
No se aceptará un proyecto arbitrario desde parámetros, almacenamiento local o datos de un usuario.
Cada instalación deberá disponer de Auth, membresías, reglas y Functions vinculados al mismo proyecto.
La organización y las credenciales verificadas deben corresponder a esa instalación en cada operación.
El piloto actual continúa hardcoded; una configuración incompatible falla cerrado.
La custodia local por ámbito no equivale a una provisión comercial entre proyectos ya terminada.
No se mueve, copia, convierte ni importa la cartera actual para preparar ese modelo.
Licencias e importador permanecen pendientes; no añadir sus flujos al cierre de este candidato.

## Producción, backend y publicación

La referencia actual de Hosting conservada es la release 126, asociada al SHA inicial `7b53fc1`.
Su SHA completo es `7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5`.
La producción actual permanece intacta durante esta continuidad local.
El workflow autorizado publica únicamente Hosting; no publica Functions ni reglas de Firestore.
Los módulos backend y las reglas locales requieren revisión explícita de esquema, permisos y compatibilidad.
Antes de una nueva publicación, comprobar qué backend está instalado y qué necesita el frontend candidato.
Un Hosting verde no demuestra que los nuevos endpoints o permisos estén instalados.
Los cambios locales de CI y build tampoco conceden autorización de publicación.
CI ahora observa también cambios en `functions/**` y comprueba la sintaxis del backend.
El cierre deberá identificar el SHA completo final, artefacto, hashes y pruebas pendientes.

## Conservación y recuperación

Conservar el artefacto exacto de Hosting 126 / `7b53fc1` antes de sustituir cualquier publicación.
Conservar el tag `stable-rollback-v2-20261008-43a7afa`, SHA `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71`, sin moverlo.
No certificar automáticamente el Hosting actual ni este candidato como nueva estable.
Si fuera imprescindible recuperar código, elegir la estable inmediatamente anterior certificada.
No reconstruir el rollback desde este árbol con cambios ni mezclarlo con paquetes históricos.
La recuperación de código no restaura ni reemplaza clientes, créditos, pagos, caja o respaldos financieros.
Toda publicación o recuperación efectiva conserva los controles humanos del procedimiento vigente.
El ZIP local `MI_CARTERA_V2_ROLLBACK_APP_7b53fc1.zip` conserva la fuente exacta de la publicación actual.
Antes de habilitar el candidato, ensayar el regreso con el nuevo almacenamiento por ámbito:
una app anterior no conoce las colas scoped. El regreso queda bloqueado si hay operaciones
sin confirmar; conservar todos los archivos y claves, sin borrarlos ni convertirlos para forzarlo.
No se afirma compatibilidad de downgrade del backend ni de una cola pendiente por disponer del ZIP.

No se hicieron commits, push, merge, cambios de membresía ni despliegues en esta continuidad.
Referencias: `AGENTS.md`, `PUBLICATION_CONTROL.md`, `VERSIONING_POLICY.md`, `APP_RECOVERY.md`
y `FUTURE_PORTFOLIO_MIGRATION.md`. Este registro complementa esas políticas; no las sustituye.
