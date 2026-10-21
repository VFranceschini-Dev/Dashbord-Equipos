-- ============================================================================
-- users_new: tabla gestionada por la app para el ALTA de usuarios no
-- registrados en el origen interno de accesos. La escritura pasa SIEMPRE por
-- la función serverless (service role); el navegador no accede directo.
-- Ejecutar en Supabase (SQL Editor) antes de publicar los cambios.
-- ============================================================================

create table if not exists public.users_new (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  apellido      text not null,
  usuario       text not null,          -- login, en minúsculas sin espacios
  correo        text not null default '',
  departamento  text not null default '',
  estado        text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índices únicos sobre lower(usuario) y lower(correo): evitan duplicados.
-- El índice de correo ignora cadenas vacías (usuarios sin correo).
create unique index if not exists users_new_usuario_key
  on public.users_new (lower(usuario));
create unique index if not exists users_new_correo_key
  on public.users_new (lower(correo))
  where correo <> '';

alter table public.users_new enable row level security;

-- Sin políticas para roles anónimos/authenticados: el acceso legítimo es
-- exclusivamente desde la función serverless con la clave service_role
-- (bypass de RLS). Así el navegador nunca puede leer ni escribir acá.

-- Trigger simple de updated_at.
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_new_set_updated_at on public.users_new;
create trigger users_new_set_updated_at
  before update on public.users_new
  for each row execute function public.set_updated_at();
