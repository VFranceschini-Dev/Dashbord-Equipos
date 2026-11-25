-- Código de inventario de las impresoras.
-- Opcional (vacío por defecto) y único por usuario solo cuando tiene valor,
-- así las impresoras ya cargadas no se ven afectadas.
-- EJECUTAR ESTA MIGRACIÓN EN SUPABASE ANTES DE DESPLEGAR EL CÓDIGO:
-- sin la columna, los inserts/updates de impresoras fallan.

ALTER TABLE public.app_printers
  ADD COLUMN IF NOT EXISTS inventory_code text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_printers_inventory_code
  ON public.app_printers (user_id, lower(inventory_code))
  WHERE inventory_code <> '';
