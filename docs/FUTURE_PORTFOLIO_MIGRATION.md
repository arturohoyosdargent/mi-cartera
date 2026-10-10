# Siguiente módulo comercial: Migrar cartera desde otro sistema

Documentado para una fase posterior. No implementado ni habilitado en este candidato.

Permitir a un nuevo usuario revisar una importación masiva Excel/CSV/respaldo compatible. Incluir clientes, créditos, saldos, cronogramas y pagos históricos únicamente cuando haya evidencia suficiente. Los antecedentes desconocidos permanecen desconocidos; no inferir cuotas o pagos por monto.

El diseño deberá incluir validación previa de formato y consistencia, detección de duplicados y errores, resumen de lo encontrado, vista previa de los cambios y confirmación explícita antes de importar. Seleccionar o leer un archivo nunca modifica V2 ni importa automáticamente. Aislar organización y propietario, conservar trazabilidad, respaldos y la distinción entre código y datos.

La antigua función “Importar clientes desde V1” no será la base de este diseño. Antes de implementar se acordarán formatos, resolución de conflictos, alcance financiero y casos de prueba con archivos ficticios. No añadir ahora handlers de archivos, escrituras Cloud, cambios de esquema ni importadores.
