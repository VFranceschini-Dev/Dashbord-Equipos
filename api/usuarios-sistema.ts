/**
 * api/usuarios-sistema.ts — Administración de los usuarios que inician sesión en el sistema.
 * Solo para administradores (rol en perfiles_usuarios).
 *
 * GET   /api/usuarios-sistema → lista de perfiles { id, nombre, email, rol, area, activo, permisos, created_at }.
 * POST  /api/usuarios-sistema → crea la cuenta (Supabase Auth, con contraseña temporal) y su perfil.
 *         { nombre, email, password, rol, area?, permisos? }
 * PATCH /api/usuarios-sistema → edita un perfil.
 *         { id, nombre?, area?, rol?, activo?, permisos?, password? }
 *         Desactivar un usuario también bloquea su cuenta en Supabase Auth.
 *
 * DELETE /api/usuarios-sistema → elimina definitivamente a un usuario DESACTIVADO.
 *         { id, confirmar }  (confirmar = correo del usuario, a modo de confirmación)
 *         Todo lo que cargó pasa al administrador que lo elimina (función SQL reasignar_datos_usuario),
 *         luego se borra la cuenta de Supabase Auth y su perfil.
 *
 * Para conservar el historial lo normal es desactivar; eliminar es la baja definitiva.
 * Protecciones: un administrador no puede quitarse a sí mismo el rol ni desactivarse, y siempre
 * debe quedar al menos un administrador activo.
 *
 * Variables de entorno: SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY (solo servidor).
 */
import { sesionDeApi, type SesionApi } from './_lib/sesion.js';
import { ROLES, compactarPermisos, normalizarRol, sanearPermisos, type Permisos, type Rol } from './_lib/permisos.js';

const TIMEOUT_MS = 15000;
const NOMBRE_RE = /^[\p{L}\p{M} .'-]{1,80}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOQUEO_PERMANENTE = '876000h'; // ~100 años: Supabase Auth no tiene "desactivar" sin borrar

interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  area: string;
  activo: boolean;
  permisos: Permisos;
  created_at: string | null;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
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

interface Servicio { base: string; key: string }
function servicio(): Servicio | null {
  const base = env('SUPABASE_URL', 'VITE_SUPABASE_URL')?.replace(/\/+$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return base && key ? { base, key } : null;
}

const cabeceras = (s: Servicio, extra: Record<string, string> = {}) => ({
  apikey: s.key,
  Authorization: `Bearer ${s.key}`,
  'Content-Type': 'application/json',
  ...extra,
});

function aPerfil(f: any): Perfil {
  return {
    id: String(f.id),
    nombre: String(f.nombre ?? ''),
    email: String(f.email ?? ''),
    rol: normalizarRol(f.rol),
    area: String(f.area ?? ''),
    activo: f.activo !== false,
    permisos: sanearPermisos(f.permisos),
    created_at: f.created_at ?? null,
  };
}

/** Perfiles ordenados por nombre. Si todavía no existe la columna permisos (migración pendiente), se lee sin ella. */
async function listarPerfiles(s: Servicio): Promise<Perfil[]> {
  const url = `${s.base}/rest/v1/perfiles_usuarios?order=nombre.asc`;
  let res = await fetchConTimeout(`${url}&select=id,nombre,email,rol,area,activo,permisos,created_at`, { headers: cabeceras(s) });
  if (!res.ok) res = await fetchConTimeout(`${url}&select=id,nombre,email,rol,area,activo,created_at`, { headers: cabeceras(s) });
  if (!res.ok) throw new Error('No se pudo leer la lista de usuarios.');
  return ((await res.json()) as any[]).map(aPerfil);
}

async function leerJson(request: Request): Promise<any | null> {
  try { return await request.json(); } catch { return null; }
}

/** Sesión de un administrador activo, o la respuesta de error que corresponda. */
async function exigirAdministrador(request: Request): Promise<{ error: Response } | { sesion: SesionApi; s: Servicio }> {
  const sesion = await sesionDeApi(request);
  if (!sesion) return { error: jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' }) };
  if (sesion.rolSistema !== 'admin') {
    return { error: jsonResponse(403, { success: false, error: 'Solo un administrador puede gestionar usuarios.' }) };
  }
  const s = servicio();
  if (!s) return { error: jsonResponse(500, { success: false, error: 'La administración de usuarios no está configurada en el servidor.' }) };
  return { sesion, s };
}

const rolValido = (v: unknown): v is Rol => ROLES.some(r => r.id === v);

/** Texto de error de Supabase Auth -> mensaje para el administrador. */
async function errorAuth(res: Response): Promise<{ status: number; mensaje: string }> {
  let detalle = '';
  try { const j = await res.json(); detalle = String(j?.msg || j?.message || j?.error_description || j?.error_code || ''); } catch { /* sin cuerpo */ }
  if (res.status === 422 && /already|exist|registered/i.test(detalle)) return { status: 409, mensaje: 'Ya existe una cuenta con ese correo.' };
  if (/password/i.test(detalle) && /weak|short|least|characters/i.test(detalle)) return { status: 400, mensaje: 'La contraseña es demasiado débil. Usá al menos 8 caracteres.' };
  return { status: 502, mensaje: 'No se pudo completar la operación en el servicio de autenticación.' };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await exigirAdministrador(request);
  if ('error' in ctx) return ctx.error;
  try {
    return jsonResponse(200, { success: true, data: await listarPerfiles(ctx.s) });
  } catch (err) {
    return jsonResponse(502, { success: false, error: (err as Error).message });
  }
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await exigirAdministrador(request);
  if ('error' in ctx) return ctx.error;
  const { s } = ctx;

  const body = await leerJson(request);
  if (!body || typeof body !== 'object') return jsonResponse(400, { success: false, error: 'Solicitud inválida.' });

  const nombre = String(body.nombre ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const area = String(body.area ?? '').trim().slice(0, 80);
  const rol = body.rol;
  if (!NOMBRE_RE.test(nombre)) return jsonResponse(400, { success: false, error: 'Ingresá un nombre válido (hasta 80 caracteres).' });
  if (!EMAIL_RE.test(email)) return jsonResponse(400, { success: false, error: 'Ingresá un correo válido.' });
  if (password.length < 8 || password.length > 72) return jsonResponse(400, { success: false, error: 'La contraseña temporal debe tener entre 8 y 72 caracteres.' });
  if (!rolValido(rol)) return jsonResponse(400, { success: false, error: 'Elegí un rol válido.' });
  const permisos = compactarPermisos(rol, sanearPermisos(body.permisos));

  // 1) Cuenta en Supabase Auth (el correo queda confirmado: el administrador entrega la contraseña)
  const resAuth = await fetchConTimeout(`${s.base}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabeceras(s),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: nombre } }),
  });
  if (!resAuth.ok) {
    const e = await errorAuth(resAuth);
    return jsonResponse(e.status, { success: false, error: e.mensaje });
  }
  const creado = await resAuth.json();
  const id = String(creado?.id ?? '');
  if (!UUID_RE.test(id)) return jsonResponse(502, { success: false, error: 'El servicio de autenticación no devolvió el usuario creado.' });

  const deshacer = () => fetchConTimeout(`${s.base}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: cabeceras(s) }).catch(() => undefined);

  // 2) Perfil. Sin la columna permisos (migración pendiente) solo se puede crear sin ajustes.
  const fila = { id, nombre, email, rol, area, activo: true };
  const insertar = (datos: Record<string, unknown>) => fetchConTimeout(`${s.base}/rest/v1/perfiles_usuarios`, {
    method: 'POST',
    headers: cabeceras(s, { Prefer: 'return=representation' }),
    body: JSON.stringify(datos),
  });
  let resPerfil = await insertar(Object.keys(permisos).length ? { ...fila, permisos } : fila);
  if (!resPerfil.ok && Object.keys(permisos).length === 0) resPerfil = await insertar(fila);
  if (!resPerfil.ok) {
    await deshacer();
    return jsonResponse(502, { success: false, error: 'No se pudo guardar el perfil. Si es la primera vez, ejecutá la migración de permisos en Supabase. No se creó la cuenta.' });
  }
  const [guardado] = (await resPerfil.json()) as any[];
  return jsonResponse(201, { success: true, data: aPerfil(guardado ?? { ...fila, permisos }) });
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await exigirAdministrador(request);
  if ('error' in ctx) return ctx.error;
  const { sesion, s } = ctx;

  const body = await leerJson(request);
  const id = String(body?.id ?? '');
  if (!body || !UUID_RE.test(id)) return jsonResponse(400, { success: false, error: 'Solicitud inválida.' });

  let perfiles: Perfil[];
  try { perfiles = await listarPerfiles(s); } catch (err) { return jsonResponse(502, { success: false, error: (err as Error).message }); }
  const actual = perfiles.find(p => p.id === id);
  if (!actual) return jsonResponse(404, { success: false, error: 'No se encontró el usuario.' });

  const cambios: Record<string, unknown> = {};
  if ('nombre' in body) {
    const nombre = String(body.nombre ?? '').trim();
    if (!NOMBRE_RE.test(nombre)) return jsonResponse(400, { success: false, error: 'Ingresá un nombre válido (hasta 80 caracteres).' });
    cambios.nombre = nombre;
  }
  if ('area' in body) cambios.area = String(body.area ?? '').trim().slice(0, 80);
  if ('rol' in body) {
    if (!rolValido(body.rol)) return jsonResponse(400, { success: false, error: 'Elegí un rol válido.' });
    cambios.rol = body.rol;
  }
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') return jsonResponse(400, { success: false, error: 'Solicitud inválida.' });
    cambios.activo = body.activo;
  }
  const password = 'password' in body ? String(body.password ?? '') : null;
  if (password !== null && (password.length < 8 || password.length > 72)) {
    return jsonResponse(400, { success: false, error: 'La contraseña temporal debe tener entre 8 y 72 caracteres.' });
  }

  const rolFinal = (cambios.rol as Rol | undefined) ?? actual.rol;
  const activoFinal = (cambios.activo as boolean | undefined) ?? actual.activo;
  if ('permisos' in body || 'rol' in cambios) {
    cambios.permisos = compactarPermisos(rolFinal, 'permisos' in body ? sanearPermisos(body.permisos) : actual.permisos);
  }

  // Protecciones contra bloqueo
  if (id === sesion.id && (rolFinal !== 'admin' || !activoFinal)) {
    return jsonResponse(409, { success: false, error: 'No podés quitarte el rol de administrador ni desactivarte a vos mismo. Pedíselo a otro administrador.' });
  }
  const administradores = perfiles
    .map(p => (p.id === id ? { rol: rolFinal, activo: activoFinal } : p))
    .filter(p => p.rol === 'admin' && p.activo).length;
  if (administradores === 0) {
    return jsonResponse(409, { success: false, error: 'Tiene que quedar al menos un administrador activo.' });
  }

  // Perfil
  let perfilFinal: Perfil = actual;
  if (Object.keys(cambios).length > 0) {
    const patch = (datos: Record<string, unknown>) => fetchConTimeout(`${s.base}/rest/v1/perfiles_usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: cabeceras(s, { Prefer: 'return=representation' }),
      body: JSON.stringify(datos),
    });
    let res: Response | null = await patch(cambios);
    // Migración pendiente (no existe la columna permisos): sin ajustes que guardar, se omite esa columna.
    if (!res.ok && 'permisos' in cambios && Object.keys(cambios.permisos as object).length === 0) {
      const { permisos: _omitido, ...resto } = cambios;
      res = Object.keys(resto).length > 0 ? await patch(resto) : null;
    }
    if (res && !res.ok) {
      return jsonResponse(502, { success: false, error: 'No se pudo guardar el cambio. Si guardás permisos, verificá que la migración de permisos esté ejecutada en Supabase.' });
    }
    const [guardado] = res ? ((await res.json()) as any[]) : [];
    perfilFinal = guardado ? aPerfil(guardado) : { ...actual, ...(cambios as Partial<Perfil>), rol: rolFinal, activo: activoFinal };
  }

  // Cuenta de Supabase Auth: bloqueo al desactivar / contraseña temporal
  const avisos: string[] = [];
  const authCambios: Record<string, unknown> = {};
  if ('activo' in cambios && cambios.activo !== actual.activo) authCambios.ban_duration = cambios.activo ? 'none' : BLOQUEO_PERMANENTE;
  if (password !== null) authCambios.password = password;
  if (Object.keys(authCambios).length > 0) {
    const res = await fetchConTimeout(`${s.base}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: cabeceras(s), body: JSON.stringify(authCambios) });
    if (!res.ok) {
      const e = await errorAuth(res);
      avisos.push(password !== null && 'password' in authCambios
        ? `El perfil se guardó, pero no se pudo cambiar la contraseña: ${e.mensaje}`
        : `El perfil se guardó, pero no se pudo actualizar el bloqueo de la cuenta: ${e.mensaje}`);
    }
  }

  return jsonResponse(200, { success: true, data: perfilFinal, aviso: avisos.join(' ') || undefined });
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await exigirAdministrador(request);
  if ('error' in ctx) return ctx.error;
  const { sesion, s } = ctx;

  const body = await leerJson(request);
  const id = String(body?.id ?? '');
  if (!body || !UUID_RE.test(id)) return jsonResponse(400, { success: false, error: 'Solicitud inválida.' });
  if (id === sesion.id) return jsonResponse(409, { success: false, error: 'No podés eliminar tu propia cuenta. Pedíselo a otro administrador.' });

  let perfiles: Perfil[];
  try { perfiles = await listarPerfiles(s); } catch (err) { return jsonResponse(502, { success: false, error: (err as Error).message }); }
  const objetivo = perfiles.find(p => p.id === id);
  if (!objetivo) return jsonResponse(404, { success: false, error: 'No se encontró el usuario.' });
  if (objetivo.activo) return jsonResponse(409, { success: false, error: 'Primero desactivá al usuario; solo se pueden eliminar usuarios desactivados.' });
  if (String(body.confirmar ?? '').trim().toLowerCase() !== objetivo.email.trim().toLowerCase()) {
    return jsonResponse(400, { success: false, error: 'Escribí el correo del usuario para confirmar la eliminación.' });
  }
  // Un usuario inactivo no cuenta como administrador, pero se revisa igual por seguridad.
  if (!perfiles.some(p => p.id !== id && p.rol === 'admin' && p.activo)) {
    return jsonResponse(409, { success: false, error: 'Tiene que quedar al menos un administrador activo.' });
  }

  // 1) Los datos que cargó pasan al administrador que lo elimina
  const resRpc = await fetchConTimeout(`${s.base}/rest/v1/rpc/reasignar_datos_usuario`, {
    method: 'POST',
    headers: cabeceras(s),
    body: JSON.stringify({ p_origen: id, p_destino: sesion.id }),
  });
  if (!resRpc.ok) {
    const faltaFuncion = resRpc.status === 404;
    return jsonResponse(502, {
      success: false,
      error: faltaFuncion
        ? 'Falta ejecutar en Supabase la migración de eliminación de usuarios (20261128_eliminar_usuarios.sql). No se eliminó nada.'
        : 'No se pudieron traspasar los datos del usuario. No se eliminó nada.',
    });
  }
  const reasignado = (await resRpc.json().catch(() => ({}))) as Record<string, number>;

  // 2) Cuenta de Supabase Auth (404 = ya no existía)
  const resAuth = await fetchConTimeout(`${s.base}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: cabeceras(s) });
  if (!resAuth.ok && resAuth.status !== 404) {
    const e = await errorAuth(resAuth);
    return jsonResponse(e.status, { success: false, error: `Los datos ya pasaron a tu cuenta, pero no se pudo eliminar la cuenta: ${e.mensaje} Reintentá la eliminación.` });
  }

  // 3) Perfil
  const resPerfil = await fetchConTimeout(`${s.base}/rest/v1/perfiles_usuarios?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: cabeceras(s) });
  const aviso = resPerfil.ok ? undefined : 'La cuenta se eliminó, pero quedó un registro de perfil sin borrar.';

  return jsonResponse(200, { success: true, data: { id, email: objetivo.email, reasignado }, aviso });
}
