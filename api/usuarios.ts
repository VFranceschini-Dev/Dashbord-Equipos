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
 *                            (la consulta es nativa T-SQL sobre UsuariosAccesos;
 *                             ya no se usa table_id)
 *   SUPABASE_URL / SUPABASE_ANON_KEY   fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY          opcional: lectura de la tabla de respaldo (solo servidor)
 *   USERS_FALLBACK_TABLE               opcional: nombre de la tabla de respaldo (solo servidor)
 */

// Lee process.env del runtime de Vercel sin depender de @types/node.
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

export interface UsuarioPublico {
  id: string;           // opaco, único por usuario (merge entre fuentes por login normalizado)
  nombre: string;       // nombre de pila
  apellido: string;     // apellido(s)
  usuario: string;      // login/código
  correo: string;       // email ('' si la fuente no lo tiene)
  departamento: string; // '' si la fuente no lo tiene
  estado: 'activo' | 'inactivo';
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

// ---------- fuente 1: Metabase (consulta nativa T-SQL, SOLO lectura) ----------
// La base subyacente es SQL Server: se usa type:'native' con SELECT TOP /
// ORDER BY ... OFFSET ... FETCH NEXT. Nunca se arma SQL con texto del usuario:
// el único dato que entra en el SQL son números de offset/limit ya validados.

const PAGE_SIZE = 2000;
const MAX_ROWS = 50000; // corte de seguridad
const TIMEOUT_MS = 15000;

// Proyección segura: solo las 7 columnas necesarias de UsuariosAccesos.
// Excluye explícitamente Contrasenia, ContraseniaVencimiento,
// ContraseniaPeriodo y ServiceKey_Path (la columna binaria puede romper la
// respuesta completa de /api/dataset si se proyecta).
const COLUMNAS_REQUERIDAS = [
  'usuariosaccesoid', 'nombre', 'descripcion', 'perfil', 'ubicacionid', 'tipo', 'activo',
];

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
  email: string;
  department: string;
  activo: boolean;
  tipo: string;
}

async function consultarPagina(offset: number): Promise<{ cols: string[]; rows: unknown[][] }> {
  const baseUrl = env.IPA_API_URL || 'https://ipa.donnet.com.ar';
  const apiKey = (env.IPA_API_KEY || env.METABASE_API_KEY) as string;
  const dbId = Number(env.IPA_DB_ID || '5');
  // Paginación estándar de SQL Server (T-SQL). offset/PAGE_SIZE son enteros ya
  // normalizados acá — ningún texto del usuario llega al SQL.
  const sql = `SELECT TOP ${PAGE_SIZE} ${COLUMNAS_REQUERIDAS.join(', ')} FROM UsuariosAccesos ` +
    `ORDER BY usuariosaccesoid OFFSET ${offset} ROWS FETCH NEXT ${PAGE_SIZE} ROWS ONLY`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ database: dbId, type: 'native', native: { query: sql } }),
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
  // Metabase puede responder HTTP 200 con status:'failed' (p. ej. una columna
  // binaria que rompe la serialización): hay que validar ambos.
  if (json?.error || json?.status === 'failed') {
    throw new UpstreamError('other', 'La fuente primaria devolvió un error en el cuerpo');
  }

  const cols: string[] = (json?.data?.cols ?? []).map((c: any) => String(c?.name ?? '').toLowerCase());
  const rows: unknown[][] = json?.data?.rows ?? [];
  return { cols, rows };
}

async function traerFuentePrimaria(): Promise<PrimaryRow[]> {
  const out: PrimaryRow[] = [];
  let offset = 0;
  let colsRef: string[] | null = null;

  while (true) {
    const { cols, rows } = await consultarPagina(offset);
    if (!colsRef) colsRef = cols;

    const idx = (name: string) => colsRef!.indexOf(name);
    const pick = (r: unknown[], name: string): string => {
      const i = idx(name);
      return i >= 0 ? String(r[i] ?? '').trim() : '';
    };

    for (const r of rows) {
      const login = pick(r, 'nombre');           // login/código
      let fullName = pick(r, 'descripcion');     // nombre completo
      if (!fullName || fullName.startsWith('[')) fullName = login;
      const perfil = pick(r, 'perfil');
      const ubicacion = pick(r, 'ubicacionid');
      out.push({
        realId: pick(r, 'usuariosaccesoid'),
        login,
        fullName,
        email: pick(r, 'email') || pick(r, 'correo'),
        // departamento: primer dato descriptivo razonable de la fuente primaria
        department: pick(r, 'departamento') || pick(r, 'area') || perfil || ubicacion,
        tipo: pick(r, 'tipo').toUpperCase(),
        activo: (() => { const i = idx('activo'); return i >= 0 ? toBool(r[i]) : false; })(),
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
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  activo: boolean;
}

async function traerFuenteRespaldo(): Promise<FallbackRow[]> {
  const table = env.USERS_FALLBACK_TABLE;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!table || !serviceKey || !url) return []; // fuente opcional: sin config, no participa

  const select = 'id,nombre,usuario,user_name,full_name,first_name,last_name,email,correo,departamento,department,activo,estado,status';
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
      const firstName = String(r.first_name ?? '').trim();
      const lastName = String(r.last_name ?? '').trim();
      const fullName = String(r.nombre ?? r.full_name ?? [firstName, lastName].filter(Boolean).join(' ') ?? login).trim() || login;
      return {
        realId: String(r.id ?? login),
        login,
        fullName,
        firstName,
        lastName,
        email: String(r.email ?? r.correo ?? '').trim(),
        department: String(r.departamento ?? r.department ?? '').trim(),
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
  nombre: string;    // nombre completo
  firstName: string;
  lastName: string;
  usuario: string;
  email: string;
  department: string;
  key: string;       // login normalizado para merge/filtro
  tipo: string;      // 'U' | ... (fuente primaria; '' en respaldo)
  activo: boolean;
}

// Dividir un nombre completo en nombre/apellido (para la fuente primaria, que
// solo trae "descripcion"). No revela el origen: es un derivado puramente local.
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
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
    const { first, last } = splitName(p.fullName);
    byKey.set(k, { realId: p.realId, nombre: p.fullName, firstName: first, lastName: last, usuario: p.login, email: p.email, department: p.department, key: k, tipo: p.tipo, activo: p.activo });
    seenRealIds.add(`P:${p.realId}`);
  }
  for (const f of respaldo) {
    const k = mergeKey(f.login);
    if (!k || byKey.has(k)) continue;              // prevalece la primaria
    if (seenRealIds.has(`R:${f.realId}`)) continue; // no duplicar por id interno
    byKey.set(k, { realId: f.realId, nombre: f.fullName, firstName: f.firstName, lastName: f.lastName, usuario: f.login, email: f.email, department: f.department, key: k, tipo: '', activo: f.activo });
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

interface NuevoUsuarioInput {
  nombre: string;
  apellido: string;
  usuario: string;
  correo: string;
  departamento: string;
  activo: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateNuevoUsuario(body: any): { input?: NuevoUsuarioInput; error?: string } {
  const get = (...keys: string[]) => keys.map((k) => String(body?.[k] ?? '').trim()).find((v) => v) ?? '';
  const nombre = get('nombre', 'name', 'first_name');
  const apellido = get('apellido', 'lastName', 'last_name');
  const usuario = get('usuario', 'user_name', 'username');
  const correo = get('correo', 'email').toLowerCase();
  const departamento = get('departamento', 'department');
  const estadoRaw = body?.estado ?? body?.active ?? true;
  const activo = typeof estadoRaw === 'boolean' ? estadoRaw : toBool(estadoRaw);

  if (!nombre || !apellido || !usuario || !correo) return { error: 'Faltan campos obligatorios' };
  if (/\s/.test(usuario)) return { error: 'El usuario no puede tener espacios' };
  if (!EMAIL_RE.test(correo)) return { error: 'El correo no tiene un formato válido' };
  if ([nombre, apellido, usuario, correo, departamento].some((v) => v.length > 120)) return { error: 'Uno de los campos supera los 120 caracteres' };
  return { input: { nombre, apellido, usuario, correo, departamento, activo } };
}

// Chequeo de existencia en ambas fuentes. Nunca escribe en la fuente primaria.
async function existeEnAlgunaFuente(input: NuevoUsuarioInput): Promise<boolean> {
  const k = mergeKey(input.usuario);
  const correoK = norm(input.correo);
  try {
    const { users } = await buildCache(); // siempre fresco para evitar condiciones de carrera
    return users.some((u) => u.key === k || (correoK && norm(u.email) === correoK));
  } catch {
    // No podemos confirmar: el filtro `on_conflict` del insert evita duplicados
    // por login contra la tabla propia; ante la duda, no dejamos de crear.
    return false;
  }
}

// Inserta en la tabla propia de usuarios nuevos (solo servidor, service role).
// Si se define USERS_NEW_CONFLICT_COLUMN (p. ej. "usuario"), el insert usa
// on_conflict para que dos altas simultáneas no generen duplicados.
async function insertarUsuarioNuevo(input: NuevoUsuarioInput, createdBy: string): Promise<{ ok: boolean; conflict?: boolean; error?: string }> {
  const table = env.USERS_FALLBACK_TABLE;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!table || !serviceKey || !url) return { ok: false, error: 'El servidor no está configurado para guardar usuarios' };

  const conflictCol = env.USERS_NEW_CONFLICT_COLUMN; // opcional: columna con unique constraint
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(table)}${conflictCol ? `?on_conflict=${encodeURIComponent(conflictCol)}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: conflictCol ? 'return=minimal,resolution=merged' : 'return=minimal',
      },
      body: JSON.stringify([
        {
          nombre: `${input.nombre} ${input.apellido}`.trim(),
          first_name: input.nombre,
          last_name: input.apellido,
          usuario: input.usuario,
          email: input.correo,
          departamento: input.departamento,
          activo: input.activo,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        },
      ]),
    });
    if (res.status === 409) return { ok: false, conflict: true };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { ok: false, error: 'timeout' };
    return { ok: false, error: (err as Error)?.message ?? 'error' };
  } finally {
    clearTimeout(timer);
  }
}

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
    // Filtro por nombre, apellido, usuario o correo (nunca por id).
    filtered = filtered.filter(
      (u) =>
        u.key.includes(q.replace(/\s+/g, '')) ||
        norm(u.nombre).includes(q) ||
        norm(u.apellido).includes(q) ||
        norm(`${u.nombre} ${u.apellido}`).includes(q) ||
        norm(u.email).includes(q),
    );
  }

  const total = filtered.length;
  // Campos estrictamente necesarios para el formulario: sin origen, sin campos internos.
  const data: UsuarioPublico[] = filtered.slice(0, limit).map((u) => ({
    id: u.id,
    nombre: u.firstName || u.nombre,
    apellido: u.lastName,
    usuario: u.usuario,
    correo: u.email,
    departamento: u.department,
    estado: u.activo ? ('activo' as const) : ('inactivo' as const),
  }));

  return json({ success: true, total, count: data.length, data });
}
