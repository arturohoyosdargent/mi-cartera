# Matriz QA — Cloud/offline

- Login Cloud: pull debe persistir localmente y actualizar UI.
- Sync manual: push → pull → persist debe conservar IDs y relaciones.
- Usuario de ruta: solo datos permitidos; pagos deben conservar `creditId` y `routeId`.
- Administrador/supervisor: merge completo sin eliminar movimientos locales válidos.
- Primer arranque Cloud: pagos/cierres/aprobaciones locales deben sobrevivir migración.
- Firestore sin campo `id`: usar ID documental.
- Reconexión online: reintento no debe duplicar pagos.
- Cola `PENDIENTE/ERROR`: no debe vaciarse antes de confirmar sincronización.
