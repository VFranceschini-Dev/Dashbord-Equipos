-- Migración: corregir equipment_movements en producción (ejecutada el 2026-10-30).
--
-- La tabla de producción no coincidía con 20261002_equipment_movements.sql:
-- id bigint autonumérico, usuario_ref integer, RLS activado SIN políticas y
-- sin la función registrar_equipment_movement. Resultado: no se podían
-- registrar ni leer movimientos desde la app.
--
-- Verificación previa (debía dar 0): select count(*) from public.equipment_movements;

begin;

-- usuario_ref pasa a texto (guarda el id de usuario)
alter table public.equipment_movements
  alter column usuario_ref type text using usuario_ref::text;

-- Política: cada usuario ve y registra solo sus movimientos (igual que el resto de las tablas)
drop policy if exists "own_equipment_movements" on public.equipment_movements;
create policy "own_equipment_movements"
  on public.equipment_movements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índices para el historial
create index if not exists eqmov_user_idx   on public.equipment_movements (user_id);
create index if not exists eqmov_equipo_idx on public.equipment_movements (equipment_id);
create index if not exists eqmov_fecha_idx  on public.equipment_movements (fecha desc);

-- Función que registra el movimiento y actualiza el estado del equipo, todo junto
create or replace function public.registrar_equipment_movement(
  p_equipment_id uuid,
  p_usuario_ref text,
  p_usuario_nombre text,
  p_usuario_area text,
  p_tipo text,
  p_observaciones text default null,
  p_registrado_por text default null
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_new_id bigint;
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
    set status = v_status, updated_at = now()
    where id = p_equipment_id;

  return v_new_id;
end;
$$;

commit;
