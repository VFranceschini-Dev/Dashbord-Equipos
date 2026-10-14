# Backend intermedio Metabase — Dashbord-Equipos

Node.js 20 + Express. Puente **solo lectura** entre la app (React/Vite) y Metabase
(`http://10.0.0.8:3000`, base `SAI_TEST`, db id 5, tabla `UsuariosAccesos`, source-table id 1406).

## Arquitectura

```
Navegador (Vite/React) ──► /api/metabase/* ──► este backend (puerto 4000) ──► Metabase (x-api-key)
        │
        └──► Supabase (ABM de equipos/movimientos; RLS con el JWT del usuario)
```

- La API key vive **solo acá** (`server/.env`). El navegador nunca habla con Metabase.
- Metabase se usa SOLO para leer. No se crean/modifican preguntas ni dashboards.
- Capas: `clients/` (HTTP a Metabase) → `queries/` (consultas a SAI_TEST) → `services/` (lógica + caché) → `routes/` (HTTP). Las rutas nunca llaman a Metabase directamente.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Healthcheck. |
| GET | `/api/metabase/usuarios?q=texto` | Usuarios cacheados; búsqueda sobre la caché (no arma SQL con el input). Devuelve solo `id, nombre, area, estado`. |
| POST | `/api/metabase/usuarios/refresh` | Fuerza recarga desde Metabase. |

Si Metabase no responde → HTTP 502 con `{"error": "Metabase no disponible"}` para que el frontend muestre aviso y siga con datos cacheados.

## Variables de entorno (`server/.env`, ver `.env.example`)

Obligatorias: `METABASE_URL`, `METABASE_API_KEY` (grupo con permisos de **solo consulta** sobre SAI_TEST).
Opcionales: `PORT` (4000), `METABASE_DB_ID` (5), `SAI_USUARIOS_TABLE_ID` (1406), `METABASE_TIMEOUT_MS`, `METABASE_PAGE_SIZE` (tope 2000), `METABASE_CARD_ID` (pregunta guardada como alternativa a la paginación), `ALLOWED_ORIGINS` (CORS), `USERS_CACHE_TTL_MS` (5 min).

La validación de obligatorias ocurre al arrancar (`src/config.js`).

## Ejecutar en desarrollo

```bash
cd server
cp .env.example .env   # completar METABASE_API_KEY
npm install
npm run test:metabase  # prueba de conexión: motor SQL, columnas y cantidad de filas
npm run dev            # puerto 4000 (--watch)
```

En otro terminal, desde la raíz del proyecto: `npm run dev` (Vite, puerto 3000).
El proxy de Vite (`vite.config.js → server.proxy`) reenvía `/api/metabase` a `localhost:4000`, así el frontend puede llamar a `/api/metabase/usuarios` sin configurar CORS.

## Ejecutar en la red interna (Docker)

El backend debe correr en un host con acceso a `10.0.0.8` (por ejemplo, un contenedor/CT en Proxmox):

```bash
docker compose up -d --build    # expone puerto 4000
```

En producción (frontend en Vercel), el navegador no alcanza la red interna por sí solo: exponé el backend tras un reverse-proxy accesible (o VPN) y configurá `ALLOWED_ORIGINS=https://tu-app.vercel.app`. El frontend debe poder llamar a `https://backend-interno.tuempresa.com/api/metabase/...` (en desarrollo basta el proxy de Vite).

## Cómo agregar una consulta nueva a SAI_TEST

1. Agregar una función en `src/queries/saiTest.js` (ej.: `areas()` usando `tabla(id)` o `sql(...)` con SQL **estático**, nunca con entradas libres del usuario).
2. Consumirla desde un service en `src/services/`.
3. Exponerla desde una ruta en `src/routes/`.
No hace falta tocar el cliente ni la configuración.

## Descubrimiento de columnas

`npm run test:metabase` muestra las columnas reales de `UsuariosAccesos` (vía `GET /api/database/5/metadata`) y el motor SQL detectado. Los candidatos de mapeo (id/nombre/área/estado) están en `src/services/usuariosService.js`; ajustalos con los nombres reales confirmados.

## Pendientes de esta etapa (Etapa 1–3)

- Validar contra Metabase real desde la red interna (acá no hay acceso a 10.0.0.8).
- Protección opcional de endpoints con el JWT de Supabase (ver plan; requiere validar el token contra tu proyecto Supabase).
- Etapas 4 (tabla `equipment_movements` en Supabase) y 5 (UI) pendientes de implementación.
