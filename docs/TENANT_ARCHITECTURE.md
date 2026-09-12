# Arquitectura multiempresa — Préstamo Ya

## Modelo

La unidad comercial es una **organización (tenant)**. Cada empresa cliente recibe un `orgId` único y todos sus datos operativos viven bajo ese ámbito.

```text
Plataforma Préstamo Ya
├── Organización A
│   ├── usuarios
│   ├── rutas
│   ├── clientes
│   ├── créditos
│   ├── pagos
│   ├── cierres
│   └── reportes
└── Organización B
    ├── usuarios
    ├── rutas
    ├── clientes
    ├── créditos
    ├── pagos
    ├── cierres
    └── reportes
```

## Identidad y autorización

- Firebase Authentication identifica al usuario.
- El documento `users/{uid}` contiene su `orgId`, rol, estado y rutas autorizadas.
- Las reglas de Firestore son la autoridad final.
- La interfaz nunca debe ser considerada una barrera de seguridad.
- Un usuario no puede cambiar su propio `orgId` mediante una operación normal de aplicación.

## Estructura Firestore objetivo

```text
users/{uid}
orgs/{orgId}/routes/{routeId}
orgs/{orgId}/clients/{clientId}
orgs/{orgId}/credits/{creditId}
orgs/{orgId}/payments/{paymentId}
orgs/{orgId}/cashClosures/{closureId}
orgs/{orgId}/approvals/{approvalId}
orgs/{orgId}/capital/{entryId}
orgs/{orgId}/entries/{entryId}
orgs/{orgId}/expenses/{expenseId}
orgs/{orgId}/audit/{auditId}
```

## Regla de aislamiento

Toda operación sobre `orgs/{orgId}/...` debe comprobar que el `orgId` solicitado coincide con el `orgId` autorizado en el perfil del usuario. Para operaciones limitadas por ruta, además se debe comprobar que la ruta pertenece a `routeIds` del usuario.

## Administrador de plataforma vs. administrador de empresa

En la siguiente etapa se separarán dos conceptos:

- **Platform Admin:** administra organizaciones, planes, licencias, estado comercial y configuración global.
- **Org Admin:** administra usuarios, rutas y operación únicamente dentro de su empresa.

El `admin` actual no debe convertirse automáticamente en administrador de todas las empresas.

## Alta de una empresa

Flujo objetivo:

1. Crear organización.
2. Generar `orgId` único e inmutable.
3. Crear perfil del administrador de empresa con ese `orgId`.
4. Aplicar plan/licencia.
5. Inicializar configuración y catálogos.
6. Crear rutas y usuarios.
7. Entregar acceso.

## Datos que no deben ser globales

Clientes, créditos, pagos, rutas, cierres, aprobaciones, capital, gastos, movimientos y auditoría son datos de empresa y deben quedar aislados por `orgId`.

## Compatibilidad con offline

El `orgId` activo debe quedar asociado al perfil autenticado y a cada escritura local que posteriormente pueda sincronizarse. Antes de hacer `pullCloud`, las operaciones locales pendientes deben enviarse respetando el mismo tenant. Nunca se debe permitir que un cambio pendiente de una organización se publique en otra.

## Migración desde la versión actual

La versión actual ya utiliza `orgs/{orgId}/...` y comprobaciones `sameOrg` en las reglas de Firestore. El trabajo comercial consiste en evolucionar el origen del `orgId` y el ciclo de alta de empresas sin romper los flujos operativos existentes.
