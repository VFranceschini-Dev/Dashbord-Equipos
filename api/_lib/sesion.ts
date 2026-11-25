/**
 * api/_lib/sesion.ts — Validación de sesión compartida por las funciones de api/.
 *
 * Valida el Bearer token contra Supabase Auth y lee el perfil del usuario en
 * perfiles_usuarios (con el propio token del usuario, sujeto a RLS: no necesita
 * service_role). Devuelve null si no hay sesión válida o si el perfil está
 * desactivado, así un usuario dado de baja deja de acceder aunque su token siga vigente.
 *
 * Misma regla que src/services/authService.ts: sin fila en perfiles_usuarios se
 * usa app_metadata.role y el usuario se considera activo.
 */
const TIMEOUT_MS = 15000;

export interface SesionApi {
  id: string;
  email: string;
  rol: 'admin' | 'user';
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

    let rol: SesionApi['rol'] = u.app_metadata?.role === 'admin' ? 'admin' : 'user';
    const resPerfil = await fetchConTimeout(
      `${baseUrl}/rest/v1/perfiles_usuarios?id=eq.${encodeURIComponent(id)}&select=rol,activo`,
      { headers },
    );
    if (resPerfil.ok) {
      const [perfil] = (await resPerfil.json()) as { rol?: string; activo?: boolean }[];
      if (perfil) {
        if (perfil.activo === false) return null;
        rol = String(perfil.rol ?? '').toLowerCase() === 'admin' ? 'admin' : 'user';
      }
    }
    return { id, email: String(u.email || ''), rol };
  } catch {
    return null;
  }
}
