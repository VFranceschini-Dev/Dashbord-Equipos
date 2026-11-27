/**
 * api/zammad-usuarios.ts — Directorio de Zammad para dar de alta usuarios (solo administradores).
 *
 * GET /api/zammad-usuarios?q=texto → hasta 30 usuarios activos de las organizaciones habilitadas
 *        { zammadId, login, nombre, email, yaTieneCuenta }. Sin q devuelve los primeros 30.
 *
 * Variables: ZAMMAD_URL, ZAMMAD_TOKEN, ZAMMAD_ORGANIZACIONES, SUPABASE_URL (o VITE_), SUPABASE_SERVICE_ROLE_KEY.
 */
import { sesionDeApi } from './_lib/sesion.js';
import { usuariosHabilitados } from './_lib/zammad-directorio.js';

const LIMITE = 30;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

/** ids de Zammad y correos que ya tienen cuenta en el sistema. */
async function cuentasExistentes(): Promise<{ ids: Set<number>; correos: Set<string> }> {
  const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ids = new Set<number>(); const correos = new Set<string>();
  if (!base || !key) return { ids, correos };
  const cab = { apikey: key, Authorization: `Bearer ${key}` };
  let res = await fetch(`${base}/rest/v1/perfiles_usuarios?select=email,zammad_id`, { headers: cab });
  if (!res.ok) res = await fetch(`${base}/rest/v1/perfiles_usuarios?select=email`, { headers: cab });   // migración de zammad_id pendiente
  if (res.ok) for (const f of (await res.json()) as any[]) {
    if (f.email) correos.add(String(f.email).toLowerCase());
    if (Number.isInteger(f.zammad_id)) ids.add(f.zammad_id);
  }
  return { ids, correos };
}

export async function GET(request: Request): Promise<Response> {
  const sesion = await sesionDeApi(request);
  if (!sesion) return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });
  if (sesion.rolSistema !== 'admin') return jsonResponse(403, { success: false, error: 'Solo un administrador puede ver el directorio.' });

  const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  try {
    const [todos, existentes] = await Promise.all([usuariosHabilitados(), cuentasExistentes()]);
    const coincide = q ? todos.filter(u => [u.nombre, u.login, u.email].some(t => t.toLowerCase().includes(q))) : todos;
    const data = coincide.slice(0, LIMITE).map(u => ({
      zammadId: u.zammadId, login: u.login, nombre: u.nombre, email: u.email,
      yaTieneCuenta: existentes.ids.has(u.zammadId) || (u.email !== '' && existentes.correos.has(u.email)),
    }));
    return jsonResponse(200, { success: true, data, total: coincide.length });
  } catch (err) {
    return jsonResponse(502, { success: false, error: (err as Error).message });
  }
}
