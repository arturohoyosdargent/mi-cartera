# Evidencia de candidata integral

Base: main 2a93b85. Rama: cierre-integral-20261001. Se comparó el historial completo, incluidas ramas posteriores y la candidata socios-08 del 26/09; V35 se usó como referencia, sin revertir el repositorio ni restaurar filas ausentes de Cloud.

Se recuperaron socios financieros/calendario, fechas comerciales, normalización de teléfonos, edición de clientes, sesión offline y almacenamiento durable antes de enviar. Se conservaron la autoridad de Cloud, los comprobantes gráficos, las renovaciones posteriores editables y su historial. La edición/cancelación de renovaciones ahora ajusta caja y restaura la cadena de origen; la reversión de pagos usa marcadores append-only compatibles con las reglas existentes.

La revisión independiente detectó transporte colgado, caché inaccesible con red degradada y balance desactualizado en la misma pestaña. Se corrigieron con regresiones que fallaban antes. La revisión posterior detectó que CloudRuntime.flush omitía el ejecutor con límite: se unificó. Las lecturas de hidratación también tienen límite, conservan datos y liberan el bloqueo. La cola rechaza un ID reutilizado con contenido financiero diferente y conserva las operaciones concurrentes.

PWA: SDK Firebase local, recursos precacheados, caché coherente por release, actualización que instala antes de reemplazar el shell y protege formularios/operaciones pendientes, navegación inferior por encima de la barra de cierre. Build v2-pilot-20261001-b2-integral-4.

Validación aislada: Auth/Firestore demo-cartera-final, sin escrituras de producción. Cliente + crédito S/600/720, pago S/180 → saldo S/540; comprobante gráfico. Aporte S/1000 → interés S/100 → devolución S/200: caja S/280, capital de socio pendiente S/800, interés siguiente S/80, capital neto S/-70. Confirmados en UI y documentos de Firestore.

Offline en sesión nueva: alta de cliente aceptada durable, sigue presente tras recargar desconectado; al reconectar crea un único cliente y una única operación. Total laboratorio: 2 clientes, 1 crédito, 1 pago, 7 operaciones; dinero sin cambios. Prueba física Redmi 28/09 aprobada por el usuario (S/7,08 → S/124,92, recibo y sincronización). Regresión física nueva solicitada solo para reapertura offline/navegación/reconexión; no repetir pago.

Pruebas reproducibles: npm ci --prefix v2/tests --ignore-scripts; desde raíz, ejecutar cada v2/tests/*.spec.js con Node 22+. CI incluye todas las suites. Las pruebas y dependencias se excluyen de Hosting.

Antes de publicar se preservó la release live: projects/mi-cartera-d0d8c/sites/mi-cartera-pro-v2/versions/ec5b9643613bd366, más 55 archivos públicos con SHA-256. No se leyó ni modificó la cartera real. Publicar únicamente Hosting target v2 después del cierre de los gates; no cambiar reglas, Auth ni datos.
