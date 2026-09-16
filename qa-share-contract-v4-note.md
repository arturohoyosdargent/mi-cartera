# QA share contract v4

El módulo `credit-detail-share-fix.js` está en v4. El QA heredado todavía buscaba símbolos internos de v2 (`__prestamoYaCreditDetailShareFixV2` y `const bodyCreditId=`), aunque el contrato funcional vigente usa `__prestamoYaCreditDetailShareFixV4`, `bodyId()`, `b.dataset.creditId=id`, `window.__prestamoYaLastPaymentShare=null`, `navigator.share` y `prestamo-ya-detalle-credito.png`.

Este archivo documenta la migración; la corrección del workflow debe validar el contrato funcional v4 y no nombres internos obsoletos.
