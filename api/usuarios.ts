/**
 * api/usuarios.ts — Función serverless de Vercel (runtime Node).
 *
 * Navegador → /api/usuarios (esta función, mismo dominio) → POST
 * {IPA_API_URL}/api/dataset (Metabase v0.55.3, SAI_TEST) — SOLO LECTURA.
 *
 * La API key de Metabase vive SOLO acá (variable de entorno sin prefijo VITE_).
 * El navegador nunca habla con ipa.donnet.com.ar.
 *
 * Variables de entorno (Vercel > Settings > Environment Variables):
 *   IPA_API_URL            ej. https://ipa.donnet.com.ar
 *   IPA_API_KEY            API key de Metabase (solo servidor)
 *   IPA_DB_ID              id numérico de la DB SAI_TEST en Metabase (ej. 5)
 *   IPA_USUARIOS_TABLE_ID  id numérico de la table Users de UsuariosAccesos (ej. 1406)
 *   SUPABASE_URL / SUPABASE_ANON_KEY  (fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 */

// ---------------------------------------------------------------------------
// Tipos del mapeo UsuariosAccesos (SOLO estos 7 campos salen al navegador)
// ---------------------------------------------------------------------------
interface UsuarioRow {
  id: string;
  usuario: string;         // login (nombre)
  nombreCompleto: string;  // descripcion
  perfilId: string;        // perfil
  ubicacionId: string;     // ubicacionid
  tipo: string;            // tipo, en mayúsculas
  activo: boolean;         // activo
}

const TIMEOUT_MS = 15000;
const PAGE_SIZE = 2000;
const SAFETY_MAX_ROWS = 50000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Caché en memoria: evita consultas duplicadas simultáneas (single-flight)
// ---------------------------------------------------------------------------
interface CacheEntry {
  expiresAt: number;
  promise: Promise<UsuarioRow[]>;
}
let cache: CacheEntry | null = null;

function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

// ---------------------------------------------------------------------------
// Normalización / mapeo
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sin tildes
    .trim();
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = norm(String(v ?? ''));
  return s === 'true' || s === '1' || s === 's' || s === 'si' || s === 'activo';
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function mapRow(raw: Record<string, unknown>): UsuarioRow {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (raw[k] !== undefined) return raw[k];
    }
    return undefined;
  };
  const login = str(get('nombre'));
  let nombreCompleto = str(get('descripcion')).trim();
  // Si la descripción está vacía o empieza con "[", se usa el login.
  if (!nombreCompleto || nombreCompleto.startsWith('[')) {
    nombreCompleto = login;
  }
  return {
    id: str(get('usuariosaccesoid')),
    usuario: login,
    nombreCompleto,
    perfilId: str(get('perfil')),
    ubicacionId: str(get('ubicacionid')),
    tipo: str(get('tipo')).toUpperCase(),
    activo: toBool(get('activo')),
  };
}

// ---------------------------------------------------------------------------
// Validación de sesión Supabase (Bearer token → GET {SUPABASE_URL}/auth/v1/user)
// ---------------------------------------------------------------------------
async function validateSession(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return false;

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
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
// Consulta a Metabase (paginada por offset, solo lectura)
// ---------------------------------------------------------------------------
async function queryMetabaseAll(cfg: {
  apiUrl: string;
  apiKey: string;
  dbId: number;
  tableId: number;
}): Promise<UsuarioRow[]> {
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
      if ((err as Error).name === 'AbortError') {
        throw Object.assign(new Error('timeout'), { status: 504 });
      }
      throw Object.assign(new Error('Metabase no respondió'), { status: 502 });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // No reenviar el detalle de Metabase al navegador.
      throw Object.assign(new Error(`Metabase respondió HTTP ${res.status}`), { status: 502 });
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw Object.assign(new Error('Respuesta no JSON de Metabase'), { status: 502 });
    }
    if (json?.error) {
      throw Object.assign(new Error(String(json.error)), { status: 502 });
    }

    const data = json?.data;
    const pageCols: string[] = (data?.cols || []).map((c: any) =>
      typeof c === 'string' ? c : String(c?.name ?? '')
    );
    const rows: unknown[][] = data?.rows || [];

    if (!cols) cols = pageCols.map(c => c.toLowerCase());

    for (const row of rows) {
      all.push(Object.fromEntries(cols.map((c, i) => [c, row[i]])));
    }

    // Seguir paginando solo mientras vengan páginas completas de PAGE_SIZE.
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all.map(mapRow);
}

function loadUsuarios(cfg: {
  apiUrl: string;
  apiKey: string;
  dbId: number;
  tableId: number;
}): Promise<UsuarioRow[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.promise;
  const promise = queryMetabaseAll(cfg).catch(err => {
    cache = null; // no cachear errores
    throw err;
  });
  cache = { expiresAt: now + CACHE_TTL_MS, promise };
  return promise;
}

// ---------------------------------------------------------------------------
// Handler web
// ---------------------------------------------------------------------------
function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  // 1) Sesión obligatoria
  const authenticated = await validateSession(request);
  if (!authenticated) {
    return jsonResponse(401, {
      success: false,
      error: 'No autenticado. Se requiere un token válido de Supabase.',
    });
  }

  // 2) Parámetros
  const url = new URL(request.url);
  const qRaw = url.searchParams.get('q') ?? '';
  if (qRaw.length > 120) {
    return jsonResponse(400, { success: false, error: 'El parámetro q supera los 120 caracteres.' });
  }
  const onlyActive = url.searchParams.get('soloActivos') !== 'false';
  const onlyPersons = url.searchParams.get('soloPersonas') === 'true';
  const refresh = url.searchParams.get('refresh') === 'true';

  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  if (Number.isNaN(limitParam) || limitParam < 1 || limitParam > 500) {
    return jsonResponse(400, { success: false, error: 'El parámetro limit debe estar entre 1 y 500.' });
  }

  // 3) Configuración mínima
  const apiUrl = env('IPA_API_URL');
  const apiKey = env('IPA_API_KEY');
  const dbId = parseInt(env('IPA_DB_ID') || '', 10);
  const tableId = parseInt(env('IPA_USUARIOS_TABLE_ID') || '', 10);
  if (!apiUrl || !apiKey || !Number.isFinite(dbId) || !Number.isFinite(tableId)) {
    return jsonResponse(500, {
      success: false,
      error:
        'Falta configuración del servidor: revisá las variables IPA_API_URL, IPA_API_KEY, IPA_DB_ID e IPA_USUARIOS_TABLE_ID en Vercel.',
    });
  }

  if (refresh) cache = null;

  // 4) Traer usuarios (caché de 5 min, single-flight)
  let rows: UsuarioRow[];
  try {
    rows = await loadUsuarios({ apiUrl: apiUrl.replace(/\/+$/, ''), apiKey, dbId, tableId });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    if (status === 504) {
      return jsonResponse(504, { success: false, error: 'Tiempo de espera agotado al consultar SAI_TEST.' });
    }
    return jsonResponse(502, {
      success: false,
      error: 'El servidor interno (SAI_TEST) no pudo responder la consulta.',
    });
  }

  // 5) Filtros en memoria (NUNCA se arma SQL con el texto del usuario)
  let filtered = rows;
  if (onlyActive) filtered = filtered.filter(u => u.activo);
  if (onlyPersons) filtered = filtered.filter(u => u.tipo === 'U');
  const q = norm(qRaw);
  if (q) {
    filtered = filtered.filter(
      u => norm(u.id).includes(q) || norm(u.usuario).includes(q) || norm(u.nombreCompleto).includes(q)
    );
  }

  const total = filtered.length;
  const data = filtered.slice(0, limitParam);

  return jsonResponse(200, { success: true, total, count: data.length, data });
}
