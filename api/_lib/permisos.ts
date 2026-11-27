/**
 * Modelo de permisos del sistema (roles + ajustes por módulo).
 *
 * IMPORTANTE: este archivo es una copia idéntica de src/config/permisos.ts (la API
 * no puede importar desde src/). Si se cambia uno, se cambia el otro. La función SQL
 * public.tiene_permiso() (supabase/migrations/20261126_permisos_usuarios.sql) aplica las mismas reglas.
 *
 * Reglas:
 *  - Administrador: todo, y es el único que administra usuarios.
 *  - Operador: ver, crear y editar en Equipos, Proveedores e Impresoras; solo ver en Reportes y Servidores.
 *    Eliminar no viene con el rol: el administrador lo habilita como ajuste. Es también el rol de quien figura
 *    como "usuario" (o sin rol).
 *  - Consulta: solo ver, y solo Equipos e Impresoras (sin proveedores, reportes ni servidores).
 *  - Cada usuario puede tener ajustes que permiten o quitan una acción puntual de un módulo,
 *    por encima de su rol (excepto el Administrador, que siempre puede todo).
 *  - Crear, editar y eliminar exigen poder ver el módulo.
 */

export const MODULOS = ['equipos', 'proveedores', 'impresoras', 'reportes', 'servidores'] as const;
export type Modulo = (typeof MODULOS)[number];

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const;
export type Accion = (typeof ACCIONES)[number];

export type Rol = 'admin' | 'operador' | 'lectura';

/** Ajustes por usuario: true permite, false quita; lo que no figura sigue al rol. */
export type Permisos = Partial<Record<Modulo, Partial<Record<Accion, boolean>>>>;

export const ETIQUETA_MODULO: Record<Modulo, string> = {
  equipos: 'Equipos y asignaciones',
  proveedores: 'Proveedores y facturas',
  impresoras: 'Impresoras y tóner',
  reportes: 'Reportes',
  servidores: 'Servidores',
};

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
};

export const ROLES: { id: Rol; label: string; descripcion: string }[] = [
  { id: 'admin', label: 'Administrador', descripcion: 'Acceso total y administración de usuarios.' },
  { id: 'operador', label: 'Operador', descripcion: 'Ve, carga y edita equipos, proveedores e impresoras (eliminar se habilita aparte); en reportes y servidores solo mira.' },
  { id: 'lectura', label: 'Consulta', descripcion: 'Solo ve equipos, asignaciones, impresoras y tóner, sin modificar nada.' },
];

/** Convierte lo que haya guardado en la columna rol: "admin", "lectura"; cualquier otra cosa (user, vacío) es operador. */
export function normalizarRol(valor: unknown): Rol {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'lectura' || /^solo[ _]lectura$/.test(v)) return 'lectura';
  return 'operador';
}

/** Lo que permite el rol por sí solo, sin ajustes. */
export function permisoBase(rol: Rol, modulo: Modulo, accion: Accion): boolean {
  if (rol === 'admin') return true;
  if (rol === 'lectura') return accion === 'ver' && (modulo === 'equipos' || modulo === 'impresoras');
  if (accion === 'ver') return true;
  if (accion === 'eliminar') return false;
  return modulo === 'equipos' || modulo === 'proveedores' || modulo === 'impresoras';
}

/** Ajustes guardados -> solo módulos y acciones conocidos con valor true/false. */
export function sanearPermisos(entrada: unknown): Permisos {
  const salida: Permisos = {};
  if (!entrada || typeof entrada !== 'object') return salida;
  for (const modulo of MODULOS) {
    const ajustes = (entrada as Record<string, unknown>)[modulo];
    if (!ajustes || typeof ajustes !== 'object') continue;
    const limpio: Partial<Record<Accion, boolean>> = {};
    for (const accion of ACCIONES) {
      const valor = (ajustes as Record<string, unknown>)[accion];
      if (typeof valor === 'boolean') limpio[accion] = valor;
    }
    if (Object.keys(limpio).length > 0) salida[modulo] = limpio;
  }
  return salida;
}

/** ¿Puede este usuario hacer esta acción en este módulo? */
export function puede(rol: Rol, permisos: Permisos | null | undefined, modulo: Modulo, accion: Accion): boolean {
  if (rol === 'admin') return true;
  const valor = (a: Accion) => permisos?.[modulo]?.[a] ?? permisoBase(rol, modulo, a);
  if (!valor('ver')) return false;
  return valor(accion);
}

/** Ajustes mínimos: descarta los que coinciden con lo que ya da el rol. */
export function compactarPermisos(rol: Rol, permisos: Permisos): Permisos {
  const salida: Permisos = {};
  for (const modulo of MODULOS) {
    const limpio: Partial<Record<Accion, boolean>> = {};
    for (const accion of ACCIONES) {
      const valor = permisos[modulo]?.[accion];
      if (typeof valor === 'boolean' && valor !== permisoBase(rol, modulo, accion)) limpio[accion] = valor;
    }
    if (Object.keys(limpio).length > 0) salida[modulo] = limpio;
  }
  return salida;
}
