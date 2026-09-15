# Hallazgo crítico — persistencia posterior a pullCloud

En `firebase-cloud-core.js`, `pullCloud()` termina actualmente después de `dedupeClients(true)` sin ejecutar explícitamente `saveCloudDb()`, `normalize()` ni `renderAll()`.

Esto puede dejar una descarga Cloud fusionada en memoria sin persistencia/render inmediato cuando `pullCloud()` se invoca desde el inicio de sesión. `cloudSyncNow()` sí guarda después del pull, pero el flujo de login llama `pullCloud(); pushLocalAllowed();` sin un `saveCloudDb()` posterior.

## Corrección requerida
Añadir al final de `pullCloud()`:

```js
saveCloudDb();
try{ normalize(); }catch(_){}
try{ renderAll(); }catch(_){}
```

La corrección debe aplicarse preservando íntegramente el archivo actual y validarse con QA antes de merge a `main`.
