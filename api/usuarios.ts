/**
 * api/usuarios.ts — Función serverless de Vercel (runtime Node).
 *
 * GET  /api/usuarios → busca usuarios y devuelve SOLO el perfil normalizado
 *          { id, nombre, apellido, usuario, correo, departamento, estado }.
 * POST /api/usuarios → alta de un usuario nuevo en la base gestionada por la app.
 *
 * Fuentes (solo el backend las conoce; NUNCA se mencionan al navegador):
 *   1) Origen interno de acceso (SOLO LECTURA, vía query HTTP paginada).
 *   2) Tabla local "users_new" de la base gestionada (lectura + alta),
 *      accedida con REST PostgREST usando SUPABASE_SERVICE_ROLE_KEY.
 * La fusión ocurre acá: clave = login en minúsculas sin espacios; si el usuario
 * está en ambas fuentes, prevalece la del origen interno. El id devuelto es un
 * UUID opaco derivado de la fuente + login (no revela el origen).
 *
 * Variables de entorno (Vercel > Settings > Environment Variables, Production):
 *   IPA_API_URL            ej. https://ipa.donnet.com.ar
 *   IPA_API_KEY            API key del origen interno (solo servidor)
 *   IPA_DB_ID              id numérico de la base en el origen interno (ej. 5)
 *   IPA_USUARIOS_TABLE_ID  id numérico de la tabla de accesos (ej. 1406)
 *   USERS_NEW_TABLE        nombre de la tabla local de altas (default users_new)
 *   SUPABASE_URL / SUPABASE_ANON_KEY  validación de sesión (fallback: VITE_*)
 *   SUPABASE_SERVICE_ROLE_KEY  escritura en la tabla local (solo servidor)
 */

// ---------------------------------------------------------------------------
// Perfil normalizado: ES LO ÚNICO que sale al navegador.
// ---------------------------------------------------------------------------
interface UsuarioPublico {
  id: string;           // UUID opaco v5 (fuente + login) — no revela el origen
  nombre: string;       // pila
  apellido: string;
  usuario: string;      // login
  correo: string;
  departamento: string;
  estado: 'activo' | 'inactivo';
}

const TIMEOUT_MS = 15000;
const PAGE_SIZE = 2000;
const SAFETY_MAX_ROWS = 50000;
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
const NAMESPACE_LOCAL = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';   // OID

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
  promise: Promise<UsuarioPublico[]>;
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

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = norm(String(v ?? ''));
  return s === 'true' || s === '1' || s === 's' || s === 'si' || s === 'activo';
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Separa un nombre completo en pila/apellido (el origen interno los trae junto). */
function splitNombre(full: string): { nombre: string; apellido: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  if (!t) return { nombre: '', apellido: '' };
  const parts = t.split(' ');
  if (parts.length === 1) return { nombre: parts[0], apellido: '' };
  return { nombre: parts.slice(0, -1).join(' '), apellido: parts[parts.length - 1] };
}

// ---------------------------------------------------------------------------
// Validación de sesión (Bearer token → endpoint de autenticación)
// ---------------------------------------------------------------------------
async function validateSession(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return false;

  const baseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!baseUrl || !anonKey) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fuente 1: origen interno de accesos (SOLO LECTURA, nunca se escribe acá)
// ---------------------------------------------------------------------------
async function queryOrigenAll(cfg: { apiUrl: string; apiKey: string; dbId: number; tableId: number }): Promise<UsuarioPublico[]> {
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  let cols: string[] | null = null;

  while (all.length < SAFETY_MAX_ROWS) {
    const body = {
      database: cfg.dbId,
      type: 'query',
      query: { 'source-table': cfg.tableId, limit: PAGE_SIZE, offset },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${cfg.apiUrl}/api/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw Object.assign(new Error('timeout'), { status: 504 });
      throw Object.assign(new Error('El origen interno no respondió'), { status: 502 });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: 502 });
    let json: any;
    try { json = await res.json(); } catch { throw Object.assign(new Error('respuesta inválida'), { status: 502 }); }
    if (json?.error) throw Object.assign(new Error(String(json.error)), { status: 502 });

    const data = json?.data;
    const pageCols: string[] = (data?.cols || []).map((c: any) => (typeof c === 'string' ? c : String(c?.name ?? '')));
    const rows: unknown[][] = data?.rows || [];
    if (!cols) cols = pageCols.map(c => c.toLowerCase());
    for (const row of rows) all.push(Object.fromEntries(cols.map((c, i) => [c, row[i]])));
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all.map(raw => {
    const login = str(raw['nombre']);
    let full = str(raw['descripcion']).trim();
    if (!full || full.startsWith('[')) full = login; // descripción vacía o técnica → usar login
    const { nombre, apellido } = splitNombre(full);
    return {
      id: uuidV5(NAMESPACE_ORIGEN, cleanKey(login) || str(raw['usuariosaccesoid'])),
      nombre,
      apellido,
      usuario: login,
      correo: '',
      departamento: str(raw['perfil']),
      estado: toBool(raw['activo']) ? ('activo' as const) : ('inactivo' as const),
      __tipo: str(raw['tipo']).toUpperCase(),
    } as UsuarioPublico & { __tipo: string };
  });
}

// ---------------------------------------------------------------------------
// Fuente 2: tabla local de altas (lectura + escritura)
// ---------------------------------------------------------------------------
function localBase(): { url: string; key: string; table: string } | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const table = env('USERS_NEW_TABLE') || 'users_new';
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key, table };
}

async function readLocal(base: { url: string; key: string; table: string }): Promise<UsuarioPublico[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base.url}/rest/v1/${base.table}?select=*&limit=5000`, {
      headers: { apikey: base.key, Authorization: `Bearer ${base.key}` },
      signal: controller.signal,
    });
  } catch {
    throw Object.assign(new Error('falló la lectura local'), { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: 502 });
  const rows: any[] = await res.json();
  return rows.map(r => ({
    id: uuidV5(NAMESPACE_LOCAL, cleanKey(str(r.usuario)) || str(r.id)),
    nombre: str(r.nombre),
    apellido: str(r.apellido),
    usuario: str(r.usuario),
    correo: str(r.correo),
    departamento: str(r.departamento),
    estado: (str(r.estado) === 'inactivo' ? 'inactivo' : 'activo') as UsuarioPublico['estado'],
  }));
}

// ---------------------------------------------------------------------------
// Fusión: SAI prevalece sobre la tabla local (clave: login minúscula sin espacios)
// ---------------------------------------------------------------------------
async function loadFusionados(): Promise<(UsuarioPublico & { __tipo?: string })[]> {
  const cfg = {
    apiUrl: (env('IPA_API_URL') || '').replace(/\/+$/, ''),
    apiKey: env('IPA_API_KEY') || '',
    dbId: parseInt(env('IPA_DB_ID') || '', 10),
    tableId: parseInt(env('IPA_USUARIOS_TABLE_ID') || '', 10),
  };
  const tieneCfg = Boolean(cfg.apiUrl && cfg.apiKey && Number.isFinite(cfg.dbId) && Number.isFinite(cfg.tableId));
  const base = localBase();
  if (!tieneCfg && !base) {
    throw Object.assign(
      new Error('Falta configuración del servidor: revisá las variables de entorno de la función.'),
      { status: 500 },
    );
  }

  // Cada fuente se evalúa por separado: si una falla, la otra sigue funcionando.
  const [origenRes, localRes] = await Promise.allSettled([
    tieneCfg ? queryOrigenAll(cfg) : Promise.reject(new Error('sin config de origen')),
    base ? readLocal(base) : Promise.reject(new Error('sin config local')),
  ]);
  const origen = origenRes.status === 'fulfilled' ? origenRes.value : [];
  const local = localRes.status === 'fulfilled' ? localRes.value : [];
  if (origen.length === 0 && local.length === 0) {
    // Las dos fuentes fallaron → error para que la UI muestre el mensaje genérico.
    const firstErr = origenRes.status === 'rejected' ? origenRes.reason : localRes.reason;
    throw Object.assign(new Error('no hay datos disponibles'), {
      status: (firstErr as { status?: number })?.status === 500 ? 500 : 502,
    });
  }

  const map = new Map<string, UsuarioPublico & { __tipo?: string }>();
  for (const u of local) map.set(cleanKey(u.usuario), u);
  for (const u of origen) map.set(cleanKey(u.usuario), u); // SAI prevalece
  return [...map.values()];
}

function getCached(forceRefresh: boolean): Promise<UsuarioPublico[]> {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expiresAt > now) return cache.promise;
  const promise = loadFusionados().then(list => list.map(({ __tipo, ...resto }) => resto as UsuarioPublico));
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

  let list: UsuarioPublico[];
  try {
    list = await getCached(refresh);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    if (status === 504) return jsonResponse(504, { success: false, error: 'Tiempo de espera agotado al consultar los datos.' });
    if (status === 500) return jsonResponse(500, { success: false, error: 'Falta configuración del servidor.' });
    return jsonResponse(502, { success: false, error: 'No se pudo obtener la información en este momento.' });
  }

  let filtered = list;
  if (onlyActive) filtered = filtered.filter(u => u.estado === 'activo');
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
  filtered.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));

  const total = filtered.length;
  const data = filtered.slice(0, limitParam);
  return jsonResponse(200, { success: true, total, count: data.length, data });
}

// ---------------------------------------------------------------------------
// POST: alta de usuario nuevo (solo en la tabla local; jamás en el origen)
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request): Promise<Response> {
  const authenticated = await validateSession(request);
  if (!authenticated) {
    return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });
  }

  let input: any;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Los datos enviados no son válidos.' });
  }

  const nombre = str(input?.nombre).trim();
  const apellido = str(input?.apellido).trim();
  const usuario = str(input?.usuario).trim().toLowerCase().replace(/\s+/g, '');
  const correo = str(input?.correo).trim().toLowerCase();
  const departamento = str(input?.departamento).trim();
  const estado = str(input?.estado).trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo';

  // Validaciones (mensajes genéricos, sin detalles internos)
  if (!nombre || !/^[\w .'-]{1,80}$/.test(nombre)) {
    return jsonResponse(400, { success: false, error: 'El nombre no es válido.' });
  }
  if (!apellido || /^[\w .'-]{1,80}$/.test(apellido) === false) {
    return jsonResponse(400, { success: false, error: 'El apellido no es válido.' });
  }
  if (!usuario || usuario.length < 2 || usuario.length > 60) {
    return jsonResponse(400, { success: false, error: 'El usuario no es válido.' });
  }
  if (correo && !EMAIL_RE.test(correo)) {
    return jsonResponse(400, { success: false, error: 'El correo no es válido.' });
  }

  const base = localBase();
  if (!base) {
    return jsonResponse(500, { success: false, error: 'Falta configuración del servidor para guardar usuarios.' });
  }

  // Anti-duplicado contra AMBAS fuentes (además del índice único en la base).
  let existentes: UsuarioPublico[];
  try {
    existentes = await getCached(false);
  } catch {
    return jsonResponse(502, { success: false, error: 'No se pudo verificar si el usuario ya existe. Intentá de nuevo más tarde.' });
  }
  const dupLogin = existentes.some(u => cleanKey(u.usuario) === cleanKey(usuario));
  const dupCorreo = correo ? existentes.some(u => u.correo && norm(u.correo) === norm(correo)) : false;
  if (dupLogin || dupCorreo) {
    return jsonResponse(409, { success: false, error: 'Ya existe un usuario con esos datos.' });
  }

  // Insertar en la tabla local (nunca en el origen interno).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base.url}/rest/v1/${base.table}`, {
      method: 'POST',
      headers: {
        apikey: base.key,
        Authorization: `Bearer ${base.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ nombre, apellido, usuario, correo, departamento, estado }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return jsonResponse(504, { success: false, error: 'Tiempo de espera agotado al guardar.' });
    return jsonResponse(502, { success: false, error: 'No se pudo guardar el usuario. Intentá de nuevo más tarde.' });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 409) {
    return jsonResponse(409, { success: false, error: 'Ya existe un usuario con esos datos.' });
  }
  if (!res.ok) {
    return jsonResponse(502, { success: false, error: 'No se pudo guardar el usuario. Intentá de nuevo más tarde.' });
  }

  let created: any;
  try {
    const arr = await res.json();
    created = Array.isArray(arr) ? arr[0] : arr;
  } catch {
    created = null;
  }

  cache = null; // la caché quedó vieja
  const usuarioCreado: UsuarioPublico = {
    id: uuidV5(NAMESPACE_LOCAL, cleanKey(str(created?.usuario) || usuario)),
    nombre: str(created?.nombre) || nombre,
    apellido: str(created?.apellido) || apellido,
    usuario: str(created?.usuario) || usuario,
    correo: str(created?.correo) || correo,
    departamento: str(created?.departamento) || departamento,
    estado: (str(created?.estado) === 'inactivo' ? 'inactivo' : 'activo') as UsuarioPublico['estado'],
  };
  return jsonResponse(201, { success: true, data: usuarioCreado });
}
