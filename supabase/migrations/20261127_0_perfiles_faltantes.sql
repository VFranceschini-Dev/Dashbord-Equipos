-- Preparación de la Fase 2 (datos compartidos con permisos): EJECUTAR ANTES de 20261127_datos_compartidos_permisos.sql.
--
-- 1) Corrige el correo guardado en cada perfil para que coincida con el de la cuenta de acceso (Auth).
-- 2) Crea el perfil de las cuentas de Auth que no tienen ninguno, como "operador" activo
--    (es lo que la app venía haciendo con ellas, así nadie pierde acceso). Después podés
--    cambiarles el rol o los permisos desde Administración.
-- Se puede ejecutar más de una vez. No toca roles ni datos de perfiles existentes.

-- 1) Correo del perfil = correo de Auth
UPDATE public.perfiles_usuarios p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND u.email IS NOT NULL
   AND p.email IS DISTINCT FROM u.email;

-- 2) Perfiles que faltan
INSERT INTO public.perfiles_usuarios (id, nombre, email, rol, activo)
SELECT u.id,
       COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
                NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
                split_part(u.email, '@', 1)),
       u.email, 'operador', true
  FROM auth.users u
 WHERE u.email IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.perfiles_usuarios p WHERE p.id = u.id);

-- Resultado: cuentas de acceso con su perfil y rol
SELECT u.email AS cuenta, p.nombre, p.rol, p.activo
  FROM auth.users u
  LEFT JOIN public.perfiles_usuarios p ON p.id = u.id
 ORDER BY u.email;
