-- Migración: comprobantes de entrega con firma electrónica.
-- Ejecutar en Supabase > SQL Editor. Solo crea tablas nuevas.

begin;

-- 1) Firma del responsable de Sistemas (una por usuario de la app).
--    Firma tipográfica: nombre + tipo de letra + DNI.
create table if not exists public.firmas_responsables (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  dni        text not null,
  fuente     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.firmas_responsables enable row level security;
drop policy if exists "own_firma" on public.firmas_responsables;
create policy "own_firma" on public.firmas_responsables for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists firmas_responsables_set_updated_at on public.firmas_responsables;
create trigger firmas_responsables_set_updated_at before update on public.firmas_responsables
  for each row execute function public.set_updated_at();

-- 2) Correo de los usuarios del origen interno (que no trae correo).
--    Se carga al registrar una asignación y lo comparte todo el equipo de Sistemas.
create table if not exists public.usuarios_contacto (
  usuario_ref text primary key,          -- id del usuario en la app
  correo      text not null,
  updated_at  timestamptz not null default now()
);
alter table public.usuarios_contacto enable row level security;
drop policy if exists "contacto_autenticados" on public.usuarios_contacto;
create policy "contacto_autenticados" on public.usuarios_contacto for all to authenticated
  using (true) with check (true);
drop trigger if exists usuarios_contacto_set_updated_at on public.usuarios_contacto;
create trigger usuarios_contacto_set_updated_at before update on public.usuarios_contacto
  for each row execute function public.set_updated_at();

-- 3) Comprobantes de entrega. Los crea y firma la función serverless
--    (service_role); el navegador solo puede leer los propios.
create table if not exists public.comprobantes_entrega (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id),   -- quien registró la entrega
  movement_id        bigint not null unique references public.equipment_movements(id) on delete cascade,
  token              text not null unique,                     -- enlace de firma (secreto)
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'firmado', 'anulado')),
  datos              jsonb not null,                           -- copia fija del contenido del comprobante
  hash_documento     text not null,                            -- SHA-256 de "datos"
  correo_destino     text,
  zammad_ticket_id   integer,
  firmado_nombre     text,
  firmado_dni        text,
  firmado_fuente     text,
  firmado_at         timestamptz,
  firmado_ip         text,
  firmado_user_agent text,
  hash_firma         text,                                     -- SHA-256 de documento + firma
  created_at         timestamptz not null default now()
);
create index if not exists comprobantes_entrega_user_idx on public.comprobantes_entrega (user_id);
alter table public.comprobantes_entrega enable row level security;
drop policy if exists "own_comprobantes_select" on public.comprobantes_entrega;
create policy "own_comprobantes_select" on public.comprobantes_entrega for select
  using (auth.uid() = user_id);

commit;
