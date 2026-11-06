-- ⚠️ NOTA (2026-10-30): esta migración NO refleja la tabla de producción.
-- En producción equipment_movements se creó con otro esquema (id bigint,
-- usuario_ref integer, sin políticas ni RPC) y se corrigió con
-- 20261030_fix_equipment_movements.sql. Para una base nueva, usar
-- supabase/schema.sql en lugar de esta migración.
--
-- Migración: movimientos de EQUIPOS (hardware) asignados a usuarios de SAI_TEST.
-- Ejecutar en Supabase > SQL Editor. No modifica tablas existentes.
-- La tabla "toner_movements" (ex movements) es de TÓNER y NO se reutiliza acá.

create table if not exists public.equipment_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                       -- usuario autenticado (auth.uid()) que registra
  equipment_id uuid not null references public.equipments(id) on delete restrict,
  usuario_ref text not null,                   -- usuariosaccesoid tal como viene de UsuariosAccesos
  usuario_nombre text,                         -- cache: login/código del usuario
  usuario_area text,                           -- cache: área/descripción (historial si Metabase no responde)
  tipo text not null check (tipo in ('asignacion','devolucion','traslado','baja')),
  fecha timestamptz not null default now(),
  observaciones text,
  registrado_por text,                         -- email/nombre de quien registra
  created_at timestamptz not null default now()
);

create index if not exists eqmov_user_idx    on public.equipment_movements (user_id);
create index if not exists eqmov_equipo_idx  on public.equipment_movements (equipment_id);
create index if not exists eqmov_usuario_idx on public.equipment_movements (usuario_ref);
create index if not exists eqmov_fecha_idx   on public.equipment_movements (fecha desc);

-- RLS igual que el resto de las tablas propias
alter table public.equipment_movements enable row level security;

drop policy if exists "own_equipment_movements" on public.equipment_movements;
create policy "own_equipment_movements"
  on public.equipment_movements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RPC atómica: inserta el movimiento y actualiza el status del equipo coherente.
-- asignacion -> assigned | devolucion -> available | traslado -> assigned | baja -> retired
create or replace function public.registrar_equipment_movement(
  p_equipment_id uuid,
  p_usuario_ref text,
  p_usuario_nombre text,
  p_usuario_area text,
  p_tipo text,
  p_observaciones text default null,
  p_registrado_por text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_new_id uuid;
  v_status text;
begin
  if p_tipo not in ('asignacion','devolucion','traslado','baja') then
    raise exception 'Tipo de movimiento inválido: %', p_tipo;
  end if;

  v_status := case p_tipo
    when 'asignacion' then 'assigned'
    when 'traslado'   then 'assigned'
    when 'devolucion' then 'available'
    when 'baja'       then 'retired'
  end;

  -- valida que el equipo exista y pertenezca al usuario logueado
  perform id from public.equipments
    where id = p_equipment_id and user_id = auth.uid();
  if not found then
    raise exception 'El equipamiento no existe o no pertenece al usuario';
  end if;

  insert into public.equipment_movements
    (user_id, equipment_id, usuario_ref, usuario_nombre, usuario_area, tipo, observaciones, registrado_por)
  values
    (auth.uid(), p_equipment_id, p_usuario_ref, p_usuario_nombre, p_usuario_area, p_tipo, p_observaciones, p_registrado_por)
  returning id into v_new_id;

  update public.equipments
    set status = v_status,
        collaborator_id = case when p_tipo in ('asignacion','traslado') then collaborator_id else null end,
        updated_at = now()
    where id = p_equipment_id;

  return v_new_id;
end;
$$;
