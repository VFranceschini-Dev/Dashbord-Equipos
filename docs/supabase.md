# Supabase

> Documento consolidado. Reemplaza a: `INTEGRACION_SUPABASE.md`, `GUIA_RAPIDA_SUPABASE.md`,
> `FLUJO_IMPORTACION_SUPABASE.md`, `IMPORTACION_SUPABASE.md`.

## Proyecto y acceso

1. Crear el proyecto en [supabase.com](https://supabase.com) (elegir contraseña de base fuerte y guardarla).
2. En **Settings > API** copiar `Project URL` y la `anon key` (es pública por diseño: la protección real
   la da RLS).
3. Variables del frontend (`.env.local`, prefijo `VITE_` porque viajan al navegador):
   ```bash
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
   Nunca commitear valores reales; `.env` está en `.gitignore` y `.env.example` usa placeholders.

## Esquema

- Referencia completa y ejecutable: [`supabase/schema.sql`](../supabase/schema.sql).
- Migraciones incrementales idempotentes (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`):
  [`supabase/migrations/`](../supabase/migrations/) con nombre `AAAAMMDD_descripcion.sql`.
- Tablas: `printers`, `toner_items`, `toner_movements` (ex `movements`), `equipment_movements`,
  `equipments`, `collaborators`, `suppliers`, `vouchers`, `external_servers`, `synced_devices`, `alerts`.
- Orden de creación: `collaborators` **antes** que `equipments` (esta tiene FK hacia aquella).
- Toda tabla propia lleva `user_id UUID NOT NULL REFERENCES auth.users(id)` + índices + RLS.

## Row Level Security

Patrón uniforme en todas las tablas: cada usuario solo ve/escribe sus filas.

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON <tabla> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON <tabla> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON <tabla> FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON <tabla> FOR DELETE USING (auth.uid() = user_id);
```

Excepciones conocidas: `toner_movements` no define política UPDATE (los movimientos son inmutables:
se insertan o se corrigen vía SQL admin); `equipment_movements` usa una policy `FOR ALL`.

## Autenticación

Login gestionado en **Supabase > Authentication** (email + contraseña personales). El script
[`scripts/setup-supabase-auth.sh`](../scripts/setup-supabase-auth.sh) genera un bootstrap opcional.
No hay usuarios hardcodeados en el código desde la migración documentada en
`docs/MIGRACION_BACKEND_AUTH.md`.

## Patrón ABM: primero Supabase, después estado

Implementado en `src/services/supabaseSync.ts` + `src/context/AppContext.tsx`:

- **Alta**: crear el objeto SIN id local; `service.create()` devuelve el id real de Supabase; recién
  entonces se agrega al estado.
- **Modificación**: enviar el objeto completo combinado; actualizar estado solo si `success`.
- **Baja**: borrar en Supabase; quitar del estado solo si `success`.
- Todas las funciones devuelven `{ success: boolean; error?: string }`; los modales cierran únicamente
  con éxito y muestran el error inline si falla.

## Importaciones masivas

El flujo de importación (CSV/Excel/Word/PDF) valida y previsualiza en el navegador y luego persiste
por lotes en Supabase siguiendo el mismo patrón. Ver `docs/importacion.md`.

## Buenas prácticas aplicadas

- Contraseñas de servidores externos (Mesh Central) guardadas en `external_servers.password` aisladas
  por RLS; a futuro: migrar a `vault.secrets`.
- Consultas siempre parametrizadas por `user_id` del cliente autenticado; nunca se confía en ids
  enviados desde la UI.
- Verificar tras el alta que `user_id` sea el del usuario logueado (no un UUID default).
