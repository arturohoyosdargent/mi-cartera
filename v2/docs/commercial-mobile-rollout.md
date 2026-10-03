# Bloque comercial móvil — 2 de octubre de 2026

Actualización de la guía: 3 de octubre. Las asignaciones individuales y referencias por crédito ya están integradas. El incidente de los dos cobros protegidos quedó cerrado en el dispositivo por confirmación del administrador; su exclusión de reenvío se conserva. El ajuste `routes-summary-1` afecta únicamente la consulta de cartera sin cronograma y la clasificación de filas con saldo cero.

Base de retorno: `133ebb8b312f009e4ebca3051e53c354844c2145`, build `v2-pilot-20261002-b2-mobile-final-1`. Candidato agrupado: `v2-pilot-20261002-b2-commercial-mobile-5`.

## Alcance

- Comprobantes y recordatorios tienen una sola acción «Compartir comprobante»: imagen y mensaje editable juntos en el selector nativo, sin descargar antes el PNG. El selector de Android puede pedir elegir WhatsApp y el contacto. Las demás fichas conservan su entrega aprobada al teléfono registrado. No se envían mensajes automáticamente.
- Más, Balance/Caja, Reportes y Rutas permiten filtrar y abrir movimientos, consultar datos y referencias y navegar al cliente, crédito o cobro relacionado. Estas vistas no modifican registros.
- Rutas reutiliza `orgs/{org}/routes` con perfiles ROUTE/WORKER, condiciones TERM, asignaciones ASSIGNMENT y transferencias TRANSFER. Los registros financieros canónicos siguen en sus colecciones originales.
- Administrador/supervisor configuran perfiles, asignaciones, entrega interna de capital y pago de comisiones. GESTOR tiene un workerId específico y solo consulta/opera su cartera autorizada. El rol COBRADOR anterior conserva su comportamiento aprobado.
- Las comisiones admiten porcentaje sobre cobrado/capital/interés/mora, importe por cobro o importe por periodo completo. Las condiciones tienen vigencia y se conservan históricamente.
- La asignación conjunta modifica únicamente propiedad/ruta/versión/auditoría del cliente y sus créditos; no reasigna cobros anteriores. El pago de comisiones guarda distribución por ruta de origen en el mismo egreso único, incluso después de cambiar de ruta y en pagos parciales.
- La caja pagadora se distingue de la atribución del gestor. Las entregas internas tienen un egreso del líder y un ingreso del gestor por igual monto: el consolidado no aumenta. Pagar una comisión desde caja del líder no reduce de nuevo el efectivo del gestor.
- La revisión compartida `routes/leader-cash-revision`, incluida en la transacción atómica, evita gastar un saldo obsoleto concurrentemente desde distintos dispositivos. La lectura de revisión precede y sigue la hidratación; el desacuerdo cancela antes del diario. Una lectura bloqueada tiene plazo y libera el bloqueo. Las nuevas entregas/pagos comerciales requieren conexión.

## Alta administrativa de un gestor

Crear una ruta activa y un perfil de gestor en Más → Rutas / Gestores no concede acceso por sí solo. Para una persona real, un administrador autorizado debe crear su cuenta Firebase Auth y vincular ese UID al perfil WORKER. La membresía `orgs/{org}/members/{uid}` necesita `active: true`, `role: 'gestor'`, `workerId` del perfil y `routeIds` autorizadas. No reutilizar cuentas del líder ni credenciales de laboratorio. La cuenta debe coincidir con `authUid` del perfil, que debe estar activo en una ruta activa. Se puede asignar un crédito individual conservando el titular y sus demás préstamos: la asignación crea el vínculo de consulta del contacto necesario, sin conceder acceso a otros créditos. Para trasladar toda la cartera del titular, elegir la asignación predeterminada del cliente y marcar «Incluir todos sus créditos existentes». Los cobros anteriores mantienen su gestor original.

## Evidencia y publicación

QA con datos ficticios: 87 suites de regresión verdes; después del último ajuste de distribución por ruta, los cuatro módulos afectados pasan 20 pruebas y la revisión independiente pasa 20/20. SDK Firebase real contra emuladores con reglas candidatas: aislamiento, creación/cobro atómicos, deduplicación, rechazo de caja ajena, gestor inactivo y concurrencia del líder. Reasignación móvil preserva exactamente cobros y caja históricos. Prueba física de WhatsApp Redmi aprobada y cerrada; no requiere repetición.

Motores financieros, calendario, acciones aprobadas de pago, socios y generador visual permanecen idénticos a la base de retorno. El registro de renovación aprobado permanece idéntico; el ajuste en ese archivo es el transporte de la presentación compartida.

Publicación única del conjunto aprobado: `firebase deploy --config firebase.v2.json --project mi-cartera-d0d8c --only hosting:v2,firestore:rules`. El destino Hosting V1 no se publica. Las reglas mantienen el comportamiento V1 y añaden permisos aislados para GESTOR V2. Antes/después se comparan únicamente huellas de los documentos reales; las pruebas no escriben en producción. Verificar todos los archivos servidos frente al árbol Git aprobado, versión y caché de release/Service Worker.

Para volver a la base, conservar el bundle Git de `133ebb8`, sus reglas verificadas y la versión Hosting anterior `c4d51bc1e769c075`. Restaurar Hosting y reglas conjuntamente; no borrar ni migrar datos.
