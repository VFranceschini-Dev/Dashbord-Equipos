-- Migración: políticas de perfiles_usuarios (ejecutada en producción el 2026-11-12).
-- La política de administradores era FOR ALL y se consultaba a sí misma:
-- toda lectura con sesión fallaba con "infinite recursion detected in policy".
-- Además la lectura estaba abierta a cualquiera con la clave pública.
begin;

-- ¿El usuario con sesión es administrador? Se evalúa sin aplicar las políticas
-- de la tabla (security definer), así no se consulta a sí misma en bucle.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles_usuarios
    where id = auth.uid() and rol = 'admin' and coalesce(activo, true)
  );
$$;

-- Modificación solo para administradores (misma regla, sin recursión)
drop policy if exists "Permitir modificación de perfiles a administradores" on public.perfiles_usuarios;
create policy "Permitir modificación de perfiles a administradores" on public.perfiles_usuarios
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Lectura: solo usuarios con sesión (antes, cualquiera con la clave pública)
drop policy if exists "Permitir lectura completa de perfiles" on public.perfiles_usuarios;
create policy "Permitir lectura completa de perfiles" on public.perfiles_usuarios
  for select to authenticated using (true);

commit;
