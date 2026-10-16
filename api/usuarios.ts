/**
 * api/usuarios.ts — Función serverless de Vercel (runtime Node).
 *
 * Puente SOLO LECTURA entre la app (navegador) y Metabase SAI_TEST (red interna):
 *   Navegador → /api/usuarios (mismo dominio, valida sesión Supabase)
 *             → POST {IPA_API_URL}/api/dataset con x-api-key (la key solo vive acá)
 *             → tabla UsuariosAccesos de SAI_TEST.
 *
 * El navegador nunca habla con ipa.donnet.com.ar ni ve la API key.
 *
 * Variables de entorno (Vercel > Settings > Environment Variables, sin prefijo VITE_):
 *   IPA_API_URL            default https://ipa.donnet.com.ar
 *   IPA_API_KEY            obligatoria (nunca exponer al navegador)
 *   IPA_DB_ID              id de la base SAI_TEST en Metabase (default 5)
 *   IPA_USUARIOS_TABLE_ID  table_id de UsuariosAccesos (default 1406)
 *   SUPABASE_URL / SUPABASE_ANON_KEY  fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 */

// Lee process.env del runtime de Vercel sin depender de @types/node ni de import.meta.env.
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

interface UsuarioFila {
  id: string;
  usuario: string;        // login (campo "nombre")
  nombreCompleto: string; // descripción (si está vacía o empieza con "[", se usa el login)
  perfilId: string;
  ubicacionId: string;
  tipo: string;           // 'U' | ... (mayúsculas)
  activo: boolean;
}

// ---------- utilidades ----------

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = norm(v);
  return s === 'true' || s === '1' || s === 's' || s === 'si' || s === 'activo';
}

// ---------- validación de sesión Supabase ----------

async function validarToken(token: string): Promise<boolean> {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- consulta a Metabase (query builder JSON, nunca SQL con texto del usuario) ----------

const PAGE_SIZE = 2000;
const MAX_ROWS = 50000; // corte de seguridad
const TIMEOUT_MS = 15000;

class UpstreamError extends Error {
  kind: 'timeout' | 'auth' | 'other';
  constructor(kind: 'timeout' | 'auth' | 'other', message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
  }
}

async function consultarPagina(
  baseUrl: string,
  apiKey: string,
  dbId: string,
  tableId: string,
  offset: number,
): Promise<{ cols: string[]; rows: unknown[][] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        database: Number(dbId),
        type: 'query',
        query: { 'source-table': Number(tableId), limit: PAGE_SIZE, offset },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new UpstreamError('timeout', 'Timeout consultando Metabase');
    throw new UpstreamError('other', `No se pudo conectar con Metabase: ${(err as Error)?.message ?? 'error de red'}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new UpstreamError('auth', 'API key rechazada por Metabase');
  if (!res.ok) throw new UpstreamError('other', `Metabase respondió HTTP ${res.status}`);

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError('other', 'Respuesta no JSON de Metabase');
  }
  if (json?.error) throw new UpstreamError('other', 'Metabase devolvió un error en el cuerpo de la respuesta');

  const cols: string[] = (json?.data?.cols ?? []).map((c: any) => String(c?.name ?? '').toLowerCase());
  const rows: unknown[][] = json?.data?.rows ?? [];
  return { cols, rows };
}

async function traerUsuarios(
  baseUrl: string,
  apiKey: string,
  dbId: string,
  tableId: string,
): Promise<UsuarioFila[]> {
  const out: UsuarioFila[] = [];
  let offset = 0;
  let colsRef: string[] | null = null;

  while (true) {
    const { cols, rows } = await consultarPagina(baseUrl, apiKey, dbId, tableId, offset);
    if (!colsRef) colsRef = cols;

    const idx = (name: string) => colsRef!.indexOf(name);
    const iId = idx('usuariosaccesoid');
    const iNombre = idx('nombre');
    const iDesc = idx('descripcion');
    const iPerfil = idx('perfil');
    const iUbic = idx('ubicacionid');
    const iTipo = idx('tipo');
    const iActivo = idx('activo');

    for (const r of rows) {
      const login = String(r[iNombre] ?? '');
      let nombreCompleto = String(r[iDesc] ?? '').trim();
      if (!nombreCompleto || nombreCompleto.startsWith('[')) nombreCompleto = login;
      out.push({
        id: String(r[iId] ?? ''),
        usuario: login,
        nombreCompleto,
        perfilId: iPerfil >= 0 ? String(r[iPerfil] ?? '') : '',
        ubicacionId: iUbic >= 0 ? String(r[iUbic] ?? '') : '',
        tipo: (iTipo >= 0 ? String(r[iTipo] ?? '') : '').toUpperCase(),
        activo: iActivo >= 0 ? toBool(r[iActivo]) : false,
      });
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= MAX_ROWS) break; // corte de seguridad
  }

  return out;
}

// ---------- caché en memoria (5 min), deduplica consultas simultáneas ----------

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachePromise: Promise<UsuarioFila[]> | null = null;
let cacheExpiresAt = 0;

function getCache(force: boolean): Promise<UsuarioFila[]> {
  if (!force && cachePromise && Date.now() < cacheExpiresAt) return cachePromise;
  const baseUrl = env.IPA_API_URL || 'https://ipa.donnet.com.ar';
  const apiKey = env.IPA_API_KEY as string; // ya validada por el handler
  const dbId = env.IPA_DB_ID || '5';
  const tableId = env.IPA_USUARIOS_TABLE_ID || '1406';
  const p = traerUsuarios(baseUrl, apiKey, dbId, tableId)
    .then((rows) => {
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return rows;
    })
    .catch((err) => {
      // Si falló, descartar la promise para permitir reintento inmediato.
      if (cachePromise === p) { cachePromise = null; cacheExpiresAt = 0; }
      throw err;
    });
  cachePromise = p;
  return p;
}

// ---------- respuesta ----------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  // 1) Sesión Supabase obligatoria (el navegador nunca ve la key de Metabase)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ success: false, error: 'No autenticado' }, 401);
  if (!(await validarToken(token))) return json({ success: false, error: 'Sesión inválida o expirada' }, 401);

  // 2) Variables de entorno obligatorias (mensaje claro, sin valores)
  if (!env.IPA_API_KEY) return json({ success: false, error: 'Falta la variable de entorno IPA_API_KEY en el servidor' }, 500);
  if (!(env.SUPABASE_URL || env.VITE_SUPABASE_URL)) return json({ success: false, error: 'Falta la variable de entorno SUPABASE_URL en el servidor' }, 500);
  if (!(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)) return json({ success: false, error: 'Falta la variable de entorno SUPABASE_ANON_KEY en el servidor' }, 500);

  // 3) Parámetros
  const sp = new URL(request.url).searchParams;
  const qRaw = sp.get('q') ?? '';
  if (qRaw.length > 120) return json({ success: false, error: 'El parámetro q supera los 120 caracteres' }, 400);

  const soloActivos = sp.get('soloActivos') !== 'false';
  const soloPersonas = sp.get('soloPersonas') === 'true';
  const refresh = sp.get('refresh') === 'true';

  let limit = parseInt(sp.get('limit') ?? '50', 10);
  if (Number.isNaN(limit)) limit = 50;
  limit = Math.min(500, Math.max(1, limit));

  // 4) Datos desde la caché / Metabase
  let all: UsuarioFila[];
  try {
    all = await getCache(refresh);
  } catch (err) {
    const e = err as UpstreamError;
    if (e?.kind === 'timeout') return json({ success: false, error: 'Tiempo de espera agotado consultando el servidor de datos' }, 504);
    if (e?.kind === 'auth') return json({ success: false, error: 'El servidor de datos rechazó la credencial' }, 502);
    // No reenviar el detalle del upstream al navegador; log genérico sin key ni datos.
    console.error('/api/usuarios: fallo consultando Metabase (kind: %s)', e?.kind ?? 'unknown');
    return json({ success: false, error: 'El servidor de datos respondió incorrectamente' }, 502);
  }

  // 5) Filtros en memoria (NUNCA se arma SQL con el texto del usuario)
  let filtered = all;
  if (soloActivos) filtered = filtered.filter((u) => u.activo);
  if (soloPersonas) filtered = filtered.filter((u) => u.tipo === 'U');
  const q = norm(qRaw);
  if (q) {
    filtered = filtered.filter(
      (u) => norm(u.id).includes(q) || norm(u.usuario).includes(q) || norm(u.nombreCompleto).includes(q),
    );
  }

  const total = filtered.length;
  // Solo 7 campos: nunca contrasenia, servicekey_path, identityrecord ni vencimientos.
  const data = filtered.slice(0, limit).map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombreCompleto: u.nombreCompleto,
    perfilId: u.perfilId,
    ubicacionId: u.ubicacionId,
    tipo: u.tipo,
    activo: u.activo,
  }));

  return json({ success: true, total, count: data.length, data });
}
