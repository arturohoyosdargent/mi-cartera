# Preparación verificable de un backend externo para Spark

El módulo `.github/scripts/spark-release-readiness.cjs` es una comprobación de lectura. No publica Hosting, Functions, reglas ni backend externo; no cambia facturación ni registra operaciones financieras. El workflow de publicación vigente y sus requisitos de SHA, revisión y destino permanecen intactos. El resultado siempre contiene `publicationAuthorized: false` y `status: PREPARATION_ONLY`.

## Entradas y evidencia

`validateSnapshot(snapshot, {now})` exige destino `mi-cartera-d0d8c` / `mi-cartera-pro-v2`, `billingEnabled: false`, `backendMode: external`, un origen HTTPS sin credenciales, ruta, query ni fragmento, `approvedSha` de 40 caracteres y `approvedBackendSHA256` de 64. Rechaza direcciones IP, localhost y endpoints Cloud Functions. La URL externa debe aprobarse junto con el artefacto; el módulo no acredita quién controla ese dominio ni su plan de alojamiento.

`stable` debe identificar `sha`, `build`, `hostingVersion`, `rulesetName`, `rulesSha256` y `backupSha256`. Son referencias y huellas del respaldo conservado; deben obtenerse y cotejarse mediante el proceso protegido. El módulo no descarga ni sustituye esos artefactos. Los nombres de Hosting y reglas deben pertenecer al mismo destino autorizado.

`availabilityProof` debe contener `backendBaseUrl`, `checkedAt` ISO, `httpStatus: 200`, `method: GET`, `path: /health`, `authentication: firebase-id-token` y `health`. La evidencia caduca a los cinco minutos y no admite fechas futuras.

La respuesta autenticada `/health` debe ser:

```json
{
  "apiVersion": "mi-cartera-b3-callable-v2",
  "schemaVersion": 1,
  "mode": "external-spark",
  "projectId": "mi-cartera-d0d8c",
  "releaseId": "<identificador-del-backend>",
  "sourceSHA256": "<huella-del-artefacto-aprobado>",
  "services": [
    "recordV2Installment",
    "recordV2CommissionTerms",
    "settleV2Commission",
    "requestV2CreditAdministrativeReview"
  ]
}
```

La huella debe coincidir con `approvedBackendSHA256`; la lista de servicios es exacta y ordenada. Esta identificación declarada por el servidor no es una firma criptográfica ni demuestra por sí sola la integridad de su infraestructura o de las cuatro operaciones.

## Uso de lectura y permisos pendientes

El modo local sin red lee una instantánea JSON ya obtenida por el operador protegido:

```text
node .github/scripts/spark-release-readiness.cjs <snapshot.json>
```

Sin URL y evidencia autenticada válida, termina con error. Una instantánea preparada manualmente sirve para revisar el contrato, pero no acredita disponibilidad real ni concede permiso de publicación.

El modo opcional de comprobación de disponibilidad hace una única solicitud `GET /health`, rechaza redirecciones y exige respuesta JSON del mismo origen:

```text
node .github/scripts/spark-release-readiness.cjs <snapshot.json> --probe
```

Requiere acceso de red al origen externo y un ID token Firebase en la variable privada `V2_SPARK_BACKEND_ID_TOKEN`. El token no va en argumentos, archivos de evidencia ni salida. El servidor debe verificar su firma y revocación, y consultar una membresía activa admin/supervisor. Solo se permiten las lecturas necesarias de Auth y membresía para esta comprobación; no se solicita una operación financiera de prueba en producción.

La API exportada `probeReadiness(snapshot, {fetch, token, now})` recibe el transporte explícitamente. Devuelve la evidencia permitida y el resultado de preparación; omite campos desconocidos y oculta errores de transporte para evitar imprimir credenciales. La ejecución local de las pruebas usa transporte ficticio, sin red, tokens reales ni escrituras.

Antes de cualquier publicación faltan, si aún no existen: origen externo operativo y aprobado, artefacto y dependencias fijados, credenciales de ejecución bajo custodia del proveedor, restricciones de origen, evidencia real autenticada, comprobación de permisos y disponibilidad de recuperación, y los controles vigentes del workflow. No se permite publicar únicamente la interfaz mientras esos requisitos no estén demostrados. No se crea un despliegue ni se modifica un workflow para omitirlos.

## Evidencia focalizada

`node --test .github/scripts/spark-release-readiness.spec.cjs`: 12 pruebas nuevas aprobadas. Cubren el cierre sin backend, destino, Spark sin facturación, URL, respaldo, contrato y huella, cinco servicios, autenticación y caducidad, solicitud GET única, rechazo de redirecciones y ocultamiento de secretos. Las pruebas históricas aprobadas no se repiten por este cambio administrativo.

Actualización del contrato: el backend exige financialProtocol:2 y también recordV2FinancialOperation. Un health con protocolo inactivo o solo cuatro endpoints no supera el gate.
