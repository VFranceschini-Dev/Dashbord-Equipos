-- Vincula cada perfil con su usuario de Zammad (clave estable: el id numérico, no el correo ni el login).
-- Solo agrega una columna opcional; no cambia datos existentes. Idempotente.
alter table public.perfiles_usuarios add column if not exists zammad_id integer;
create unique index if not exists perfiles_usuarios_zammad_id_uq on public.perfiles_usuarios (zammad_id) where zammad_id is not null;
