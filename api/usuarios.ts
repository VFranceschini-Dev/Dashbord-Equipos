/**
 * api/usuarios.ts — Función serverless de Vercel (runtime Node). ÚNICO endpoint
 * de usuarios que consume el navegador: /api/usuarios (alias histórico /api/users).
 *
 * Arquitectura (SOLO LECTURA, dos fuentes):
 *   Navegador → /api/usuarios (valida sesión Supabase)
 *             → fuente 1: {IPA_API_URL}/api/dataset con x-api-key  (Metabase, base interna de usuarios)
 *             → fuente 2: {SUPABASE_URL}/rest/v1/{USERS_FALLBACK_TABLE}  (REST directo, clave de servicio)
 *   La API key de Metabase y la clave de servicio de Supabase viven SOLO acá
 *   (variables de entorno sin prefijo VITE_). El navegador nunca habla con los
 *   servidores internos ni ve credenciales ni nombres de bases/tablas.
 *
 * Respuesta al navegador: { success, total, count, data } donde cada fila es
 * exactamente { id, nombre, usuario }:
 *   - id es OPACO (hash SHA-256 truncado, sin saltar a la vista) derivado del id
 *     real de la fuente; no revela el origen (nada de "ipa-123" o "sb-45").
 *   - No se devuelven campos source/db/origen/tabla/schema/connection.
 *   - Si solo una fuente falla, se devuelven igual los resultados de la otra
 *     (el detalle va al log del servidor, nunca al cliente).
 *
 * Variables de entorno (Vercel > Settings > Environment Variables):
 *   IPA_API_URL              default https://ipa.donnet.com.ar
 *   IPA_API_KEY (o METABASE_API_KEY)  obligatoria
 *   IPA_DB_ID                id de la base de usuarios en Metabase (default 5)
 *   IPA_USUARIOS_TABLE_ID    table_id de la tabla de accesos (default 1406)
 *   SUPABASE_URL / SUPABASE_ANON_KEY   fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY          opcional: lectura de la tabla de respaldo (solo servidor)
 *   USERS_FALLBACK_TABLE               opcional: nombre de la tabla de respaldo (solo servidor)
 */

// Lee process.env del runtime de Vercel sin depender de @types/node.
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

export interface UsuarioPublico {
  id: string;      // opaco, único por usuario (merge entre fuentes por login normalizado)
  nombre: string;  // nombre completo
  usuario: string; // login/código
}

// ---------- utilidades ----------

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Clave de merge: login sin mayúsculas, sin espacios ni tildes.
function mergeKey(login: unknown): string {
  return norm(login).replace(/\s+/g, '');
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = norm(v);
  return s === 'true' || s === '1' || s === 's' || s === 'si' || s === 'activo';
}

// Hash FNV-1a de 64 bits (dos pasadas de 32) → id opaco de 16 hex. Sin dependencias.
function fnv1a64(str: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul((h2 + c) ^ (h2 >>> 7), 0x85ebca6b) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

async function opaqueId(realId: string): Promise<string> {
  try {
    const subtle = (globalThis as any).crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`usr:${realId}`));
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }
  } catch { /* fallback abajo */ }
  return fnv1a64(`usr:${realId}`) + fnv1a64(`usr2:${realId}`);
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

// ---------- fuente 1: Metabase (query builder JSON, nunca SQL con texto del usuario) ----------

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

interface PrimaryRow {
  realId: string;
  login: string;
  fullName: string;
  activo: boolean;
  tipo: string;
}

async function consultarPaginaPrimaria(offset: number): Promise<{ cols: string[]; rows: unknown[][] }> {
  const baseUrl = env.IPA_API_URL || 'https://ipa.donnet.com.ar';
  const apiKey = (env.IPA_API_KEY || env.METABASE_API_KEY) as string;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        database: Number(env.IPA_DB_ID || '5'),
        type: 'query',
        query: { 'source-table': Number(env.IPA_USUARIOS_TABLE_ID || '1406'), limit: PAGE_SIZE, offset },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new UpstreamError('timeout', 'Timeout consultando la fuente primaria');
    throw new UpstreamError('other', `Fallo de red en la fuente primaria: ${(err as Error)?.message ?? ''}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new UpstreamError('auth', 'Credencial rechazada por la fuente primaria');
  if (!res.ok) throw new UpstreamError('other', `La fuente primaria respondió HTTP ${res.status}`);

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError('other', 'Respuesta no JSON de la fuente primaria');
  }
  if (json?.error) throw new UpstreamError('other', 'La fuente primaria devolvió un error en el cuerpo');

  const cols: string[] = (json?.data?.cols ?? []).map((c: any) => String(c?.name ?? '').toLowerCase());
  const rows: unknown[][] = json?.data?.rows ?? [];
  return { cols, rows };
}

async function traerFuentePrimaria(): Promise<PrimaryRow[]> {
  const out: PrimaryRow[] = [];
  let offset = 0;
  let colsRef: string[] | null = null;

  while (true) {
    const { cols, rows } = await consultarPaginaPrimaria(offset);
    if (!colsRef) colsRef = cols;

    const idx = (name: string) => colsRef!.indexOf(name);
    const iId = idx('usuariosaccesoid');
    const iNombre = idx('nombre');           // login/código
    const iDesc = idx('descripcion');        // nombre completo
    const iTipo = idx('tipo');
    const iActivo = idx('activo');

    for (const r of rows) {
      const login = String(r[iNombre] ?? '').trim();
      let fullName = String(r[iDesc] ?? '').trim();
      if (!fullName || fullName.startsWith('[')) fullName = login;
      out.push({
        realId: String(r[iId] ?? ''),
        login,
        fullName,
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

// ---------- fuente 2: tabla de respaldo en Supabase (REST directo, solo servidor) ----------

interface FallbackRow {
  realId: string;
  login: string;
  fullName: string;
  activo: boolean;
}

async function traerFuenteRespaldo(): Promise<FallbackRow[]> {
  const table = env.USERS_FALLBACK_TABLE;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!table || !serviceKey || !url) return []; // fuente opcional: sin config, no participa

  const select = 'id,nombre,usuario,user_name,full_name,first_name,last_name,email,activo,estado,status';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&order=id.asc&limit=1000&offset=0`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    const first: any[] = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let all = first;
    // Paginar mientras vengan páginas llenas (corte de seguridad 50.000).
    while (all.length >= 1000 && all.length < MAX_ROWS) {
      const next = await fetch(
        `${url.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&order=id.asc&limit=1000&offset=${all.length}`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (!next.ok) break;
      const pageRows: any[] = await next.json();
      if (!pageRows.length) break;
      all = all.concat(pageRows);
      if (pageRows.length < 1000) break;
    }
    return all.map((r: any) => {
      const login = String(r.usuario ?? r.user_name ?? r.email ?? '').trim();
      const fullName = String(r.nombre ?? r.full_name ?? [r.first_name, r.last_name].filter(Boolean).join(' ') ?? login).trim() || login;
      return {
        realId: String(r.id ?? login),
        login,
        fullName,
        activo: r.activo === undefined && r.estado === undefined && r.status === undefined
          ? true
          : toBool(r.activo ?? r.estado ?? r.status),
      };
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new UpstreamError('timeout', 'Timeout consultando la tabla de respaldo');
    throw new UpstreamError('other', `Fallo consultando la tabla de respaldo: ${(err as Error)?.message ?? ''}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- caché en memoria (5 min), deduplica consultas simultáneas ----------

interface CachedUser {
  realId: string;
  id: string;        // opaco ya calculado
  nombre: string;
  usuario: string;
  key: string;       // login normalizado para merge/filtro
  tipo: string;      // 'U' | ... (fuente primaria; '' en respaldo)
  activo: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachePromise: Promise<{ users: CachedUser[]; primaryFailed: boolean; fallbackFailed: boolean }> | null = null;
let cacheExpiresAt = 0;

async function buildCache(): Promise<{ users: CachedUser[]; primaryFailed: boolean; fallbackFailed: boolean }> {
  const [primRes, respRes] = await Promise.allSettled([traerFuentePrimaria(), traerFuenteRespaldo()]);

  const primaryFailed = primRes.status === 'rejected';
  const fallbackFailed = respRes.status === 'rejected';
  const primaria: PrimaryRow[] = primaryFailed ? [] : primRes.value;
  const respaldo: FallbackRow[] = fallbackFailed ? [] : respRes.value;

  if (primaryFailed) console.error('/api/usuarios: fallo la fuente primaria (%s)', (primRes.reason as Error)?.message ?? 'desconocido');
  if (fallbackFailed) console.error('/api/usuarios: fallo la tabla de respaldo (%s)', (respRes.reason as Error)?.message ?? 'desconocido');

  // Merge SIN duplicados por login normalizado; si está en ambas, prevalece la primaria.
  const byKey = new Map<string, Omit<CachedUser, 'id'>>();
  const seenRealIds = new Set<string>();

  for (const p of primaria) {
    const k = mergeKey(p.login);
    if (!k) continue;
    byKey.set(k, { realId: p.realId, nombre: p.fullName, usuario: p.login, key: k, tipo: p.tipo, activo: p.activo });
    seenRealIds.add(`P:${p.realId}`);
  }
  for (const f of respaldo) {
    const k = mergeKey(f.login);
    if (!k || byKey.has(k)) continue;              // prevalece la primaria
    if (seenRealIds.has(`R:${f.realId}`)) continue; // no duplicar por id interno
    byKey.set(k, { realId: f.realId, nombre: f.fullName, usuario: f.login, key: k, tipo: '', activo: f.activo });
    seenRealIds.add(`R:${f.realId}`);
  }

  const users: CachedUser[] = [];
  for (const u of byKey.values()) {
    users.push({ ...u, id: await opaqueId(u.realId) });
  }
  return { users, primaryFailed, fallbackFailed };
}

function getCache(force: boolean) {
  if (!force && cachePromise && Date.now() < cacheExpiresAt) return cachePromise;
  const p = buildCache().then((res) => {
    // Si AMBAS fuentes fallaron, no cachacear el vacío: permitir reintento inmediato.
    if (res.primaryFailed && res.fallbackFailed) {
      if (cachePromise === p) { cachePromise = null; cacheExpiresAt = 0; }
    } else {
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    }
    return res;
  }).catch((err) => {
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
  // 1) Sesión Supabase obligatoria (el navegador nunca ve credenciales internas)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ success: false, error: 'No autenticado' }, 401);
  if (!(await validarToken(token))) return json({ success: false, error: 'Sesión inválida o expirada' }, 401);

  // 2) Variables de entorno obligatorias (mensaje claro, sin valores)
  if (!(env.IPA_API_KEY || env.METABASE_API_KEY)) return json({ success: false, error: 'Falta configurar las credenciales del servidor' }, 500);
  if (!(env.SUPABASE_URL || env.VITE_SUPABASE_URL)) return json({ success: false, error: 'Falta configurar las credenciales del servidor' }, 500);
  if (!(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)) return json({ success: false, error: 'Falta configurar las credenciales del servidor' }, 500);

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

  // 4) Datos combinados desde las dos fuentes (caché 5 min)
  let result: Awaited<ReturnType<typeof buildCache>>;
  try {
    result = await getCache(refresh);
  } catch (err) {
    const e = err as UpstreamError;
    // Detalle solo al log del servidor; el cliente recibe un mensaje genérico.
    console.error('/api/usuarios: fallo inesperado (%s)', e?.kind ?? 'unknown');
    return json({ success: false, error: 'No se pudo cargar la lista de usuarios' }, 502);
  }

  // Si ninguna fuente respondió, mensaje genérico (sin revelar cuál falló).
  if (result.primaryFailed && result.fallbackFailed) {
    return json({ success: false, error: 'No se pudo cargar la lista de usuarios' }, 502);
  }

  // 5) Filtros EN MEMORIA (jamás se arma SQL/PGRST con el texto del usuario)
  let filtered = result.users;
  if (soloActivos) filtered = filtered.filter((u) => u.activo);
  if (soloPersonas) filtered = filtered.filter((u) => u.tipo === 'U' || u.tipo === ''); // el respaldo no tiene tipo: se incluye
  const q = norm(qRaw);
  if (q) {
    filtered = filtered.filter(
      (u) => u.key.includes(q.replace(/\s+/g, '')) || norm(u.nombre).includes(q) || norm(u.id).includes(q),
    );
  }

  const total = filtered.length;
  // Exactamente { id, nombre, usuario }: sin origen, sin campos internos.
  const data: UsuarioPublico[] = filtered.slice(0, limit).map((u) => ({ id: u.id, nombre: u.nombre, usuario: u.usuario }));

  return json({ success: true, total, count: data.length, data });
}
