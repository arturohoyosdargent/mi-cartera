# Continuidad del candidato — validación aislada, 15/10/2026

Rama: candidate/continuation-20261015. HEAD: 7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5. Sin commits, push, publicación ni cambios de datos reales.

## Avance confirmado

Se conservaron los 346 archivos del manifiesto de continuidad anterior: 346/346 SHA256 idénticos. No se repitieron las 102 suites históricas, sus 449 casos ni las 15 verificaciones Android del 13/10. Sus resultados permanecen históricos, sin recertificación física nueva.

Las incorporaciones de esta continuación están en tools/isolated-qa, tools/isolated-integration y tools/financial-audit. No se modificaron nuevamente motores, configuración Firebase productiva, reglas ni Functions operativas. El entorno ejecuta una copia externa con overlays de ensayo.

## Nuevas comprobaciones

- Auth real de emulador y callable de Functions: dos envíos simultáneos crean un solo cobro; el reintento tras reasignar ruta devuelve el resultado canónico y la membresía revocada rechaza acceso.
- SDK oficial Firebase10.14.1 y reglas reales del candidato: recuperación fría de cola por el mismo propietario, envío único, segundo flush sin repetición, dos clientes independientes y cierres administrativos preservados.
- SDK/reglas: un cobrador no puede leer un crédito fuera de su ruta; un administrador revocado recibe rechazo.
- Socios: interés100, devolución400, principal restante600; dos egresos canónicos. Reabrir/copiar el comprobante desde historial no modifica documentos financieros en la prueba integrada.
- Arranque completo con módulos reales y límites externos simulados: sesión confirmada, hidratación, transporte configurado y cliente visible sin escrituras.
- Navegador del PC: SDK web local + Auth/Firestore/Functions locales, sesión autorizada, datos recuperados y NUBE CONECTADA. Caja ficticia900 al inicio; interés100 y devolución400 dejan caja400 y deuda600. Recarga fría conserva cifras; historial reutiliza los códigos. Comprobantes de intereses y capital renderizados con canvas real y captura.

Suites nuevas: laboratorio4/4, preparación3/3, rollback6/6, auditor financiero9/9, arranque1/1 e integración emulada4/4, más regresión de detención1/1: 28/28. Sintaxis de16 archivosJS/CJS aprobada. Las verificaciones de integración usan cuentas y datos ficticios; no certifican servicios cloud productivos ni Android físico.

## Fallos resueltos del entorno y auditor

Firestore1.22.0 con Java21 y locale es_PE lanzaba MissingResourceException al evaluar consultas de listas. Se fuerza -Duser.language=en y -Duser.country=US sólo para ese proceso; las siete colecciones del shell ya responden por SDK y el PC recupera datos. No se alteraron reglas para evitar el error.

El adaptador REST inicial del test tropezó con BYTE_STRING del emulador. Se sustituyó por el SDK oficial; los objetos que cruzan el VM del fixture se normalizan por JSON. Es una corrección de las herramientas, no del formato de datos operativo.

El auditor puro distingue colecciones ausentes de colecciones vacías; detecta IDs duplicados, diarios inválidos, vínculos faltantes y egresos de socios sin apunte. No convierte información desconocida en rentabilidad cero. No ejecuta colas ni modifica snapshots.

## Panel financiero

Se conserva docs/FINANCIAL_HEALTH_DESIGN_20261015.md. Auditor de cobertura implementado, con pruebas y ejemplo ficticio. Rentabilidad definitiva y liquidez conciliada siguen NO_DISPONIBLE: faltan cobertura histórica comprobada, saldos de apertura/cuentas físicas y política de reconocimiento/costos. No se auditó producción ni se implementó una cifra de utilidad supuesta.

## Rollback y límites

El preflight local de sólo lectura apunta a7b53fc1 y bloquea pendientes, errores, conflictos, estados/scope desconocidos o JSON inválido. Conserva cierres sin reenviarlos. No certifica compatibilidad completa del backend y nunca autoriza rollback automático. Un rollback de código no revierte datos financieros.

Respaldo de aplicación7b53fc1 preservado: SHA256 adfd3a5ca621e87fafb2737970bf934a379bd047a340a84f457496c041ecbb78. Tag histórico inmutable stable-rollback-v2-20261008-43a7afa sigue apuntando al commit43a7afa2ab629cdc7b4c7db9856dbd10eae61f71.

Pendientes: Android físico y navegador habitual del usuario; compartir/descargar PNG y portapapeles reales; apertura/reenvío de WhatsApp al propio número; comportamiento del rollback sobre backend completo y runtime Node20 de producción (el ensayo usa Node24); auditoría histórica real y arquitectura comercial con bases independientes. El transporte actual sigue limitado al piloto: no ofrecerlo todavía como multiempresa comercial terminado.

La guía de tools/isolated-qa/README.md y el informe de outputs de esta conversación contienen el arranque y pruebas manuales. Abrir un perfil privado nuevo para cada instancia de laboratorio: conservar el mismo proyecto/UID en un navegador viejo podría recuperar registros ficticios del ensayo anterior mediante la hidratación. No importar respaldos reales.

El lanzador se verificó desde una sesión con permiso de red. El sandbox puede ocultar los PIDs a otra ejecución: la antigua parada notificaba éxito sin cerrar servicios. Corregido con rechazo STOP_UNVERIFIED y registro preservado; regresión1/1 aprobada. El cierre de la sesión original propia liberó los seis puertos. No se certifica la detención por PID entre jobs restringidos; usar el control de la consola propia o un PowerShell con visibilidad verificable.

La copia reproducible requiere @google-cloud/firestore7.11.6 como dependencia directa: omitir opcionales de npm retiraba el paquete requerido por firebase-admin y dejaba Functions sin exportaciones. Se fijó esa versión del lockfile; el arranque verifica además respuestas401 de los cuatro callables antes de indicar READY, con espera acotada a180 segundos. El preparador final se ejecutó de nuevo por este cambio de dependencias, sin repetir suites aprobadas.
