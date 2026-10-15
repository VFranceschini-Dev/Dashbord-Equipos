-- Migración: rebautizar la tabla de movimientos de TÓNER
--   movements  ->  toner_movements
-- Ejecutar UNA VEZ en Supabase > SQL Editor. No toca datos ni RLS definidos
-- sobre la tabla (las policies e índices acompañan al rename).
BEGIN;

ALTER TABLE IF EXISTS public.movements RENAME TO toner_movements;

-- Índices originales idx_movements_* -> idx_toner_movements_* (si existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_movements_user_id') THEN
    ALTER INDEX public.idx_movements_user_id RENAME TO idx_toner_movements_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_movements_type') THEN
    ALTER INDEX public.idx_movements_type RENAME TO idx_toner_movements_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_movements_date') THEN
    ALTER INDEX public.idx_movements_date RENAME TO idx_toner_movements_date;
  END IF;
END $$;

COMMIT;
