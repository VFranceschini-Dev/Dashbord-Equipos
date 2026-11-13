-- Migración: facturas de proveedores (ex "Comprobantes") con datos fiscales,
-- archivo adjunto y visibles para todo el equipo de Sistemas.
-- Ejecutar en Supabase > SQL Editor. No borra datos.

begin;

-- 1) Datos fiscales y de origen de la factura (tabla vouchers)
alter table public.vouchers
  add column if not exists letra            text,          -- A, B, C, M…
  add column if not exists punto_venta      text,          -- 0001
  add column if not exists cuit_emisor      text,          -- solo números
  add column if not exists cae              text,
  add column if not exists cae_vencimiento  date,
  add column if not exists neto             numeric(14,2),
  add column if not exists iva              numeric(14,2),
  add column if not exists vencimiento_pago date,
  add column if not exists archivo_path     text,          -- ruta en Storage (bucket "facturas")
  add column if not exists archivo_nombre   text,
  add column if not exists origen           text not null default 'manual',
  add column if not exists zammad_ticket_id integer,
  add column if not exists cargada_por      text;          -- email de quien la cargó (o "Zammad")
alter table public.vouchers drop constraint if exists vouchers_origen_check;
alter table public.vouchers add constraint vouchers_origen_check check (origen in ('manual', 'zammad'));
alter table public.vouchers alter column amount type numeric(14,2);

-- La misma factura (emisor + letra + punto de venta + número) no se carga dos veces
create unique index if not exists vouchers_factura_unica
  on public.vouchers (cuit_emisor, coalesce(letra, ''), coalesce(punto_venta, ''), number)
  where cuit_emisor is not null and cuit_emisor <> '';

-- 2) Facturas y proveedores: los ve y edita todo el equipo de Sistemas
--    (antes cada usuario veía solo lo que cargaba él).
do $$
declare t text;
begin
  foreach t in array array['vouchers', 'suppliers'] loop
    execute format('drop policy if exists %I on public.%I', 'Users can view their own ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Users can insert their own ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Users can update their own ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Users can delete their own ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'equipo_sistemas_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'equipo_sistemas_' || t, t);
  end loop;
end $$;

-- 3) Archivos de las facturas: espacio privado "facturas" en Storage,
--    accesible solo para usuarios con sesión.
insert into storage.buckets (id, name, public)
  values ('facturas', 'facturas', false)
  on conflict (id) do nothing;
drop policy if exists "facturas_equipo_sistemas" on storage.objects;
create policy "facturas_equipo_sistemas" on storage.objects for all to authenticated
  using (bucket_id = 'facturas') with check (bucket_id = 'facturas');

commit;
