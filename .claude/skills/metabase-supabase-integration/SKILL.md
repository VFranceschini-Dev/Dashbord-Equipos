---
name: metabase-supabase-integration
description: Patrón de integración para apps React/Vite + Supabase que necesitan leer datos desde Metabase (red interna) sin exponer credenciales. Usar cuando el proyecto deba conectar con una API REST de Metabase, montar un backend intermedio Node/Express, leer tablas fuente vía /api/dataset, cachear usuarios y guardar ABM en Supabase con RLS. Cubre cliente Metabase reutilizable (x-api-key, timeout, paginación 2000 filas), arquitectura en capas (clients/queries/services/routes), seguridad (API key solo en backend, helmet, CORS), esquema Supabase con user_id/RLS, patrón ABM "primero Supabase después estado" y despliegue Docker.
---

# Integración Metabase + Supabase

Patrón probado para aplicaciones internas donde:
- **Supabase** es la base propia (ABM completo, auth, RLS por usuario).
- **Metabase** es una fuente de datos externa de **solo lectura** (ej: usuarios de un sistema legado en SQL Server), accesible únicamente desde la red interna.
- El navegador **nunca habla con Metabase**: lo hace a través de un backend intermedio Express que guarda la API key.

## Cuándo aplicar este skill
- El proyecto necesita listar/buscar registros que viven en otra base expuesta por Metabase.
- Hay que levantar un proxy/backend interno (Node 20+, ES Modules, fetch nativo) para una API que no tiene CORS o está aislada en LAN.
- Se requiere persistir movimientos/asignaciones referenciando usuarios externos sin copiarlos completos (cache de nombre/área).

## Arquitectura objetivo

```
navegador (React/Vite) ──HTTPS──> backend intermedio (:4000) ──LAN──> Metabase (:3000, solo lectura)
        │
        └────HTTPS(anon key)────> Supabase (ABM, Auth, RLS por user_id)
```

Reglas inquebrantables:
1. La API key de Metabase vive SOLO en el backend (`METABASE_API_KEY`, sin prefijo `VITE_`).
2. Metabase nunca se escribe: solo `POST /api/dataset`, `GET /api/database/:id/metadata` y opcionalmente `POST /api/card/:id/query/json`.
3. Las rutas HTTP jamás llaman a Metabase directamente: pasan por `services/`, que usa `queries/`, que usa `clients/`.
4. Agregar una consulta nueva a la base externa = agregar UNA función en `src/queries/<db>.js`; nadie más conoce ids de tablas ni SQL.
5. El ABM propio se hace solo sobre Supabase; los usuarios externos se guardan como `usuario_ref` + cache de nombre/área.

## Estructura de carpetas del backend (server/)

```
server/
├── package.json          # type:module, node>=20, express/helmet/cors/zod/dotenv
├── .env.example          # sin valores reales; .env en .gitignore
├── Dockerfile            # node:20-alpine, USER node, EXPOSE 4000
├── docker-compose.yml    # restart unless-stopped, env_file, extra_hosts p/ LAN
├── scripts/
│   └── testMetabase.js   # npm run test:metabase → conexión + columnas REALES
└── src/
    ├── config.js         # valida variables obligatorias al arrancar (throw si faltan)
    ├── index.js          # helmet + CORS restringido + express.json(limit) + errorHandler
    ├── clients/
    │   └── metabaseClient.js   # x-api-key, AbortController, tabla(), sql(), metadata()
    ├── queries/
    │   └── saiTest.js          # TODAS las consultas a la DB externa viven acá
    ├── services/
    │   ├── dbEngine.js         # detecta motor SQL desde metadata (sin asumir)
    │   └── usuariosService.js  # caché TTL 5min + toUsuario() (proyección segura)
    ├── routes/
    │   └── metabaseRoutes.js   # GET /usuarios?q=, POST /usuarios/refresh (zod)
    └── middleware/
        └── errorHandler.js     # ZodError→400, MetabaseError→502, sin loguear PII/keys
```

## Los 5 puntos críticos (lecciones aprendidas)

### 1. Formato correcto de /api/dataset (error 400 clásico)
En Metabase v0.55.x el body DEBE llevar `database` en el nivel superior, junto a `type` y `query`:
```js
// ✅ Correcto — sin esto: 400 "Se requiere `database` para todas las consultas cuyo tipo no sea internal"
{ database: DB_ID, type: 'query', query: { 'source-table': tableId, limit, offset } }

// ❌ Incorrecto (database dentro de query):
{ type: 'query', query: { database: DB_ID, 'source-table': ... } }
```
Para native: `{ database: DB_ID, type: 'native', native: { query, 'template-tags': {} }, parameters }`.

### 2. Límite de 2000 filas y paginación
`/api/dataset` devuelve máximo 2000 filas. Estrategia configurable:
- Default: paginación por `offset`/`limit` hasta recibir una página < pageSize (corte de seguridad a 100k filas).
- Alternativa: pregunta guardada vía `POST /api/card/{id}/query/json` (una sola request), activable con `METABASE_CARD_ID`.

### 3. No inventar columnas: descubrirlas
Antes de mapear nada, correr `test:metabase` que combina:
- `tabla(id)` → claves reales de la primer fila, y
- `GET /api/database/:id/metadata` → nombre/tipo/PK de cada campo y **motor SQL detectado** (postgres/sqlserver/mysql...).
Normalizar claves a minúsculas (`lowerCaseKeys`) porque ciertos motores devuelven mayúsculas.

### 4. Proyección segura (toUsuario)
Devolver SOLO campos necesarios (id, nombre, área, estado). Excluir explícitamente columnas sensibles que aparecen en tablas legadas (`contrasenia`, `servicekey_path`, `identityrecord`, vencimientos). Búsqueda `?q=` hecha EN MEMORIA sobre la caché — nunca se arma SQL con texto del usuario.

### 5. Timeout y errores claros
Todo fetch con `AbortController` (default 15s). Errores tipados `MetabaseError` con status; 401/403 ⇒ API key inválida o grupo sin permisos de lectura; el middleware traduce MetabaseError→502 sin filtrar headers/payloads.

## Lado Supabase (ABM)

### Esquema mínimo por tabla
```sql
create table equipment_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),      -- dueño (RLS)
  equipment_id uuid not null references equipments(id),
  usuario_ref text not null,                            -- id externo (Metabase), NO FK
  usuario_nombre text,                                  -- cache p/ historial offline
  usuario_area text,                                    -- cache
  tipo text check (tipo in ('asignacion','devolucion','traslado','baja')),
  fecha timestamptz not null default now(),
  observaciones text,
  registrado_por text,
  created_at timestamptz default now()
);
-- RLS idéntica al resto del proyecto: policy (user_id = auth.uid())
```

### Patrón ABM: primero Supabase, después el estado
En el contexto de React (AppContext), cada operación devuelve `Promise<{ success, error? }>`:
- **Alta**: crear objeto SIN id (no uuidv4 local: un update sobre id inexistente no inserta nada), llamar `sync*ToSupabase` (hace create y asigna `entidad.id = data.id`), y recién si `success` agregar al estado con el id real.
- **Modificación**: combinar registro actual + Partial, enviar objeto completo, actualizar estado solo si sale bien.
- **Baja**: `delete*FromSupabase(id)` y quitar del estado solo si sale bien.
- Componentes: `await` al ABM, cerrar modal solo si `success`, mostrar error inline si falla, botón `disabled={saving}`.
- Normalizar TODAS las funciones de sync a `{ success: boolean; error?: string }` con el mensaje de Supabase incluido.

### Coherencia de estado derivado
Al registrar movimiento: `asignacion → assigned`, `devolucion → available`, `baja → retired` sobre `equipments.status`. Si hace falta atomicidad, usar RPC (`security definer function`) en lugar de dos llamadas desde el cliente.

## Seguridad (checklist)
- [ ] `.env` en `.gitignore` (raíz Y server/); `.env.example` sin valores reales.
- [ ] API key de un grupo Metabase con permisos SOLO de consulta sobre la DB.
- [ ] helmet + CORS limitado a `ALLOWED_ORIGINS` explícito.
- [ ] Nunca loguear API keys ni datos personales completos (solo mensajes técnicos).
- [ ] PostgreSQL siempre parametrizado; SQL nativo hacia Metabase sin entradas libres.
- [ ] Config validada al arrancar (throw con nombre de variable faltante).
- [ ] Opcional producción: validar JWT de Supabase en los endpoints del backend (Bearer → `supabase.auth.getUser(token)`).

## Frontend (Vite)
- Proxy en desarrollo: `server.proxy['/api/metabase'] → http://localhost:4000` (el backend NO usa puerto 3000, lo ocupa Vite).
- Servicio `metabaseUsers.ts` consume solo `/api/metabase/...`; si el backend no responde, aviso claro + seguir con datos cacheados del lado Supabase.

## Verificación mínima antes de integrar
1. `npm run test:metabase` desde una máquina de la red interna → debe imprimir filas, columnas reales y motor.
2. `curl localhost:4000/health` → ok.
3. `curl 'localhost:4000/api/metabase/usuarios?q=juan'` → solo campos proyectados.
4. Alta de prueba → confirmar en Supabase que el `user_id` es el del usuario logueado (no el UUID default `00000000-...`).

## Referencias
- `references/metabase-client.js` — cliente completo corregido (formato dataset + paginación + card).
- `references/supabase-abm-pattern.ts` — extracto del patrón ABM {success,error} listo para copiar.
