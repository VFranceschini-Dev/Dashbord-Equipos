-- Fase 2: datos compartidos por el equipo, con permisos hechos cumplir en la base.
--
-- ANTES: impresoras, tóner, movimientos de tóner, equipos, movimientos de equipos y constancias eran
--        "cada usuario ve solo lo suyo" (auth.uid() = user_id); proveedores y facturas, abiertos a todo usuario con sesión.
-- AHORA: todos esos datos son del equipo y cada acción se permite según la matriz del usuario
--        (public.tiene_permiso): ver / crear / editar / eliminar por módulo.
--          equipos      -> equipments, equipment_movements, comprobantes_entrega (solo lectura desde el navegador)
--          impresoras   -> app_printers, toner_items, toner_movements
--          proveedores  -> suppliers, vouchers y el espacio de archivos "facturas"
--        user_id pasa a ser "quién lo cargó"; ya no limita quién lo ve.
--        Los datos existentes no se mueven: quedan visibles para quien tenga permiso de ver.
--
-- REQUISITOS (esta migración aborta con un mensaje claro si falta alguno):
--   1. 20261126_permisos_usuarios.sql ejecutada.
--   2. 20261127_0_perfiles_faltantes.sql ejecutada (toda cuenta de acceso necesita perfil).
--   3. Al menos un administrador activo.
--   4. Sin códigos de inventario de impresora repetidos entre usuarios ni nodos de Mesh repetidos.
-- ORDEN: ejecutar esta migración y después desplegar el código (o al revés: ambos órdenes son seguros).
-- Para volver atrás: supabase/rollback/20261127_datos_compartidos_permisos_revertir.sql
-- Se puede ejecutar más de una vez.

-- ---------------------------------------------------------------------------
-- 0) Comprobaciones previas
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_lista text;
BEGIN
  IF to_regprocedure('public.tiene_permiso(text, text)') IS NULL THEN
    RAISE EXCEPTION 'Falta ejecutar antes 20261126_permisos_usuarios.sql.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.perfiles_usuarios WHERE lower(coalesce(rol, '')) = 'admin' AND coalesce(activo, true)) THEN
    RAISE EXCEPTION 'No hay ningún administrador activo en perfiles_usuarios. Sin uno, nadie podría administrar el sistema.';
  END IF;

  SELECT string_agg(u.email, ', ') INTO v_lista
    FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.perfiles_usuarios p WHERE p.id = u.id);
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'Estas cuentas no tienen perfil y quedarían sin acceso: %. Ejecutá antes 20261127_0_perfiles_faltantes.sql.', v_lista;
  END IF;

  SELECT string_agg(codigo, ', ') INTO v_lista
    FROM (SELECT lower(inventory_code) AS codigo FROM public.app_printers WHERE inventory_code <> ''
          GROUP BY lower(inventory_code) HAVING count(*) > 1) d;
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'Códigos de inventario de impresora repetidos entre usuarios: %. Corregilos antes (el código pasa a ser único para todo el equipo).', v_lista;
  END IF;

  SELECT string_agg(mesh_node_id, ', ') INTO v_lista
    FROM (SELECT mesh_node_id FROM public.equipments WHERE mesh_node_id IS NOT NULL
          GROUP BY mesh_node_id HAVING count(*) > 1) d;
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'Equipos de Mesh repetidos entre usuarios (nodo: %). Dejá uno por nodo antes de continuar.', v_lista;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) tiene_permiso estricto: una cuenta sin perfil no tiene ningún permiso
--    (la versión de 20261126 la trataba como operador).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiene_permiso(p_modulo text, p_accion text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol    text;
  v_activo boolean;
  v_perm   jsonb;
  v_ver    boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF p_modulo NOT IN ('equipos', 'proveedores', 'impresoras', 'reportes', 'servidores')
     OR p_accion NOT IN ('ver', 'crear', 'editar', 'eliminar') THEN
    RETURN false;
  END IF;

  SELECT lower(coalesce(rol, '')), coalesce(activo, true), coalesce(permisos, '{}'::jsonb)
    INTO v_rol, v_activo, v_perm
    FROM public.perfiles_usuarios
   WHERE id = auth.uid();

  IF NOT FOUND THEN RETURN false; END IF;      -- sin perfil: sin acceso
  IF NOT v_activo THEN RETURN false; END IF;
  IF v_rol = 'admin' THEN RETURN true; END IF;

  v_ver := coalesce(
    CASE WHEN jsonb_typeof(v_perm #> ARRAY[p_modulo, 'ver']) = 'boolean'
         THEN (v_perm #>> ARRAY[p_modulo, 'ver'])::boolean END,
    public.permiso_base(v_rol, p_modulo, 'ver'));
  IF NOT v_ver THEN RETURN false; END IF;
  IF p_accion = 'ver' THEN RETURN true; END IF;

  RETURN coalesce(
    CASE WHEN jsonb_typeof(v_perm #> ARRAY[p_modulo, p_accion]) = 'boolean'
         THEN (v_perm #>> ARRAY[p_modulo, p_accion])::boolean END,
    public.permiso_base(v_rol, p_modulo, p_accion));
END;
$$;
GRANT EXECUTE ON FUNCTION public.tiene_permiso(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Políticas por permiso (reemplazan TODAS las políticas anteriores de estas tablas)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t record;
  pol record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('app_printers',        'impresoras',  true),
      ('toner_items',         'impresoras',  true),
      ('toner_movements',     'impresoras',  true),
      ('equipments',          'equipos',     true),
      ('equipment_movements', 'equipos',     true),
      ('suppliers',           'proveedores', false),
      ('vouchers',            'proveedores', false)
    ) AS v(tabla, modulo, exige_creador)
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tabla LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t.tabla);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.tiene_permiso(%L, ''ver''))',
                   'permiso_ver_' || t.tabla, t.tabla, t.modulo);
    -- user_id registra quién cargó el dato; en las tablas con creador no se puede cargar a nombre de otro.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso(%L, ''crear'')%s)',
                   'permiso_crear_' || t.tabla, t.tabla, t.modulo,
                   CASE WHEN t.exige_creador THEN ' AND user_id = auth.uid()' ELSE '' END);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.tiene_permiso(%L, ''editar'')) WITH CHECK (public.tiene_permiso(%L, ''editar''))',
                   'permiso_editar_' || t.tabla, t.tabla, t.modulo, t.modulo);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.tiene_permiso(%L, ''eliminar''))',
                   'permiso_eliminar_' || t.tabla, t.tabla, t.modulo);
  END LOOP;
END $$;

-- Constancias de entrega: el navegador solo lee (las escribe la función serverless con service_role).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comprobantes_entrega' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.comprobantes_entrega', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "permiso_ver_comprobantes_entrega" ON public.comprobantes_entrega
  FOR SELECT TO authenticated USING (public.tiene_permiso('equipos', 'ver'));

-- Archivos de facturas (espacio privado "facturas")
DROP POLICY IF EXISTS "facturas_equipo_sistemas"  ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_ver"      ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_crear"    ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_editar"   ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_eliminar" ON storage.objects;
CREATE POLICY "facturas_permiso_ver" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'facturas' AND public.tiene_permiso('proveedores', 'ver'));
CREATE POLICY "facturas_permiso_crear" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facturas' AND public.tiene_permiso('proveedores', 'crear'));
CREATE POLICY "facturas_permiso_editar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'facturas' AND public.tiene_permiso('proveedores', 'editar'))
  WITH CHECK (bucket_id = 'facturas' AND public.tiene_permiso('proveedores', 'editar'));
CREATE POLICY "facturas_permiso_eliminar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'facturas' AND public.tiene_permiso('proveedores', 'eliminar'));

-- ---------------------------------------------------------------------------
-- 3) Únicos que pasan de "por usuario" a "para todo el equipo"
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_app_printers_inventory_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_printers_inventory_code
  ON public.app_printers (lower(inventory_code))
  WHERE inventory_code <> '';

DROP INDEX IF EXISTS public.equipments_mesh_node_key;
CREATE UNIQUE INDEX IF NOT EXISTS equipments_mesh_node_key
  ON public.equipments (mesh_node_id)
  WHERE mesh_node_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Registrar movimiento de equipo: ya no exige que el equipo sea "propio".
--    Corre con los permisos de quien llama (SECURITY INVOKER) y exige crear + editar en Equipos,
--    porque inserta el movimiento y cambia el estado del equipo; con solo una de las dos quedaría a medias.
-- ---------------------------------------------------------------------------
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

  IF NOT (public.tiene_permiso('equipos', 'crear') AND public.tiene_permiso('equipos', 'editar')) THEN
    RAISE EXCEPTION 'No tenés permiso para registrar movimientos de equipos.';
  END IF;

  v_status := CASE p_tipo
    WHEN 'asignacion' THEN 'assigned'
    WHEN 'traslado'   THEN 'assigned'
    WHEN 'devolucion' THEN 'available'
    WHEN 'baja'       THEN 'retired'
  END;

  PERFORM id FROM public.equipments WHERE id = p_equipment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El equipamiento no existe o no tenés acceso a él';
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
