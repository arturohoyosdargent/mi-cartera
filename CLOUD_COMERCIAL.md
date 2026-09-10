# Mi Cartera PRO — Arquitectura Cloud y Comercial

## Objetivo
Convertir Mi Cartera PRO V21 en una aplicación multiempresa, accesible desde celular y computadora, con recuperación de datos desde cualquier dispositivo.

## Arquitectura objetivo
- **Frontend:** PWA instalable (la versión actual).
- **Identidad:** Firebase Authentication o proveedor equivalente.
- **Base de datos:** Firestore (una organización/negocio por espacio de datos).
- **Seguridad:** reglas por `tenantId`/negocio y rol.
- **Auditoría:** registro inmutable de operaciones sensibles.
- **Respaldo:** exportación manual + respaldo Cloud automático.
- **Offline:** cache de la PWA para operación básica; sincronización cuando vuelva Internet.

## Modelo de datos Cloud
Cada documento operativo debe pertenecer a un `tenantId`:

- `tenants/{tenantId}` — negocio, plan, estado, configuración.
- `users/{userId}` — usuario, tenantId, rol, estado.
- `clients/{clientId}` — cliente y ruta.
- `credits/{creditId}` — crédito, cuotas, saldo y estado.
- `payments/{paymentId}` — cobranza y método.
- `routes/{routeId}` — rutas.
- `entries/{entryId}` — entradas de caja.
- `expenses/{expenseId}` — gastos/salidas.
- `cashClosures/{closureId}` — cierres de caja.
- `audit/{auditId}` — trazabilidad.

## Roles comerciales
- **Administrador:** configuración, usuarios, cartera, caja y reportes.
- **Supervisor:** supervisa rutas, cartera, autorizaciones y caja.
- **Cobrador:** clientes, ruta y cobranza asignada.
- **Consulta:** solo lectura.

## Recuperación ante pérdida del equipo
1. Instalar/abrir Mi Cartera PRO en el nuevo equipo.
2. Iniciar sesión.
3. Seleccionar el negocio.
4. La información Cloud se sincroniza nuevamente.
5. El respaldo JSON sigue disponible como recuperación extraordinaria.

## Producto comercial
La plataforma se debe diseñar como SaaS. Cada negocio tendrá sus propios datos y usuarios aislados.

### Plan sugerido Inicial
Clientes, créditos, cobranza, rutas y reportes básicos.

### Plan sugerido Profesional
Incluye caja, cierres, usuarios/roles, autorizaciones, auditoría y reportes avanzados.

### Plan sugerido Empresa
Incluye múltiples cobradores, supervisión, mayores límites, soporte prioritario y funciones avanzadas.

## Orden de implementación
1. PWA instalable + respaldo local (actual).
2. Cuenta Cloud y autenticación.
3. Multiempresa (`tenantId`).
4. Sincronización de clientes/créditos/pagos.
5. Seguridad por roles.
6. Cierres y auditoría Cloud.
7. Migración/importación de datos actuales.
8. Panel de administración y planes.
9. Dominio propio y marca comercial.
10. Publicación como aplicación móvil.

## Importante
No se deben almacenar contraseñas directamente en `index.html` ni en el repositorio. Las credenciales de servicios Cloud deben mantenerse en la configuración segura del proveedor.
