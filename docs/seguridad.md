# Seguridad

> Documento consolidado. Reemplaza a: `SEGURIDAD_CAMBIOS.md` (origen de la migración de login).
> El detalle del login hardcodeado → Supabase Auth está en `docs/MIGRACION_BACKEND_AUTH.md`.

## Principios aplicados

1. **Credenciales fuera del repositorio.** `.env` en `.gitignore`; `.env.example` solo con placeholders.
   Antes de commitear cualquier doc, revisar que no queden contraseñas, API keys ni URLs con credenciales.
2. **API key externa solo en serverless.** La key de `ipa.donnet.com.ar/api` vive en variables de Vercel
   sin prefijo `VITE_`. Nada con prefijo `VITE_` puede ser secreto: se compila dentro del bundle.
3. **SAI_TEST es de solo lectura.** La key debe pertenecer a un grupo con permisos exclusivos de
   consulta sobre esa base. Ninguna escritura (INSERT/UPDATE/DELETE) sale hacia la fuente externa.
4. **ABM únicamente en Supabase**, protegido por RLS (`auth.uid() = user_id`) con anon key pública.
5. **Sin usuarios hardcodeados**: el login usa Supabase Auth. Práctica abandonada documentada en
   `docs/MIGRACION_BACKEND_AUTH.md` y `docs/SEGURIDAD_CAMBIOS.md`.
6. **Validación de entrada en las funciones**: zod sobre query params; búsquedas resueltas en memoria —
   nunca se arma SQL/consultas con texto libre del usuario.
7. **Proyección mínima de datos personales**: la función `/api/usuarios` devuelve solo id, login, nombre,
   perfilId, ubicacionId, tipo y activo. Columnas como `contrasenia`, `servicekey_path`, `identityrecord`
   o vencimientos jamás salen del servidor.
8. **Logs limpios**: no loguear API keys ni payloads con PII; errores tipados (502 fuente externa,
   504 timeout, 401 sin sesión válida).

## Checklist ante rotación de compromisos

- [ ] Generar API key nueva (grupo solo-consulta SAI_TEST) y cargarla en Vercel.
- [ ] Revocar la key anterior en Metabase/Admin.
- [ ] Si una credencial llegó a comitearse: **cambiar la contraseña ya** (queda en el historial de git
      aunque se borre del árbol) y evaluar purga con BFG si el repo lo exige.
- [ ] Auditar historial: `git log -p -S "x-api-key"` y `git log -p -S "password"` desde un clone completo
      (este working tree tiene historia *grafted*: el `-S` no cubre commits anteriores al graft).

## CORS / exposición

- Las funciones de Vercel solo aceptan llamadas con JWT válido de Supabase (401 en caso contrario),
  por lo que no depende de `ALLOWED_ORIGINS` como control de acceso.
- Verificar en producción: pestaña Red del navegador → ninguna request del front hacia
  `ipa.donnet.com.ar` directa, ningún header `x-api-key` saliendo del borde.
