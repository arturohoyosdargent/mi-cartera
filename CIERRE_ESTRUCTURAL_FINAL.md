# CIERRE ESTRUCTURAL FINAL — Mi Cartera PRO V2

Fecha: 8 de octubre de 2026, America/Lima. Operación administrativa autorizada; sin publicación de aplicación.

## Resultado y referencias oficiales

Los controles administrativos autorizados quedaron aplicados. La rama remota `reengineering-v2-final` avanzó por fast-forward al candidato aprobado y pasó a ser la rama predeterminada. Se conservaron las 79 ramas y el contenido funcional del estable.

| Referencia | SHA exacto / valor | Resultado |
|---|---|---|
| Estable protegido | `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71` | Intacto y alcanzable desde final |
| Tag de rollback | `stable-rollback-v2-20261008-43a7afa` → `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71` | Intacto |
| Objeto del tag estable | `94a5eed8574ec3b1d1897f97e8cf1707a0abf9b6` | Sin cambios |
| Build estable y contenido funcional conservado | `v2-pilot-20261008-b2-socios-pwa-session-1` | No se generó ni publicó otro build |
| Candidato aprobado | `candidate-phase3-control-20261008` → `9004a7c91b29a21eee5f3ad2eb3c47e084a472e0` | Intacto |
| Final remota anterior | `1ed4f5d7632008a6523b35713e4edfd168e8ac96` | Ancestro directo del estable |
| Final remota actual | `9004a7c91b29a21eee5f3ad2eb3c47e084a472e0` | Exactamente el candidato aprobado |
| Main remota | `6df954437e39163c3a2989a9ed095b026c3e4e70` | Existente, intacta, sin merge ni cherry-pick |
| Rama predeterminada | `reengineering-v2-final` | Configuración aplicada |
| Árbol Git de V2, estable y candidato | `4f55732a8a508fae5398f972e9cacb281687630d` | Idéntico |

El compare remoto anterior-final → candidato demuestra **0 commits atrás y 3 adelante**; merge-base = `1ed4f5d7632008a6523b35713e4edfd168e8ac96`. El compare estable → candidato demuestra **0 atrás y 2 adelante**; merge-base = `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71`.

El movimiento autorizado se realizó mediante:

```http
PATCH /repos/arturohoyosdargent/mi-cartera/git/refs/heads/reengineering-v2-final
```

```json
{"sha":"9004a7c91b29a21eee5f3ad2eb3c47e084a472e0","force":false}
```

No hubo force-push, merge, cherry-pick ni movimiento de main. Todas las demás ramas conservaron exactamente sus SHA previos.

Referencias de revisión: [final](https://github.com/arturohoyosdargent/mi-cartera/tree/reengineering-v2-final), [estable](https://github.com/arturohoyosdargent/mi-cartera/tree/stable-rollback-v2-20261008-43a7afa), [comparación administrativa](https://github.com/arturohoyosdargent/mi-cartera/compare/43a7afa2ab629cdc7b4c7db9856dbd10eae61f71...9004a7c91b29a21eee5f3ad2eb3c47e084a472e0).

## Pages: estado efectivo y límites

- Sitio conservado: https://arturohoyosdargent.github.io/mi-cartera/.
- Sigue accesible: HTTP 200; `status=built`, `build_type=workflow`, fuente declarada `main:/`, HTTPS obligatorio, sin dominio personalizado.
- No se modificó `/pages`, su fuente, contenido, dominio ni despliegue. No se eliminó ni despublicó el sitio.
- SHA256 del HTML servido antes y después: `c929ab0bb84a50d0f0276c02d8d0e35a608a69194214f4fd761b82bc64443944`.
- Los registros de deployments permanecieron idénticos. No apareció ningún deployment nuevo.
- `353826731`, `dynamic/pages/pages-build-deployment`, sigue `active` como registro dinámico de plataforma. **No se intentó nuevamente deshabilitarlo** tras el 422 anterior.

La política administrativa de Actions cambió de `allowed_actions=all` a `selected`:

```json
{"enabled":true,"allowed_actions":"selected"}
```

```json
{
  "github_owned_allowed": false,
  "verified_allowed": false,
  "patterns_allowed": [
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "actions/upload-artifact@v4"
  ]
}
```

Aplicado mediante `PUT /repos/arturohoyosdargent/mi-cartera/actions/permissions` y `PUT .../actions/permissions/selected-actions`. Lectura posterior confirmó exactamente estos valores. `sha_pinning_required=false` se conservó; no se añadió una excepción general para acciones GitHub ni verificadas.

Quedan fuera de la lista los publicadores estándar de Pages: `actions/deploy-pages`, `actions/upload-pages-artifact`, `actions/configure-pages` y `actions/jekyll-build-pages`. `actions/upload-artifact@v4` sólo permite artefactos ordinarios de QA/paquete; no es el publicador de Pages.

Se protegieron los environments existentes `github-pages` y `v2-audit`:

| Control | github-pages | v2-audit |
|---|---|---|
| Revisor obligatorio | arturohoyosdargent, User ID `326856429` | Mismo revisor |
| `prevent_self_review` | `true` | `true` |
| `can_admins_bypass` | `false` | `false` |
| Política de ramas previa | Personalizada, sólo `main`; regla ID `59495930` intacta | `null`, sin política de ramas añadida |
| ID del environment | `21545232290`, conservado | `22170234158`, conservado |

No se añadieron secretos ni se ejecutaron jobs de Pages. La URL histórica permanece publicada, pero **Pages queda fuera de la vía oficial V2**.

Este cierre bloquea la reutilización accidental de los publicadores estándar y añade revisión a los entornos existentes. No equivale a desactivar el registro dinámico ni a eliminar Pages. No es una garantía contra un administrador que cambie deliberadamente políticas o introduzca un publicador propio por API. No se promete ese bloqueo absoluto.

## Workflows: estados finales exactos

| ID | Nombre / ruta | Estado efectivo |
|---|---|---|
| 362828975 | Deploy V2 Firebase Hosting — `.github/workflows/deploy-v2-firebase.yml` | `disabled_manually`; no se reactivó |
| 360791786 | V2 Audit QA (sin publicacion) — `.github/workflows/v2-audit-pages.yml` | `disabled_manually`; QA manual sin publicador Pages |
| 355181239 | QA Préstamo Ya — `.github/workflows/qa-predeploy.yml` | `disabled_manually` |
| 357176335 | Sincronizar loader de Préstamo Ya — `.github/workflows/sync-loader-version.yml` | `disabled_manually` |
| 367153907 | Fix Cloud Pull Persistence — `.github/workflows/fix-cloud-pull-persistence.yml` | `disabled_manually` |
| 366555713 | Repair only remaining V2 promise regression — `.github/workflows/hotfix-write-runtime.yml` | `deleted` en el registro de Actions, por ausencia del YAML en la nueva predeterminada; fuente histórica conservada |
| 369377695 | Fix stable6 syntax — `.github/workflows/fix-stable6-syntax.yml` | `deleted` en el registro de Actions, por ausencia del YAML en la nueva predeterminada; fuente histórica conservada |
| 353826731 | pages-build-deployment — `dynamic/pages/pages-build-deployment` | `active`; controles administrativos aplicados, sin intento de disable |
| 359733876 | V2 Greenfield QA — `.github/workflows/v2-greenfield-qa.yml` | `active`, restaurado tras pausa temporal; sin publicador |
| 360156158 | V2 Pilot Package — `.github/workflows/v2-pilot-package.yml` | `active`, restaurado tras pausa temporal; artefactos, sin publicador |

Los restantes workflows QA conservaron su estado `active`: `356651713`, `358315812`, `367152117`, `367166287` y `367169162`.

**Aclaración obligatoria:** los dos registros `deleted` dejaron de aparecer en el listado general al cambiar la rama predeterminada; se comprobaron por GET de sus IDs. Sus YAML ya estaban ausentes en el estable 43a7afa y en el candidato 9004a7c. Ambos permanecen intactos en main 6df9544. No se invocó DELETE, no se borraron archivos ni se reactivaron esos workflows. No se reconstruyeron para cambiar su etiqueta de estado. No debe describirse el resultado como «siete disabled_manually»: son cinco con ese estado y dos sin YAML en la nueva predeterminada. Una reintroducción histórica futura requerirá comprobar nuevamente su registro y permisos antes de cualquier movimiento autorizado.

## Incidencia de QA automático, sin publicación

Se pausaron y restauraron exclusivamente `359733876` y `360156158` durante el fast-forward, como estaba especificado. Aun así, GitHub creó dos ejecuciones `push` con retraso después de restaurarlos, para el SHA aprobado 9004a7c:

| Ejecución | Workflow | Resultado |
|---|---|---|
| [37861082770](https://github.com/arturohoyosdargent/mi-cartera/actions/runs/37861082770) | V2 Greenfield QA | `completed / success` |
| [37861082876](https://github.com/arturohoyosdargent/mi-cartera/actions/runs/37861082876) | V2 Pilot Package | `completed / success` |

No se hizo dispatch, rerun ni ejecución manual de las 61 suites. El supuesto de «cero ejecuciones automáticas de QA mediante una pausa breve» **no se cumplió**; se informa expresamente. No se modificaron los YAML para corregirlo en esta operación. No hubo ejecución de publicadores, despliegue ni modificación del sitio/datos. No se debe confiar en una pausa breve para garantizar cero runs ante un movimiento futuro.

## Única vía oficial de trabajo y publicación

**ESTABLE PROTEGIDO → reengineering-v2-final → desarrollo controlado → candidato por SHA completo → QA completo → autorización humana → único workflow Firebase manual → producción.**

- `main`, Pages, ramas históricas y carpetas/builds antiguos no son fuentes autorizadas de nueva producción V2.
- El único publicador previsto es `.github/workflows/deploy-v2-firebase.yml`, sólo `workflow_dispatch`, sin publicación por push/tag/PR/cron.
- Se conserva el gate del candidato: SHA completo, referencia de autorización que identifica ese SHA, ancestro estable, checkout exacto, destino aislado y QA obligatoria antes del job de producción.
- Destino único configurado: proyecto `mi-cartera-d0d8c`, target `hosting:v2`, site `mi-cartera-pro-v2`.
- El workflow continúa deshabilitado. `V2_PUBLISHING_ENABLED` no está habilitada; no se cambiaron variables ni secretos. `v2-production` continúa sin provisionar: el gate falla si no existe su política de revisores.
- La configuración protegida de `v2-production`, credenciales, variable habilitadora, activación del workflow y dispatch para un SHA concreto requieren autorización posterior de publicación. **Nada de eso se ejecutó ahora.**
- Firebase CLI local queda fuera del procedimiento ordinario. Sólo una autorización explícita de emergencia/rollback con SHA/build/destino podría habilitar esa vía.
- Cualquier trabajo funcional futuro debe conservar las implementaciones históricamente aprobadas y el punto de recuperación; QA/regresión verifica, no autoriza reconstrucciones.

Este informe actualiza el estado temporal descrito al cerrar Fase 3 en `docs/PUBLICATION_CONTROL.md` y `FASE3_RESULTADO.md`, sin reescribir esos documentos ni alterar el candidato aprobado.

## Verificaciones realizadas

| Comprobación | Resultado |
|---|---|
| SHA/tag/objeto del rollback exactos | PASS |
| Main existente y SHA exacto sin cambios | PASS |
| Descendencia y fast-forward sin force | PASS |
| Final exacta en candidato aprobado; default = final | PASS |
| Las otras 78 ramas conservaron su SHA; total 79 | PASS |
| Allowlist efectiva de Actions, protecciones y políticas de environments | PASS |
| Pages accesible, mismo HTML y registros de deployments | PASS |
| Ningún publicador reactivado o ejecutado; estados históricos explícitos | PASS |
| Gate administrativo, pruebas focales `publication-control.spec.cjs` | PASS: 9/9 |
| Árbol V2 y todos los archivos funcionales idénticos al estable | PASS |
| Objetivo auxiliar de cero runs automáticos de QA/paquete | FAIL: dos runs automáticos, ambos success; sin deploy |
| Cero deploy, cero Firebase CLI, cero cambios Firestore/datos reales | PASS |

No se repitió manualmente la regresión completa de 61 suites: no cambió ningún archivo funcional. Las verificaciones fueron administrativas, de referencias, hashes, estados y nueve pruebas focales del control de publicación. Las 61 suites/134 JS previamente aceptadas siguen siendo evidencia de Fase 3, no se presentan como una nueva ejecución local de este cierre.

Los únicos siete archivos diferentes del estable en la rama final siguen siendo:

1. `.github/scripts/publication-control.cjs`
2. `.github/scripts/publication-control.spec.cjs`
3. `.github/workflows/deploy-v2-firebase.yml`
4. `.github/workflows/v2-audit-pages.yml`
5. `AGENTS.md`
6. `FASE3_RESULTADO.md`
7. `docs/PUBLICATION_CONTROL.md`

En esta operación no se modificó ninguno de esos archivos ni ningún archivo funcional. El único archivo Git nuevo de entrega es este informe, en un commit/tag documental aislado, sin avanzar nuevamente final.

## Historia y dependencias conservadas deliberadamente

Se conservaron todas las ramas: A=2, B=27, C=32, D=6, E=12, según el [inventario Fase 2](https://github.com/arturohoyosdargent/mi-cartera/blob/informe-fase2-20261008/FASE2_INFORME_FINAL.md). Sólo final cambió por el fast-forward autorizado; no se eliminó ninguna rama C/D/E ni se movieron las demás.

Las seis D siguen existentes con sus SHA previos:

| Rama | SHA conservado |
|---|---|
| hotfix/v2-localecompare-complete-20261007 | `d17f3e204313a6f6d0011a948be4880fb3ea7430` |
| hotfix/v2-payment-receipt-preview-20261006 | `adb5bb37b2c589a8f010fba682a1da19d5883654` |
| reengineering-v2-integrated | `2fbaa98231c6505ce2b6a5919b3bf7d43749f7f8` |
| reengineering-v2-ui | `10f384c242e8c72fa14e2666acd885c534260b17` |
| repair-audit-2026-09-15 | `95a51b6fa46b1cafe422fd7697ca960a4047ceb5` |
| v2-pilot-deploy | `7f070c6ab88bb82c08bd11ae0dd314ca789f2a57` |

`reengineering-v2-integrated` mantiene dependencia CI. V1 y sus dependencias, `credit-share.js`, `firestore.rules`, `functions/`, `sw.js`, `firebase-cloud.js`, backups, tags y fuentes históricas permanecen intactos. No se eliminaron ni bloquearon dependencias E por esta operación.

## Rollback administrativo documentado

La configuración anterior quedó registrada antes de actuar. Su restauración requiere autorización expresa; no se ejecuta automáticamente ni modifica la aplicación:

1. Restaurar Actions mediante `PUT .../actions/permissions` con `{"enabled":true,"allowed_actions":"all"}`. La configuración seleccionada deja de ser la política efectiva.
2. Restaurar `github-pages` y `v2-audit` mediante sus PUT de environments, con `reviewers=[]`, `prevent_self_review=false`, `can_admins_bypass=true`, `wait_timer=0`; conservar `github-pages` con su política personalizada y regla `main` ID 59495930, y `v2-audit` con `deployment_branch_policy=null`.
3. El sitio Pages ya está conservado: no necesita borrado, recreación ni deploy para revertir estos controles administrativos.
4. Un eventual retorno de la rama predeterminada a main sería otro cambio administrativo autorizado. No se propone retroceder final ni realizar force-push.
5. El rollback funcional exacto sigue identificado por `stable-rollback-v2-20261008-43a7afa`, commit `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71`, build `v2-pilot-20261008-b2-socios-pwa-session-1`. No se publicó ni se ejecutó rollback ahora.

## Entrega documental y detención

Ruta GitHub: `CIERRE_ESTRUCTURAL_FINAL.md`, bajo el tag documental `cierre-estructural-final-20261008`. Este tag se publica separado de las ramas, con un commit documental hijo de 9004a7c cuyo único cambio es añadir este archivo. Final continúa exactamente en el candidato aprobado. No se crea Release, PR ni deployment por la entrega documental.

Confirmaciones: **cero deploy; cero Firebase CLI; cero cambios de Firebase Hosting/Firestore/datos reales; cero cambios funcionales; estable y tag intactos; main intacta; ninguna eliminación de historia.**

La operación se detiene aquí. No se inició el siguiente trabajo funcional: **RECORDATORIO WHATSAPP = IMAGEN GRÁFICA EXISTENTE + TEXTO EDITABLE**. Será un proceso separado y deberá reutilizar la implementación gráfica aprobada.
