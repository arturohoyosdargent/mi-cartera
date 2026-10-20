# Evaluación de arquitectura Spark para Mi Cartera PRO V2

Fecha: 18/10/2026. Estado: diseño técnico, sin implementación ni certificación de la alternativa. Alcance: código B3 de candidate/continuation-20261015 y sus dependencias financieras. No se modificaron la aplicación activa, las reglas desplegadas, el plan de Firebase, los datos ni producción para elaborar este documento. No se activó Blaze.

## Conclusión operativa

Una base con Firebase Authentication, Firestore, Hosting y reglas puede ejecutar operaciones financieras verificables sin Functions. No existe una imposibilidad general de implementar Mi Cartera en Spark. La alternativa requiere diseñar las operaciones para que cada condición se pueda demostrar sobre un conjunto acotado de documentos conocidos.

**Estado de publicación de la alternativa: BLOCKED. El B3 actual no es una sustitución directa segura para una arquitectura sin backend confiable.** Su frontend exige cuatro callables y parte de su autoridad financiera reside en transacciones de servidor que consultan colecciones completas. Eliminar las llamadas, permitir las escrituras del navegador o copiar solamente Hosting no traslada esas garantías a las reglas.

Existen dos rutas viables y distintas: **A) mantener un backend Node confiable externo a Cloud Functions**, reutilizando los servicios transaccionales y el esquema financiero; **B) ejecutar las operaciones directamente desde clientes con reglas que demuestren sus efectos**, lo que sí exige el protocolo, normalización e inicialización descritos en las secciones posteriores. No se presenta Blaze como obligación para todo el proyecto Firebase: la decisión de dónde ejecutar la autoridad financiera es independiente de que Auth, Firestore y Hosting continúen en la base Spark.

La alternativa Spark descrita aquí no habilita una publicación del B3 actual ni se declara terminada. Los resultados anteriores se conservan; las 55 pruebas existentes son evidencia del comportamiento probado, no una certificación de reglas, esquema o migración todavía inexistentes. Los resultados adicionales del emulador, la cuenta y los costos se registran en el informe de esta etapa; no se inventan ni se ejecutan nuevamente en este análisis.

## Dependencias concretas del B3 examinado

El archivo v2/app/firebase-bootstrap.js configura estos cuatro endpoints de us-central1 y v2/app/cloud/runtime-cloud.js los utiliza para ejecutar los tipos correspondientes:

| Callable requerido actualmente | Función y autoridad que aporta | Sustitución necesaria sin Functions |
| --- | --- | --- |
| recordV2Installment | Valida miembro, asignación, versión, cronograma, reparto capital/interés y destinos; actualiza crédito, pago, caja, auditoría y operación una sola vez. | Transacción de navegador con cálculo comprobado por reglas, cronograma normalizado, idempotencia y saldos protegidos. |
| recordV2CommissionTerms | Valida gestor/ruta, condiciones y avance de fecha; conserva reintento aceptado. | Índice protegido de condiciones, control de intervalos y transición coherente de devengos. |
| settleV2Commission | Calcula obligación pendiente, caja global disponible y asignación por rutas; crea egreso y auditoría. | Acumuladores respaldados por devengos, cuenta de caja común y asignaciones verificables acotadas. |
| requestV2CreditAdministrativeReview | Comprueba crédito y versión, existencia de pagos y revisión única; registra solicitud sin efecto financiero. | Índice protegido de pagos por crédito y solicitud/operación/auditoría enlazadas atómicamente. |

Los cuatro son necesarios para mantener las funciones correspondientes del B3 tal como está conectado; esto no significa que deban existir en cualquier futura implementación. Una implementación Spark los reemplazaría mediante un adaptador explícito, conservando sus resultados canónicos y sus rechazos pertinentes. El antiguo createCarteraUser pertenece a otra función y no sustituye los cuatro contratos.

Fuentes locales principales: functions/index.js, functions/v2-collector-payment.js, functions/v2-manager-commissions.js, functions/v2-commercial-model.js, functions/v2-credit-admin-review.js, v2/core/partner-loans.js, v2/core/financial-engine.js y firestore.rules. La copia v2/cloud/firestore-v2.rules usa un modelo de perfil distinto; no debe intercambiarse con las reglas del piloto basadas en members sin una decisión explícita y pruebas de permisos.

## Ruta A: sin Cloud Functions, con backend Node confiable externo

El Admin SDK se puede inicializar en un servidor propio mediante una identidad de servicio y credenciales de aplicación. No exige que el proceso sea una Cloud Function: Firebase documenta expresamente la inicialización en un servidor propio. Por eso una base Spark puede conservar Firestore/Auth y recibir operaciones de un backend externo confiable, sujeto a los permisos, cuotas, conectividad y operación de ese backend. La ejecución y su proveedor tienen sus propios requisitos/costos; no se equipara esta alternativa a hosting de backend gratuito e ilimitado. [Inicialización del servidor Firestore](https://firebase.google.com/docs/firestore/quickstart-server), [configuración del Admin SDK](https://firebase.google.com/docs/admin/setup).

### Portabilidad de los servicios existentes

La autoridad del código no está inseparablemente ligada a onCall. v2-collector-payment.js y v2-manager-commissions.js reciben runAtomic y un contexto con UID verificado. v2-credit-admin-review.js expone igualmente un servicio transaccional. Los wrappers v2-collector-callable.js y v2-commission-callable.js adaptan get/set/create/list a db.runTransaction; onCall en functions/index.js es el envoltorio de transporte de Functions.

Un servidor HTTP puede reutilizar esos cuatro contratos con un adaptador de errores y solicitudes, sin copiar el núcleo financiero a la UI ni migrar la historia a contadores. Debe conservar comprobaciones de miembros dentro de la transacción, organización fija, versiones, idempotencia, cierres noReplay y ACK canónico. Conservar el esquema no equivale a conservar permisos directos excesivos: las escrituras financieras deben quedar bajo la misma autoridad y no admitir una vía paralela que eluda sus validaciones.

### Transporte opcional encontrado durante esta etapa

Se revisó por lectura functions/spark-http-server.cjs y la selección opcional de v2/app/firebase-bootstrap.js. El servidor HTTP reutiliza los cuatro wrappers sin importar onCall, permite solo rutas de servicio conocidas, verifica Bearer con verifyIdToken(token, true), comprueba aud/iss contra el proyecto configurado y exige autorización de membresía en los servicios. Devuelve el sobre result/error usado por el SDK callable. Limita contenido JSON a 16 KiB y acepta CORS solo para orígenes exactos configurados.

El frontend mantiene Functions como valor por defecto; solo una configuración estática de release puede escoger external, con backendBaseUrl incluido en backendAllowedOrigins. No toma el destino de query strings, fragmentos, formularios ni almacenamiento de tenant. La excepción HTTP de loopback está limitada al modo de prueba explícito. La existencia del código opcional **no prueba disponibilidad, provisión de infraestructura, cobertura financiera completa ni aptitud para publicar**.

Esta revisión no ejecutó el servidor ni repitió las 55 pruebas. El conjunto está cambiando durante la preparación; cualquier nuevo servicio monetario, mutex o cambio de reglas debe quedar identificado y validado en el manifiesto final, sin atribuirle automáticamente esta revisión de una instantánea anterior.

### Autenticación, CORS y secretos

1. El navegador manda un ID token de Firebase por HTTPS. El servidor verifica firma/expiración y proyecto; con checkRevoked=true detecta además revocación/deshabilitación. UID, rol u organización recibidos como campos del body no sustituyen esa identidad. Las membresías y asignaciones se comprueban sobre datos del proyecto autorizado. [Verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [detectar revocación](https://firebase.google.com/docs/auth/admin/manage-sessions).
2. CORS debe tener origen exacto y no reflejar valores arbitrarios. CORS limita al navegador, no autentica a otros clientes HTTP; una solicitud sin Origin solo es aceptable si conserva las mismas comprobaciones de token y autorización. No se ponen secretos compartidos ni credenciales de servicio en JavaScript público.
3. El runtime requiere una cuenta de servicio dedicada o identidad equivalente mediante ADC, con el mínimo IAM necesario para las operaciones del código y la comprobación de revocación. No utilizar Owner/Editor como sustituto de revisar privilegios. El Admin SDK usa IAM y no las reglas de cliente: el servidor debe mantener todos los controles de negocio y fijar proyecto/organización. El alcance real de IAM debe comprobarse; no se presume aislamiento por colección si el permiso efectivo abarca la base.
4. Priorizar credenciales administradas/federadas cuando el proveedor lo soporte. Si se usa un archivo de cuenta de servicio, debe entrar por un almacén seguro de runtime, con acceso mínimo, rotación y exclusión de repositorio, ZIP, logs, navegador y artefactos públicos. La variable GOOGLE_APPLICATION_CREDENTIALS es una referencia a una credencial protegida, no un secreto para pegar en la configuración de Hosting.
5. La configuración debe fallar cerrado ante proyecto, runtime, release, credenciales, TLS o allowlist ausentes/incompatibles. Un booleano READY declarado a mano no demuestra que el servidor esté provisionado o autorizado.

No se aprovisionó una cuenta de servicio, no se exportó una clave ni se enviaron credenciales o datos a terceros para realizar este análisis.

### Autoridad financiera y concurrencia común

Los cuatro endpoints iniciales no incluyen por sí solos todos los escritores de socios, renovaciones, caja y creación de créditos. Es imprescindible inventariarlos y mantenerlos bajo el mismo protocolo autorizado. Un servidor nuevo seguro no protege una transacción paralela del navegador que pueda seguir escribiendo egresos o créditos arbitrarios con las reglas anteriores.

En esta ruta un mutex/versionado transaccional común puede serializar las operaciones que compiten por la misma caja. Debe ser un documento compartido dentro de las transacciones de **todos** los escritores monetarios pertinentes, no una variable en memoria del proceso ni un candado usado solo por las comisiones. Deben comprobarse también los efectos de otras instancias del servidor y las escrituras administrativas. El alcance completo y su integración forman parte del trabajo de implementación/validación, no se presuponen por añadir el wrapper HTTP.

### Infraestructura y publicación necesarias

- Runtime Node soportado, dependencias fijadas y artefacto del backend con SHA/huella; TLS público confiable, proxy de entrada, reinicio automático y disponibilidad continua para PC y Android. Un proceso local, túnel temporal o equipo que se suspende no es un servicio de producción 24/7.
- Límites de concurrencia/tamaño/tiempo y protección contra abuso en la entrada, más observabilidad con IDs técnicos sin tokens ni datos financieros innecesarios. La ausencia de rate limiting es un pendiente de disponibilidad aunque la autenticación esté correcta.
- Configuración de origen/proyecto/release y secretos separada de Hosting. Un health autenticado sirve para verificar identidad del despliegue, pero no certifica por sí solo caja, reglas ni todos los escritores.
- Pipeline protegido del servidor y control de cambios de reglas cuando corresponda; el workflow vigente de Hosting no despliega ese runtime. Verificación previa de compatibilidad del backend con el frontend, despliegue ordenado, conservación del backend anterior y rollback de código sin restaurar datos.
- Validación aislada del transporte HTTPS, token ajeno/revocado, roles, payloads manipulados, ACK perdido, doble envío, concurrencia monetaria y sincronización. Las pruebas del servicio puro se reutilizan, pero no sustituyen las del nuevo límite HTTP/credenciales/proxy.

**Bloqueo actual de esta ruta:** no consta un servidor externo productivo aprovisionado, identidad runtime de privilegios mínimos, dominio/TLS operativo, configuración estática autorizada y pipeline protegido de despliegue/rollback. El código local opcional no elimina esos requisitos. No es publicable hoy por copiar Hosting ni por cambiar backendMode. Cualquier servicio financiero adicional todavía en preparación debe cerrarse y validarse antes de decidir el alcance real.

## Ruta B: clientes y reglas, sin backend financiero confiable

Las secciones de contadores, getAfter, normalización, migración y fencing siguientes corresponden a esta segunda ruta. Son necesarias porque la autoridad pasa al conjunto reglas+esquema; no son una migración obligatoria para reutilizar los servicios mediante un servidor Node confiable externo.

## Alternativas que no resuelven el problema por declararlas

- **Cambiar Firestore por Realtime Database:** RTDB puede sostener modelos válidos, pero no instala los cuatro contratos ni mantiene automáticamente las consultas, esquema, transacciones, permisos, SDK y rollback de B3. Requeriría otro diseño y migración; mover documentos sin ello no conserva las pruebas aprobadas.
- **Mover cloud/core al JavaScript de la UI:** reutilizar lógica pura permite calcular una propuesta, pero el usuario puede modificar ese JavaScript o enviar su propio payload. Sin backend confiable o reglas suficientes, no se demuestra el reparto, la caja ni la idempotencia.
- **Declarar noCloudFunctions en la configuración:** un indicador no reemplaza endpoints ni cambia los permisos. En B3 las llamadas se crean y se consumen explícitamente; el servidor o el protocolo alternativo deben existir y verificarse.
- **Cambiar a external apuntando a un host sin provisión:** un URL aceptado por la allowlist no prueba quién ejecuta el código, qué credenciales tiene, qué release sirve ni si conserva la autoridad financiera. Tiene que formar parte del artefacto y pipeline certificados.
- **Activar otro plan como arreglo automático:** un cambio de facturación no valida código, reglas ni registros. Esta evaluación no solicita ni activa Blaze.

## Qué debe seguir siendo cierto

| Área | Garantía que debe conservarse | Límite del esquema actual | Diseño Spark que debe demostrarse |
| --- | --- | --- | --- |
| Cobranza | Un importe válido reduce exactamente el saldo autorizado, aplica las cuotas correctas y genera un único ingreso. Capital más interés más penalidad coincide con lo aplicado. | El callable recorre el array schedule y modifica varias posiciones; la validación del navegador no es una prueba para reglas. | Resumen protegido del crédito, cuotas direccionables, orden verificable y transacción acotada con pago/caja/auditoría/operación. |
| Duplicados y reintentos | El mismo intento aceptado devuelve el recibo original sin otro movimiento; otro actor o payload colisionante se rechaza. Un cierre noReplay no se reactiva. | El servidor calcula un requestKey y reconoce el recibo antes de volver a exigir asignaciones para un pago nuevo. | Operación inmutable con campos canónicos comprobables y lectura autorizada del recibo; IDs de intento conservados antes de enviar. |
| Caja | Nadie gasta el mismo disponible en dos liquidaciones concurrentes; el saldo se corresponde con el diario y la fecha de corte. | La liquidación de comisión suma todas las entradas y salidas elegibles; existen movimientos con fechas futuras y campos legacy. | Una cuenta compartida por caja, deltas respaldados por apuntes y tratamiento explícito de movimientos diferidos. |
| Socios | Intereses no se pagan dos veces por vencimiento; capital devuelto no supera el pendiente; cambio de condición respeta pagos posteriores. Compartir/reemitir nunca escribe dinero. | El préstamo y sus arrays de pagos, devoluciones y condiciones están anidados en un movimiento. | Contrato separado, vencimientos y pagos con claves deterministas, principal pendiente e índices de fechas protegidos. |
| Renovaciones | El crédito anterior se cierra una vez, el nuevo tiene enlace recíproco y solo la diferencia realmente entregada afecta caja. Cobro de intereses conserva su naturaleza. | El motor y los planes de operación ejecutan varias transformaciones y producen cronogramas completos en cliente. | Transiciones específicas que comprueben ambos créditos, importes, desembolso, operación, cuotas y caja sin permitir edición genérica. |
| Auditoría | Cada movimiento tiene actor, organización, tipo, fecha autorizada y operación verificables; historial aceptado no se sobrescribe. | Un admin/supervisor puede escribir ampliamente en varios documentos; audit acepta creaciones de miembros activos. | Reglas por tipo de evento, destinos deterministas, campos inmutables y enlaces bidireccionales comprobados con getAfter. |
| Roles y sincronización | Membresía activa, rol y ruta se comprueban al confirmar; una sesión tardía o de otra identidad no aplica resultados ni cola ajena. | Existen protecciones locales útiles, pero esas protecciones no hacen confiable el payload del navegador. | Reglas de servidor basadas en members, custodia por proyecto/org/UID/protocolo y consumidores de confirmaciones canónicas. |
| Rollback | Recuperar código conserva pagos, colas e historia y no permite que un escritor antiguo omita nuevos acumuladores. | B2 no conoce nuevos contadores, cuotas normalizadas ni el nuevo protocolo. Un rollback de Hosting no revierte reglas/esquema. | Fencing de escritores y lector compatible; rollback a un build puente certificado o mantenimiento de solo lectura. |

## Invariantes que hoy dependen de consultas no acotadas

1. **Última condición del gestor.** v2-manager-commissions.js lee routes completo y rechaza cualquier condición previa cuya effectiveDate sea igual o posterior. Buscar solo una condición enviada por el cliente no demuestra que no exista otra. Un índice protegido lastEffectiveDay/latestTermId permitiría convertirlo en una comparación sobre un documento conocido.
2. **Comisión generada.** v2-commercial-model.js selecciona la condición vigente para cada pago, excluye pagos anulados y calcula porcentajes o importes por cobro. La ausencia de una anulación se conoce hoy recorriendo payments. Se necesita estado de anulación verificable por pago y devengos enlazados; no basta un total declarado por el cliente.
3. **Períodos fijos.** Se generan todos los períodos completos entre la vigencia de una condición y el corte de la siguiente o la fecha actual. No hay un contador materializado que demuestre cuántos ya fueron reconocidos. Cada período debe tener identidad única y un avance de período protegido, sin saltos ni repeticiones.
4. **Obligación pagada y reparto por rutas.** allocateCommission suma liquidaciones anteriores por ruta y consume devengos ordenados por fecha/ID. El número de rutas y elementos puede crecer sin un límite fijo. Un saldo total no demuestra que la asignación conserve ese orden.
5. **Disponible de caja.** Se suman entries y expenses, con cuenta líder/legacy, exclusión de tombstones y corte por fecha. Un contador que solo recibe las comisiones no incluye el resto de escritores y pierde la protección de caja.
6. **Solicitud de revisión administrativa.** v2-credit-admin-review.js recorre payments y cuenta los vinculados al crédito. Un índice certificado paymentCount por crédito puede demostrar la existencia y cantidad; no debe aceptarse una cantidad enviada libremente.

Las reglas pueden consultar documentos conocidos mediante get/exists/getAfter, pero no ejecutar estos recorridos arbitrarios ni confiar en que el cliente haya consultado la colección completa. getAfter permite comprobar el estado posterior al conjunto atómico; no convierte un subtotal del cliente en un dato autorizado. [Condiciones de reglas de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Semánticas que no se pueden cambiar silenciosamente al introducir contadores

**Condición nueva con vigencia hoy.** El servicio actual permite effectiveDate igual al día comercial. El modelo decide la condición por la fecha del pago, no por el instante en que se capturó. Una condición creada hoy puede cambiar la comisión calculada sobre pagos de hoy ya existentes. Congelar para siempre el devengo al cobrar cambiaría ese comportamiento. Para equivalencia completa se requiere una reconstrucción verificable de los devengos afectados, con bloqueo y cambio de generación; la alternativa de permitir únicamente condiciones posteriores al último día con pagos es un cambio de producto que debe aprobarse expresamente.

**Redondeo por pago.** El modelo redondea la comisión de cada pago antes de sumarla. Redondear una sola vez un porcentaje del total diario puede dar otro resultado. Definir céntimos y una escala fija para tasas mejora la verificabilidad, pero también exige comprobar equivalencia con las tasas históricas y límites aceptados; no se presume esa equivalencia.

**Anulaciones e importes ya pagados.** Una anulación puede reducir lo generado después de pagar una comisión. Se conservan por separado generado, pagado, pendiente y sobrepago; no se debe borrar el sobrepago ni disminuir artificialmente pagado para hacer coincidir contadores. Una rectificación se registra como evento nuevo y auditable.

**Fechas futuras.** El disponible actual usa movimientos con fecha menor o igual al corte. Sumarlos anticipadamente al contador disponible contradice esa regla. Los registros futuros existentes se conservan; el diseño debe diferenciarlos de dinero disponible y de un pago que se puede confirmar mediante comprobante.

**Atribución histórica.** El pago conserva workerId/routeId del momento de cobro. Reasignar un crédito no cambia esa atribución ni una comisión ya reconocida. Una consulta de la ruta actual no reemplaza la historia.

## Esquema propuesto para una implementación independiente

Los nombres siguientes son una propuesta. No son colecciones creadas ni reglas publicadas. Todo queda bajo la misma organización autorizada y vinculado al proyecto de la sesión.

| Documento o conjunto | Campos/invariante principal | Quién puede cambiarlo |
| --- | --- | --- |
| control/writerProtocol | schemaVersion, minWriterProtocol, activeGeneration, migrationState y modos de escritura habilitados. | Provisión administrativa controlada; nunca un usuario del navegador. |
| cashAccounts/{accountId} | balanceCents, futureReservedCents si corresponde, recognizedThroughDay, revision, lastOperationId, generation. | Solo transiciones financieras permitidas y respaldadas por apuntes enlazados. |
| commissionAccounts/{workerId} | generatedCents, paidCents, revision, latestTermId, lastEffectiveDay y generación certificada. | Devengos/ajustes/liquidaciones definidos por reglas; nunca un set genérico. |
| commissionRouteAccounts/{workerRouteKey} | Devengado/pagado por atribución histórica y cabeza de devengos pendientes. | Las mismas transiciones, enlazadas a gestor y ruta exactos. |
| commissionTerms/{termId} | Worker/ruta, modo, base, tasa/importe, inicio y fin exclusivos del intervalo y enlace de sucesión. | Alta/avance condicionado; valores acordados inmutables y cierre de intervalo estrictamente validado. |
| commissionAccruals/{sourceKey} | Fuente única: pago, período o ajuste; importe, condición, ruta, estado y enlaces. | Creación una sola vez y ajustes explícitos; no sobreescritura financiera. |
| creditPositions/{creditId} | Principal/interés/penalidad/cronograma pendientes, paymentCount, versión y cabeza de cuota. | Transacciones que demuestren exactamente su delta y la cuota/fuente correspondiente. |
| creditInstallments/{creditInstallmentKey} | Orden, importe original, aplicado, saldo, generación y enlace a siguiente cuota. | Transiciones acotadas de creación, cobro o renovación. |
| partnerContracts/{loanId} | Principal recibido/pendiente, secuencia de devolución, condición vigente y fechas de control. | Alta/pago/devolución específicos, enlazados al diario. |
| partnerDues/{loanDueKey} y partnerPayments/{paymentId} | Vencimiento único, importe pactado, contrato, estado y movimiento canónico. | Pago atómico con la obligación y caja; historial inmutable. |
| operations/{operationId} | Actor, organización, protocolo, tipo, request canónico, efectos, estado final y recibo. | Creación por la operación autorizada. Recibo aplicado inmutable; cierres administrativos mediante transición distinta y protegida. |
| entries, expenses, audit | Apuntes canónicos con operationId, tipo permitido, cuenta, importe, actor y fuente. | Solo ligados a una operación y a sus deltas exactos. |

Los contadores son **proyecciones controladas del diario**, con una conciliación reproducible. No sustituyen las fuentes históricas ni reciben autoridad por existir. Un valor ausente, una generación incompleta o una discrepancia se trata como estado no disponible/bloqueado; no como cero.

## Protocolo de escritura y prueba con getAfter

Cada operación sigue estos pasos conceptuales; todavía deben traducirse a reglas y un adaptador concreto:

1. El cliente verifica sesión/custodia, genera y conserva el mismo identificador de intento antes de enviar, y lee control/writerProtocol. La comodidad local no reemplaza la autorización de reglas.
2. La transacción lee los documentos canónicos necesarios y sus revisiones. Las reglas comprueban membresía activa, organización, rol, ruta cuando corresponde, protocolo y estado de migración.
3. Para un cobro simple, la misma confirmación incluye crédito/posición, cuotas admitidas, pago, ingreso, cuenta de caja, operación, auditoría y devengo de comisión cuando corresponda. No se registra primero el pago para intentar arreglar la caja después.
4. Cada apunte exige el estado posterior correcto de sus posiciones mediante getAfter. Cada incremento/decremento de una posición exige a su vez la operación y el apunte que justifican el delta. Esto impide crear dinero incrementando un contador y evita escribir un apunte sin mantenerlo.
5. Las reglas limitan campos y tipos por transición, comprueban importe positivo y entero en céntimos, conservación de sumas, límites de saldo, versión anterior+1, IDs de destino y referencias recíprocas. El cambio de campos ajenos se rechaza.
6. Una operación aceptada y su recibo no se sustituyen. Un reintento con el mismo actor y campos canónicos recibe lo aceptado, sin escrituras financieras. Un hash enviado por el navegador no es, por sí solo, prueba de que el payload coincide; se comparan también los campos canónicos requeridos.
7. El cliente revalida sesión/generación al consumir el resultado y muestra confirmación solo de una operación aplicada. Ante pérdida de ACK conserva el intento y consulta su estado; no genera otro ID para el mismo intento ni borra una cola para desbloquear la interfaz.

Los pagos legítimos distintos pueden tener igual importe y fecha. La deduplicación no debe usar esos dos campos como identidad global. La protección de doble pulsación y la clave durable del mismo intento son complementarias al control de versión.

La lectura de un recibo por su actor activo debe contemplar el reintento después de una reasignación, sin conceder acceso general a la nueva ruta. Un usuario revocado continúa rechazado. Las reglas actuales de operations limitadas a managers no bastan para una futura lectura directa de recibos de cobradores.

### Presupuesto de validación

El diseño debe acreditar el presupuesto de cada rama de reglas, no solo del caso ideal. Firestore limita los accesos documentales a 10 por operación individual y a 20 para el conjunto de una transacción/lote; la caché de accesos puede reducir el cómputo, pero no se presume sin comprobar la implementación. [Transacciones y escrituras por lotes](https://firebase.google.com/docs/firestore/manage-data/transactions).

Un cobro que implique demasiadas cuotas, documentos de comisión y rutas no cabe automáticamente en un conjunto válido. Antes de implementarlo se necesita un inventario de lecturas/escrituras y un límite demostrado por variante. Debe fallar antes de escribir si excede el contrato admitido.

## Cronogramas y arrays: normalización obligatoria del diseño completo

El cronograma actual es un array dentro del crédito. El callable valida todos sus elementos, suma saldos y aplica dinero en orden hasta agotarlo. Las reglas no pueden aceptar una sustitución arbitraria del array confiando en que el cliente ejecutó ese algoritmo. Comprobar únicamente total antes/después permitiría redistribuir saldos o alterar cuotas ajenas sin demostrar la corrección.

La alternativa completa necesita cuotas direccionables, una cabeza/orden protegido y resúmenes que se mantengan en cada transición. Los arrays de socios presentan el mismo problema: buscar cualquier vencimiento pagado, cualquier devolución futura o todas las condiciones no se reemplaza por un test de longitud del array.

Para operaciones que afectan más cuotas de las que caben en el presupuesto existen decisiones de diseño pendientes:

- Un máximo explícito de cuotas por operación permite reglas acotadas, pero restringe el comportamiento actual y no equivale a soportar cualquier cobro múltiple aprobado.
- Un protocolo de preparación por generaciones podría validar bloques contiguos bajo una reserva exclusiva y publicar un único resultado final. Necesita demostrar completitud, ausencia de saltos, vencimiento/cancelación de reservas, recuperación tras fallo y visibilidad atómica. Dividir el importe en varios pagos finales o escribir cuotas parcialmente y luego marcar APPLIED no cumple esa garantía.

No se certifica aquí ninguna de esas alternativas. La elección debe conservar el alcance real de cobros y renovaciones, o registrar expresamente la restricción. Una proyección legacy del array puede mantenerse para lectores compatibles, pero nunca se usa como segunda fuente sumable junto con las cuotas normalizadas.

## Todos los escritores deben participar

El acumulador de caja debe mantenerse por cobros de cuota, pagos libres/extraordinarios, renovaciones con interés, nuevos desembolsos, diferencias de refinanciación, capital/inyecciones, gastos, ajustes, transferencias entre cuentas, préstamos de socios, intereses de socios, devoluciones de capital y liquidaciones de gestores. Una anulación, tombstone financiero o corrección histórica debe producir su efecto autorizado y auditable; no debe quitar un apunte del cómputo dejando el contador intacto.

También deben inventariarse restauraciones/importaciones, herramientas administrativas, otra pestaña/PWA antigua y clientes externos. Las credenciales administrativas de servidor pueden eludir reglas: cualquier proceso con esos permisos debe respetar el protocolo o ejecutarse en mantenimiento y exigir reconstrucción/conciliación antes de reabrir la escritura.

Las reglas actuales permiten al manager crear/actualizar créditos, operaciones y varios apuntes de forma amplia. Un rol administrativo válido autoriza una función del negocio; no demuestra que el importe, reparto, saldo ni contador enviado sean correctos. La certificación Spark exige sustituir los permisos financieros genéricos por transiciones específicas en **todos los match que puedan conceder acceso**. Añadir una regla restrictiva no neutraliza otro permiso coincidente más amplio.

### Caja por fecha y cuenta

Una cuenta global por caja serializa gastos concurrentes de gestores distintos. Llevar solo una posición por gestor permite que ambos gasten el mismo dinero de la caja líder. Las transferencias necesitan débito y crédito recíprocos en el mismo conjunto atómico, sin duplicar el total consolidado.

Para las fechas futuras se requiere una política explícita: nuevos eventos programados separados del diario realizado, o buckets por día con avance verificado de recognizedThroughDay antes de gastar. Los eventos futuros ya existentes no se reetiquetan ni eliminan automáticamente. Un avance por buckets debe tener secuencia completa, identidad única y límite de documentos; ningún cliente puede omitir un egreso que ya vence o reconocer un ingreso todavía futuro. La ausencia de tareas programadas no impide un avance bajo demanda, pero ese avance también necesita reglas y recuperación certificadas.

### Socios y comprobantes

La obligación por vencimiento se identifica por préstamo+período. El egreso y el pago aceptado deben enlazarse con el contrato, vencimiento, principal pendiente si corresponde, caja, operación y auditoría. Las devoluciones parciales conservan el orden de fechas y la condición acordada para los próximos intereses; índices protegidos de último movimiento y vencimientos pagados posteriores deben justificar sus restricciones.

Vista previa, copiar, WhatsApp, guardar imagen y reenvío consultan el pago canónico: no invocan el adaptador de escritura. Se mantiene la separación entre una obligación programada, un movimiento futuro histórico y un pago realizado a la fecha; no se emite confirmación por el solo hecho de existir un vencimiento.

### Comisiones, devengos y orden

El índice de términos evita consultar todas las condiciones, pero no basta para devengar: una condición reclamada debe cubrir la fecha del pago mediante un intervalo certificado y una cadena sin superposiciones. El próximo término puede ser futuro; no debe activarse prematuramente. Cerrar el intervalo del término anterior es una transición controlada, sin permitir cambiar libremente su importe o tasa histórica.

Para porcentajes y pago por cobro, cada devengo tiene una fuente única enlazada al pago válido y a sus bases de capital/interés/penalidad. Para períodos fijos, la identidad incluye término y número de período, con fecha de finalización autorizada y avance sin saltos. La ausencia de Functions no obliga a un cron: puede materializarse a demanda, pero sin confiar en el reloj del cliente ni en un número de períodos declarado.

El reparto por rutas históricas requiere una cola/índice verificable de devengos pendientes. Una liquidación que atraviesa demasiadas rutas necesita un protocolo acotado explícito; elegir una asignación arbitraria que conserve solo el total cambia los informes y el historial. No se presume equivalencia con allocateCommission.

## Inicialización histórica verificable

No puede crearse un contador inicial usando únicamente el saldo mostrado por una pantalla. La migración debe ser un procedimiento separado, con autorización para cualquier lectura/copia/escritura real necesaria. Este documento no concede esa autorización ni ejecuta ese procedimiento.

1. Inventariar todos los escritores y congelar la escritura mediante reglas/modo administrativo verificable. Ocultar botones no constituye congelación. Conservar exportación/artefactos y registrar el punto de corte y las operaciones pendientes sin reenviarlas.
2. Obtener una instantánea consistente del mismo corte. Preservar documentos, IDs, fechas, cierres noReplay, tombstones, anulaciones, operaciones y atribución histórica; separar ámbitos y duplicados antes de sumar.
3. Validar cobertura y referencias: pago/crédito/ingreso/auditoría/operación, gastos de socios, cadenas de renovación, miembros/rutas y saldos de cronograma. Fechas o importes inválidos y campos ausentes generan incidencias; no se convierten silenciosamente en cero.
4. Reconstruir, con algoritmos y política de corte identificados, caja por cuenta/día, posiciones de créditos, vencimientos/principal de socios y comisiones por gestor/ruta/condición. Incluir futuros y sobrepagos en categorías separadas. El modelo puro actual sirve como referencia de comparación donde su contrato aplica.
5. Producir manifiesto por documento, conteos, totales y diferencias, con versión del transformador y huellas de entrada/salida. Un hash acredita identidad del archivo, no corrección de las fórmulas ni autorización financiera.
6. Cargar una generación nueva en el entorno independiente, conservar los documentos legacy sin reemplazarlos y conciliar lectura normalizada frente a la fuente al mismo corte. Resolver todas las diferencias antes de considerar cualquier activación real.
7. Ensayar corte, cancelación de migración, reanudación y rollback con clientes antiguos y colas pendientes ficticias. El cambio a ACTIVE solo se prepara cuando todas las posiciones requeridas están completas y certificadas. No debe depender de que una petición pueda revisar una cantidad ilimitada de documentos.

La constancia de generación inicial certificada se aprovisiona por un proceso administrativo controlado. Un navegador no puede autodeclarar que ya validó toda la historia ni establecer libremente los saldos de apertura.

## Versionado, doble lectura y protección frente a B2

Se propone distinguir schemaVersion, readModelVersion, writerProtocol y generation. El build visible sirve para soporte; no es una autorización de escritura.

### Transición de lectura

- LEGACY_READ: el lector utiliza solo la fuente anterior. No suma contadores nuevos incompletos.
- DUAL_READ_COMPARE: el lector compatible calcula ambas vistas al mismo corte para comparar; solo una se presenta como fuente efectiva. Las diferencias bloquean la activación y se registran.
- SPARK_ACTIVE: el lector utiliza la generación certificada y conserva acceso histórico inequívoco. Un dato sin generación/proyección reconocida no recibe una interpretación por defecto.

La coexistencia de lecturas no implica doble escritura libre. Si se conserva una proyección legacy, debe producirse mediante el mismo protocolo y no actuar como entrada financiera alternativa. Las colas incluyen versión de protocolo; no se convierten ni ejecutan automáticamente bajo otro esquema.

### Fencing de escritores

Las reglas de cada ruta financiera exigen protocolo soportado, generación y transición válida, consultando un control que el navegador no puede modificar. Una app B2 que envíe su operación antigua carece de esos efectos y debe ser rechazada aun si conserva Auth, rol admin, service worker o documentos en caché. Escribir un campo writerProtocol no prueba que un cliente sea confiable: las reglas tienen que comprobar los deltas y enlaces completos aunque un cliente hostil copie el campo.

Se deben cerrar también las rutas legacy originales para impedir que una app antigua escriba pagos/egresos que omitan los nuevos acumuladores. El bloqueo debe abarcar todas las reglas coincidentes y consumidores externos; no puede depender de version-guard.js del navegador.

### Rollback compatible

Restaurar Hosting a B2 no restaura las reglas ni transforma los datos normalizados. Permitir a B2 volver a escribir libremente dejaría apuntes nuevos sin contadores y corrompería el nuevo contrato. Borrar acumuladores o bajar minWriterProtocol para que B2 funcione tampoco es un rollback seguro.

Antes de activar Spark debe conservarse un **build puente certificado** que lea el esquema necesario y respete el protocolo vigente, junto al artefacto anterior y su identidad. Si solo está disponible B2, la alternativa segura es bloqueo de escrituras y una vista de mantenimiento/solo lectura explícita que no presente saldos legacy desactualizados como actuales, hasta recuperar un escritor compatible. No se promete operación diaria completa con B2 sobre el nuevo esquema.

En cualquier rollback se conservan operaciones aplicadas y pendientes, claves locales, generaciones, reglas de integridad y datos financieros. No se restaura una exportación de datos para deshacer una actualización de código. El procedimiento debe ensayarse antes de certificar la alternativa, incluyendo una PWA antigua offline que se reconecta después del corte.

## Criterios de certificación completa de la alternativa Spark

Todos los criterios siguientes son pendientes de implementar/demostrar. Este documento no los marca como aprobados:

1. **Paridad funcional definida:** contratos de los cuatro callables sustituidos, resultados canónicos, errores y reintentos documentados; ninguna degradación silenciosa de cuotas múltiples, fechas, comisiones, socios ni renovaciones.
2. **Esquema normalizado y matemática verificable:** cronogramas/arrays tratados, redondeo y tasas definidos, importes en céntimos, intervalos de términos, devengos, sobrepagos y fechas futuras equivalentes o con cambios expresamente aprobados.
3. **Reglas adversariales con SDK real:** un miembro autorizado no puede forjar importes, bases, contador, auditoría, operación, tipo, atribución, generación o protocolo; se rechazan faltantes y escrituras parciales, incluso con rol admin/supervisor y payload manipulado.
4. **Cobertura completa de escritores:** cada variante financiera mantiene los mismos saldos e índices; rutas coincidentes, herramientas administrativas y restauraciones no abren vías alternativas. Una escritura legacy directa falla antes de producir efectos.
5. **Atomicidad y concurrencia:** doble confirmación, pérdida de ACK, reinicio, dos pestañas, reasignación, dos gestores gastando la misma caja, cambio de versión, revocación y cierres noReplay dejan exactamente los efectos canónicos admitidos.
6. **Presupuesto de reglas demostrado:** cada tipo y máximo de cuotas/rutas/períodos cabe en los límites verificados; operaciones mayores se resuelven mediante un protocolo certificado o una restricción de alcance aprobada. No se atribuye un resultado a la caché sin prueba.
7. **Historia inicial conciliada:** diferencias cero o excepciones identificadas y resueltas conforme a una política explícita; manifiestos reproducibles, punto de corte consistente y generación de apertura autorizada. Ni saldos mostrados ni datos faltantes se aceptan como prueba suficiente.
8. **Doble lectura y fencing:** el lector no suma fuentes duplicadas; una generación incompleta falla cerrado; B2 y otras versiones antiguas no pueden escribir al reconectarse ni reactivar sus colas.
9. **Rollback ensayado:** build puente/artefactos identificados, transición de solo lectura si falta compatibilidad, conservación de datos y recuperación de pendientes del mismo dueño sin replay. No se declara rollback inmediato operativo si depende de una migración inversa no probada.
10. **Operación física y sincronización:** Chrome PC y Xiaomi/PWA validan los flujos afectados, reconexión, actualización, cambio de sesión y comprobantes con datos ficticios. Compartir/reemitir no cambia colecciones ni confirma obligaciones programadas.
11. **Seguridad y operación del plan:** destino/proyecto y roles correctos, superficie pública sin herramientas/secretos del laboratorio, cuotas y límites operativos comprobados para el volumen previsto. Las cuotas se evalúan aparte de la integridad del esquema; alcanzar una cuota debe producir un fallo recuperable, sin pagos parciales.
12. **Candidato y publicación identificables:** SHA/artefacto y manifiesto exactos, evidencia específica de esta arquitectura, respaldo conservado y procedimiento de publicación/rollback que incluya la compatibilidad de reglas. Hosting verde por sí solo no certifica el modelo.

Las 55 pruebas conservadas pueden reutilizarse como especificación y regresión de los contratos existentes. Las nuevas reglas, adaptador, transición histórica, normalización y protocolo de rollback necesitan evidencia propia. No es correcto presentar esas 55 como pruebas ya aprobadas de una arquitectura Spark completa que todavía no existe.

## Secuencia de trabajo propuesta

Primero cerrar la especificación de semánticas pendientes —condiciones con vigencia hoy, redondeo, futuros y cobros extensos— y enumerar los escritores. Después construir un prototipo separado con operaciones pequeñas y reglas estrictas, seguido de normalización, comisiones/caja compartida y compatibilidad de versiones. Ensayar la migración solo sobre fixtures/copias autorizadas, obtener evidencia adversarial y física, y recién entonces decidir un candidato de publicación independiente.

La situación actual permite conservar una base Spark y estudiar esa vía con rigor. No permite declarar al B3 existente libre de Functions mediante un cambio de configuración. No se habilita Blaze ni se altera producción por esta evaluación.

## Referencias oficiales

- [Condiciones y acceso a documentos desde reglas de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions): get/exists/getAfter y evaluación de permisos sobre datos conocidos.
- [Transacciones y escrituras por lotes](https://firebase.google.com/docs/firestore/manage-data/transactions): validación de estados posteriores y límites de acceso de reglas por operación/conjunto atómico.

Las referencias sostienen las capacidades/límites de Firestore. Las conclusiones sobre B3 proceden de los archivos locales indicados, no de una imposibilidad general del plan Spark.
