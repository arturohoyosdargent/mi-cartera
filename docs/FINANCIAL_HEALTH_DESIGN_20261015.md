# Salud financiera — auditoría de fuente y diseño técnico, 15/10/2026

Estado: propuesta para revisión, sin cálculos definitivos implementados.
Base local: `7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5` más cambios de `candidate/continuation-20261015`.
Alcance realizado: lectura de código y fixtures ficticios. **No se auditaron carteras reales**, Firestore productivo, cuentas bancarias ni archivos financieros del usuario.
La existencia de un campo en el código no acredita que esté completo o conciliado en una cartera real.
Esta auditoría no modificó motores, datos, reglas, Functions ni saldos. No se hicieron commits ni publicaciones.

## 1. Resultado de la auditoría

La fuente permite identificar cobros y sus componentes, deuda de socios, egresos y comisiones.
No permite certificar por sí sola rentabilidad real completa, devengo por período ni liquidez bancaria disponible.
Faltan cobertura histórica acreditada, clasificación económica uniforme, cuentas físicas conciliadas y políticas de reconocimiento aprobadas.
Los valores actuales de caja, cartera y resultado comercial tienen finalidades distintas; no deben rebautizarse como utilidad real.
Este diseño define cómo demostrar cada cifra, cuándo mostrar un subtotal parcial y cuándo responder «No disponible».

## 2. Fuentes examinadas y límites

| Fuente | Evidencia disponible | Límite relevante |
| --- | --- | --- |
| `v2/core/financial-engine.js:9-12` | Crédito: `capital`, `total`, `principalPaid`, `interestPaid`, `penaltyPaid`, estado y versión. Pago: `id`, `creditId`, `clientId`, `amount`, `concept`, `capitalAmount`, `interestAmount`, `penaltyAmount`, `operationId`. | Los acumulados describen el estado guardado. No constituyen un historial de saldos diarios ni una política de devengo. La asignación genérica admite un remanente no distribuido. |
| `v2/core/financial-engine.js:13-15` | Renovaciones: `renewedFrom`, `renewedTo`, `renewedAt`, `previousBalance` y desembolso neto. | El saldo trasladado puede contener deuda no cobrada; no equivale a una recuperación de capital ni a ingreso recibido. |
| `v2/app/durable-actions-v2.js:20,64,179` | Desembolso enlazado a crédito; cuota con `installmentApplications`; renovación con `renewalMode`, `previousBalance`, `netDisbursement`. | Un alta ordinaria no añade fecha de origen al crédito en ese constructor; puede existir en el desembolso enlazado. No inventar la fecha desde la primera cuota. |
| `functions/v2-collector-payment.js:46-55` | Fecha comercial del servidor, actor, operación, recibo canónico y entrada de caja con `ref=payment.id`. | La entrada de caja no contiene todo el desglose del pago. Ambos documentos describen aspectos de un mismo hecho y no son dos ingresos. |
| `v2/core/partner-loans.js:8-24` | `partnerLoan`: capital, tasa, fecha, primer vencimiento, `terms`, pagos de interés, devoluciones y `closedAt`. | `partner` es texto, sin identidad estable del socio; no hay calendario contractual de devolución de principal ni devengo diario. |
| `v2/app/partner-loans-ui.js:27-42` | Master actualizado y egresos `INTERES_SOCIO` / `DEVOLUCION_CAPITAL_SOCIO`, con `partnerLoanId`, `ref`, `interestDue` y auditoría de IDs. | El pago embebido y el egreso asociado no son dos pagos. El enlace a operación no aparece uniformemente en cada movimiento; puede requerir auditoría. |
| `v2/core/commercial-model.js:4-25,34-39` | Deduplicación, reversos de pago, atribución, condiciones de comisión vigentes, generado/pagado/pendiente y asignaciones por ruta. | Su `result` combina interés/mora cobrados, gastos seleccionados y comisión generada; no certifica un resultado bajo una base contable única. |
| `v2/app/cash-menu-v2.js:17-65,94-109,154` | Libro de caja con deduplicación, fechas, apertura/cierre y filtros; categorías manuales. | Las categorías mezclan uso personal y operativo. «Resultado del mes» representa flujo neto, no rentabilidad. No hay catálogo de cuentas físicas en ese flujo. |
| `v2/app/operational-controller.js:2`, `dashboard-parity-v2.js:2` y `admin-parity-v2.js:2` | Reporte de capital/interés/mora, caja y métricas de cartera. | Los agregados de las vistas no sustituyen una conciliación común de reversos, fechas, alcance y duplicados. `capitalPlaced` sobre créditos activos no es desembolso del período ni capital medio invertido. |
| `v2/app/cloud-rehydration-v2.js:6-7,63-70,144-156` | `entries` y `expenses` forman `cashMovements`; lecturas según rol y ámbito. | Un cobrador no recibe la vista global administrativa. No calcular salud global desde una lectura parcial de permisos. |

Los helpers que convierten ausencias o valores inválidos en cero son útiles en vistas existentes, pero no deben validar la integridad de este módulo.
`total - capital` es margen contractual pactado: no demuestra interés cobrado ni interés devengado a una fecha.
`schedule.amount/paid/balance/date` contiene saldos totales; no conserva necesariamente principal/interés/mora por vencimiento.
El estado actual de un crédito no demuestra su estado a un corte anterior. Una cartera histórica necesita eventos completos o un saldo inicial certificado.

### Socios y antecedentes históricos

- `historical=true` registra el pasivo con entrada de caja cero; no sumar otra vez el capital recibido.
- `firstDue` puede omitir meses previos ya atendidos según el registro inicial; no acredita importes o fechas de esos pagos anteriores.
- `terms.from/amount` conserva el próximo interés acordado tras una devolución parcial; no reducirlo por una tasa inferida.
- `closedAt` cierra el principal, pero puede dejar intereses vencidos pendientes.
- Las devoluciones/pagos registrados para fecha futura no son salida realizada al corte actual; deben conservar su condición y reserva explícita.
- Agrupar por nombre no acredita que dos entregas pertenezcan a la misma persona. Una identidad nueva no se asignará por similitud textual.

Fixtures revisados: `financial-engine.spec.js`, `partner-financial-integration.spec.js`, `partner-balance.spec.js`, `partner-session-cutoff.spec.js`, `cash-range-consistency.spec.js`, `history-list-batches.spec.js` y `report-installment-splits.spec.js`.
Demuestran reglas con datos ficticios; no son una auditoría de la integridad financiera de producción. No se repitieron sus suites para redactar este documento.
`report-installment-splits.spec.js` inspecciona texto del controlador: por sí solo no demuestra conciliación ni rentabilidad.

## 3. Reglas de clasificación obligatorias

| Hecho económico | Efecto de caja cuando ocurre | Tratamiento requerido |
| --- | --- | --- |
| Desembolso de principal a cliente | Salida | Activo por recuperar; no gasto ni pérdida automática. |
| Recuperación de principal | Entrada | Reduce cuenta por cobrar; no utilidad ni ingreso por interés. |
| Interés o mora efectivamente cobrado | Entrada | Mostrar cobrado, con componente probado. No confundir con principal. |
| Interés pactado futuro | Ninguno por sí solo | Compromiso contractual; no cobrado ni devengado automáticamente. |
| Capital recibido de socio prestamista | Entrada, salvo antecedente ya incluido | Aumenta deuda; no utilidad. Separarlo de aporte patrimonial del dueño. |
| Devolución de capital a socio | Salida | Reduce deuda; no gasto operativo ni gasto financiero. |
| Interés de socio | Salida al pagar | Costo financiero. Separar vencido/pendiente, reconocido según política y pagado; evitar duplicar gasto al cancelar un pasivo ya reconocido. |
| Aporte del propietario | Entrada | Financiamiento patrimonial; no ingreso por explotación. |
| Retiro o uso personal | Salida | Separado de costos del negocio; su naturaleza patrimonial o de gasto requiere clasificación explícita. No reclasificar por nombre de categoría. |
| Gasto operativo | Salida al pagar | Costo operativo con finalidad, período y evidencia. |
| Comisión de gestor | Salida al pagar | Costo comercial separado en generada, pagada y pendiente; no descontar generado y pagado dos veces. |
| Transferencia entre cuentas propias | Salida en origen, entrada en destino | No ingreso/gasto consolidado. No inventar una contrapartida ausente. |
| Refinanciación o renovación | Solo el dinero nuevo realmente entregado/cobrado | Trazar cadena y componentes trasladados. El principal antiguo y su sucesor no son dos colocaciones económicas simultáneas. |
| Descuento, castigo, condonación o reverso | Según evento probado | No simular un pago. Requieren motivo, importe/componente y vínculo al evento corregido. |

Las categorías personales, operativas y financieras serán ejes explícitos; una descripción libre no basta.
«Cobrado», «devengado», «vencido pendiente» y «contractual futuro» deben permanecer en columnas y series distintas.
Ningún aporte, recuperación o devolución de principal aumentará o reducirá utilidad por su mero movimiento de caja.

## 4. Datos existentes y datos por completar

| Área | Se puede aprovechar | Falta o debe acreditarse antes de habilitar métricas completas |
| --- | --- | --- |
| Cobros de clientes | IDs, fecha, crédito, componentes, actor y vínculos de caja en flujos nuevos. | Cobertura histórica; componentes faltantes/remanentes; reversos con fecha económica; cobros sin caja o caja sin cobro. |
| Interés devengado | Contratos, cronogramas, renovaciones y cobros. | Política aprobada de reconocimiento por tiempo/vencimiento, moras, prepago, renovación y condonación; eventos de ajustes. |
| Gastos | Movimientos, categoría, concepto, observación y auditoría. | Clase económica estable, finalidad personal/negocio/financiera, fecha de reconocimiento, período cubierto, pasivo/cancelación y evidencia. |
| Liquidez por cuenta | `cashAccountId` en algunos flujos y transferencias de gestor. | Catálogo de efectivo/banco/billetera, moneda, titularidad, saldo inicial fechado, conciliación y fondos restringidos. `leader`/worker denota custodia técnica, no cuenta bancaria acreditada. |
| Cartera | Principal registrado, pagos, cronograma y cadenas de renovación. | Historia al corte, desembolso real de origen, composición de deuda refinanciada, castigos y recuperaciones, pérdidas reconocidas y política de deterioro. |
| Socios | Pasivo principal, pagos, acuerdos de interés y vencimientos conocidos. | Identidad estable, distinción préstamo/aporte patrimonial, evidencia anterior a `firstDue`, vencimiento de principal si se pactó y cuentas de pago. |
| Comisiones | Condiciones inmutables y componentes generados, pagos y pendientes. | Cobertura de términos/atribución histórica, fecha efectiva de reversos y criterio temporal para reportes anteriores. |
| Comisiones ganadas por el negocio | No se acreditó una fuente separada de comisiones cobradas a clientes. | No confundir comisiones de gestores (costo) con ingreso; exigir concepto, componente y reconocimiento verificados. |
| Rentabilidad porcentual | Importes trazables, una vez clasificados. | Denominador aprobado: capital propio, capital total o cartera media; saldos iniciales/serie temporal suficiente y trato de deuda/capitalización. No elegir un denominador implícito. |

No rellenar ausencias con cero, con la tasa del préstamo ni con relaciones por cliente/monto aproximado.
Cuando un campo requerido falta, el resultado global afectado queda no disponible; los subtotales probados se etiquetan como parciales.
Un cero solo es válido si la cobertura del período acredita que no existió ese movimiento u obligación.
Los consumidores revisados ofrecen ALL/TODAY/MONTH/RANGE; los presets y proyecciones solicitados aún no están implementados.

## 5. Enfoque técnico propuesto

Se comparan tres caminos:

1. Reutilizar directamente los totales actuales: costo inicial bajo, pero arrastra mezcla de bases y cobertura desconocida; no satisface este objetivo.
2. **Recomendado:** vista financiera derivada y de solo lectura sobre registros canónicos, con conciliación y bloqueos de calidad por métrica.
3. Sustituir todo por un nuevo libro contable: mayor cambio de esquema y operación; queda fuera de esta fase y no se justifica para la auditoría solicitada.

La opción 2 conserva los motores operativos y separa cinco responsabilidades:

- Lectura autorizada de una instantánea completa dentro de proyecto/org/usuario y capacidades verificadas.
- Normalización estricta sin mutación: fechas, centavos, tipo, moneda, versión y clave documental de origen.
- Clasificación económica y conciliación de cobros, caja, socios, comisiones, renovaciones y reversos.
- Cálculo puro por base y corte, habilitado únicamente cuando su contrato de datos esté satisfecho.
- Tres vistas móviles con desglose, calidad y acceso al origen de cada valor.

Contrato propuesto de consulta: ámbito verificado, corte, período, moneda, base de reconocimiento y filtros autorizados.
Contrato de resultado: versión de criterio, revisión de fuentes, corte/período/base, métricas, exclusiones y discrepancias.
Cada métrica devolverá valor o `null`, unidad, estado `VERIFICADO` / `PARCIAL` / `NO_DISPONIBLE`, causas y referencias de origen.
No persistir contadores de utilidad ni corregir cartera desde una vista de salud financiera.
Las nuevas clasificaciones o vínculos, si se autorizan, se guardarán con autor, fecha, evidencia y versión; no reescribirán antecedentes financieros para completar un reporte.

### Conciliación y trazabilidad sin doble conteo

- Clave de origen: proyecto + organización + colección + ID documental. `id` repetido con contenido distinto se denuncia; no gana silenciosamente la última copia.
- Un cobro aporta su componente económico; su movimiento enlazado aporta caja. No sumar `payment.amount` y `entry.amount` como dos ingresos.
- Un pago a socio embebido y el egreso con el mismo ID representan un único hecho. Comparar importes, fecha y préstamo antes de conciliar.
- No sumar a la caja el principal contenido en `partnerLoan`, el nominal del crédito o el saldo de cartera.
- Las dos patas de transferencia se concilian por identificador, cuentas, importe, fecha y moneda. Una pata sin pareja queda discrepante.
- Usar `operationId`, `ref`, `creditId`, `partnerLoanId`, `paymentId`, `termId`, auditoría y reverso; no coincidencias por monto/nombre.
- Conservar vínculo entre original y corrección. Un reverso futuro no altera un corte anterior sin la política temporal aprobada.
- Tombstones, cierres administrativos y `noReplay` conservan su significado operativo; el reporte no los ejecuta ni los interpreta como perdón de deuda.
- Cola pendiente, confirmación incompleta o lectura parcial impiden la etiqueta «verificado global»; no se convierten en movimientos financieros aceptados.
- Mostrar cantidad y monto de registros excluidos cuando sea posible. Una discrepancia no se oculta compensándola con otro registro.

## 6. Tres módulos móviles

### A. Rentabilidad real

Primera pantalla: intereses/mora cobrados probados; costos operativos y financieros pagados; retiros personales separados; estado de integridad.
Otra pestaña mostrará devengado y pendientes solo con la política aprobada. No combinar bases en una misma utilidad.
La identidad de resultado propuesta es ingresos reconocidos menos costos reconocidos bajo la misma base y período; sus componentes y política quedan sujetos a aprobación antes de programarla.
El retorno porcentual permanecerá no disponible hasta acreditar el denominador y pérdidas/ajustes necesarios.
No usar flujo neto de caja, `commercial.summary.result` ni `netCapital` como atajo para «utilidad real».

### B. Liquidez por cuentas

Mostrar saldo registrado, saldo conciliado y fondos restringidos por cuenta; no confundir saldo con disponibilidad libre.
La conciliación verificará apertura + entradas − salidas = cierre para la misma cuenta, moneda y período.
Separar flujo de operación, movimientos de principal, financiamiento y transferencias; las transferencias propias se cancelan al consolidar.
Las obligaciones conocidas se muestran aparte; solo reservas identificadas reducen un disponible comprometido, sin descontarlas dos veces.
Sin catálogo/saldos iniciales/conciliación, mostrar «Caja registrada parcial»; no «dinero disponible en bancos».

### C. Cartera y compromisos con socios

Separar principal recuperable registrado, interés contractual pendiente y vencidos por componente acreditado.
Mostrar antigüedad por vencimiento y corte, sin asignar pérdida probable ni porcentaje de recuperación sin política/datos.
Mostrar principal de socios, intereses pagados, vencidos pendientes y próximos vencimientos conocidos.
La cartera no es liquidez inmediata y el capital neto registrado no es utilidad del período.
Si no existe fecha pactada de devolución de principal a socios, mostrar «sin vencimiento registrado», sin distribuirlo en días ficticios.
Cada tarjeta abre movimientos/préstamos de origen y expone campos faltantes; la interfaz no corrige saldos ni registra pagos.

Indicadores adicionales previstos, condicionados a cobertura:

- Cartera: capital desembolsado del período, principal pendiente al corte, créditos vigentes/vencidos y recuperación mensual por componente. Un estado actual no reconstruye meses anteriores.
- Morosidad: importe vencido y porcentaje sobre un denominador mostrado; no mezclar cuota total vencida con principal total como si fueran la misma medida.
- Socios: financiación recibida y deuda pendiente por socio acreditado, costos financieros pagados/devengados por separado y obligaciones sin fecha visibles.
- Dependencia externa: propuesta deuda de financiación / (capital propio + deuda de financiación) al mismo corte, solo con capital propio acreditado y denominador positivo. No inferirlo de un flujo de caja.
- Rentabilidad atribuible a capital financiado: no disponible sin vínculos de financiación a créditos o una política explícita de asignación. No adjudicar toda utilidad a un socio porque su dinero ingresó antes.
- Cuentas: efectivo, bancos, Yape, Plin, Dale y otras billeteras como catálogo configurable por moneda; el diseño exige apertura, transferencias enlazadas, movimientos y conciliación antes de mostrar saldo conciliado.

Las tres vistas comparten controles, ámbito y corte. Diseño de una columna, tarjetas apiladas y detalle expandible; tablas extensas solo como detalle/exportación futura.

## 7. Períodos y proyecciones

- Presets de 1, 3, 6 y 12 meses y rango personalizado; fechas inclusivas y misma zona comercial que la instalación (piloto: America/Lima).
- Propuesta verificable para presets: desde el primer día del mes de corte menos N−1 meses hasta el corte. Ejemplo ficticio: 3 meses al 15/10/2026 = 01/08/2026–15/10/2026.
- La interfaz mostrará siempre las fechas exactas. No comparar un mes parcial con otro completo sin indicarlo.
- Los flujos pertenecen al intervalo; los saldos pertenecen al corte. No restar snapshots actuales para inventar resultados históricos.
- Proyecciones de 30/60/90 días en una sección separada titulada «Proyección contractual / escenario», nunca dentro del resultado realizado.
- Fuente de entrada prevista: cuotas futuras pendientes con fechas acreditadas. Fuente de salida prevista: compromisos de socios, comisiones y gastos programados documentados.
- Una cuota programada no es cobro garantizado. No suponer reinversión, renovaciones, nueva financiación o repago de socios sin registros/acuerdos.
- Exponer corte, horizonte, supuestos, cobertura y obligaciones sin fecha. Las proyecciones no crean cobros, egresos, devengo ni reservas contables.
- Un escenario con tasa de cobro/costos variables requerirá parámetros explícitos y aprobación; no generar porcentajes a partir de una cartera incompleta.
- Gráficos previstos: componentes de resultado por mes, evolución de caja conciliada y principal/mora/deuda de socios. Meses sin cobertura se muestran como huecos «N/D», nunca como cero. Comparar series con igual base y denominador.
- Alertas previstas: déficit observado de caja, diferencia de conciliación, obligaciones conocidas que exceden disponibilidad y datos incompletos. Umbrales de riesgo requieren política explícita; los colores no sustituyen la evidencia y ninguna alerta escribe movimientos.

## 8. Especificación de verificación antes de implementar

| Caso ficticio requerido | Aserción verificable |
| --- | --- |
| Desembolso y recuperación del principal íntegro | Cambian caja/cartera; el principal aporta cero al resultado en ambas operaciones. |
| Cobro con capital/interés/mora y su entrada de caja | Cada componente se atribuye una vez; el flujo de caja coincide con el movimiento, sin sumarle el pago otra vez. |
| Cobro sin componentes o con suma menor que importe | El remanente queda sin clasificar; no se inventa interés ni utilidad. |
| Aporte de dueño, préstamo de socio y devolución | No generan utilidad/gasto por principal; pasivo y patrimonio permanecen diferenciados. |
| Socio histórico ya incluido en caja | La deuda existe y la caja no aumenta otra vez; períodos anteriores sin evidencia quedan no disponibles. |
| Interés de socio devengado pendiente y posterior pago | Bajo base aprobada, se reconoce una vez y su cancelación no duplica gasto. |
| Comisión generada/pagada y reverso de cobro | Pendientes y costos se concilian sin descontar generado y pagado dos veces, respetando el corte. |
| Personal, operativo y financiero con texto similar | Se clasifican por dato acreditado; el texto no decide la naturaleza ni altera antecedentes. |
| Transferencia entre dos cuentas y una pata faltante | Consolidado sin ingreso/gasto ficticio; la pata faltante genera discrepancia, no contrapartida inventada. |
| Refinanciación con deuda trasladada e importe nuevo | No duplica la cartera vieja/nueva ni convierte deuda capitalizada en cobro o utilidad. |
| Socio con devolución futura o capital cerrado e intereses vencidos | Respeta el corte y mantiene vencidos; no anticipa caja ni elimina obligaciones. |
| Corte anterior con pagos/reversos posteriores | El resultado depende solo de hechos efectivos al corte y cobertura histórica; de faltar evidencia, no disponible. |
| Duplicado, tombstone, colisión de IDs, fecha o moneda inválida | No hay sumas silenciosas, ceros sustitutos ni agregación entre monedas/ámbitos. |
| Cuenta inicial o gasto/pérdida sin clasificación | No se publica rentabilidad global ni liquidez conciliada como completa. |
| Períodos 1/3/6/12/custom y fronteras de mes | Fechas exactas, inclusividad, apertura/cierre y zona horaria consistentes. |
| Proyecciones 30/60/90 y obligaciones sin fecha | Se separan de realizado y exponen cobertura; abrir/cambiar escenario no modifica datos. |
| Cambio de usuario/proyecto/org o rol con lectura parcial | Se invalida la vista anterior; no se reutilizan cifras globales de otro ámbito. |
| Repetir consulta, recargar o abrir detalle | Misma revisión de fuentes produce mismo resultado; cero escrituras, replays o cambios a cuotas y caja. |

La implementación futura deberá probar estas invariantes con fixtures mínimos y expectativas independientes del código de cálculo.
Antes de considerar «real» un reporte se necesitará una auditoría autorizada de cobertura sobre una copia adecuada; esta revisión de fuente no la sustituye.

## 9. Decisiones que requieren revisión del diseño

1. Aprobar significado de los tres módulos y sus etiquetas de integridad; revisar los presets de fechas propuestos.
2. Definir política de devengo de interés/mora, clasificación de gastos personales, pérdidas/condonaciones y composición de refinanciación.
3. Elegir denominador de rentabilidad y requisitos de historia; sin ello se publicarán únicamente componentes trazables, nunca una tasa implícita.
4. Definir catálogo de cuentas, saldo inicial/conciliación, fondos restringidos y compromisos de socios con fecha.
5. Autorizar por separado cualquier ampliación de esquema, reglas o backend y su plan de pruebas. No se implementa en este documento.

El trabajo de comprobantes de pagos a socios pertenece a otra prioridad: puede reutilizar presentación de comprobantes de clientes, pero no convierte el comprobante en una segunda operación financiera.
No se incluyen precios, licencias, importación de cartera ni recomendaciones financieras personales. Las restricciones de `AGENTS.md` y de publicación permanecen vigentes.

## 10. Referencias de contraste y estado posterior

La separación entre flujos de financiación y resultado se contrasta con [IAS 7, IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows.html/). La clasificación de flujos de una entidad financiera requiere su política aplicable; este panel de gestión no afirma cumplimiento normativo ni reemplaza estados financieros.

El diseño de pérdidas estimadas requiere evidencia histórica, actual y prospectiva, en línea con la explicación de [IFRS Foundation sobre pérdidas crediticias esperadas](https://www.ifrs.org/news-and-events/news/2020/03/application-of-ifrs-9-in-the-light-of-the-coronavirus-uncertainty/). No se fija una tasa arbitraria de mora como pérdida definitiva.

Después de esta auditoría, los comprobantes nuevos incorporan `operationId` en el egreso y `partnerPhone` en el master. Los registros históricos mantienen la falta de uniformidad descrita; no se migraron ni se completaron por inferencia. El comprobante valida contra el pago embebido y no constituye una segunda fuente para sumar caja o gastos.
