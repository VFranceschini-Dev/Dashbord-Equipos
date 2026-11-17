-- Emails de Zammad con factura que ya se procesaron (búsqueda periódica cada 30 min).
-- Sirve para no leer dos veces el mismo email ni repetir la nota en el ticket.
-- Solo la usa el servidor (service_role): sin políticas, el navegador no la ve.
begin;

create table if not exists public.facturas_zammad_procesados (
  article_id   bigint primary key,           -- id del artículo (email) en Zammad
  ticket_id    integer not null,
  resultado    jsonb,                        -- qué pasó con cada adjunto
  procesado_at timestamptz not null default now()
);
create index if not exists facturas_zammad_procesados_ticket on public.facturas_zammad_procesados (ticket_id);

alter table public.facturas_zammad_procesados enable row level security;

commit;
