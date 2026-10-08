# FASE 3 — RESULTADO DEL SANEAMIENTO ESTRUCTURAL CONTROLADO

Fecha: 2026-10-08. Fuente: [FASE2_INFORME_FINAL.md](https://github.com/arturohoyosdargent/mi-cartera/blob/informe-fase2-20261008/FASE2_INFORME_FINAL.md). Autorización: orden original de Fase 3 y continuación que conserva los bloqueos ejecutados.

**Candidato estructural: 8bae92054642dd42621bb736783c5823056aee5d.** Padre directo: 43a7afa2ab629cdc7b4c7db9856dbd10eae61f71. Rama local nueva: candidate/phase3-control-20261008. La entrega añade este informe en un commit exclusivamente documental, hijo de ese candidato. Su SHA exacto se obtiene del tag remoto nuevo **candidate-phase3-control-20261008**; el commit de controles probado sigue siendo el indicado arriba, sin cambios posteriores de implementación.

**Resultado:** QA técnico PASS; preservación funcional PASS. Control estructural preparado para revisión, todavía deshabilitado y sin integrar. **No se declara cerrada ni deshabilitada la entrada dinámica de plataforma Pages 353826731.** No existe autorización de deploy. No se elimina ninguna rama ni V1.

## 1. Estable y referencias intactas

- SHA estable: 43a7afa2ab629cdc7b4c7db9856dbd10eae61f71.
- Tag: stable-rollback-v2-20261008-43a7afa; objeto anotado 94a5eed8574ec3b1d1897f97e8cf1707a0abf9b6.
- Build: v2-pilot-20261008-b2-socios-pwa-session-1.
- Árbol completo estable: 5ead03727fb52cd21ec9b43f8686527f4ebcbabc.
- Subárbol V2 idéntico en estable y candidato: **4f55732a8a508fae5398f972e9cacb281687630d**.
- Las 79 ramas remotas conservan exactamente los SHA de entrada. No se movieron ni borraron ramas existentes.
- main conserva 6df954437e39163c3a2989a9ed095b026c3e4e70; rama predeterminada main intacta.
- reengineering-v2-final remota conserva 1ed4f5d7632008a6523b35713e4edfd168e8ac96; checkout original local conserva 43a7afa.
- Tags estables, informe Fase 2 y backups oficiales se conservan. No merge, cherry-pick, rollback ni sustitución de módulos.

## 2. Archivos realmente modificados

En el candidato de controles, seis archivos:

1. .github/workflows/deploy-v2-firebase.yml — convertir a publicador Firebase exclusivamente manual y cerrado.
2. .github/workflows/v2-audit-pages.yml — retirar toda capacidad Pages y conservar QA manual.
3. .github/scripts/publication-control.cjs — controles administrativos de solicitud, policy, destino, SHA y QA.
4. .github/scripts/publication-control.spec.cjs — nueve pruebas de los controles administrativos.
5. AGENTS.md — procedimiento obligatorio de fuente/publicación y conservación de funciones/historia.
6. docs/PUBLICATION_CONTROL.md — fuente única propuesta, controles y pasos todavía no habilitados.

Commit de entrega documental: única adición **FASE3_RESULTADO.md**. Total de entrega contra estable: dos workflows modificados y cinco archivos administrativos/documentales nuevos. Ningún archivo de aplicación, V1/E, backend, reglas, configuración Firebase o Service Worker cambió. Archivos auxiliares/evidencias de trabajo permanecen fuera del candidato.

## 3. Workflows deshabilitados, sin ejecutarlos

| ID | Ruta exacta | Estado confirmado |
|---|---|---|
| 362828975 | .github/workflows/deploy-v2-firebase.yml | disabled_manually |
| 360791786 | .github/workflows/v2-audit-pages.yml | disabled_manually |
| 366555713 | .github/workflows/hotfix-write-runtime.yml | disabled_manually |
| 369377695 | .github/workflows/fix-stable6-syntax.yml | disabled_manually |
| 355181239 | .github/workflows/qa-predeploy.yml | disabled_manually |
| 357176335 | .github/workflows/sync-loader-version.yml | disabled_manually |
| 367153907 | .github/workflows/fix-cloud-pull-persistence.yml | disabled_manually |

Discrepancia resuelta: los IDs 366555713/369377695 del pedido correspondían realmente a hotfix-write-runtime.yml/fix-stable6-syntax.yml. Los nombres qa-predeploy.yml/sync-loader-version.yml tienen IDs 355181239/357176335. Se bloquearon conservadoramente los cuatro mutadores, además de los dos publicadores y el mutador E.

Se usó exclusivamente la API de deshabilitación y lectura de estado. No se ejecutó workflow_dispatch, rerun, deploy, ejecución de los scripts mutadores ni modificación de sus definiciones históricas.

## 4. Decisión individual sobre los seis Actions E

| ID / archivo | Trigger y ramas comprobados | Capacidad / dependencia | Decisión y estado |
|---|---|---|---|
| 356651713 / qa-commercial.yml | push commercial-v1; workflow_dispatch | contents:read; sintaxis, lecturas, aserciones, VM y localStorage simulado. Dos tests recuperados en f004d66e1f46cac674ad0d380d101942de1d0a22. Sin escritura persistente, publicación o artifact de producción. | CONSERVADO active como QA de lectura |
| 367152117 / qa-cloud-pull-persistence.yml | push v2-prueba-avance-25sep; PR hacia main; manual | Permisos heredados read. Test en 9371b025e95a5df8df9d4f2b42442162a0b4c428 lee contrato textual, sin ejecutar Cloud real. | CONSERVADO active como QA de lectura |
| 367153907 / fix-cloud-pull-persistence.yml | push v2-prueba-avance-25sep; filtro del propio YAML | contents:write. Python escribe firebase-cloud-core.js; git add/commit/push a la rama histórica. Definición recuperada en 28d72fdd923be59e63b16481a3806430f2bed363. | DESHABILITADO disabled_manually |
| 367166287 / qa-financial-integrity.yml | PR hacia main, filtros fuente/test/YAML; manual | Permisos heredados read. VM y datos sintéticos; test comprueba report-only. Fuente/test en 9371b025e95a5df8df9d4f2b42442162a0b4c428. | CONSERVADO active como QA de lectura |
| 367169162 / qa-payment-safety.yml | PR hacia main, filtros fuente/test/YAML; manual | Permisos heredados read. VM con crédito ficticio, DOM/registro/toasts simulados. Fuente/test en 9371b025e95a5df8df9d4f2b42442162a0b4c428. | CONSERVADO active como QA de lectura |
| 353826731 / dynamic/pages/pages-build-deployment | evento histórico dynamic, main; sin YAML local recuperable | Workflow administrado por plataforma con capacidad de hosting Pages. Permisos/comandos internos no expuestos por YAML. | **NO DESHABILITADO:** API devolvió 422 Unable to disable this workflow |

La política actual del GITHUB_TOKEN es default_workflow_permissions=read y can_approve_pull_request_reviews=false. Se examinaron cinco tests invocados por los cuatro QA antes de conservarlos; usan lecturas/aserciones/fixtures, no HTTP real, comandos Git, deploy, escrituras persistentes ni artifact de producción.

**Limitación Pages:** el registro dinámico sigue active. La configuración actual es build_type=workflow, source main:/, sitio https://arturohoyosdargent.github.io/mi-cartera/. El publicador de repositorio V2 Audit Pages está deshabilitado; su candidato pierde también la capacidad de publicación en código. Esto no demuestra que el registro dinámico esté deshabilitado ni elimina el sitio ya servido. No se forzó el bloqueo, no se cambió la configuración ni se retiró el sitio. Cualquier cierre adicional debe decidirse y autorizarse separadamente.

## 5. Estado de las seis ramas D — ninguna eliminada

| Rama | SHA remoto exacto | Commits exclusivos frente al estable | PR abiertos | Dependencia / conclusión |
|---|---|---:|---:|---|
| hotfix/v2-localecompare-complete-20261007 | d17f3e204313a6f6d0011a948be4880fb3ea7430 | 0 | 0 | Sin consumidor ejecutable localizado en ámbitos revisados; consumidores externos no acreditados completamente. No autorizada eliminación. |
| hotfix/v2-payment-receipt-preview-20261006 | adb5bb37b2c589a8f010fba682a1da19d5883654 | 0 | 0 | Sin consumidor ejecutable localizado en ámbitos revisados; consumidores externos no acreditados completamente. No autorizada eliminación. |
| reengineering-v2-integrated | 2fbaa98231c6505ce2b6a5919b3bf7d43749f7f8 | 0 | 0 | Dependencia ejecutable: filtro v2-greenfield-qa en estable y main. NO apta para eliminación. |
| reengineering-v2-ui | 10f384c242e8c72fa14e2666acd885c534260b17 | 0 | 0 | Sin consumidor ejecutable localizado en ámbitos revisados; consumidores externos no acreditados completamente. No autorizada eliminación. |
| repair-audit-2026-09-15 | 95a51b6fa46b1cafe422fd7697ca960a4047ceb5 | 0 | 0 | Sin consumidor ejecutable localizado en ámbitos revisados; consumidores externos no acreditados completamente. No autorizada eliminación. |
| v2-pilot-deploy | 7f070c6ab88bb82c08bd11ae0dd314ca789f2a57 | 0 | 0 | Sin consumidor ejecutable localizado en ámbitos revisados; consumidores externos no acreditados completamente. No autorizada eliminación. |

Las seis comparaciones GitHub fueron behind y ahead_by=0: todos esos commits son alcanzables desde el tag estable protegido. Las seis pueden recuperarse exactamente desde ese tag por el SHA indicado. La consulta de webhooks del repositorio devolvió cero.

Búsqueda de nombres: fuentes del estable, main y scripts/workflows disponibles. Se localizó reengineering-v2-integrated en .github/workflows/v2-greenfield-qa.yml tanto en el estable como en main. Las alusiones documentales/históricas no equivalen por sí mismas a consumidores ejecutables.

**No pasan las seis el conjunto de condiciones para etiquetarlas ELIMINACIÓN SEGURA PENDIENTE DE AUTORIZACIÓN FINAL:** hay una dependencia CI explícita y no puede acreditarse globalmente la ausencia de consumidores externos no registrados en GitHub. Se conservan todas hasta revisión individual/autorización final; no se borra ni mueve ninguna. Las 32 C y 12 E siguen preservadas y conceptualmente bloqueadas como fuentes mediante AGENTS.md y PUBLICATION_CONTROL.md; no se crearon archivos históricos ni se modificaron sus SHA.

## 6. Arquitectura de publicación preparada, todavía cerrada

ESTABLE PROTEGIDO → DESARROLLO V2 CONTROLADO → CANDIDATO POR SHA → QA COMPLETO → AUTORIZACIÓN EXPLÍCITA → ÚNICO PUBLICADOR FIREBASE MANUAL → PRODUCCIÓN.

El workflow Firebase exige:

- workflow_dispatch únicamente; ningún push/tag/PR/cron/workflow_run publica.
- SHA exacto de 40 caracteres, contexto del repositorio y rama controlada reengineering-v2-final.
- Referencia de autorización que contenga ese SHA y variable V2_PUBLISHING_ENABLED explícitamente true. La referencia no sustituye la revisión humana.
- Checkout separado del control de workflow en github.workflow_sha y del código aprobado por SHA. No se usa main como base.
- HEAD exacto, ancestro estable, .firebaserc/firebase.v2.json intactos respecto del estable y destino aislado.
- Todas las suites y sintaxis V2; cualquier prueba fallida o interrumpida impide deploy.
- Environment v2-production ya existente con revisores obligatorios, comprobado ANTES de ejecutar código de tests del candidato. Ausencia/fallo de lectura de la política bloquea publicación.
- Job de producción separado, con aprobación humana del environment, revalidación de solicitud/policy y checkout fresco del MISMO SHA.
- Concurrencia única mi-cartera-pro-v2-production, sin cancelar otro deploy en curso.
- Firebase CLI fijada a 15.30.1, basada en el paquete local instalado; secreto sólo expuesto en el paso final. No se incorporó ninguna credencial.

La revisión independiente detectó que la policy estaba después del código de tests del candidato: se corrigió en una sola pasada administrativa. La prueba focal falló antes y pasa después; además se comprueba que QA no haya modificado el checkout de controles confiables. No se cambió ninguna función de la aplicación.

Pages conserva únicamente QA manual y contents:read: sin pages:write, id-token:write, deploy-pages, upload-pages-artifact, copia _site ni job de publicación.

**Firebase CLI local permanece instalada y expresamente fuera del procedimiento ordinario.** Sólo una orden humana explícita de emergencia/rollback puede autorizarla. No se usó como alternativa ni se ejecutó en esta fase.

## 7. QA y preservación

| Verificación | Resultado |
|---|---|
| Suites V2 completas | **61/61 PASS**, cero fallos, ejecutadas una vez sobre el contenido V2 intacto |
| Sintaxis JS V2 | **134/134 PASS** |
| Pruebas de control administrativo | **9/9 PASS** (RED antes de implementación, GREEN final) |
| Regresión focal de policy previa y detección de controles alterados | **PASS** (RED→GREEN tras revisión) |
| Sintaxis CJS de controles | **2/2 PASS** |
| YAML y condiciones de workflows | **2/2 PASS**, parser YAML; manual-only, mismo SHA, QA previa, environment, concurrencia y Pages sin publicación |
| Archivos funcionales contra 43a7afa | **PASS: cero diferencias** fuera de workflows/administración/documentación autorizados |
| Árbol completo v2 contra estable | **PASS: hash Git idéntico 4f55732a8a508fae5398f972e9cacb281687630d** |
| Ramas remotas existentes y rama predeterminada | **PASS: 79 SHA y main preservados** |
| Workflow dinámico Pages deshabilitado | **NO / BLOQUEADO por API422**; no se certifica cierre |
| Ausencia global de consumidores externos para seis D | **NO DETERMINADA**, sin eliminación |
| Ejecución real del nuevo publicador/aprobación de producción | **NO EJECUTADA**; deliberadamente deshabilitado, sin variables/creds/policy habilitadas por esta fase |

Runtime local: v24.21.0. Regresión con fixtures, DOM PC/móvil, Cloud y persistencia simulados; sin login/lectura/escritura de datos reales. Cubierta la matriz protegida por las suites existentes: Inicio, Clientes, Créditos, Cobranza, pagos normal/libre/múltiples y duplicados, comprobante/cuotas/WhatsApp, recordatorios, renovaciones, Socios, Gestores/Rutas, Caja, búsquedas, sincronización simulada, offline/reconexión, build/PWA y reapertura. No se afirma nueva validación física de dispositivos ni sincronización real; la validación física previa del estable sigue siendo la referencia y su aplicación no cambió.

Las únicas ediciones después de la regresión funcional fueron ajustes administrativos de policy/documentación, comprobados con pruebas focales y comparación del árbol funcional idéntico; no se repitió innecesariamente el diagnóstico o la regresión de aplicación.

Suites ejecutadas:

- v2/tests/access-audit.spec.js: PASS
- v2/tests/auth-cloud-gate.spec.js: PASS
- v2/tests/client-import.spec.js: PASS
- v2/tests/credit-proposal-share.spec.js: PASS
- v2/tests/extra-installment.spec.js: PASS
- v2/tests/firestore-v2-rules.spec.js: PASS
- v2/tests/inactive-credit-actions.spec.js: PASS
- v2/tests/offline-operation-queue.spec.js: PASS
- v2/tests/operational-card-installment-state.spec.js: PASS
- v2/tests/partner-agenda-ui.spec.js: PASS
- v2/tests/partner-financial-integration.spec.js: PASS
- v2/tests/partners.spec.js: PASS
- v2/tests/pilot-runtime-consistency.spec.js: PASS
- v2/tests/renewal-confirmation-consistency.spec.js: PASS
- v2/tests/shadow-plan.spec.js: PASS
- v2/tests/transaction-store.spec.js: PASS
- v2/tests/agenda-capital-ui.spec.js: PASS
- v2/tests/cash-range-consistency.spec.js: PASS
- v2/tests/cloud-pilot-runtime.spec.js: PASS
- v2/tests/credit-schedule-regression.spec.js: PASS
- v2/tests/financial-engine.spec.js: PASS
- v2/tests/functional-parity.spec.js: PASS
- v2/tests/integrated-branch-smoke.spec.js: PASS
- v2/tests/offline-operational-integration.spec.js: PASS
- v2/tests/operational-rbac.spec.js: PASS
- v2/tests/partner-agenda.spec.js: PASS
- v2/tests/partner-interest-agenda.spec.js: PASS
- v2/tests/payment-installment-consistency.spec.js: PASS
- v2/tests/portfolio-search-history.spec.js: PASS
- v2/tests/report-installment-splits.spec.js: PASS
- v2/tests/share-preview-refresh.spec.js: PASS
- v2/tests/app-functional-regression.spec.js: PASS
- v2/tests/client-credit-ux.spec.js: PASS
- v2/tests/cloud-rehydration.spec.js: PASS
- v2/tests/date-utils.spec.js: PASS
- v2/tests/firestore-integrated-isolation.spec.js: PASS
- v2/tests/historical-sharing-recovery.spec.js: PASS
- v2/tests/legacy-audit.spec.js: PASS
- v2/tests/opening-credit-validator.spec.js: PASS
- v2/tests/operational-sync-reconnect.spec.js: PASS
- v2/tests/partner-balance-refresh.spec.js: PASS
- v2/tests/partner-pwa-session-recovery.spec.js: PASS
- v2/tests/payment-receipt-share-regression.spec.js: PASS
- v2/tests/preflight.spec.js: PASS
- v2/tests/runtime-retry.spec.js: PASS
- v2/tests/sharing-experience.spec.js: PASS
- v2/tests/app-shell.spec.js: PASS
- v2/tests/client-edit-overdue.spec.js: PASS
- v2/tests/controller-durable-commit.spec.js: PASS
- v2/tests/end-to-end-safety.spec.js: PASS
- v2/tests/firestore-operational-paths.spec.js: PASS
- v2/tests/history-sync-rerender.spec.js: PASS
- v2/tests/manager-management.spec.js: PASS
- v2/tests/operation-commit-gate.spec.js: PASS
- v2/tests/operational-sync.spec.js: PASS
- v2/tests/partner-balance.spec.js: PASS
- v2/tests/partner-session-cutoff.spec.js: PASS
- v2/tests/pilot-config.spec.js: PASS
- v2/tests/receipt-installment-identity.spec.js: PASS
- v2/tests/schedule-engine.spec.js: PASS
- v2/tests/sync-errors.spec.js: PASS

## 8. Acciones que NO se ejecutaron

- **CERO deploy; CERO publicación de aplicación; CERO ejecución/rerun de workflows.** Se sube sólo una referencia Git nueva de revisión.
- **CERO cambios Firebase Hosting, Firestore, Auth, credenciales, datos reales o configuración desplegada.** No se invocó Firebase CLI.
- No borrar ramas, V1, credit-share.js, firestore.rules, functions/, sw.js, firebase-cloud.js ni sus dependencias.
- No alterar módulos financieros, pagos, comprobantes, renovación, Socios, gestores/rutas, Caja, sincronización, WhatsApp ni recordatorios.
- No mover main/default/final remota, estable, backups ni tags existentes.
- No ejecutar los mutadores ni la limpieza D1–D4/inventario anterior.

## 9. Pendientes y siguiente acción exacta recomendada

**Primero:** revisar externamente el tag candidate-phase3-control-20261008 y este informe, confirmar su SHA de entrega y la preservación del estable. No ejecutar deploy ni habilitar workflows/credenciales.

**Después, sólo con nueva autorización administrativa:** resolver el cierre del Pages dinámico/sitio secundario y decidir cómo hacer disponible el workflow manual desde la rama predeterminada sin tomar main como fuente ni mezclar historia. La integración del candidato, el environment de revisión obligatoria, la variable habilitadora, la credencial y la reactivación del único publicador son pasos pendientes; ninguno se realizó aquí. El punto de recuperación seguirá intacto.

Las ramas D requieren cerrar sus consumidores y autorización final individual; C/E y la cadena V1 permanecen preservadas. WhatsApp/recordatorios y cualquier mejora funcional siguen fuera de esta fase.

**Trabajo detenido tras entregar el candidato de control para revisión.**
