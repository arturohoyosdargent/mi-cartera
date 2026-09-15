# Estabilización estructural — Mi Cartera PRO

Objetivo: sustituir el crecimiento por parches por un núcleo verificable sin alterar datos financieros reales.

## Reglas de esta fase

1. No borrar ni reescribir pagos, créditos, clientes o cola offline para hacer coincidir saldos.
2. Preservar IDs existentes y relaciones `clientId` / `creditId`.
3. Un único contrato de estado: colecciones críticas siempre deben ser arrays antes de que la UI o los módulos las consuman.
4. Un único flujo de pago: crear movimiento local -> persistir -> encolar con el mismo ID -> sincronizar idempotentemente -> auditar.
5. Un único flujo de crédito: crear con ID estable -> asociar cliente -> persistir -> encolar -> sincronizar -> auditar.
6. Las capas históricas de reparación se retirarán solo cuando su comportamiento esté cubierto por el núcleo y pruebas equivalentes.
7. Ningún cambio llega a `main` sin QA del HEAD exacto.

## Contrato mínimo de estado

Las siguientes propiedades deben existir siempre como arrays durante runtime: `clients`, `credits`, `payments`, `users`, `routes`, `syncQueue` y `audit` cuando corresponda al esquema vigente. Los consumidores deben tolerar carga parcial de Cloud y no asumir que una colección remota ya fue recibida.

## Pruebas obligatorias antes del cierre

- arranque limpio en PC y móvil;
- arranque con Cloud lento/parcial;
- modo offline y posterior reconexión;
- cliente -> crédito -> pago -> recarga -> pull Cloud;
- repetición de sincronización sin duplicar pago;
- conservación de `clientId`, `creditId` e ID del pago;
- auditoría financiera sin cambios destructivos;
- caché/Service Worker actualizados sin borrar datos de negocio.

## Criterio de salida

La fase no se considera terminada por pasar sintaxis. Debe pasar pruebas de integración de los flujos anteriores y reducir dependencias de wrappers/reparaciones históricas sin pérdida funcional.