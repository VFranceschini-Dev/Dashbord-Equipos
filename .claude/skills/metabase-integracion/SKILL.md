---
name: metabase-integracion
description: Lectura de Metabase (v0.55.x, tabla SAI_TEST UsuariosAccesos) desde una app React+Vite+Supabase desplegada en Vercel, usando funciones serverless como único punto que conoce la API key. Skill unificado (ex metabase-connection + metabase-supabase-integration). Usar al integrar, depurar o extender la conexión con la base externa de solo lectura.
---

# Integración Metabase ↔ Supabase (arquitectura Vercel)

Skill unificado. Reemplaza a los antiguos `metabase-connection` y
`metabase-supabase-integration`, actualizados a la arquitectura real del proyecto:
**ya no existe backend interno Node/Express (`server/`) ni proxy propio**; la lectura
de la base externa pasa por **funciones serverless de Vercel** (`api/*.ts`).

## Reglas de oro
1. **La API key vive SOLO en las funciones de Vercel** (env vars sin prefijo `VITE_`).
   El navegador nunca habla con Metabase ni con la API externa: ni CORS ni exposición de credenciales.
2. **SAI_TEST es solo lectura**: nunca INSERT/UPDATE/DELETE, ni crear/archivar preguntas o dashboards.
   El ABM se hace únicamente sobre Supabase.
3. **Nunca armar SQL con texto libre del usuario**: la búsqueda (`?q=`) se filtra EN MEMORIA
   sobre la lista cacheada.
4. **No loguear API key ni datos personales completos.** Proyectar solo campos necesarios.
5. Detectar columnas reales antes de mapear; no inventar nombres ni asumir motor SQL.

## Arquitectura actual

```
navegador (React/Vite en Vercel)
   │  fetch('/api/usuarios') + header Authorization: Bearer <token Supabase>
   ▼
función serverless api/usuarios.ts (Vercel, Node runtime)
   │  valida sesión con supabase.auth.getUser(token) → si no: 401
   │  x-api-key (env IPA_API_KEY, NUNCA visible en el bundle)
   ▼
Metabase v0.55.x expuesto públicamente por HTTPS → SAI_TEST (db=5, solo lectura)

Paralelo: navegador ──HTTPS(anon key)──> Supabase (ABM, Auth, RLS por user_id)
```

## Autenticación con Metabase
Header `x-api-key`. La key debe pertenecer a un grupo con permisos **solo de consulta**
sobre la BD destino. Si la key se filtró alguna vez (historial git público): rotarla.

## Formato correcto de POST /api/dataset (fix crítico v0.55.x)
El body DEBE incluir `database` en el nivel superior, junto a `type` y `query`:

```js
// ✅ Correcto — sin esto: 400 "Se requiere `database` para todas las consultas cuyo tipo no sea internal"
{ database: 5, type: 'query', query: { 'source-table': 1406, limit: 2000, offset: 0 } }

// ❌ Incorrecto (database dentro de query)
{ type: 'query', query: { database: 5, 'source-table': 1406 } }
```

Para native: `{ database: 5, type: 'native', native: { query: '...' }, parameters: [] }`.

## Límite de filas y paginación
- `/api/dataset` devuelve máximo **2000 filas** por request.
- Paginar con `limit`/`offset` hasta recibir una página `< pageSize` (corte de seguridad a 100k filas).
- Alternativa sin límite: pregunta guardada → `POST /api/card/{id}/query/json` (env opcional `METABASE_CARD_ID`).

## Columnas REALES de UsuariosAccesos (source-table 1406, SAI_TEST db=5)
Confirmadas por descubrimiento en producción — no inventar otras:

| Columna | Uso |
|---|---|
| `usuariosaccesoid` (PK) | id externo → se guarda como `usuario_ref` en Supabase |
| `nombre` | login (p. ej. `MSQUINA`) |
| `descripcion` | nombre completo (algunos registros traen `[Descripción Usuario ...]`) |
| `perfil`, `ubicacionid` | códigos numéricos |
| `tipo` | `"U"` = persona; otros valores = cuentas genéricas/perfiles (CAJA, VENTAS…) |
| `activo` | estado |
| `gestionid`, `ultimoacceso` | auxiliares |
| `contrasenia`, `servicekey_path`, `identityrecord`, `vencimiento*`, `contraseniaperiodo` | **SENSIBLES → excluidas de toda proyección** |

### Proyección segura (toPublicUser)
Devolver SOLO: `id, usuario (nombre), nombreCompleto (descripcion), perfilId, ubicacionId, tipo, activo`.

```js
function toPublicUser(row) {
  const val = k => (row[k] != null ? String(row[k]).trim() : null);
  return {
    id: val('usuariosaccesoid'),
    usuario: val('nombre'),
    nombreCompleto: val('descripcion'),
    perfilId: val('perfil'),
    ubicacionId: val('ubicacionid'),
    tipo: val('tipo'),            // 'U' = persona
    activo: val('activo'),
  };
}
```

Búsqueda normalizada: `String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')`
(sin tildes) sobre id/usuario/nombreCompleto. Filtros opcionales: `soloActivos`, `soloPersonas` (tipo==='U').

## Cliente base (ES Modules, fetch nativo, Node 20+)
Ver `references/metabase-client.js` (versión completa con `tabla()`, `sql()`, `databaseMetadata()`).
Núcleo:

```js
async function request(path, { method='GET', body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'x-api-key': API_KEY, ...(body ? {'Content-Type':'application/json'} : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let json; try { json = await res.json(); } catch { throw new ExternalError(`Respuesta no JSON (HTTP ${res.status})`, {status: res.status}); }
    if (!res.ok) throw new ExternalError(`Metabase respondió ${res.status}`, {status: res.status});
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new TimeoutError(`Timeout (${timeoutMs} ms)`);
    throw err;
  } finally { clearTimeout(timer); }
}
/** data.cols + data.rows → array de objetos, claves a lowercase (ciertos motores devuelven MAYÚSCULAS) */
export function datasetToObjects(data) {
  const cols = (data?.cols || []).map(c => c.name.toLowerCase()), rows = data?.rows || [];
  return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}
```

## Función serverless (api/usuarios.ts) — contrato
- Valida sesión: `Authorization: Bearer <token>` → `supabase.auth.getUser(token)`; sin sesión válida → **401**.
- Parámetros aceptados (validados con zod): `q` (texto ≤ 120 chars), `soloActivos`, `soloPersonas`. Nada más.
- Respuesta: solo los campos proyectados. Códigos: 200 ok, 400 validación, **502** API externa falla, **504** timeout.
- Caché en memoria de instancia + TTL (~5 min) + dedupe inflight; header `Cache-Control: private, max-age=60`.
  En serverless el caché es **solo de mejor esfuerzo** (se pierde al escalar/rotar instancias).
- Errores: mensajes técnicos claros, sin PII ni keys en logs.

## Patrón de capas (dentro de la función o módulos compartidos `api/_lib/`)
```
routes (handler) → zod valida query; NUNCA toca Metabase
services         → cache TTL + toPublicUser + filtro/búsqueda en memoria
queries          → TODAS las consultas a la BD externa (usuariosAccesos()); agregar consulta = 1 función acá
clients          → HTTP puro (request/tabla/sql/metadata)
config           → valida envs obligatorias al invocar (throw con nombre de variable faltante)
```

## Variables de entorno (funciones Vercel — sin prefijo VITE_)
```bash
IPA_API_URL=https://ipa.donnet.com.ar     # Metabase publicado por HTTPS
IPA_API_KEY=...                           # grupo con permisos SOLO de consulta sobre SAI_TEST
IPA_DB_ID=5                               # SAI_TEST
IPA_USUARIOS_TABLE_ID=1406                # source-table UsuariosAccesos
SUPABASE_URL=...                          # para validar el token de sesión
SUPABASE_ANON_KEY=...                     # anon key (no service role)
IPA_TIMEOUT_MS=15000                      # opcional
USERS_CACHE_TTL_MS=300000                 # opcional
```
En `.env.example` van **sin valores reales**. Cargar en Vercel → Settings → Environment Variables
(Production + Preview + Development).

## Descubrimiento de columnas (siempre primero)
Antes de escribir cualquier mapeo, correr `references/test-metabase-script.js`:
1. Lee `engine` de `GET /api/database/{id}/metadata` (no asumir postgres/sqlserver).
2. Lista `tables[].fields[]` (nombre, base_type, primary_key) de la tabla destino.
3. Muestra solo nombres/tipos — nunca valores de columnas sensibles.

## Lado Supabase (ABM): patrón "primero Supabase, después el estado"
- **Alta**: crear objeto SIN id local (`uuidv4` no: un update sobre id inexistente no inserta), llamar
  `sync*ToSupabase` (hace create y asigna el id devuelto), y recién si `success` agregar al estado.
- **Modificación**: enviar objeto COMPLETO; actualizar estado solo si sale bien.
- **Baja**: borrar en Supabase primero; quitar del estado solo si sale bien.
- Resultados normalizados `{ success: boolean; error?: string }` en todas las funciones de sync.
- Usuarios externos se guardan como `usuario_ref` + cache de login/nombre (no copiar la tabla).
- Movimientos/asignaciones: RPC atómica (`registrar_equipment_movement` / `asignar_equipos`) que
  inserta y actualiza `equipments.status` en una sola transacción. Ver `references/supabase-abm-pattern.ts`.

## Frontend (Vite)
- Servicio `src/services/metabaseProxy.ts` llama SOLO a `/api/usuarios` con el token de la sesión.
- Si la función no responde: aviso claro y seguir mostrando lo guardado en Supabase (degradación elegante).
- Desarrollo local: `vercel dev` (monta `api/` + Vite) o `npm run dev` + `npx vercel dev`.

## Seguridad (checklist)
- [ ] `.env` en `.gitignore`; `.env.example` sin valores reales.
- [ ] API key de un grupo Metabase con permisos SOLO de consulta; rotada si se filtró.
- [ ] Ninguna variable secreta con prefijo `VITE_` (se compila en el bundle).
- [ ] Nunca loguear API keys ni datos personales completos.
- [ ] Sesión Supabase validada en cada invocación de la función (401 sin token válido).
- [ ] Zod en toda entrada; búsqueda siempre en memoria.

## Troubleshooting de errores reales encontrados
| Error | Causa | Fix |
|---|---|---|
| 400 "Se requiere `database`…" | body sin `database` arriba | poner `database` en el nivel superior del POST |
| 401/403 de Metabase | API key inválida o grupo sin permisos | revisar grupo de la key en Admin > Permissions |
| Tabla devuelve 0 filas | source-table id equivocado | abrir la tabla en Metabase y decodificar el fragmento base64 de la URL (`"source-table":NNNN`) |
| CORS / fetch falla del navegador | el frontend apunta directo a la API externa | todo debe pasar por `api/usuarios.ts` |
| Timeout | red lenta o DNS | subir `IPA_TIMEOUT_MS`; probar curl contra la función, no contra Metabase |
| Claves en MAYÚSCULAS según motor | normalizar keys a lowercase | helper `datasetToObjects` ya lo hace |
| 401 inesperado de la función | token expirado / SUPABASE_URL mal configurado | revisar sesión en cliente y envs de la función |

## Referencias (`references/`)
| Archivo | Qué contiene |
|---|---|
| `metabase-client.js` | Cliente completo: x-api-key, AbortController, formato correcto de `/api/dataset`, paginación offset, card query, metadata |
| `queries-example.js` | Queries SAI_TEST: `usuariosAccesos()` + descubrimiento de columnas vía metadata |
| `metabase-usuarios-service.js` | Caché TTL + dedupe + proyección segura sobre columnas REALES de UsuariosAccesos |
| `test-metabase-script.js` | Prueba de conexión sin datos personales (motor, filas, columnas) |
| `supabase-abm-pattern.ts` | Patrón ABM `{success,error?}`, alta sin uuid local, modal cierra solo si success |

Historial: estos patrones nacieron con un backend Express interno (`server/`, puerto 4000, Docker en LAN),
luego con un proxy interno en `ipa.donnet.com.ar/api`, y hoy viven en funciones serverless de Vercel.
Las referencias conservan la lógica de cliente/servicio (paginación, timeout, proyección), que sigue vigente
tal cual dentro de la función.
