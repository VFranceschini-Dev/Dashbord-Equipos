-- Permisos por usuario (roles + ajustes por módulo) — Fase 1 de "Administración de usuarios".
--
-- Es aditiva y no cambia ninguna política existente: agrega la columna de ajustes y las funciones
-- que usarán las políticas de datos en la Fase 2. Se puede ejecutar más de una vez.
-- EJECUTAR EN SUPABASE (SQL Editor) ANTES DE DESPLEGAR EL CÓDIGO: sin la columna, el perfil se lee
-- igual (el código lo tolera), pero no se pueden guardar permisos.
--
-- Reglas (mismas que src/config/permisos.ts):
--   admin     -> todo.
--   operador  -> ver/crear/editar/eliminar en equipos, proveedores e impresoras; solo ver en reportes y servidores.
--                Es lo que hoy figura como "user" o sin rol, así nadie pierde acceso.
--   lectura   -> solo ver, en todos los módulos.
--   Los ajustes por usuario (columna permisos) permiten o quitan una acción puntual por encima del rol.
--   Crear, editar y eliminar exigen poder ver el módulo.
-- Formato de permisos: {"proveedores": {"eliminar": false}, "reportes": {"crear": true}}

ALTER TABLE public.perfiles_usuarios
  ADD COLUMN IF NOT EXISTS permisos jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lo que permite el rol por sí solo
CREATE OR REPLACE FUNCTION public.permiso_base(p_rol text, p_modulo text, p_accion text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_modulo NOT IN ('equipos', 'proveedores', 'impresoras', 'reportes', 'servidores') THEN false
    WHEN p_accion NOT IN ('ver', 'crear', 'editar', 'eliminar') THEN false
    WHEN lower(coalesce(p_rol, '')) = 'admin' THEN true
    WHEN p_accion = 'ver' THEN true
    WHEN lower(coalesce(p_rol, '')) IN ('lectura', 'solo lectura', 'solo_lectura') THEN false
    ELSE p_modulo IN ('equipos', 'proveedores', 'impresoras')
  END;
$$;

-- ¿El usuario con sesión puede hacer esta acción en este módulo?
-- security definer: lee su propio perfil sin depender de las políticas de la tabla.
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

  -- Sin perfil: igual que la app, se lo trata como operador activo
  IF NOT FOUND THEN
    v_rol := ''; v_activo := true; v_perm := '{}'::jsonb;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.permiso_base(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tiene_permiso(text, text) TO authenticated;
