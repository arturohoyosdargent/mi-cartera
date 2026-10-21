# Preparación de publicación B2 compatible — 21/10/2026

## Identidad y alcance

- Rama de desarrollo: `development/v2-b2-continuation-20261021`.
- Base estable: `b22816b87eced0eb736e7a2e269d0d9194a25302`.
- Versión candidata: `v2-pilot-20261021-b2-continuation-1`.
- La publicación activa continúa en `v2-pilot-20261020-b2-compatible-1`.
- El SHA completo del commit preparado se registra en la entrega de preparación; esta rama no autoriza desplegar.

Se integran las correcciones de renovaciones, compromisos, eliminación protegida, cola offline, coherencia de identidad, asignaciones y búsqueda. No se cambian reglas, esquema B2, backend, motores financieros, datos reales ni workflows.

## Verificación integral

- 114 suites aprobadas: todas las suites `.spec.js` del publicador, más compatibilidad B2 y controles de publicación.
- 206 verificaciones de sintaxis JavaScript aprobadas.
- SDK oficial Firebase 10.14.1 aprobado en emulador `demo-mi-cartera-native`, con datos ficticios y las reglas B2 conservadas, SHA256 `833c9c939eb81c70f3d5f0913b9c29108e61ceb563e74388e2b19a6107ecb8a6`.
- Cobranza, ambas renovaciones, socios, caja, rutas, gestores, separación de cuentas, offline, reconexión, deduplicación y recuperación quedan cubiertos por la regresión.
- La prueba SDK confirma pago atómico, pérdida ficticia de ACK, reintento, segundo cliente simulado y compatibilidad del código de respaldo sin duplicar el recibo de operación.

La regresión encontró una comprobación estática antigua que exigía asignar directamente la ruta del crédito; se actualiza para comprobar el helper que conserva también rutas heredadas. Se mantiene íntegra su prueba funcional de UID y ruta y se repite únicamente esa suite fallida.

El emulador Java presentaba un fallo de recursos de idioma `es_PE`, reproducido también con el código estable. Se ejecuta con locale JVM `en_US`; no se modifica código de negocio ni reglas para resolverlo. La validación SDK posterior aprueba.

Las pruebas PC/móvil son automatizadas y el segundo dispositivo SDK es simulado. La aceptación física de estas correcciones en PC y Xiaomi no se presume.

## Publicación futura, únicamente después de autorización

1. Obtener autorización humana expresa para el SHA completo del commit preparado y este build.
2. Iniciar exclusivamente `.github/workflows/deploy-v2-firebase.yml` desde `reengineering-v2-final`, con ese SHA inmutable y su autorización registrada.
3. Mantener el interruptor administrativo, las comprobaciones de destino, la regresión del workflow y la aprobación humana obligatoria de `v2-production`.
4. Desplegar sólo `hosting:v2`, proyecto `mi-cartera-d0d8c`, sitio `mi-cartera-pro-v2`, configuración `firebase.v2.json`. No desplegar Functions, reglas ni datos.
5. Comprobar build, archivos servidos, Hosting activo y ruleset sin cambios; validar físicamente PC/Xiaomi antes de promover esta candidata a nueva estable.

No se inicia ni aprueba ese workflow durante la preparación. No se usa Firebase CLI local como vía alternativa.

## Recuperación de código

Si una actualización futura autorizada falla, el respaldo conservado es:

- SHA `b22816b87eced0eb736e7a2e269d0d9194a25302`.
- Build `v2-pilot-20261020-b2-compatible-1`.
- Etiqueta `stable-rollback-v2-20261021-b22816b`.
- Hosting certificado `sites/mi-cartera-pro-v2/versions/c3a543a6e4909d66`.
- ZIP fuente SHA256 `0ff303a32c189fb88c724f84d8467e3355293ec4c5272fac7d67816abe78a8ea`.

Una recuperación requiere una orden humana explícita y el mismo workflow Hosting protegido. Nunca restaura créditos, pagos, caja, socios, Firestore, reglas B2 ni localStorage financiero. Se conservan también la estable histórica `43a7afa` y el respaldo anterior de código `7b53fc1`. No se ejecuta ningún rollback en esta preparación.
