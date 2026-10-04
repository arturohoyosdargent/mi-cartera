# Consultas comerciales — cierre del bloque, 2026-10-03

Base verificada: `a78def050753501b68240b01f7041757e5e2a638`, `v2-pilot-20261003-b2-read-first-sync-1`. Conservar esta base y el rollback histórico `d0df8a8`.

Candidato: `v2-pilot-20261003-b2-commercial-consultation-1`. Este documento no acredita publicación ni conciliación de operaciones reales.

## Correcciones comprobadas

- Las comisiones pendientes y los excesos pagados del consolidado se suman por gestor: el exceso de uno no cancela la deuda de otro. Se conservan contratos y devengos históricos aunque el perfil del gestor no esté disponible; el detalle explica sus importes. No se modifican tasas, fórmulas individuales, pagos ni movimientos almacenados.
- El titular de un crédito asignado individualmente aparece en las consultas del gestor y su ruta, sin trasladar el contacto ni los créditos hermanos. Las asociaciones se cotejan como pares gestor/ruta. Los cobros históricos conservan su atribución original; pagos futuros o revertidos no generan asociaciones históricas.
- Los créditos de un mismo titular se distinguen en los listados de consulta por beneficiario/referencia, capital, saldo pendiente, fecha y estado. Una referencia ausente se indica y no se inventa.
- Los créditos heredados sin cronograma utilizan el saldo del modelo aprobado para el filtro de activos y el detalle. Un crédito completamente pagado no aparece como activo; un saldo pendiente se muestra sin fabricar cuotas.

## Preservación

Son cambios de consulta/presentación. Las acciones de asignación, cobro, renovación y comisión, el transporte Cloud, las reglas de acceso, el diario protegido, los cierres administrativos y las fichas gráficas aprobadas permanecen sin cambios. No se escriben datos reales durante QA.

Continúan aprobados: asignación individual con referencia y contacto conservado; selección explícita de toda la cartera sin casilla deshabilitada; permisos y auditoría; renovación con cuota adicional en propuesta y detalle; comprobantes/recordatorios con mensaje editable y un botón de compartir sin descarga previa. No repetir sus pruebas físicas.

## Validación

- Once casos nuevos: fallos reproducidos antes de corregir y ejecución final 11/11, exclusivamente ficticios.
- QA focalizado de siete suites relacionadas, sin fallos.
- Revisión independiente: 20/20 escenarios y 28/28 controles adicionales, sin hallazgos pendientes.
- Navegación real en navegador a 393×873: filtros de contacto, beneficiarios individuales, exclusión de crédito pagado, detalle de saldo heredado y movimiento original de comisión. Sin desbordamiento horizontal. Estado financiero ficticio, seis operaciones protegidas y dos cierres intactos, cero transmisiones financieras.
- CI debe estar verde sobre el SHA exacto antes de integrar/publicar. No solicitar nuevas pruebas físicas para estas consultas de solo lectura.

## Pendiente real de cierre total

Las seis operaciones protegidas del Redmi siguen pendientes de conciliación individual con Cloud. No se conocen ni se infieren sus resultados desde los casos ficticios. No reenviar, borrar, cambiar ni recrear operaciones reales. Los dos cobros cerrados administrativamente permanecen terminales; no reabrir ese incidente. No presentar este candidato como cierre total ni efectuar una publicación final mientras esa conciliación siga pendiente.
