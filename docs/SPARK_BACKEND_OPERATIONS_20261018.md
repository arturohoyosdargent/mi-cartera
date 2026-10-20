# B3 Spark: operación del backend externo

Estado: preparación local; no se ha creado servidor, credencial, commit ni publicación. Spark se conserva. El transporte HTTP reutiliza Firebase Auth y Firestore con transacciones autoritativas; no importa ni despliega Cloud Functions.

## Artefacto y ejecución

El paquete requiere Node 22, `functions/package.json`, su lockfile y todos los archivos de ejecución indicados por `SOURCE_FILES` en `functions/spark-http-server.cjs`. Las dependencias se instalan desde `functions/` mediante `npm ci --ignore-scripts --no-audit --no-fund`. Las copias `spark-partner-loans.js` y `spark-schedule-engine.js` son idénticas a los modelos aprobados y tienen prueba de igualdad.

El servidor escucha exclusivamente en `127.0.0.1`, detrás de un proxy HTTPS permanente. Requiere un host Node confiable disponible durante la operación diaria; el laboratorio de escritorio y un túnel temporal no cumplen ese requisito. No usar GitHub Actions como servidor de cobros.

Configuración del entorno remoto, actualmente pendiente:

- `GCLOUD_PROJECT=mi-cartera-d0d8c`, `MI_CARTERA_RELEASE_ID` igual al build aprobado y `MI_CARTERA_ALLOWED_ORIGINS` con los orígenes exactos autorizados.
- `GOOGLE_APPLICATION_CREDENTIALS` apunta a una identidad dedicada montada fuera del repositorio o a una configuración de federación. Nunca incluir credenciales en Hosting, el paquete de fuentes o JavaScript del navegador.
- La identidad necesita acceso a los documentos y consultas Firestore de la organización y lectura de usuarios Firebase Auth para verificar revocación/inhabilitación. El despliegue y la modificación de membresías quedan separados del runtime.
- `MI_CARTERA_BACKEND_DEPLOYMENT_READY=true` solo se establece después de verificar infraestructura e identidad; no es una certificación automática.
- `PORT` es el puerto privado detrás del proxy. No definir variables de emulador en producción. No usar credenciales administrativas del usuario como identidad permanente del servidor.

Inicio: `node functions/spark-http-server.cjs`. El endpoint privado `GET /health` exige token Firebase válido, usuario activo y miembro administrador/supervisor. Debe declarar `mi-cartera-b3-callable-v2`, esquema 1, protocolo financiero 2, cinco servicios y huella SHA256 del backend aprobado. La facturación de Firebase sigue desactivada; el host externo tiene su propio costo y operación, aún no contratados ni configurados.

## Cierre financiero y activación

Las escrituras de cobranza, comisiones, créditos, ambas renovaciones, caja y socios comparten el mutex `routes/spark-financial-mutex`. El ledger original conserva autoridad; no se inicializan contadores desde datos reales ni se reconstruye historia en producción. Las salidas consultan caja central canónica y reservas de egresos futuros; las entradas futuras no financian desembolsos actuales. Los reintentos aceptados devuelven el resultado anterior sin reescribir el mutex.

La capacidad `routes/spark-financial-capability` debe ser provisionada por un control de despliegue, nunca por navegador. Solo el estado `{active:true, protocol:2, backendMode:'external'}` admite operaciones financieras nuevas. Con esa capacidad, las reglas impiden escrituras financieras directas incluso a administradores; conservan lecturas y parches de metadata delimitados. Los ocho helpers históricos no reintroducen las concesiones de escritura inseguras del snapshot.

La configuración estática del frontend requiere `backendMode:'external'`, `backendBaseUrl` HTTPS y `backendAllowedOrigins` exactos. La plantilla activa conserva el modo anterior hasta disponer de URL y validaciones reales. No completar el valor con un dominio inventado ni habilitar fallback silencioso al navegador.

## Publicación y rollback

El workflow nuevo `v2-spark-candidate-qa.yml` solo verifica un SHA inmutable y carece de permisos de despliegue. El publicador existente de cuatro Functions sigue fallando cerrado bajo Spark; no se utiliza para publicar esta variante. El gate Spark verifica evidencia de disponibilidad y respaldos, pero no publica ni sustituye los controles protegidos existentes. Falta implementar el despliegue coordinado específico del proveedor externo una vez que exista infraestructura verificable.

Secuencia obligatoria pendiente: comprobar host/identidad/TLS; ejecutar pruebas aisladas sobre ese host; verificar Auth, huella y cinco servicios; validar código/reglas y permisos; validar PC y Xiaomi por HTTPS; integrar el SHA aprobado mediante los controles protegidos; activar frontend y capacidad sin ventana para clientes antiguos; verificar las lecturas posteriores. No ejecutar un deploy de Hosting aislado.

Rollback preparado y ensayado en emulador: desactivar la capacidad para frenar nuevas escrituras; conservar consultas de confirmaciones anteriores; volver a Hosting estable y a su ruleset exacto; verificar que las sesiones nuevas usen la versión estable. El backend nuevo se retira solo cuando el cliente estable y sus reglas estén confirmados. No restaurar, borrar ni reescribir documentos financieros. El mutex es metadata aditiva y no exige revertir saldos.

Fusión de clientes duplicados, bajas financieras y tipos no autorizados por el quinto servicio se rechazan expresamente en el modo externo. No afirmar paridad operacional completa mientras esas rutas no se certifiquen. El rol gestor recupera sus contratos de lectura; su flujo de sesión/escritura no se amplía por copiar reglas históricas.
