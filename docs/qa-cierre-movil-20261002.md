# Candidata agrupada de cierre móvil — 2 de octubre de 2026

Base verificada: `8619ab5`; retorno estable preservado: `99a1dbc`.
Build: `v2-pilot-20261002-b2-mobile-final-1`.

## Pendientes reales corregidos

- La imagen de propuesta truncaba a cuatro filas un cronograma que ya contenía la quinta. Ahora propuesta previa, mensaje, imagen y detalle incluyen la adicional y el restante programado llega a cero. No se modificó el cálculo ni el registro de renovaciones.
- Todas las imágenes compartibles usan el generador común PRÉSTAMO YA según la primera referencia visual del usuario: propuesta de crédito, renovación, detalle/cronograma, comprobante y recordatorio. Iconos vectoriales, bloques compactos, tabla alternada, cierre comercial y marca. El detalle conserva el pendiente individual además del restante programado; los cronogramas largos crecen sin truncar cuotas. Compromisos de pago no tienen un generador separado de imagen en esta versión.
- La eliminación/consolidación genérica ya no puede romper una cadena de renovación, incluyendo enlaces inversos heredados. La cancelación financiera existente conserva su comportamiento.
- Cerrar sesión o cambiar de propietario sin descargar su cartera bloquea navegación y oculta datos conservados. Se cierran respaldo, panel de socios y propuestas abiertas; cancelar la propuesta libera el bloqueo de operación. No se borran filas ni colas.

## Evidencia previa a integración

- Pruebas nuevas reproducidas en rojo y verificadas en verde: cadena de renovación, privacidad de sesión, propuesta con quinta, identidad visual común.
- Regresión relacionada: renovación/edición/cancelación, quinta opcional, rehidratación, sesión offline del mismo propietario, imágenes compartibles y descarga de comprobante en PC; integración financiera ficticia de socios.
- LAB móvil 393 × 852 con Auth y Firestore locales, proyecto `demo-cartera-final`, reglas actuales del repositorio. Propuesta ficticia S/1.000 al 10%, cuatro cuotas S/200 + adicional S/300 = S/1.100; 30/10/2026, restante S/0; neto S/120. Revisión y captura de imagen sin confirmar renovación.
- Cierre de sesión en otra pestaña elimina el panel de respaldo y protege navegación. Cuenta cobrador solo ve su ruta ficticia; retorno a cuenta admin recupera ambas rutas.
- Laboratorio antes/después: 2 clientes, 2 créditos de fixture, 0 pagos, 0 operaciones, 0 auditorías; caja S/750. Ninguna escritura de producción.
- Cinco PNG reales generados en navegador e inspeccionados a tamaño celular. Cálculo de totales, estado de cuota y etiqueta del comprobante preservados literalmente.
- Revisión independiente aprobada. CI integral y comprobación de Hosting son puertas obligatorias antes de declarar el cierre.

## Aprobaciones físicas preservadas

El usuario aprobó Redmi: pago offline único del 28/09, comprobante, reconexión y cero pendientes; reapertura offline/reconexión; quinta en formulario y en renovación aceptada con cuatro S/100 + adicional S/560 = S/960. No se repiten esas operaciones. El bloque actual conserva el transporte de compartir y la lógica financiera; no requiere otro pago o renovación física.

## Publicación

Una sola publicación de este conjunto: exclusivamente Hosting V2 con `firebase.v2.json`. No desplegar reglas, Auth, datos, ni V1. Después comparar todos los archivos servidos con la candidata integrada y comprobar build/actualización desde la interfaz móvil.
