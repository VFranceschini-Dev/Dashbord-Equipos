-- ============================================================================
-- Eliminación de usuarios (solo administradores, desde la app)
-- Al eliminar un usuario, todo lo que cargó pasa al administrador que lo elimina
-- y recién entonces se borra la cuenta. Esta función la llama únicamente el servidor
-- (service_role); no la puede ejecutar ningún usuario desde el navegador.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

create or replace function public.reasignar_datos_usuario(p_origen uuid, p_destino uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n bigint;
  resultado jsonb := '{}'::jsonb;
begin
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'Usuarios inválidos para la reasignación';
  end if;
  if not exists (select 1 from auth.users where id = p_destino) then
    raise exception 'El usuario destino no existe';
  end if;

  -- La firma del responsable es personal (clave = user_id): la del usuario eliminado se descarta.
  if to_regclass('public.firmas_responsables') is not null then
    delete from public.firmas_responsables where user_id = p_origen;
  end if;

  -- Toda columna de public que referencia auth.users(id) pasa al destino.
  for r in
    select c.conrelid::regclass::text as tabla, a.attname as columna
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace ns on ns.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and array_length(c.conkey, 1) = 1
      and ns.nspname = 'public'
      and t.relname <> 'perfiles_usuarios'
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tabla, r.columna, r.columna)
      using p_destino, p_origen;
    get diagnostics n = row_count;
    if n > 0 then
      resultado := resultado || jsonb_build_object(r.tabla, n);
    end if;
  end loop;

  return resultado;
end;
$$;

revoke all on function public.reasignar_datos_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reasignar_datos_usuario(uuid, uuid) to service_role;
