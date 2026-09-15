# Hallazgo — cronograma y pagos

`payment-schedule-fix.js` recalcula el cronograma de crédito desde valores visibles en el formulario y persiste el crédito, pero no usa el ledger `db.payments` como fuente para validar pagos ya registrados.

Riesgos a cubrir antes de producción:
- no deduplicar pagos por importe/fecha, porque dos cobros legítimos pueden coincidir;
- deduplicar únicamente por ID estable del movimiento;
- detectar diferencias entre `credit.paid`, suma del ledger y suma aplicada al cronograma;
- reportar pagos huérfanos antes de cualquier reparación;
- no borrar ni modificar importes reales automáticamente.

El auditor `financial-integrity-v1.js` agregado en esta rama realiza estas verificaciones de forma no destructiva.
