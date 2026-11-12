-- Migración: constancias con uno o varios equipos, y lectura de sucursales.
-- Ejecutar en Supabase > SQL Editor. No borra ni modifica datos existentes.

begin;

-- 1) Sucursales (tabla "Ubicacion", creada fuera de la app): solo LECTURA para
--    usuarios con sesión. No permite crear, modificar ni borrar.
drop policy if exists "ubicacion_lectura_autenticados" on public."Ubicacion";
create policy "ubicacion_lectura_autenticados" on public."Ubicacion"
  for select to authenticated using (true);

-- 2) Una constancia puede incluir varios movimientos (uno por equipo).
--    movement_id sigue siendo el primero; movement_ids tiene todos.
alter table public.comprobantes_entrega
  add column if not exists movement_ids bigint[];
update public.comprobantes_entrega
  set movement_ids = array[movement_id]
  where movement_ids is null;
create index if not exists comprobantes_entrega_movement_ids_idx
  on public.comprobantes_entrega using gin (movement_ids);

commit;
