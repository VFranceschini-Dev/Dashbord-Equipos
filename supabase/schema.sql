-- ============================================================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE
-- Dashboard Control de Equipamientos
--
-- Refleja la base de producción (relevada el 2026-10-30) en las tablas que usa
-- la aplicación, con la corrección de equipment_movements ya aplicada
-- (usuario_ref como texto, política RLS y función registrar_equipment_movement).
--
-- Idempotente: puede ejecutarse más de una vez sobre la misma base
-- (CREATE ... IF NOT EXISTS, CREATE OR REPLACE y DROP ... IF EXISTS).
--
-- Diferencia deliberada con producción: en producción
-- equipments.collaborator_id tiene una FK hacia la tabla "Users_Nuevos", que la
-- app no usa ni crea este archivo. Acá la columna queda sin FK.
-- ============================================================================

-- ============================================
-- FUNCIONES PARA updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- TABLA: APP_PRINTERS (Impresoras)
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_printers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  location         text NOT NULL DEFAULT '',
  department       text NOT NULL DEFAULT '',
  model            text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  toner_model      text NOT NULL DEFAULT '',
  last_maintenance text NOT NULL DEFAULT '',
  total_pages      integer NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_printers_user_id ON public.app_printers (user_id);

-- ============================================
-- TABLA: TONER_ITEMS (Inventario de tóner)
-- ============================================
CREATE TABLE IF NOT EXISTS public.toner_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model        text NOT NULL,
  brand        text NOT NULL DEFAULT '',
  color        text NOT NULL DEFAULT 'black' CHECK (color IN ('black', 'cyan', 'magenta', 'yellow')),
  stock        integer NOT NULL DEFAULT 0,
  min_stock    integer NOT NULL DEFAULT 2,
  max_stock    integer NOT NULL DEFAULT 10,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  supplier     text NOT NULL DEFAULT '',
  last_restock text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_toner_items_user_id ON public.toner_items (user_id);

-- ============================================
-- TABLA: TONER_MOVEMENTS (Movimientos de tóner)
-- ============================================
CREATE TABLE IF NOT EXISTS public.toner_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('delivery', 'return', 'restock', 'disposal')),
  toner_id     text NOT NULL,
  toner_model  text NOT NULL DEFAULT '',
  printer_id   text,
  printer_name text,
  quantity     integer NOT NULL DEFAULT 1,
  date         text NOT NULL,
  "user"       text NOT NULL DEFAULT '',
  user_name    text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_toner_movements_user_id ON public.toner_movements (user_id);

-- ============================================
-- TABLA: EQUIPMENTS (Equipamientos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.equipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'desktop' CHECK (type IN ('desktop', 'laptop', 'server', 'monitor', 'peripheral', 'other')),
  brand           text NOT NULL DEFAULT '',
  model           text NOT NULL DEFAULT '',
  serial_number   text NOT NULL DEFAULT '',
  asset_tag       text NOT NULL DEFAULT '',
  category        text NOT NULL DEFAULT 'Informática',
  status          text NOT NULL DEFAULT 'available' CHECK (status IN ('assigned', 'available', 'maintenance', 'retired')),
  collaborator_id uuid,  -- sin uso en la app (ver encabezado)
  purchase_date   text NOT NULL DEFAULT '',
  warranty_end    text NOT NULL DEFAULT '',
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipments_user_id ON public.equipments (user_id);

-- ============================================
-- TABLA: SUPPLIERS (Proveedores)
-- ============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  cuit       text NOT NULL DEFAULT '',
  contact    text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  phone      text NOT NULL DEFAULT '',
  address    text NOT NULL DEFAULT '',
  category   text[] NOT NULL DEFAULT ARRAY['Hardware'],
  active     boolean NOT NULL DEFAULT true,
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers (user_id);

-- ============================================
-- TABLA: VOUCHERS (Comprobantes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.vouchers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number        text NOT NULL,
  type          text NOT NULL CHECK (type IN ('invoice', 'receipt', 'order', 'delivery', 'return')),
  supplier_id   text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  date          text NOT NULL,
  amount        numeric(10,2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  description   text NOT NULL DEFAULT '',
  equipment_ids text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON public.vouchers (user_id);

-- ============================================
-- TABLA: EXTERNAL_SERVERS (Servidores externos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.external_servers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'meshcentral' CHECK (type IN ('meshcentral', 'custom')),
  url           text NOT NULL,
  username      text NOT NULL DEFAULT '',
  password      text NOT NULL DEFAULT '',
  auto_sync     boolean NOT NULL DEFAULT false,
  sync_interval integer NOT NULL DEFAULT 5,
  last_sync     timestamptz,
  status        text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  notes         text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_servers_user_id ON public.external_servers (user_id);

-- ============================================
-- TABLA: SYNCED_DEVICES (Dispositivos sincronizados)
-- ============================================
CREATE TABLE IF NOT EXISTS public.synced_devices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id          uuid NOT NULL REFERENCES public.external_servers(id) ON DELETE CASCADE,
  external_id        text NOT NULL,
  name               text NOT NULL,
  hostname           text NOT NULL DEFAULT '',
  ip                 text NOT NULL DEFAULT '',
  os                 text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  last_seen          timestamptz DEFAULT now(),
  group_name         text DEFAULT '',
  cpu                text DEFAULT '',
  ram                text DEFAULT '',
  synced_at          timestamptz DEFAULT now(),
  local_equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (server_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_synced_devices_user_id ON public.synced_devices (user_id);

-- ============================================
-- TABLA: EQUIPMENT_MOVEMENTS (Movimientos de equipos a usuarios)
-- usuario_ref guarda el id opaco del usuario (texto).
-- ============================================
CREATE TABLE IF NOT EXISTS public.equipment_movements (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id),
  equipment_id   uuid REFERENCES public.equipments(id),
  usuario_ref    text,
  usuario_nombre varchar(255),
  usuario_area   varchar(255),
  tipo           varchar(50) CHECK (tipo IN ('asignacion', 'devolucion', 'traslado', 'baja')),
  fecha          timestamptz DEFAULT now(),
  observaciones  text,
  registrado_por varchar(255),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eqmov_user_idx   ON public.equipment_movements (user_id);
CREATE INDEX IF NOT EXISTS eqmov_equipo_idx ON public.equipment_movements (equipment_id);
CREATE INDEX IF NOT EXISTS eqmov_fecha_idx  ON public.equipment_movements (fecha DESC);

-- ============================================
-- TABLA: USERS_NEW (Altas de usuarios hechas desde la app)
-- La lee y escribe solo la función serverless con la clave service_role.
-- ============================================
CREATE TABLE IF NOT EXISTS public.users_new (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  apellido     text NOT NULL,
  usuario      text NOT NULL,          -- login, en minúsculas sin espacios
  correo       text NOT NULL DEFAULT '',
  departamento text NOT NULL DEFAULT '',
  estado       text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_new_usuario_key ON public.users_new (lower(usuario));
CREATE UNIQUE INDEX IF NOT EXISTS users_new_correo_key  ON public.users_new (lower(correo)) WHERE correo <> '';

-- ============================================
-- TRIGGERS DE updated_at
-- (suppliers no tiene trigger en producción)
-- ============================================
DROP TRIGGER IF EXISTS update_app_printers_updated_at ON public.app_printers;
CREATE TRIGGER update_app_printers_updated_at BEFORE UPDATE ON public.app_printers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_toner_items_updated_at ON public.toner_items;
CREATE TRIGGER update_toner_items_updated_at BEFORE UPDATE ON public.toner_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_equipments_updated_at ON public.equipments;
CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON public.equipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_external_servers_updated_at ON public.external_servers;
CREATE TRIGGER update_external_servers_updated_at BEFORE UPDATE ON public.external_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_synced_devices_updated_at ON public.synced_devices;
CREATE TRIGGER update_synced_devices_updated_at BEFORE UPDATE ON public.synced_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS users_new_set_updated_at ON public.users_new;
CREATE TRIGGER users_new_set_updated_at BEFORE UPDATE ON public.users_new
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE public.app_printers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toner_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toner_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_servers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_devices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_new           ENABLE ROW LEVEL SECURITY;
-- users_new queda SIN políticas a propósito: el navegador no puede leerla ni
-- escribirla; solo la función serverless (service_role, que ignora RLS).

-- Políticas "cada usuario ve y modifica solo sus filas" (SELECT/INSERT/UPDATE/DELETE).
-- En toner_movements los nombres de política dicen "movements" (nombre previo de la tabla).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('app_printers',     'app_printers'),
      ('toner_items',      'toner_items'),
      ('toner_movements',  'movements'),
      ('equipments',       'equipments'),
      ('suppliers',        'suppliers'),
      ('vouchers',         'vouchers'),
      ('external_servers', 'external_servers'),
      ('synced_devices',   'synced_devices')
    ) AS v(tabla, etiqueta)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can view their own '   || t.etiqueta, t.tabla);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can insert their own ' || t.etiqueta, t.tabla);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can update their own ' || t.etiqueta, t.tabla);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can delete their own ' || t.etiqueta, t.tabla);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)',
                   'Users can view their own '   || t.etiqueta, t.tabla);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)',
                   'Users can insert their own ' || t.etiqueta, t.tabla);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)',
                   'Users can update their own ' || t.etiqueta, t.tabla);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)',
                   'Users can delete their own ' || t.etiqueta, t.tabla);
  END LOOP;
END $$;

-- Movimientos de equipos: una sola política FOR ALL.
DROP POLICY IF EXISTS "own_equipment_movements" ON public.equipment_movements;
CREATE POLICY "own_equipment_movements"
  ON public.equipment_movements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RPC: registrar movimiento de equipo (transaccional)
-- Inserta el movimiento y actualiza el estado del equipo:
-- asignacion/traslado -> assigned | devolucion -> available | baja -> retired
-- ============================================
CREATE OR REPLACE FUNCTION public.registrar_equipment_movement(
  p_equipment_id uuid,
  p_usuario_ref text,
  p_usuario_nombre text,
  p_usuario_area text,
  p_tipo text,
  p_observaciones text DEFAULT NULL,
  p_registrado_por text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_id bigint;
  v_status text;
BEGIN
  IF p_tipo NOT IN ('asignacion', 'devolucion', 'traslado', 'baja') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;

  v_status := CASE p_tipo
    WHEN 'asignacion' THEN 'assigned'
    WHEN 'traslado'   THEN 'assigned'
    WHEN 'devolucion' THEN 'available'
    WHEN 'baja'       THEN 'retired'
  END;

  PERFORM id FROM public.equipments
    WHERE id = p_equipment_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El equipamiento no existe o no pertenece al usuario';
  END IF;

  INSERT INTO public.equipment_movements
    (user_id, equipment_id, usuario_ref, usuario_nombre, usuario_area, tipo, observaciones, registrado_por)
  VALUES
    (auth.uid(), p_equipment_id, p_usuario_ref, p_usuario_nombre, p_usuario_area, p_tipo, p_observaciones, p_registrado_por)
  RETURNING id INTO v_new_id;

  UPDATE public.equipments
    SET status = v_status, updated_at = now()
    WHERE id = p_equipment_id;

  RETURN v_new_id;
END;
$$;
