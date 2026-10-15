---
name: metabase-connection
description: Conexión a Metabase v0.55.x desde Node.js/Express (solo lectura) vía API key, con cliente reutilizable, caché TTL y descubrimiento de columnas reales. Usar al integrar cualquier app con Metabase o SAI_TEST.
---

# Conexión a Metabase (v0.55.x) — Skill reutilizable

Patrón verificado en producción (Dashbord-Equipos ↔ SAI_TEST db=5).

## Reglas de oro
1. **La API key vive SOLO en el backend.** El navegador nunca habla con Metabase (sin CORS interno + exposición de credenciales).
2. **Solo lectura**: nunca INSERT/UPDATE/DELETE ni crear/archivar preguntas o dashboards.
3. **Nunca armar SQL con texto libre del usuario**: las búsquedas se hacen en memoria sobre la lista cacheada.
4. **No loguear API key ni datos personales completos.** Proyectar solo campos necesarios.
5. Detectar columnas reales antes de mapear; no inventar nombres ni asumir motor SQL.

## Autenticación
Header `x-api-key`. La key debe pertenecer a un grupo con permisos de solo consulta sobre la BD destino.

## Formato correcto de POST /api/dataset (FIX crítico v0.55.x)
El body DEBE incluir `database` en el nivel superior junto a `type` y `query`:

```js
// ✅ Correcto
{
  database: 5,                 // ← si falta: error 400 "Se requiere `database`..."
  type: 'query',
  query: { 'source-table': 1406, limit: 2000, offset: 0 }
}

// ❌ Incorrecto (falla con 400)
{ query: { type: 'query', database: 5, 'source-table': 1406 } }
```

Para native: `{ database: 5, type: 'native', native: { query: '...' }, parameters: [] }`.

## Límite de filas y paginación
- `/api/dataset` devuelve máximo **2000 filas** por request.
- Paginar con `limit`/`offset` hasta recibir una página `< pageSize`.
- Alternativa sin límite: pregunta guardada → `POST /api/card/{id}/query/json` (configurable por env `METABASE_CARD_ID`).
- Guardar contra tablas gigantes: cortar la paginación a 100k filas y lanzar error claro.

## Cliente base (ES Modules, fetch nativo, Node 20+)
```js
import { config } from '../config.js';

class MetabaseError extends Error {
  constructor(message, { status, body } = {}) { super(message); this.name='MetabaseError'; this.status=status; this.body=body; }
}

async function request(path, { method='GET', body, timeoutMs=config.metabase.timeoutMs }={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.metabase.url}${path}`, {
      method,
      headers: { 'x-api-key': config.metabase.apiKey, ...(body?{'Content-Type':'application/json'}:{}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let json; try { json = await res.json(); } catch { throw new MetabaseError(`Respuesta no JSON (HTTP ${res.status})`, {status:res.status}); }
    if (!res.ok) throw new MetabaseError(`Metabase respondió ${res.status}: ${json?.message||json?.error||''}`, {status:res.status, body:json});
    if (json?.error) throw new MetabaseError(`Error de Metabase: ${json.error}`, {status:res.status, body:json});
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new MetabaseError(`Timeout (${timeoutMs} ms)`);
    throw err instanceof MetabaseError ? err : new MetabaseError(`No se pudo conectar: ${err.message}`);
  } finally { clearTimeout(timer); }
}

/** data.cols + data.rows → array de objetos */
export function datasetToObjects(data) {
  const cols=(data?.cols||[]).map(c=>c.name), rows=data?.rows||[];
  return rows.map(r=>Object.fromEntries(cols.map((c,i)=>[c,r[i]])));
}

function lowerCaseKeys(objs){ return objs.map(o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k.toLowerCase(),v]))); }

export async function tabla(tableId, { limit, offset }={}) {
  const inner={'source-table':tableId};
  if(limit!=null) inner.limit=limit;
  if(offset!=null) inner.offset=offset;
  const json=await request('/api/dataset',{method:'POST',body:{database:config.metabase.dbId,type:'query',query:inner}});
  return lowerCaseKeys(datasetToObjects(json.data));
}

export async function sql(consulta, params=[]){
  const json=await request('/api/dataset',{method:'POST',body:{database:config.metabase.dbId,type:'native',native:{query:consulta,'template-tags':{}},parameters:params}});
  return lowerCaseKeys(datasetToObjects(json.data));
}

/** GET /api/database/:id/metadata → engine + tables[].fields[] (descubrimiento) */
export async function databaseMetadata(dbId=config.metabase.dbId){ return request(`/api/database/${dbId}/metadata`); }
```

## Descubrimiento de columnas (siempre primero)
Antes de escribir cualquier mapeo, correr un script que:
1. Lea `engine` de `GET /api/database/{id}/metadata` (no asumir postgres/sqlserver).
2. Liste `tables[].fields[]` (nombre, base_type, primary_key) de la tabla destino.
3. Muestre solo nombres/tipos — nunca valores de columnas sensibles.

## Patrón de arquitectura por capas
```
routes/   → zod valida query/params; NUNCA toca Metabase
services/ → cache en memoria {data, timestamp} + TTL; getUsers(q) filtra en memoria; refreshUsers() bypass TTL
queries/  → TODAS las consultas a la BD destino (usuariosAccesos(), etc.); agregar consulta = 1 función acá
clients/  → HTTP puro (request/tabla/sql/metadata)
config.js → valida envs obligatorias al arrancar (throw si faltan)
```

## Caché con TTL + inflight dedupe
```js
let cache={data:null,timestamp:0}, inflight=null;
const isValid=()=>cache.data&&(Date.now()-cache.timestamp)<TTL_MS;
async function load(){ /* fetch + normalizar + proyectar */ }
export async function get(q=''){
  if(!isValid()) { if(!inflight) inflight=load().finally(()=>inflight=null); await inflight; }
  return q ? filterEnMemoria(cache.data,q) : cache.data;
}
```

## Normalización de búsqueda
`String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')` sobre id/nombre/área.

## Endpoints mínimos recomendados
- `GET /health` → `{status:"ok",service:"..."}` (para Docker/monitoreo)
- `GET /api/.../usuarios?q=` → `{success,count,data,cache:getCacheStatus()}`
- `POST /api/.../usuarios/refresh` → fuerza recarga

## Seguridad Express
`helmet()` + `cors({origin:ALLOWED_ORIGINS.split(',')})` + `express.json({limit:'100kb'})` + middleware central de errores que traduce `MetabaseError→502` y `ZodError→400` sin loggear payloads.

## Variables de entorno (.env.example)
```bash
PORT=4000                      # NO 3000 (lo usa Vite/Metabase)
METABASE_URL=http://host:3000
METABASE_API_KEY=...           # sin prefijo VITE_
METABASE_DB_ID=5
METABASE_TIMEOUT_MS=15000
SAI_USUARIOS_TABLE_ID=1406     # source-table id (sale de la URL o metadata)
METABASE_PAGE_SIZE=2000
METABASE_CARD_ID=              # opcional: pregunta guardada p/ >2000 filas
ALLOWED_ORIGINS=http://localhost:5173
USERS_CACHE_TTL_MS=300000
```

## Troubleshooting de errores reales encontrados
| Error | Causa | Fix |
|---|---|---|
| 400 "Se requiere `database` para todas las consultas cuyo tipo no sea internal" | body sin `database` arriba | agregar `database` en el nivel superior del POST |
| 401/403 | API key inválida o grupo sin permisos | revisar grupo de la key en Admin > Permissions |
| Tabla devuelve 0 filas | source-table id equivocado | confirmar id abriendo la tabla en Metabase (URL base64 decodificada muestra `"source-table":NNNN`) |
| Timeout en red interna | DNS/firewall | probar curl desde el mismo host; extra_hosts en compose |
| `ERR_MODULE_NOT_FOUND` entre routes/services | nombres de archivo inconsistentes (usuariosService vs usersService) | unificar nombre e import/export; verificar exports con grep |
| Columnas en MAYÚSCULAS según motor | normalizar keys a lowercase antes de mapear | helper `lowerCaseKeys` |

## Obtener el source-table id desde la UI de Metabase
Abrir la tabla → copiar URL `http://host:3000/question#eyJkYXRhc2V0X3F1ZXJ5...` → decodificar el fragmento base64 → `"source-table":1406`.

## Prueba mínima (scripts/testMetabase.js)
Imprime: engine detectado, cantidad de filas, nombres de columnas (sin valores). Sale con `process.exitCode=1` en error (evitar `process.exit()` en Windows + --watch).

## Docker (despliegue en red interna)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 4000
CMD ["node","src/index.js"]
```
compose: `ports: 4000:4000`, `env_file: .env`, `extra_hosts` para alcanzar el host de Metabase desde el contenedor. Evitar `VITE_` en envs de backend.