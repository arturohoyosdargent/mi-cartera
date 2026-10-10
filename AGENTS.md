# Instrucciones administrativas de Mi Cartera PRO V2

- Estable protegido: 43a7afa2ab629cdc7b4c7db9856dbd10eae61f71, tag stable-rollback-v2-20261008-43a7afa. Nunca mover, reescribir ni sustituir.
- Fuente y procedimiento de publicación: docs/PUBLICATION_CONTROL.md. Main, referencias históricas C/E y paquetes legacy no son fuentes autorizadas de nueva producción V2.
- Ningún push, tag, QA o candidato autoriza deploy. Es necesaria autorización humana explícita para un SHA completo y aprobación del único workflow Firebase manual protegido.
- Firebase CLI local queda fuera del procedimiento ordinario. Sólo una orden explícita de emergencia/rollback puede autorizarlo; un workflow fallido no concede esa autorización.
- No reactivar Pages ni mutadores históricos para publicar o reconstruir código.
- Conservar V1/E, Firestore/rules/backend, ramas, backups y funciones validadas salvo autorización concreta posterior.
- Ante regresión, informar prueba fallida e historia funcional recuperable antes de proponer nuevas modificaciones. Regresión significa verificación, no reconstrucción.

- Política permanente: docs/VERSIONING_POLICY.md. Candidato → QA integral → publicación controlada autorizada → validación física PC + Android/PWA → aprobación explícita → nueva estable. Preservar la inmediatamente anterior y todos los tags históricos inmutables. El SHA 43a7afa es una referencia histórica protegida, no el destino fijo de futuros rollbacks.
- Ante una falla específica corregir sobre la línea más reciente conservando las mejoras aprobadas; si es imprescindible rollback, usar la estable inmediatamente anterior, identificada en el catálogo certificado. Nunca restaurar datos financieros como parte de recuperación de APP/CÓDIGO.
- “Migrar cartera desde otro sistema” queda documentado en docs/FUTURE_PORTFOLIO_MIGRATION.md para una fase posterior; no implementarlo al cerrar este candidato.
