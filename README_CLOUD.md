# Mi Cartera PRO V19 Cloud

## 1. Crear el proyecto
1. Entra a Firebase Console.
2. Crea un proyecto nuevo.
3. Agrega una aplicación Web.
4. Copia la configuración a `firebase-config.js`.
5. Activa Authentication > Email/Password.
6. Crea Cloud Firestore en modo bloqueado.

## 2. Crear al primer administrador
En Authentication crea manualmente el primer usuario (correo + contraseña). Luego, en Firestore crea:
`users/{UID}`
con:
- `uid`: UID del usuario
- `orgId`: `mi-cartera`
- `name`: tu nombre
- `email`: tu correo
- `role`: `admin`
- `routeIds`: []
- `active`: true

## 3. Reglas y función
Instala Firebase CLI y ejecuta en esta carpeta:
`firebase login`
`firebase use TU_PROJECT_ID`
`firebase deploy --only firestore:rules,functions`

La función `createCarteraUser` permite al administrador crear cuentas de cobradores/supervisores/consulta desde la app sin exponer la clave administrativa. Las reglas impiden que un cobrador se autoasigne permisos.

## 4. Publicar la web
Sube el contenido web a GitHub Pages como en las versiones anteriores. Firebase Authentication y Firestore seguirán funcionando desde el dominio HTTPS de GitHub Pages si ese dominio está autorizado en Authentication > Settings > Authorized domains.

## 5. Prueba mínima
1. Entra como administrador.
2. Cloud > Iniciar sesión.
3. Usuarios > Crear acceso Cloud.
4. Crea un cobrador.
5. Asigna su ruta.
6. Abre la misma URL en otro celular.
7. El cobrador inicia sesión y solo debe acceder a sus rutas/operaciones permitidas.
8. Prueba sin internet y luego vuelve a conectar.

## Seguridad
No uses reglas `allow read, write: if true` en producción. Las reglas incluidas usan Authentication + roles + rutas. Antes de operar con dinero real, probarlas en el emulador y revisar los permisos.
