# Control de publicación de Mi Cartera PRO V2

Este documento es administrativo. No autoriza deploy, modificación de datos ni cambios funcionales.

## Fuente de verdad

Última estable certificada según `docs/VERSIONING_POLICY.md` (con su inmediatamente anterior conservada)
→ desarrollo V2 controlado
→ candidato identificado por SHA completo
→ todas las suites técnicas y matriz PC/móvil/PWA
→ autorización explícita para ese SHA
→ único workflow Firebase manual
→ producción V2
→ validación física PC y Android/PWA
→ aprobación explícita y promoción a nueva estable.

La referencia histórica `stable-rollback-v2-20261008-43a7afa` (`43a7afa2ab629cdc7b4c7db9856dbd10eae61f71`) conserva el build `v2-pilot-20261008-b2-socios-pwa-session-1` y sus copias oficiales. Nunca moverla ni sustituir su contenido. El desarrollo conserva las mejoras aprobadas de la línea más reciente; no vuelve automáticamente a esta referencia antigua. Los controles de ascendencia histórica no eligen el destino de rollback.

`main` tiene función administrativa/histórica, no es fuente de producción V2. Las 32 ramas C y 12 E del [FASE2_INFORME_FINAL.md](https://github.com/arturohoyosdargent/mi-cartera/blob/informe-fase2-20261008/FASE2_INFORME_FINAL.md) no son bases autorizadas para nuevas implementaciones. Permanecen intactas hasta archivo verificado y autorización individual. Las seis D no se eliminan en esta fase.

## Único publicador propuesto

`.github/workflows/deploy-v2-firebase.yml`:

- Sólo `workflow_dispatch`, sin push, tags, PR, cron ni encadenamiento automático.
- Se inicia desde la línea controlada `reengineering-v2-final`, nunca desde main, tags ni ramas históricas.
- SHA completo, inmutable, sin nombres simbólicos; autorización registrada que identifica el mismo SHA.
- Variable `V2_PUBLISHING_ENABLED` debe estar explícitamente en `true`; su ausencia cierra el procedimiento.
- Control se toma del SHA que define el workflow; código se toma del SHA aprobado, en directorios separados.
- Se verifica HEAD, ancestro estable, configuración aislada y destino único `mi-cartera-d0d8c` / `hosting:v2` / `mi-cartera-pro-v2`.
- Se ejecutan todas las `v2/tests/*.spec.js`, incluida regresión DOM PC/móvil, y sintaxis de todos los JS V2. Cualquier fallo/interrupción impide el job de deploy.
- Antes del job de producción se exige que `v2-production` ya tenga revisores obligatorios. Sin ese environment protegido el control falla. No se crea un environment sin protección como alternativa.
- El job de producción espera aprobación humana del environment y vuelve a validar el SHA de checkout y destino. Una sola concurrencia `mi-cartera-pro-v2-production`, sin cancelación de otra publicación en curso.
- Firebase CLI dentro de ese workflow fija versión `15.30.1`, tomada del paquete local ya instalado. El comando sólo despliega Hosting V2.

La referencia de autorización incluida como input sirve de registro; **no sustituye la aprobación humana obligatoria** del environment. Las pruebas técnicas tampoco sustituyen validaciones físicas de cambios funcionales futuros.

## Registro histórico del cierre estructural

Los siguientes párrafos describen el estado original de la Fase 3, anterior al cierre posterior y la publicación autorizada de WhatsApp/comprobantes. No son instrucciones para revertir la configuración actual. Consultar `CIERRE_ESTRUCTURAL_FINAL.md` y el registro de cada publicación para el estado administrativo posterior. En este candidato no se modifican workflows, ramas administrativas ni configuración remota.

En el cierre original los publicadores quedaron deshabilitados en GitHub. El candidato se subió sólo a un tag nuevo para revisión, sin integración en main/final ni ejecución.

No se cambia la rama predeterminada ni se resuelve todavía `workflow_dispatch` (el workflow debe estar en la rama predeterminada según GitHub). No se configura el environment de producción, la variable habilitadora, credenciales ni `FIREBASE_TOKEN`. Esos pasos requieren autorización posterior, después de revisar este candidato y definir la integración administrativa.

## Pages y vías históricas

`.github/workflows/v2-audit-pages.yml` conserva sólo QA manual, con `contents: read`; no Pages, OIDC, copia de sitio ni artifact de producción.

El workflow de plataforma `dynamic/pages/pages-build-deployment` (353826731) no admite desactivación API: respuesta 422. Pages actualmente usa `build_type=workflow` y su publicador de repositorio está deshabilitado. No se afirma que el registro dinámico esté deshabilitado; cualquier cierre adicional requiere decisión administrativa posterior, sin alterar el sitio por cuenta propia.

Los mutadores históricos permanecen definidos pero deshabilitados. No usarlos para reconstruir ni integrar V2.

## Firebase CLI fuera del procedimiento ordinario

La herramienta instalada se conserva. Ninguna publicación manual local mediante Firebase CLI queda autorizada por el procedimiento ordinario, ni como alternativa si falla el workflow. Sólo una orden humana explícita de emergencia/rollback, que identifique SHA/build/destino, puede autorizar esa vía. No reutilizar carpetas de deploy históricas ni mezclar archivos.

## Regresión y recuperación

La matriz completa incluye Inicio, Clientes, Créditos, Cobranza, pagos normales/libres/múltiples, deduplicación, comprobante gráfico/WhatsApp, identificación de cuotas, recordatorios, ambas renovaciones, Socios, Gestores/Rutas, Caja/Balance, búsqueda, sincronización simulada PC↔Android, PWA/offline/reconexión y persistencia. Pruebas locales usan fixtures; las validaciones reales PC/Android se hacen tras autorización de la publicación correspondiente.

Una regresión se informa antes de modificar más código. No autoriza reimplementar funciones protegidas. Se corrige primero sobre la versión más reciente; un rollback imprescindible usa la estable inmediatamente anterior según `docs/VERSIONING_POLICY.md`, con tag remoto y artefacto exacto conservados. El tag histórico de 43a7afa permanece intacto como respaldo adicional, sin convertirse en destino fijo.

Referencia técnica de GitHub: [workflow SHA y contextos](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts), [dispatch manual y rama predeterminada](https://docs.github.com/es/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
