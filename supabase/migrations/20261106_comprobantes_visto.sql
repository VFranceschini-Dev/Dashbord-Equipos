-- Migración: registrar cuándo el usuario abre por primera vez el enlace del
-- comprobante (estado "Visto"). Solo agrega una columna vacía.
alter table public.comprobantes_entrega
  add column if not exists visto_at timestamptz;
