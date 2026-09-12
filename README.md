# Préstamo Ya

**Sistema de gestión de cartera y cobranzas para negocios de crédito.**

Préstamo Ya es una aplicación web progresiva (PWA) orientada a la gestión operativa de clientes, créditos, cuotas, pagos, cobradores y rutas, con funcionamiento offline y sincronización Cloud.

## Producto

- Clientes y expedientes.
- Créditos y cronogramas.
- Pagos y seguimiento de cobranza.
- Renovaciones y refinanciaciones.
- Pagos adicionales integrados al total de la deuda.
- Historial y detalle de operaciones.
- Rutas y cobradores.
- Usuarios y permisos.
- Funcionamiento offline/PWA.
- Sincronización Cloud.
- Navegación con Google Maps/Waze.
- Reportes y control operativo.

## Etapa comercial

La rama `commercial-v1` prepara el producto para convertirse en una solución comercial multiempresa, manteniendo `main` como versión operativa estable hasta completar la validación.

La arquitectura objetivo utiliza organizaciones (`orgId`) para aislar completamente los datos de cada empresa cliente. La autorización se refuerza en Firebase/Firestore y no depende solamente de la interfaz.

Consulta la documentación técnica:

- `docs/COMMERCIAL_V1.md` — hoja de ruta de industrialización y comercialización.
- `docs/TENANT_ARCHITECTURE.md` — arquitectura multiempresa y aislamiento de datos.

## Estado

**Producción:** `main`  
**Desarrollo comercial:** `commercial-v1`
