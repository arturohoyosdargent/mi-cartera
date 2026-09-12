# PRÉSTAMO YA — Etapa Comercial V1

## Objetivo
Convertir la versión operativa actual en un producto comercializable sin alterar la versión estable de producción (`main`). Esta rama prepara la base para vender Préstamo Ya como software con licencia e implementación y, posteriormente, como SaaS multiempresa.

## Modelo comercial objetivo

**Producto:** Préstamo Ya — Sistema de gestión de cartera y cobranzas.

**Modelo recomendado:** implementación inicial + licencia mensual.

El cliente compra el derecho de uso del software y los servicios asociados; el código fuente y la propiedad intelectual permanecen con el propietario del producto salvo que exista un contrato específico de cesión.

## Alcance comercial del producto

- Gestión de clientes y expedientes.
- Registro y seguimiento de créditos.
- Cronogramas de cuotas.
- Pagos y control de cobranza.
- Renovaciones y refinanciaciones.
- Pagos adicionales integrados al total de la deuda.
- Historial y detalle de operaciones.
- Rutas y cobradores.
- Usuarios y permisos.
- Funcionamiento offline/PWA.
- Sincronización Cloud.
- Navegación con Google Maps/Waze.
- Reportes y control operativo.

## Fases de industrialización

### V1 — Producto vendible (esta rama)
1. Separar producción (`main`) de desarrollo comercial.
2. Definir modelo de organización/tenant.
3. Definir aislamiento de datos por organización.
4. Revisar permisos de Firestore por organización, usuario y ruta.
5. Preparar configuración para alta de nuevos clientes sin duplicar el código.
6. Documentar instalación, configuración y soporte.
7. Preparar demo con datos ficticios.

### V2 — SaaS multiempresa
1. Catálogo de organizaciones.
2. Alta/baja/suspensión de empresas.
3. Administrador de plataforma separado del administrador de cada empresa.
4. `orgId` derivado de la identidad/perfil autorizado, no de un valor editable por el cliente.
5. Aislamiento obligatorio de clientes, créditos, pagos, rutas, cierres y reportes.
6. Auditoría de acciones administrativas.
7. Preparación para planes y suscripciones.

### V3 — Comercialización
1. Landing page.
2. Demo comercial.
3. Contrato de licencia.
4. Política de privacidad y tratamiento de datos.
5. Términos de servicio.
6. Paquetes de precio.
7. Proceso de onboarding.
8. Soporte y mantenimiento.

## Regla crítica de seguridad comercial

Ningún usuario de una empresa A debe poder leer, crear, modificar o eliminar información de una empresa B aunque conozca IDs, rutas, créditos o URLs. El aislamiento debe estar garantizado por reglas de Firestore y por la arquitectura; nunca únicamente por filtros de interfaz.

## Principio de compatibilidad

La versión `main` sigue siendo la versión operativa estable. Los cambios de industrialización se desarrollan en `commercial-v1` y se integran a producción solamente después de validación funcional y de seguridad.

## Criterio de salida V1

La etapa se considera lista para piloto cuando:

- existe aislamiento verificable por `orgId`;
- roles y rutas respetan el alcance de cada usuario;
- una segunda empresa puede configurarse sin copiar manualmente el código de negocio;
- los datos de una empresa no aparecen en otra sesión;
- sincronización offline/online conserva la organización correcta;
- los flujos de crédito, pago, renovación y refinanciación siguen pasando las pruebas existentes;
- existe una demo con datos ficticios y documentación de instalación.
