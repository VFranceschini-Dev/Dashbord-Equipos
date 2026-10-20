// api/users.ts — Función serverless de Vercel (runtime Node).
// Proxy SEGURO hacia Metabase (SAI_TEST, solo lectura): la API key vive acá
// como variable de entorno SIN prefijo VITE_ y nunca llega al navegador.
//
// El frontend llama a /api/users con el token de Supabase en el header
// Authorization: Bearer <token>. Respuesta: JSON limpio con id y nombre
// (más campos mínimos necesarios para el formulario "Nuevo Movimiento").

type AccessRow = Record<string, unknown>;

interface UsuarioLimpio {
  id: string;            // usuariosaccesoid
  nombre: string;        // descripcion (nombre completo) o login si viene vacía/"["
  usuario: string;       // nombre (login/código)
  tipo: string;          // U/P etc. en mayúsculas
  activo: boolean;
  perfilId: unknown;
  ubicacionId: unknown;
}

// Lee process.env del runtime de Vercel sin depender de @types/node (igual que api/usuarios.ts).
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

const TIMEOUT_MS = 15000;
const PAGE_SIZE = 2000;
const MAX_ROWS = 50000;

// Caché en memoria (5 min) con dedup de consultas simultáneas.
let cachePromise: Promise<UsuarioLimpio[]> | null = null;
let cacheExpires = 0;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function truthyActivo(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', '1', 's', 'si', 'sí', 'activo'].includes(s);
}

function mapRow(cols: string[], row: unknown[]): UsuarioLimpio {
  const obj: AccessRow = {};
  cols.forEach((c, i) => { obj[c] = row[i]; });
  const login = String(obj['nombre'] ?? '').trim();
  let nombreCompleto = String(obj['descripcion'] ?? '').trim();
  if (!nombreCompleto || nombreCompleto.startsWith('[')) nombreCompleto = login;
  return {
    id: String(obj['usuariosaccesoid'] ?? ''),
    nombre: nombreCompleto,
    usuario: login,
    tipo: String(obj['tipo'] ?? '').toUpperCase(),
    activo: truthyActivo(obj['activo']),
    perfilId: obj['perfil'] ?? null,
    ubicacionId: obj['ubicacionid'] ?? null,
  };
}

async function fetchUsuariosMetabase(): Promise<UsuarioLimpio[]> {
  const baseUrl = env.IPA_API_URL || 'https://ipa.donnet.com.ar';
  const apiKey = env.METABASE_API_KEY || env.IPA_API_KEY;
  const dbId = Number(env.IPA_DB_ID ?? 5);
  const tableId = Number(env.IPA_USUARIOS_TABLE_ID ?? 1406);

  if (!apiKey) throw new Error('MISSING_ENV');

  const all: UsuarioLimpio[] = [];
  let offset = 0;

  while (offset < MAX_ROWS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          database: dbId,
          type: 'query',
          query: { 'source-table': tableId, limit: PAGE_SIZE, offset },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as Error).name === 'AbortError') throw new Error('TIMEOUT');
      throw new Error('UPSTREAM_FAIL');
    }
    clearTimeout(timer);

    if (!res.ok) throw new Error('UPSTREAM_FAIL'); // no reenviamos el detalle al navegador
    const payload = await res.json();
    const cols: string[] = (payload?.data?.cols ?? []).map((c: string) => c.toLowerCase());
    const rows: unknown[][] = payload?.data?.rows ?? [];
    for (const r of rows) all.push(mapRow(cols, r));
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // NUNCA exponemos contrasenia, servicekey_path, identityrecord ni vencimientos.
  return all;
}

async function getCache(refresh: boolean): Promise<UsuarioLimpio[]> {
  if (!refresh && cachePromise && Date.now() < cacheExpires) return cachePromise;
  const p = fetchUsuariosMetabase().catch((e) => {
    cachePromise = null; cacheExpires = 0; throw e;
  });
  cachePromise = p;
  cacheExpires = Date.now() + 5 * 60 * 1000;
  return p;
}

export async function GET(request: Request): Promise<Response> {
  // En Vercel, las variables de entorno llegan por request.env (runtime Edge)
  // y también por process.env (runtime Node). El objeto `env` global ya las resuelve.
  const reqEnv = (request as unknown as { env?: Record<string, string | undefined> }).env;
  if (reqEnv) Object.assign(env, reqEnv);

  // 1) Validar sesión: Authorization: Bearer <token> contra Supabase /auth/v1/user
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  if (!token || !supabaseUrl || !supabaseKey) return json({ error: 'No autorizado' }, 401);

  try {
    const me = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    });
    if (!me.ok) return json({ error: 'No autorizado' }, 401);
  } catch {
    return json({ error: 'No autorizado' }, 401);
  }

  // 2) Parámetros opcionales del formulario
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === 'true';
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length > 120) return json({ error: 'Parámetro q inválido' }, 400);
  const soloActivos = url.searchParams.get('soloActivos') !== 'false';
  const soloPersonas = url.searchParams.get('soloPersonas') === 'true';
  let limit = Number(url.searchParams.get('limit') ?? 50);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 500);

  // 3) Traer usuarios desde Metabase (caché 5 min)
  let users: UsuarioLimpio[];
  try {
    users = await getCache(refresh);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'MISSING_ENV') {
      // No logueamos la key ni datos de usuarios.
      return json({ error: 'Falta configurar METABASE_API_KEY en Vercel' }, 500);
    }
    if (msg === 'TIMEOUT') return json({ error: 'Tiempo de espera agotado' }, 504);
    return json({ error: 'Error consultando Metabase' }, 502);
  }

  // 4) Filtros EN MEMORIA (jamás se arma SQL con texto del usuario)
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nq = normalize(q);

  const filtered = users.filter((u) => {
    if (soloActivos && !u.activo) return false;
    if (soloPersonas && u.tipo !== 'U') return false;
    if (nq && !(normalize(u.id).includes(nq) || normalize(u.usuario).includes(nq) || normalize(u.nombre).includes(nq)))
      return false;
    return true;
  });

  const page = filtered.slice(0, limit);
  return json({ success: true, total: filtered.length, count: page.length, data: page });
}
