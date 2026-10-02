# Pendientes verificados después de la aprobación Redmi

Base y retorno: 8619ab5, con quinta cuota y actualización Redmi aprobadas por el usuario. Se conserva también 99a1dbc. No repetir esas pruebas ni operar sobre datos reales.

La revisión del historial/QA encontró dos rutas activas sin cobertura: eliminación genérica de un sucesor renovado que deja el origen fuera de cartera; y navegación a datos locales conservados tras cerrar sesión o cambiar de cuenta sin completar la hidratación. El usuario añadió la presentación previa truncada de la quinta cuota y la uniformidad visual de todas las imágenes compartibles.

Diseño mínimo: bloquear eliminación/consolidación genérica de cualquier crédito ligado a una cadena, conservando la cancelación financiera existente; proteger visualización y navegación con Auth verificado y propietario de la copia local, sin borrar filas ni colas. La sesión offline válida del mismo propietario debe seguir disponible. No cambiar reglas, permisos, Auth ni lógica de la quinta cuota.

- [ ] Reproducir ambas rutas con fixtures y pruebas rojas.
- [ ] Aplicar guardas y pruebas verdes, con regresión estrictamente relacionada.
- [ ] QA UI móvil aislado con Auth/Firestore ficticios.
- [ ] Revisión final, CI e integración agrupada.
- [ ] Una única publicación Hosting V2 del conjunto, verificación de archivos/build/actualización.
- [ ] Checklist final y puntos de retorno preservados.

Solo se solicitará una prueba física nueva si los cambios dejan una regresión específica de Android sin cobertura suficiente.

Diseño visual autorizado por el usuario: usar la primera referencia PRÉSTAMO YA como estándar para propuesta, renovación, detalle, comprobante y recordatorio. Un único generador Canvas con encabezado degradado, iconos vectoriales, bloques compactos en dos columnas, mensaje comercial, tabla legible con filas alternadas y cierre de marca. Conservar los datos, saldos individuales y estado de cuotas; añadir saldo restante al cronograma de detalle para terminar en cero sin sustituir el saldo individual existente. No cambiar cálculos ni registro. Las imágenes largas deben crecer para conservar todo el cronograma; las propuestas comunes mantienen el resumen de primeras cuotas. No existe un generador independiente de imagen para compromisos de pago.
