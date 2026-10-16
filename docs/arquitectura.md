# Arquitectura

> Documento consolidado. Reemplaza a: `REPOSITORIO_RESUMEN.md`, `SINCRONIZACION_SERVIDORES.md`,
> `MIGRACION_BACKEND_AUTH.md` (histórico), `SKILL_DOCUMENT.md`.

## Visión general (estado actual)

```
┌─────────────────────────┐        HTTPS         ┌──────────────────────────────┐
│  Navegador (React SPA)  │ ───────────────────► │  Vercel (front + functions)  │
│  Vite + TS + Tailwind   │                      │  api/usuarios (serverless)   │
└───────────┬─────────────┘                      └──────────────┬───────────────┘
            │ anon key (pública, RLS protege)                   │ x-api-key (SOLO en la función)
            ▼                                                   ▼
┌─────────────────────────┐                      ┌──────────────────────────────┐
│  Supabase               │                      │  ipa.donnet.com.ar/api       │
│  - Auth (login real)    │                      │  Proxy Metabase SAI_TEST     │
│  - Postgres + RLS       │                      │  SOLO LECTURA                │
│  - Tablas del ABM       │                      └──────────────────────────────┘
└─────────────────────────┘
```

Reglas de la arquitectura:

1. **La API key de la fuente externa nunca llega al navegador.** Vive solo como variable de entorno
   de la función serverless de Vercel (sin prefijo `VITE_`).
2. **SAI_TEST es de solo lectura.** Todo el ABM (alta/baja/modificación) ocurre sobre tablas propias
   en Supabase. Los usuarios externos se referencian con `usuario_ref` + copia de nombre para historial.
3. **Patrón "primero Supabase, después estado"**: las mutaciones de `AppContext` guardan en Supabase y
   recién si hay éxito actualizan el estado de React (copia de la base).
4. El navegador habla únicamente con Supabase (anon key + RLS) y con sus propias funciones `/api/*`.

## Historia: backend interno eliminado

Hasta v2.9.x existía un backend Express en `server/` (puerto 4000, Docker, red interna) que hacía de
proxy hacia Metabase. Fue eliminado y reemplazado por funciones serverless de Vercel (`api/`).

Acciones operativas que acompañaron esa eliminación (checklist para entornos aún activos):
- Apagar el proceso contenedorizado del servidor interno (`docker compose down` en el host).
- Cerrar el puerto 4000 en el firewall si fue abierto hacia la LAN.
- **Rotar la API key** de Metabase usada por ese backend (quedó en variables de entorno de una máquina
  que ya no controlamos desde este repo).
- Quitar el proxy `/api/metabase` de `vite.config.js` (hoy solo queda comentado como referencia).

## Autenticación (histórico → actual)

`docs/MIGRACION_BACKEND_AUTH.md` documenta la migración desde un login hardcodeado en el bundle
(`DEFAULT_USERS` con contraseñas en claro — práctica abandonada) hacia **Supabase Auth**. Estado actual:

- Login real contra `supabase.auth.signInWithPassword` (`src/services/supabase.ts`).
- Sin usuarios ni contraseñas definidos en el código.
- Sesión = JWT de Supabase; las funciones serverless lo validan con `supabase.auth.getUser(token)`.

## Módulos funcionales

Ver `docs/modulos.md` (dashboard, equipamientos, colaboradores, proveedores, comprobantes, impresoras,
inventario/movimientos de tóner, reportes, importación, monitoreo remoto).

## Sincronización con servidores externos (Mesh Central)

El módulo de "Servidores Externos" (`docs/SINCRONIZACION_SERVIDORES.md`) permite registrar instancias
de Mesh Central para monitorear dispositivos reales. Credenciales cifradas/aisladas por RLS por usuario
(`external_servers`, `synced_devices`). No debe confundirse con el viejo backend interno: este módulo
es una funcionalidad de producto, no infraestructura del dashboard.

## Base de datos

- Esquema de referencia: `supabase/schema.sql`.
- Migraciones incrementales idempotentes: `supabase/migrations/*.sql` (prefijo fecha `AAAAMMDD_`).
- Ver `docs/supabase.md` para RLS, servicios y patrón ABM.
