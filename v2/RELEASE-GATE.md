# Mi Cartera PRO V2 — Release Gate

## Estado técnico del código
La rama canónica es `reengineering-v2-final`.
El QA automatizado de la rama final debe permanecer verde antes de cualquier publicación de validación.

## Bloqueos obligatorios antes de producción
- No reemplazar V1 ni `main` durante validación.
- No escribir sobre Firebase real desde migración en sombra.
- No migrar registros con errores de auditoría sin conciliación explícita.
- No recrear pagos históricos para cuadrar saldos.
- No procesar operaciones pendientes de V1 como parte de la migración V2.
- Verificar totales de control antes y después de la migración: clientes, créditos, pagos, capital pendiente e intereses cobrados.
- Alfredo: preservar un único pago real de interés; no reducir capital; una sola renovación válida.
- Elías: saldo previo S/60 + nuevo capital S/200 => desembolso S/140, total S/240 y 4 cuotas semanales de S/60.
- Probar instalación V2 separada en PC y móvil, incluyendo offline/reconexión, antes del corte.

## Criterio para declarar 100%
`100%` significa: código V2 validado + entorno V2 separado publicado + instalación probada + datos reales auditados/conciliados + migración controlada verificada. El QA de código por sí solo no autoriza el corte a producción.
