# Instrucciones administrativas de Mi Cartera PRO V2

- Estable protegido: 43a7afa2ab629cdc7b4c7db9856dbd10eae61f71, tag stable-rollback-v2-20261008-43a7afa. Nunca mover, reescribir ni sustituir.
- Fuente y procedimiento de publicación: docs/PUBLICATION_CONTROL.md. Main, referencias históricas C/E y paquetes legacy no son fuentes autorizadas de nueva producción V2.
- Ningún push, tag, QA o candidato autoriza deploy. Es necesaria autorización humana explícita para un SHA completo y aprobación del único workflow Firebase manual protegido.
- Firebase CLI local queda fuera del procedimiento ordinario. Sólo una orden explícita de emergencia/rollback puede autorizarlo; un workflow fallido no concede esa autorización.
- No reactivar Pages ni mutadores históricos para publicar o reconstruir código.
- Conservar V1/E, Firestore/rules/backend, ramas, backups y funciones validadas salvo autorización concreta posterior.
- Ante regresión, informar prueba fallida e historia funcional recuperable antes de proponer nuevas modificaciones. Regresión significa verificación, no reconstrucción.
