# Publicación nativa sobre Firebase Spark · contrato protegido

Estado: implementación local del publicador; ninguna ejecución de producción. La habilitación depende de evidencia completa de los nueve contratos financieros, baseline derivado verificado y recuperación certificada. Los archivos del coordinador anterior se conservan; este workflow no los invoca.

## Archivos y límites

- `.github/scripts/spark-native-publish.cjs`: validación de fuente/evidencia, adaptador registrado y coordinación de reglas con Hosting.
- `.github/scripts/spark-native-firebase-adapter.cjs`: adaptador administrativo real, fijado a Node 22 y Firebase CLI 15.30.1. Lee metadatos de facturación, Hosting, reglas y el control derivado; publica exclusivamente reglas Firestore y `hosting:v2` en `mi-cartera-d0d8c` / `mi-cartera-pro-v2`.
- `.github/workflows/deploy-v2-spark-native.yml`: ejecución manual en la línea `reengineering-v2-final`, SHA completo, autorización registrada, environment existente `v2-production` con revisores, y concurrencia `mi-cartera-pro-v2-production` sin cancelar otra ejecución.

Las dos variables `V2_PUBLISHING_ENABLED` y `V2_SPARK_NATIVE_PUBLISHING_ENABLED` deben valer exactamente `true`; la ausencia de cualquiera mantiene los jobs cerrados. El publicador no cambia facturación, no despliega funciones ni servidores, no modifica documentos financieros y no ejecuta una migración automática. Las mutaciones del adaptador requieren el job protegido `deploy-spark-native`; la CLI local no constituye una alternativa.

## Evidencia vinculada sin circularidad Git

El candidato debe contener `.github/release/spark-native-evidence.json`. Los inputs del workflow son `approved_sha`, `approval_reference` y `evidence_sha256`. El SHA aprobado identifica el checkout y la referencia de autorización debe contener ese mismo SHA; el hash de evidencia identifica los bytes exactos del manifiesto revisado.

El manifiesto no contiene obligatoriamente el SHA de su propio commit. Su `sourceSHA256` es SHA256 del JSON de los artefactos ordenados por nombre de rol, cada uno con `{role,path,sha256}`. Los roles obligatorios son `rules`, `recoveryRules`, `nativeBootstrap`, `nativeModule`, `nativeConfig` y `hostingRelease`. Pueden incluirse otros archivos nativos aprobados. Todos deben tener hash de sus bytes actuales; no se admiten rutas fuera del checkout ni enlaces que salgan de él.

`nativeConfig` identifica `v2/app/firebase-v2-template.js` y debe seleccionar estáticamente `backendMode:'spark-native'` y el proyecto aprobado, sin URL de otro servidor. `nativeBootstrap` identifica `v2/app/firebase-bootstrap.js`; `hostingRelease` identifica `v2/app/release.json` con el build aprobado. Las ramas históricas de un archivo no representan un transporte autorizado distinto: su selección activa queda vinculada a la configuración y a la QA por hash.

`qa.status`, `stableCompatibility`, `rollbackReadOnly`, `pcChrome` y `androidChrome` deben ser `PASS`. `qa.sourceSHA256` debe coincidir con el agregado de artefactos. `validationMode` distingue `ISOLATED_AUTOMATED` de `PHYSICAL_FICTITIOUS`; una prueba automática no acredita un Xiaomi físico. La promoción a estable sigue requiriendo la aprobación física prevista por la política vigente.

La lista `qa.requiredFinancialContracts` y las filas `qa.contracts` deben incluir, en este orden, PAYMENT, CREDIT_CREATE, INTEREST_RENEWAL, REFINANCE, CASH_MOVEMENT, PARTNER_LOAN_CREATED, PARTNER_INTEREST_PAID, PARTNER_CAPITAL_RETURNED y PARTNER_SETTLED. Cada fila exige `status:PASS`, un `evidenceSHA256` y `sourceSHA256` igual al hash de las reglas candidatas. Este último campo identifica específicamente las reglas, mientras el `qa.sourceSHA256` superior identifica el agregado completo. Un resultado pendiente o perteneciente a otra versión bloquea toda mutación.

## Baseline: interfaz técnica pendiente de aprovisionamiento

El manifiesto incluye `baseline:{proofPath,sha256}`. El archivo de prueba permanece bajo `.github/release/` y su hash debe coincidir. No basta declarar un JSON aprobado: el adaptador consulta también el documento vivo exacto `orgs/v2-mi-cartera-pilot/financialControls/release`.

El documento derivado exige `protocol:SPARK_NATIVE_BASELINE`, `schemaVersion:1`, el proyecto y organización exactos, `status:FROZEN_VERIFIED`, `derivedOnly:true`, `originalFinancialRowsUnchanged:true`, `writeFenceVerified:true`, `sourceSHA256`, `ledgerSnapshotSHA256` y `verifiedAt`. Se identifican las posiciones derivadas por cuenta mediante `financialControls/cash--<accountId>`, protocolo `spark-cash-v1`, tipo CASH_POSITION; su generación y conciliación corresponden al procedimiento de baseline aprobado, no a este adaptador.

El archivo de prueba exige además `backendMode:spark-native`, `status:VERIFIED`, `rulesSHA256` candidato, `writeFenceRulesSHA256` de las reglas actualmente verificadas, Hosting y ruleset previos exactos, `checkedAt`, `liveRecordPath`, `liveRecordSHA256` y los mismos campos de fuente/integridad. `liveRecordSHA256` es el hash canónico del documento actual leído. La prueba debe tener como máximo cinco minutos y coincidir con `verifiedAt`; se verifica nuevamente antes de activar reglas.

El generador de baseline y el bloqueo real de escritores siguen siendo requisitos separados. El control administrativo debe calcular el total de entradas, egresos y reservas, incluir cuentas y fechas pertinentes, conservar los hashes de filas originales y demostrar que no cambiaron durante la preparación. Los booleanos de esta interfaz documentan esa atestación confiable; no sustituyen el bloqueo efectivo ni prueban por sí solos una conciliación correcta. Una prueba caducada durante la revisión exige regeneración mediante un procedimiento protegido todavía pendiente, nunca editar su fecha para aparentar vigencia.

## Secuencia y recuperación

El coordinador valida evidencia, adquiere la exclusión del workflow, conserva versión Hosting y fuente/ruleset exactos, verifica permisos y compilación, contrasta baseline y confirma que producción no cambió. Solo después activa reglas, las verifica, publica Hosting y coteja el build y los bytes publicados con los artefactos aprobados. El journal conserva el respaldo antes de la primera mutación y se adjunta al run.

Ante un fallo posterior, instala primero la política independiente de recuperación de solo lectura certificada. Si se intentó cambiar Hosting, restaura después la versión B2 exacta respaldada. Verifica ambos componentes y conserva el resultado `ROLLED_BACK_READ_ONLY`. No restaura ni importa datos financieros, ni borra operaciones pendientes o almacenamiento del dispositivo.

Las reglas estables anteriores pueden ser más débiles. El adaptador real considera desconocido si hubo operaciones nativas y mantiene la recuperación de solo lectura. El contrato permite restaurar reglas previas únicamente con aprobación explícita, prueba independiente de que el protocolo no llegó a usarse, bloqueo confirmado de escritores y compatibilidad con los datos actuales. Cualquier operación nativa confirmada impide esa restauración. Si la recuperación no puede verificarse, registra `ROLLBACK_INCOMPLETE` y falla; no transforma ese estado en éxito.

## Acceso concreto para ejecutar cuando la evidencia esté completa

La credencial del publicador necesita lectura del baseline y permisos Hosting/reglas para publicar y recuperar: `firebasehosting.sites.update`, `firebaserules.rulesets.create`, `firebaserules.releases.get`, `firebaserules.releases.update` y `datastore.entities.get`; las APIs de lectura necesitan también los permisos efectivos para consultar proyecto/facturación y contenido del ruleset. La comprobación real cierra el flujo si no están disponibles. El secreto `FIREBASE_TOKEN` se entrega únicamente al paso protegido, sin argumentos de consola ni archivos de respaldo. El aprovisionamiento de baseline requiere su propio alcance administrativo, que no se concede al navegador.

La falta de una credencial GitHub utilizable en Codex no invalida una sesión del navegador del propietario. Tras integrar los archivos por la vía administrativa autorizada, el propietario puede abrir `https://github.com/arturohoyosdargent/mi-cartera/actions/workflows/deploy-v2-spark-native.yml`, usar **Run workflow**, seleccionar `reengineering-v2-final`, introducir el SHA completo, referencia de autorización y hash del manifiesto, y revisar el environment `v2-production`. Debe disponer de acceso de escritura/ejecución del repositorio y pertenecer a los revisores autorizados, conforme a la política de autoaprobación configurada. Si el workflow aún no existe en la rama predeterminada o no puede integrarse, ese es un requisito administrativo previo; no se sustituye por publicación local.

No se necesita una nueva autorización de publicación: se conservan la autorización vigente y los controles que identifican el artefacto exacto. Tampoco se presenta este documento como prueba de acceso remoto, baseline disponible o producción publicada.
