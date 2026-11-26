/**
 * api/_lib/sesion.ts — Validación de sesión compartida por las funciones de api/.
 *
 * Valida el Bearer token contra Supabase Auth y lee el perfil del usuario en
 * perfiles_usuarios (con el propio token del usuario, sujeto a RLS: no necesita
 * service_role). Devuelve null si no hay sesión válida o si el perfil está
 * desactivado, así un usuario dado de baja deja de acceder aunque su token siga vigente.
 *
 * Misma regla que src/services/authService.ts: una cuenta SIN fila en perfiles_usuarios no tiene acceso
 * (devuelve null), igual que la base (public.tiene_permiso). Si no se puede leer la tabla (error), se usa
 * app_metadata.role como último recurso.
 */
import { normalizarRol, puede, sanearPermisos, type Accion, type Modulo, type Permisos, type Rol } from './permisos.js';

const TIMEOUT_MS = 15000;

export interface SesionApi {
  id: string;
  email: string;
  /** 'admin' o 'user' (cualquier otro rol). Se conserva para el código que solo distingue administradores. */
  rol: 'admin' | 'user';
  /** Rol del sistema: admin, operador o lectura. */
  rolSistema: Rol;
  /** Ajustes por usuario (solo módulos y acciones conocidos). */
  permisos: Permisos;
  /** ¿Puede esta sesión hacer esta acción en este módulo? */
  puede: (modulo: Modulo, accion: Accion) => boolean;
}

function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

async function fetchConTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sesionDeApi(request: Request): Promise<SesionApi | null> {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const baseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!baseUrl || !anonKey) return null;

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  try {
    const res = await fetchConTimeout(`${baseUrl}/auth/v1/user`, { headers });
    if (!res.ok) return null;
    const u = await res.json();
    if (!u?.id) return null;
    const id = String(u.id);

    let rolSistema: Rol = normalizarRol(u.app_metadata?.role);
    let permisos: Permisos = {};
    const urlPerfil = `${baseUrl}/rest/v1/perfiles_usuarios?id=eq.${encodeURIComponent(id)}`;
    let resPerfil = await fetchConTimeout(`${urlPerfil}&select=rol,activo,permisos`, { headers });
    // Si todavía no se ejecutó la migración de permisos, la columna no existe: se lee sin ella.
    if (!resPerfil.ok) resPerfil = await fetchConTimeout(`${urlPerfil}&select=rol,activo`, { headers });
    if (resPerfil.ok) {
      const [perfil] = (await resPerfil.json()) as { rol?: string; activo?: boolean; permisos?: unknown }[];
      if (!perfil) return null;                  // sin perfil: sin acceso
      if (perfil.activo === false) return null;
      rolSistema = normalizarRol(perfil.rol);
      permisos = sanearPermisos(perfil.permisos);
    }
    return {
      id,
      email: String(u.email || ''),
      rol: rolSistema === 'admin' ? 'admin' : 'user',
      rolSistema,
      permisos,
      puede: (modulo, accion) => puede(rolSistema, permisos, modulo, accion),
    };
  } catch {
    return null;
  }
}
