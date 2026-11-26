-- Revierte 20261127_datos_compartidos_permisos.sql: vuelve a "cada usuario ve solo lo suyo" en impresoras,
-- tóner, movimientos de tóner, equipos, movimientos de equipos y constancias; proveedores y facturas
-- vuelven a estar abiertos a todo usuario con sesión.
--
-- Qué NO se deshace: los datos que ya se cargaron siguen guardados con el usuario que los creó, así que después
-- de revertir cada persona vuelve a ver solo lo que cargó ella. No se pierde nada.
-- Ejecutar en Supabase > SQL Editor. Se puede ejecutar más de una vez.
-- Si en el medio dos usuarios cargaron el mismo código de inventario o nodo de Mesh, el paso 3 puede fallar:
-- corregí el duplicado y volvé a ejecutar.

-- 1) Políticas "propias"
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_printers', 'toner_items', 'toner_movements', 'equipments'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', 'Users can view their own '   || CASE t WHEN 'toner_movements' THEN 'movements' ELSE t END, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', 'Users can insert their own ' || CASE t WHEN 'toner_movements' THEN 'movements' ELSE t END, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)', 'Users can update their own ' || CASE t WHEN 'toner_movements' THEN 'movements' ELSE t END, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)', 'Users can delete their own ' || CASE t WHEN 'toner_movements' THEN 'movements' ELSE t END, t);
  END LOOP;

  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'equipment_movements' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipment_movements', pol.policyname);
  END LOOP;
  CREATE POLICY "own_equipment_movements" ON public.equipment_movements FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comprobantes_entrega' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.comprobantes_entrega', pol.policyname);
  END LOOP;
  CREATE POLICY "own_comprobantes_select" ON public.comprobantes_entrega FOR SELECT USING (auth.uid() = user_id);

  -- 2) Proveedores y facturas: abiertos a todo usuario con sesión
  FOREACH t IN ARRAY ARRAY['suppliers', 'vouchers'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'equipo_sistemas_' || t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "facturas_permiso_ver"      ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_crear"    ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_editar"   ON storage.objects;
DROP POLICY IF EXISTS "facturas_permiso_eliminar" ON storage.objects;
DROP POLICY IF EXISTS "facturas_equipo_sistemas"  ON storage.objects;
CREATE POLICY "facturas_equipo_sistemas" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'facturas') WITH CHECK (bucket_id = 'facturas');

-- 3) Únicos por usuario
DROP INDEX IF EXISTS public.uq_app_printers_inventory_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_printers_inventory_code
  ON public.app_printers (user_id, lower(inventory_code)) WHERE inventory_code <> '';
DROP INDEX IF EXISTS public.equipments_mesh_node_key;
CREATE UNIQUE INDEX IF NOT EXISTS equipments_mesh_node_key
  ON public.equipments (user_id, mesh_node_id) WHERE mesh_node_id IS NOT NULL;

-- 4) Registrar movimiento: vuelve a exigir que el equipo sea propio
CREATE OR REPLACE FUNCTION public.registrar_equipment_movement(
  p_equipment_id uuid, p_usuario_ref text, p_usuario_nombre text, p_usuario_area text,
  p_tipo text, p_observaciones text DEFAULT NULL, p_registrado_por text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE v_new_id bigint; v_status text;
BEGIN
  IF p_tipo NOT IN ('asignacion', 'devolucion', 'traslado', 'baja') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;
  v_status := CASE p_tipo WHEN 'asignacion' THEN 'assigned' WHEN 'traslado' THEN 'assigned'
                          WHEN 'devolucion' THEN 'available' WHEN 'baja' THEN 'retired' END;
  PERFORM id FROM public.equipments WHERE id = p_equipment_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'El equipamiento no existe o no pertenece al usuario'; END IF;
  INSERT INTO public.equipment_movements
    (user_id, equipment_id, usuario_ref, usuario_nombre, usuario_area, tipo, observaciones, registrado_por)
  VALUES (auth.uid(), p_equipment_id, p_usuario_ref, p_usuario_nombre, p_usuario_area, p_tipo, p_observaciones, p_registrado_por)
  RETURNING id INTO v_new_id;
  UPDATE public.equipments SET status = v_status, updated_at = now() WHERE id = p_equipment_id;
  RETURN v_new_id;
END;
$$;

-- 5) tiene_permiso vuelve a tratar una cuenta sin perfil como operador (versión de 20261126)
CREATE OR REPLACE FUNCTION public.tiene_permiso(p_modulo text, p_accion text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rol text; v_activo boolean; v_perm jsonb; v_ver boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF p_modulo NOT IN ('equipos', 'proveedores', 'impresoras', 'reportes', 'servidores')
     OR p_accion NOT IN ('ver', 'crear', 'editar', 'eliminar') THEN RETURN false; END IF;
  SELECT lower(coalesce(rol, '')), coalesce(activo, true), coalesce(permisos, '{}'::jsonb)
    INTO v_rol, v_activo, v_perm FROM public.perfiles_usuarios WHERE id = auth.uid();
  IF NOT FOUND THEN v_rol := ''; v_activo := true; v_perm := '{}'::jsonb; END IF;
  IF NOT v_activo THEN RETURN false; END IF;
  IF v_rol = 'admin' THEN RETURN true; END IF;
  v_ver := coalesce(CASE WHEN jsonb_typeof(v_perm #> ARRAY[p_modulo, 'ver']) = 'boolean'
                         THEN (v_perm #>> ARRAY[p_modulo, 'ver'])::boolean END,
                    public.permiso_base(v_rol, p_modulo, 'ver'));
  IF NOT v_ver THEN RETURN false; END IF;
  IF p_accion = 'ver' THEN RETURN true; END IF;
  RETURN coalesce(CASE WHEN jsonb_typeof(v_perm #> ARRAY[p_modulo, p_accion]) = 'boolean'
                       THEN (v_perm #>> ARRAY[p_modulo, p_accion])::boolean END,
                  public.permiso_base(v_rol, p_modulo, p_accion));
END;
$$;
