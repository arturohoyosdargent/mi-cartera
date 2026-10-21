# Candidato local — no publicado

Base: `b22816b87eced0eb736e7a2e269d0d9194a25302`.
Identidad separada: `v2-pilot-20261021-b2-continuation-1`.

Correcciones limitadas a reproducciones con datos ficticios:

1. Ambas renovaciones conservan la referencia del beneficiario y la atribución de la ruta heredada; los compromisos permanecen en el predecesor y no se trasladan como deuda nueva.
2. La agenda muestra cada compromiso por cuota y prioriza en el resumen el de fecha prometida más próxima; los saldos y vencimientos no cambian.
3. La eliminación rechaza identificadores durables contradictorios y datos pagados/saldos no verificables antes de una acción destructiva.
4. La cola conserva operaciones encoladas durante una respuesta pendiente, respeta cierres administrativos concurrentes y vuelve a comprobar no-replay antes de ejecutar cada operación.
5. Rutas/gestores requieren coherencia con Firebase Auth real; las asignaciones no admiten clientes o créditos eliminados lógicamente ni crean membresías.
6. La asignación incorpora búsqueda local por nombre normalizado, DNI, teléfono y referencia, sin selección implícita de otro cliente ni modificación financiera.

Pruebas nuevas: `v2/tests/continuation-20261021.spec.js`. Los dos contratos administrativos de identidad/catálogo se actualizan para el candidato y la nueva estable. La etapa local anterior conservó las pruebas ya aprobadas. La solicitud posterior del usuario autoriza integrar este candidato y ejecutar ahora la regresión completa.

No se modifican reglas, backend, motores financieros, datos reales ni producción. No se despliega ni se restaura. La integración se prepara en la rama development/v2-b2-continuation-20261021, desde el SHA estable indicado, por solicitud expresa del usuario. El commit de desarrollo no autoriza publicar. Una publicación futura exige su autorización explícita por SHA completo y aprobación humana del environment v2-production; la aceptación física de estas correcciones sigue pendiente.
