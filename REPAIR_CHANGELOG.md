# Repair changelog

Rama: `repair-audit-2026-09-15`

- Se añadió auditoría financiera no destructiva.
- Se definieron invariantes de integridad para créditos y pagos.
- Se documentaron pruebas de pagos, idempotencia y Cloud/offline.
- Se confirmó que `pullCollection()` conserva IDs documentales de Firestore.
- Se confirmó que el merge Cloud/local protege relaciones de créditos y pagos existentes.
- Se identificó que `pullCloud()` necesita persistencia/normalización/render explícitos al finalizar.
- Se identificó que la corrección de cronograma no debe sustituir al ledger de pagos como fuente de validación.

Ninguna reparación de esta rama debe inventar, borrar o alterar movimientos financieros reales sin evidencia.
