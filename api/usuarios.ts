/**
 * api/usuarios.ts — Función serverless de Vercel (runtime Node).
 *
 * GET  /api/usuarios → lista de personas con el perfil normalizado
 *          { id, nombre, apellido, usuario, correo, departamento, estado, sinZammad? }.
 * POST /api/usuarios → retirado (410): las personas se gestionan en Zammad.
 *
 * Fuente: Zammad (directorio sincronizado con el Active Directory por LDAP), solo las organizaciones
 * habilitadas (api/_lib/zammad-directorio.ts). El id es un UUID v5 derivado del login (en minúsculas y
 * sin espacios), así las asignaciones ya registradas siguen apuntando a la misma persona si el login coincide.
 * Las personas con equipos asignados que no figuran en Zammad se muestran marcadas (sinZammad).
 *
 * Variables de entorno: ZAMMAD_URL, ZAMMAD_TOKEN, ZAMMAD_ORGANIZACIONES (por defecto 2),
 *   SUPABASE_URL / SUPABASE_ANON_KEY (sesión; fallback VITE_*), SUPABASE_SERVICE_ROLE_KEY (solo servidor).
 */
import { sesionDeApi } from './_lib/sesion.js';
import { miembrosOrganizaciones } from './_lib/zammad-directorio.js';

// ---------------------------------------------------------------------------
// Perfil normalizado: ES LO ÚNICO que sale al navegador.
// ---------------------------------------------------------------------------
interface UsuarioPublico {
  sinZammad?: boolean; // tiene equipos asignados pero ya no figura en Zammad
  id: string;           // UUID opaco v5 (login) — igual en ambas fuentes, no revela el origen
  nombre: string;       // pila
  apellido: string;
  usuario: string;      // login
  correo: string;
  departamento: string;
  estado: 'activo' | 'inactivo';
}

const TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// uuid v5 determinístico (implementación propia, sin dependencias nuevas)
// ---------------------------------------------------------------------------
function sha1Bytes(bytes: Uint8Array): Uint8Array {
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const l = bytes.length;
  const withPad = new Uint8Array((((l + 8) >> 6) + 1) << 6);
  withPad.set(bytes);
  withPad[l] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, (l << 3) >>> 0);
  view.setUint32(withPad.length - 8, Math.floor(l / 0x20000000));
  const w = new Int32Array(80);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getInt32(i + j * 4);
    for (let j = 16; j < 80; j++) {
      const s = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (s << 1) | (s >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setInt32(i * 4, h));
  return out;
}

const NAMESPACE_ORIGEN = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // URL

function uuidV5(namespaceHex: string, value: string): string {
  const ns = namespaceHex.replace(/-/g, '');
  const nsBytes: number[] = [];
  for (let i = 0; i < 32; i += 2) nsBytes.push(parseInt(ns.slice(i, i + 2), 16));
  const valBytes = Array.from(new TextEncoder().encode(value));
  const digest = sha1Bytes(Uint8Array.from([...nsBytes, ...valBytes]));
  digest[6] = (digest[6] & 0x0f) | 0x50; // versión 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Caché en memoria de la lista fusionada (single-flight, 5 minutos)
// ---------------------------------------------------------------------------
interface CacheEntry {
  expiresAt: number;
  promise: Promise<UsuarioLista[]>;
}
let cache: CacheEntry | null = null;

function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function cleanKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

// ---------------------------------------------------------------------------
// Validación de sesión (Bearer token → endpoint de autenticación)
// ---------------------------------------------------------------------------
async function validateSession(request: Request): Promise<boolean> {
  // Sesión válida Y perfil activo (ver api/_lib/sesion.ts)
  return (await sesionDeApi(request)) !== null;
}

// ---------------------------------------------------------------------------
// Fuente única: Zammad (usuarios del directorio LDAP, organizaciones habilitadas)
// ---------------------------------------------------------------------------
type UsuarioLista = UsuarioPublico & { sinZammad?: boolean };

function serviceBase(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

/**
 * Personas con equipos asignados hoy que no figuran en Zammad (por ejemplo, de la fuente anterior):
 * se siguen mostrando, marcadas, para no perder las asignaciones. Se calculan con el último movimiento
 * de cada equipo (asignación o traslado = asignado; devolución o baja = libre).
 */
async function personasConEquiposSinZammad(idsZammad: Set<string>): Promise<UsuarioLista[]> {
  const base = serviceBase();
  if (!base) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base.url}/rest/v1/equipment_movements?select=equipment_id,usuario_ref,usuario_nombre,usuario_area,tipo,fecha,id&order=fecha.desc,id.desc&limit=20000`,
      { headers: { apikey: base.key, Authorization: `Bearer ${base.key}` }, signal: controller.signal },
    );
    if (!res.ok) return [];
    const filas: any[] = await res.json();
    const visto = new Set<string>();
    const huerfanos = new Map<string, UsuarioLista>();
    for (const m of filas) {              // ya vienen del más nuevo al más viejo
      const eq = str(m.equipment_id);
      if (visto.has(eq)) continue;
      visto.add(eq);
      if (m.tipo !== 'asignacion' && m.tipo !== 'traslado') continue;
      const ref = str(m.usuario_ref);
      if (!ref || idsZammad.has(ref) || huerfanos.has(ref)) continue;
      huerfanos.set(ref, {
        id: ref, nombre: str(m.usuario_nombre) || 'Sin nombre', apellido: '', usuario: '', correo: '',
        departamento: str(m.usuario_area), estado: 'activo', sinZammad: true,
      });
    }
    return [...huerfanos.values()];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function loadUsuarios(): Promise<UsuarioLista[]> {
  let miembros;
  try {
    miembros = await miembrosOrganizaciones(true);
  } catch (err) {
    const msg = (err as Error).message;
    throw Object.assign(new Error(msg), { status: /no está configurada/.test(msg) ? 500 : 502 });
  }
  const lista: UsuarioLista[] = miembros.map(u => ({
    id: uuidV5(NAMESPACE_ORIGEN, cleanKey(u.login)),
    nombre: u.apellido && u.nombre.endsWith(u.apellido) ? u.nombre.slice(0, u.nombre.length - u.apellido.length).trim() : u.nombre,
    apellido: u.apellido,
    usuario: u.login,
    correo: u.email,
    departamento: u.departamento,
    estado: u.activo ? ('activo' as const) : ('inactivo' as const),
  }));
  const ids = new Set(lista.map(u => u.id));
  return [...lista, ...(await personasConEquiposSinZammad(ids))];
}

function getCached(forceRefresh: boolean): Promise<UsuarioLista[]> {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expiresAt > now) return cache.promise;
  const promise = loadUsuarios();
  promise.catch(() => { cache = null; }); // no cachear errores
  cache = { expiresAt: now + CACHE_TTL_MS, promise };
  return promise;
}

// ---------------------------------------------------------------------------
// Respuestas JSON
// ---------------------------------------------------------------------------
function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

// ---------------------------------------------------------------------------
// GET: búsqueda (filtros en memoria; NUNCA se arma SQL/consulta con el texto)
// ---------------------------------------------------------------------------
export async function GET(request: Request): Promise<Response> {
  const authenticated = await validateSession(request);
  if (!authenticated) {
    return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });
  }

  const url = new URL(request.url);
  const qRaw = url.searchParams.get('q') ?? '';
  if (qRaw.length > 120) {
    return jsonResponse(400, { success: false, error: 'El parámetro q supera los 120 caracteres.' });
  }
  const onlyActive = url.searchParams.get('soloActivos') !== 'false';
  const refresh = url.searchParams.get('refresh') === 'true';
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  if (Number.isNaN(limitParam) || limitParam < 1 || limitParam > 500) {
    return jsonResponse(400, { success: false, error: 'El parámetro limit debe estar entre 1 y 500.' });
  }

  let list: UsuarioLista[];
  try {
    list = await getCached(refresh);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    if (status === 504) return jsonResponse(504, { success: false, error: 'Tiempo de espera agotado al consultar los datos.' });
    if (status === 500) return jsonResponse(500, { success: false, error: 'Falta configuración del servidor.' });
    return jsonResponse(502, { success: false, error: 'No se pudo obtener la información en este momento.' });
  }

  let filtered = [...list]; // copia: el sort de abajo no debe alterar la caché
  const q = norm(qRaw);
  if (q) {
    filtered = filtered.filter(u =>
      norm(u.id).includes(q) ||
      norm(u.usuario).includes(q) ||
      norm(u.nombre).includes(q) ||
      norm(u.apellido).includes(q) ||
      norm(`${u.nombre} ${u.apellido}`).includes(q) ||
      norm(u.correo).includes(q) ||
      norm(u.departamento).includes(q),
    );
  }
  const activos = filtered.filter(u => u.estado === 'activo').length;
  if (onlyActive) filtered = filtered.filter(u => u.estado === 'activo');
  filtered.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));

  const total = filtered.length;
  const data = filtered.slice(0, limitParam);
  return jsonResponse(200, { success: true, total, activos, count: data.length, data });
}

// ---------------------------------------------------------------------------
// POST: retirado. Las personas se leen de Zammad; las cuentas del sistema se dan de alta
// en Administración (api/usuarios-sistema.ts).
// ---------------------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  const sesion = await sesionDeApi(request);
  if (!sesion) {
    return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });
  }
  return jsonResponse(410, { success: false, error: 'Las personas se gestionan en Zammad: ya no se pueden dar de alta desde acá.' });
}
