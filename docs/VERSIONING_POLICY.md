# Versiones estables sucesivas y recuperación de código

Regla permanente autorizada el 2026-10-09. Una versión histórica no es el destino fijo de rollback.

Cada versión sigue: candidato por SHA → QA y regresión integral → autorización de publicación controlada → publicación única → validación física PC y Android/PWA → aprobación explícita → nueva estable.

Publicar o pasar pruebas técnicas no convierte un candidato en estable. La aprobación debe identificar SHA/build y registrar la matriz física. Sólo entonces se crea un tag estable nuevo e inmutable, se actualiza el catálogo certificado `v2/app/stable-catalog-v2.js` y se registra la estable anterior como respaldo adicional. Nunca se mueve ni sobrescribe un tag existente. Los metadatos del catálogo se distribuyen mediante un candidato administrativo autorizado; no alteran retroactivamente el artefacto aprobado.

Antes de publicar otro candidato deben existir el artefacto exacto, el tag remoto y el registro de la última estable aprobada y de su inmediatamente anterior. Si aparece una falla específica, se corrige primero sobre la línea más reciente conservando todas las mejoras aprobadas. Si el rollback es imprescindible, se vuelve a la estable inmediatamente anterior a la versión problemática; no se salta a una versión histórica que pierda mejoras posteriores. Registrar destino, motivo, autorización y verificación del contenido servido.

La vía continúa siendo `docs/PUBLICATION_CONTROL.md`: workflow Firebase manual protegido por SHA, revisión humana y controles administrativos. Ninguna promoción ni tag permite deploy automático. Pages y Firebase CLI local no se habilitan por esta política.

## APP/CÓDIGO frente a DATOS

“Restaurar última versión estable” se refiere al código certificado. La interfaz prepara una solicitud administrativa con el SHA/build/tag del catálogo, previa confirmación; no contiene credenciales ni ejecuta una publicación Hosting. Una restauración efectiva requiere autorización y el procedimiento protegido. “Buscar y actualizar app publicada” es una acción auxiliar diferente, que busca la publicación actual y conserva datos.

La recuperación de código nunca restaura, borra, importa ni reemplaza clientes, créditos, cuotas, pagos, caja, operaciones pendientes ni respaldos financieros. La importación explícita de un respaldo V2 sigue siendo un flujo separado con sus confirmaciones. No se borra localStorage financiero, Firestore ni datos Cloud durante una recuperación de versión.

## Registro inicial conservador

- Estable con aprobación física global registrada: `43a7afa2ab629cdc7b4c7db9856dbd10eae61f71`, build `v2-pilot-20261008-b2-socios-pwa-session-1`, tag `stable-rollback-v2-20261008-43a7afa`. Inmutable.
- Publicación más reciente conservada: `fa36b2e48fa811f5de84e51e336922db3ed562a5`, build `v2-pilot-20261008-b2-whatsapp-receipts-1`, tag `candidate-whatsapp-receipt-release-20261008-1`. No se presupone aprobación física global ni se recomienda sustituirla por la histórica.
- Este candidato incorpora mejoras posteriores y no se publica ni se promueve automáticamente. No existe un registro anterior suficiente para rellenar `previous`; permanece vacío sin inventar una estable.

El SHA inicial del catálogo es metadato certificable, no una constante de destino en el algoritmo de recuperación. Al aprobar una nueva estable se actualizan `current` y `previous` mediante el procedimiento anterior, conservando todos los tags y la historia.
