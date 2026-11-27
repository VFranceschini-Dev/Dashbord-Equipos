-- ============================================================================
-- Roles por defecto más estrictos (solo cambia lo que cada rol permite "de base")
--   Consulta : solo ver, y solo Equipos e Impresoras.
--   Operador : ver, crear y editar en Equipos, Proveedores e Impresoras; solo ver en Reportes y
--              Servidores; NO elimina (se habilita como ajuste por usuario).
--   Administrador: todo.
-- Los ajustes individuales guardados en perfiles_usuarios.permisos siguen valiendo por encima del rol.
-- Aplica de inmediato a las políticas de datos (usan tiene_permiso -> permiso_base).
-- Idempotente. Para volver atrás: ejecutar la versión anterior en 20261126_permisos_usuarios.sql.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.permiso_base(p_rol text, p_modulo text, p_accion text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_modulo NOT IN ('equipos', 'proveedores', 'impresoras', 'reportes', 'servidores') THEN false
    WHEN p_accion NOT IN ('ver', 'crear', 'editar', 'eliminar') THEN false
    WHEN lower(coalesce(p_rol, '')) = 'admin' THEN true
    WHEN lower(coalesce(p_rol, '')) IN ('lectura', 'solo lectura', 'solo_lectura')
      THEN p_accion = 'ver' AND p_modulo IN ('equipos', 'impresoras')
    WHEN p_accion = 'ver' THEN true
    WHEN p_accion = 'eliminar' THEN false
    ELSE p_modulo IN ('equipos', 'proveedores', 'impresoras')
  END;
$$;
