# Respaldo estable certificado — 21/10/2026

- SHA de la publicación conservada: `b22816b87eced0eb736e7a2e269d0d9194a25302`.
- Build: `v2-pilot-20261020-b2-compatible-1`.
- Etiqueta remota verificada: `stable-rollback-v2-20261021-b22816b`.
- Registro: https://github.com/arturohoyosdargent/mi-cartera/releases/tag/stable-rollback-v2-20261021-b22816b.
- Hosting conservado: `sites/mi-cartera-pro-v2/versions/c3a543a6e4909d66`.

El usuario declara que la versión funciona en Android y PC y solicita explícitamente certificarla como nueva estable. Esta aceptación física es del usuario; no se presenta como una nueva prueba física independiente del agente.

Se conserva el resultado previo de 113 suites, 205 comprobaciones de sintaxis, SDK Firebase real con datos ficticios y publicación protegida #131. No se repiten esas pruebas aprobadas. El 21/10 se verifican en modo lectura la versión pública, ocho archivos críticos, el Hosting activo y el ruleset B2 sin cambios. Los 388 blobs del archivo fuente coinciden con el árbol Git `b1f025de8e33a8ab0d43c1b478a34799020bf336`.

Archivo conservado: `MI_CARTERA_ESTABLE_b22816b_FUENTE.zip`, SHA256 `0ff303a32c189fb88c724f84d8467e3355293ec4c5272fac7d67816abe78a8ea`.

La estable anterior `stable-rollback-v2-20261008-43a7afa` y el respaldo inmediatamente anterior de código `7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5` permanecen conservados. Ninguna etiqueta se mueve ni sobrescribe.

## Recuperación futura

El destino de recuperación tras una actualización futura problemática será el SHA/build/tag certificado correspondiente, no una referencia histórica fija. Requiere autorización expresa y el workflow protegido `.github/workflows/deploy-v2-firebase.yml`, desde `reengineering-v2-final`, por SHA completo y con revisión humana de `v2-production`.

La recuperación es únicamente de APP/CÓDIGO Hosting V2. Nunca restaura, importa, elimina ni reemplaza créditos, pagos, caja, socios, clientes, operaciones pendientes, Firestore, reglas B2 ni localStorage financiero. Este certificado y su etiqueta no ejecutan una restauración ni autorizan un despliegue nuevo.

La actualización local de `stable-catalog-v2.js` es administrativa y pertenece al candidato siguiente. No modifica retroactivamente el artefacto estable ni el código actualmente servido.
