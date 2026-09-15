# Hotfix móvil — diagnóstico

Incidencia observada en móvil: `Uncaught SyntaxError: missing ) after argument list`.

Este hotfix no modifica pagos, créditos, importes ni datos históricos.

Cambios:
- captura temprana de errores de runtime con archivo, línea y columna cuando el navegador los expone;
- loader v55 para limpiar caché de scripts de forma controlada una vez;
- payment sync hardening v2: el encolado se difiere al siguiente tick para conservar el método de pago final actualizado por `payment-methods.js`;
- cache-bust del módulo de pagos a `v=2`.

Criterio de cierre: QA sintáctico del PR + reproducción móvil con diagnóstico de archivo/línea si el error persiste.
