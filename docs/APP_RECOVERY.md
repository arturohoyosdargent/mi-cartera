# Recuperación de la app V2 y respaldo de datos

**Restaurar última versión estable** prepara una solicitud administrativa para recuperar el código de la última app certificada que identifica el catálogo versionado. El navegador muestra el destino exacto y permite copiar la solicitud; no publica, no cambia Hosting y no informa que una restauración se haya ejecutado.

**Buscar y actualizar app publicada** es una acción auxiliar diferente: consulta el código que Firebase Hosting V2 sirve actualmente y solicita actualizar su worker. Si esa publicación tiene una regresión, descargarla de nuevo no restaura la última estable.

Las versiones estables son sucesivas. El orden para certificar una nueva estable es **QA → publicación controlada autorizada → validación física en PC y Android/PWA → aprobación humana explícita → registro de nueva estable**. Aprobar QA o publicar un build no lo certifica automáticamente. Al registrar una nueva estable se conserva inmediatamente la anterior y sus referencias inmutables.

La identidad siguiente sigue protegida y conservada como antecedente certificado; no está codificada como destino permanente en el algoritmo de recuperación:

| Referencia protegida | Valor |
| --- | --- |
| SHA estable | `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71` |
| Tag | `stable-rollback-v2-20261008-43a7afa` |
| Build | `v2-pilot-20261008-b2-socios-pwa-session-1` |

La política administrativa sigue en [PUBLICATION_CONTROL.md](PUBLICATION_CONTROL.md). El catálogo distingue la última certificada (`current`) de su predecesora (`previous`), independientemente de la publicación o candidato más reciente. No se aprueba automáticamente el SHA `fa36b2e48fa811f5de84e51e336922db3ed562a5` como estable. Este cambio local no autoriza push, deploy, mover referencias, un nuevo backend, configuración de credenciales ni operaciones sobre datos reales.

## Funcionamiento implementado

En un primer acceso limpio del piloto, `local-ownership-bootstrap-v2.js` se carga después de Auth y antes del productor de hidratación existente. Establece únicamente la clave técnica `mi-cartera-v2-local-owner`, tras una hidratación exitosa, identidad Firebase/membresía/organización coincidentes y sesión hidratada del mismo usuario. Revalida dentro de un Web Lock exclusivo y avisa a soporte y recuperación mediante `v2-local-owner-ready`; no simula eventos de Auth ni vuelve a hidratar.

El inicializador no adopta una cartera existente sin propietario, no reemplaza propietarios ni escribe datos financieros, tokens o colas. Un cambio de identidad durante la preparación, una hidratación fallida, datos previos ambiguos o la ausencia de Web Locks bloquean la inicialización. Su alcance se limita al piloto cuya organización usa el productor actual; la compatibilidad física PC y Android/PWA sigue pendiente de validación. La recuperación conserva el requisito de propietario acreditado.

Sólo un administrador con `ready`, `authenticated` y `member` verdaderos en `MiCarteraV2AuthCloudGate`, UID presente, usuario actual de Firebase coincidente y propietario local coincidente puede ver y ejecutar la recuperación. El rol se comprueba contra el gate de Auth; no se deduce de una sesión local ni se crea un administrador cuando falta la sesión. Si falta el usuario actual de Firebase o contradice al gate, se bloquea. La organización queda vinculada a la sesión lista verificada al cargar o al recibir un evento completo de Auth listo que coincide con el gate y Firebase; cambiar únicamente el getter `ORG` bloquea la recuperación hasta otra validación completa. Un cambio de sesión o propietario cierra el panel y vuelve inválida una preparación anterior, aunque el nuevo titular también sea administrador.

El panel muestra el build del documento instalado y el build de service worker que informa el guardián existente. No presenta esos valores como una verificación nueva de lo que está publicado.

El destino se recibe de `window.MiCarteraV2StableCatalog`, un asset versionado integrado por separado. `current` y `previous` contienen `{sha, build, tag}`; `previous` puede ser nulo si aún no se identifica una predecesora certificada. El módulo valida un SHA completo, build V2 y tag presente. No toma el destino de `release.json`, de la versión instalada ni de un fallback fijo. Sin catálogo válido se identifica igualmente la versión instalada y se permite la acción auxiliar; la preparación de una restauración estable queda bloqueada.

La acción principal **Restaurar última versión estable**:

1. Comprueba el administrador autenticado y propietario, y el destino `current` del catálogo.
2. Pide confirmar el SHA, build y tag concretos, que la solicitud recupera APP/código y que conserva los DATOS actuales.
3. Vuelve a validar identidad y catálogo; muestra una solicitud con fecha, solicitante, destino certificado, estable anterior y estado `PENDING_ADMINISTRATIVE_PUBLICATION`. No consulta un endpoint, publica, modifica un worker ni recarga la app.
4. Permite copiar sus metadatos si el portapapeles está disponible. Si el navegador lo bloquea, el texto puede seleccionarse manualmente. Un cambio de sesión o catálogo invalida la solicitud.

La preparación es local, en memoria y DOM. No se guarda en localStorage ni equivale a la autorización humana o aprobación del environment del procedimiento de publicación. No elimina ni sustituye la confirmación administrativa requerida. Como no ejecuta una publicación, actualización o recarga, puede prepararse sin conexión usando el catálogo incluido en la app.

La acción **Buscar y actualizar app publicada**:

1. Comprueba permisos, conexión y `MiCarteraV2Refresh.unsaved()`. Un formulario de cliente o crédito pendiente bloquea la acción.
2. Pide confirmar que preparará el código publicado actualmente como acción auxiliar, sin restore de datos ni restauración de la última estable.
3. Consulta `release.json` con `cache: 'no-store'`, valida su build V2 y vuelve a comprobar la identidad después de cada espera.
4. Reutiliza `MiCarteraV2VersionGuard.verify()` sin modificar su algoritmo. Solicita `update()` al registro de service worker del alcance exacto de esta app y, si existe uno en espera, usa su mensaje existente `SKIP_WAITING`.
5. Informa la versión publicada y que se solicitó actualizar el worker. No afirma que ese worker ya esté instalado. Si no hay un registro, informa que el navegador puede recargar la publicación actual.
6. Habilita **Recargar app actual**. La recarga requiere otra confirmación y vuelve a comprobar permisos, propietario, conexión y formularios. Al abrir nuevamente se puede comprobar la versión instalada.

Si no se obtiene una publicación válida, no se prepara la recarga ni se solicita activar un worker. El módulo no elimina registros ni cachés, no borra credenciales y no vuelve a instalar una PWA. El guardián de versión conserva su mantenimiento de worker existente.

El módulo no lee ni escribe `mi-cartera-v2-validation-state`, no modifica ninguna clave financiera ni de Auth, no llama a Firestore, no ejecuta `MiCarteraV2Refresh.run()` ni `MiCarteraV2CloudRehydration.rehydrate()` y no consume operaciones pendientes. Sólo lee `mi-cartera-v2-local-owner` para comprobar el propietario. Después de una recarga, el arranque y la sincronización normales conservan sus controles existentes; la recuperación no les sustituye ni les suministra datos antiguos.

## Respaldo y migración histórica

El panel de respaldo conserva `payload`, `download`, `validateV2Backup`, `restoreV2` e `inspectV2Restore`. **Restaurar respaldo V2** continúa reemplazando los datos locales tras su confirmación existente y guarda `mi-cartera-v2-before-restore`. Esa operación pertenece exclusivamente al panel de respaldo; `Recuperar app` no la llama ni incluye selección de archivos.

Se retiraron del panel la importación de clientes desde V1, su validación y la reversión de esa importación. Se revisaron las referencias de `MiCarteraV2Backup.validate`, `.inspect`, `.apply` y `.rollback`, los IDs de su botonera y `__v2ClientMigration`; no existen consumidores externos activos en la fuente y pruebas del candidato base.

Las funciones históricas de migración se conservan privadas dentro de `backup-v2.js`, sin exportaciones ni enlaces desde la UI. Sus algoritmos y los respaldos históricos permanecen disponibles para revisión administrativa del código. No se borra el snapshot `mi-cartera-v2-before-client-migration`, no se ejecuta una reversión y no se intenta trasladar o reconstruir datos V1. Una futura reactivación requeriría una decisión explícita y un trabajo separado.

## Integración de la UI

La API pública es `window.MiCarteraV2AppRecovery` con `open`, `canOpen`, `prepareStableRestore`, `copyStableRequest`, `checkAndUpdate`, `reload`, `install` y `syncAccess`.

La integración debe cargar el asset de `MiCarteraV2StableCatalog` y `app-recovery-v2.js` después de `version-guard.js`, `auth-cloud-gate.js` y `refresh-controller-v2.js`. Se mantiene separado de `backup-v2.js`; puede cargarse después de éste. El acceso en Más usa un botón con `data-app-recovery`. `install()` le asigna `open()` y `syncAccess()` actualiza su visibilidad y disponibilidad. El módulo instala estos controles en `DOMContentLoaded` y escucha los eventos existentes de Auth, almacenamiento y versión. El catálogo se cambia mediante el procedimiento administrativo de certificación, nunca mediante una acción de este panel.

La inclusión del script en el shell, la lista de assets offline del worker y el build de integración pertenecen a la integración del candidato. Este módulo no modifica esos archivos ni los algoritmos financieros, de Auth, sincronización o versión.

## Rollback administrativo sin Codex

El panel prepara la solicitud del destino certificado y ofrece la búsqueda auxiliar después de una publicación. Si el código publicado tiene una regresión, volver a descargarlo no la corrige. Hace falta que una operación administrativa autorizada vuelva a publicar la estable exacta de `current`; después el panel puede buscar esa publicación. La estable inmediatamente anterior se conserva para el procedimiento administrativo, sin convertirse en el destino implícito ni reemplazar la última certificada.

Firebase Hosting conserva versiones y releases, y permite hacer rollback a una release anterior mientras siga retenida. Antes de considerar esta capacidad debe verificarse que la release retenida del sitio V2 corresponde al SHA/build estable, no sólo a una fecha o etiqueta visual. La [documentación oficial de releases y retención de Firebase Hosting](https://firebase.google.com/docs/hosting/manage-hosting-resources?hl=en) describe esa capacidad. Su disponibilidad técnica no abre una vía alternativa: el procedimiento único manual protegido sigue siendo la vía de publicación autorizada. Este panel no tiene una acción de consola ni una API de Hosting.

Para que el administrador pueda recuperar la publicación sin depender de Codex, el flujo protegido debe estar operable por una persona en GitHub: seleccionar el SHA completo autorizado, comprobar el destino V2 y aprobar el environment correspondiente. Este candidato no configura el workflow, environment, variable habilitadora ni credenciales. Los [controles de despliegue de GitHub Actions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) permiten que un job espere la aprobación de revisores del environment; esta aprobación se conserva además del inicio manual.

Una futura opción de solicitar y seguir el rollback desde una pantalla administrativa requeriría esta arquitectura externa, todavía no implementada:

- Un catálogo versionado que relacione cada SHA completo certificado, build, hash del artefacto oficial, ID de versión/release de Hosting, proyecto, sitio y aprobación. Cada referencia certificada es inmutable; registrar una nueva `current` conserva la anterior como `previous`. La certificación sólo ocurre después de QA, publicación controlada, validación física PC y Android/PWA y aprobación explícita.
- Un servicio administrativo autenticado, separado de los módulos de cartera, que compruebe en servidor la identidad, membresía activa y rol administrador, además de una autorización humana para el SHA/destino concretos. El navegador sólo solicita la operación; no recibe secretos de GitHub ni credenciales de despliegue.
- El único workflow manual protegido como ejecutor, con identidad de servidor de privilegios mínimos, destino fijo `mi-cartera-d0d8c` / `hosting:v2` / `mi-cartera-pro-v2`, control de concurrencia y aprobación del environment. El servicio registra y muestra el estado de la solicitud; no elude la aprobación ni abre otra vía automática de publicación.
- Un artefacto oficial verificado o una release retenida cuya identidad esté probada, verificación de la publicación resultante y registro administrativo de solicitante, autorización, SHA/build anterior y final. El trabajo se limita a Hosting V2 y no publica reglas, funciones, índices, V1 ni datos de Firestore.
- Un acceso administrativo fuera de la propia app V2, para que una regresión que impida iniciar sesión o abrir el panel no elimine la vía de recuperación. El flujo debe probarse con fixtures y un destino no productivo antes de habilitarlo.

Es una propuesta de infraestructura para una fase posterior. No existe en este candidato un endpoint de rollback ni automatización. **Restaurar última versión estable** prepara y copia la solicitud, sin fingir que cambia Hosting desde la PWA ni certificar una nueva estable.

## Pruebas focales

`node v2/tests/backup-recovery-safe.spec.js` ejecuta fixtures DOM sin datos reales. Cubre la retirada de UI/API V1, conservación del restore V2, identificación instalada/estable desde el catálogo, permisos sin fallback, confirmaciones, formularios pendientes, offline, cambios de sesión durante la consulta, errores de release, solicitud del worker y recarga independiente. También cubre la solicitud administrativa de última estable, cancelación, catálogo ausente/inválido, publicación reciente sin certificación, avance de `current` con conservación de `previous`, invalidación de solicitudes, cambio a otro administrador, cambio de organización sin nueva validación y copia sin endpoint de publicación. Los snapshots verifican que los datos locales, colas y tokens ficticios permanecen intactos.

La prueba inicial produjo nueve fallos esperados por la UI V1 y el módulo de recuperación ausente; el restore V2 existente pasó. La ampliación al catálogo y solicitud de última estable produjo seis fallos esperados antes de implementar esa semántica. La integración debe ejecutar la suite completa y su matriz de revisión antes de declarar el candidato apto. Este documento no afirma validación física PC/Android/PWA ni publicación.
