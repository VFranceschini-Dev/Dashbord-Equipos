/**
 * api/_lib/zammad-directorio.ts — Usuarios de Zammad habilitados para el sistema.
 *
 * Zammad es el directorio: de ahí salen las personas y su organización. Solo son elegibles los
 * usuarios ACTIVOS de las organizaciones habilitadas (acceso denegado por defecto): clientes,
 * proveedores y otras empresas que también están en Zammad quedan excluidos.
 *
 * Variables (solo servidor): ZAMMAD_URL, ZAMMAD_TOKEN (las mismas de los comprobantes; el token
 * tiene que poder leer usuarios), ZAMMAD_ORGANIZACIONES (ids separados por coma; por defecto 2 =
 * SISTEMAS PEDSA).
 */
const TIMEOUT_MS = 15000;
const POR_PAGINA = 100;
const MAX_PAGINAS = 30;          // tope de seguridad: 3000 usuarios
const CACHE_MS = 60_000;

export interface UsuarioZammad {
  zammadId: number;
  login: string;
  nombre: string;
  apellido: string;
  email: string;                 // el de Zammad, o vacío
  departamento: string;          // campo "Departamento" de Zammad (viene del AD si Zammad lo sincroniza)
  organizacionId: number;
  activo: boolean;
}

function env(name: string): string | undefined {
  const v = (process.env[name] || '').trim();
  return v || undefined;
}

export function organizacionesHabilitadas(): number[] {
  const ids = (env('ZAMMAD_ORGANIZACIONES') || '2').split(/[,;\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
  return ids.length ? ids : [2];
}

function config(): { url: string; token: string } | null {
  const url = env('ZAMMAD_URL');
  const token = env('ZAMMAD_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function zGet(z: { url: string; token: string }, path: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${z.url}/api/v1/${path}`, { headers: { Authorization: `Token token=${z.token}` }, signal: controller.signal });
    if (res.status === 401 || res.status === 403) throw new Error('Zammad no autorizó la consulta: el token necesita permiso para leer usuarios.');
    if (!res.ok) throw new Error(`Zammad respondió HTTP ${res.status}.`);
    return await res.json();
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Zammad tardó demasiado en responder.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Solo lo necesario de cada usuario; nunca se reenvía el resto de los datos de Zammad. */
export function normalizarUsuario(u: any): UsuarioZammad | null {
  const zammadId = Number(u?.id);
  const login = String(u?.login ?? '').trim();
  if (!Number.isInteger(zammadId) || zammadId <= 0 || !login) return null;
  const pila = String(u?.firstname ?? '').trim();
  const apellido = String(u?.lastname ?? '').trim();
  // Solo personas: las cuentas genéricas de áreas (Caja, Control de Stock…) no tienen nombre y apellido
  if (!pila || !apellido) return null;
  const nombre = `${pila} ${apellido}`;
  const email = String(u?.email ?? '').trim().toLowerCase();
  return {
    zammadId, login, nombre, apellido,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '',
    departamento: String(u?.department ?? '').trim(),
    organizacionId: Number(u?.organization_id) || 0,
    activo: u?.active !== false,
  };
}

export function habilitado(u: any, organizaciones = organizacionesHabilitadas()): boolean {
  return u?.active !== false && organizaciones.includes(Number(u?.organization_id)) && normalizarUsuario(u) !== null;
}

/** Correo con el que se crea la cuenta del sistema (Supabase lo exige): el de Zammad, el login si ya es un correo, o uno técnico. */
export function correoParaCuenta(u: UsuarioZammad): string {
  if (u.email) return u.email;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(u.login)) return u.login.toLowerCase();
  return `${u.login.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@interno.local`;
}

let cache: { hasta: number; usuarios: UsuarioZammad[] } | null = null;

/** Todos los miembros (activos e inactivos) de las organizaciones habilitadas, ordenados por nombre. */
export async function miembrosOrganizaciones(forzar = false): Promise<UsuarioZammad[]> {
  const z = config();
  if (!z) throw new Error('La conexión con Zammad no está configurada en el servidor (ZAMMAD_URL y ZAMMAD_TOKEN).');
  if (!forzar && cache && cache.hasta > Date.now()) return cache.usuarios;
  const orgs = organizacionesHabilitadas();
  const salida: UsuarioZammad[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const lote = await zGet(z, `users?page=${pagina}&per_page=${POR_PAGINA}`);
    if (!Array.isArray(lote)) throw new Error('Zammad devolvió una respuesta inesperada.');
    for (const u of lote) {
      if (!orgs.includes(Number(u?.organization_id))) continue;
      const n = normalizarUsuario(u);
      if (n) salida.push(n);
    }
    if (lote.length < POR_PAGINA) break;
  }
  salida.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  cache = { hasta: Date.now() + CACHE_MS, usuarios: salida };
  return salida;
}

/** Solo los activos (para dar de alta cuentas). */
export async function usuariosHabilitados(): Promise<UsuarioZammad[]> {
  return (await miembrosOrganizaciones()).filter(u => u.activo);
}

/** Un usuario puntual, siempre releído de Zammad (no se confía en lo que manda el navegador). null si no es elegible. */
export async function usuarioHabilitado(zammadId: number): Promise<UsuarioZammad | null> {
  const z = config();
  if (!z) throw new Error('La conexión con Zammad no está configurada en el servidor (ZAMMAD_URL y ZAMMAD_TOKEN).');
  let u: any;
  try { u = await zGet(z, `users/${zammadId}`); } catch (err) {
    if (/HTTP 404/.test((err as Error).message)) return null;
    throw err;
  }
  return habilitado(u) ? normalizarUsuario(u) : null;
}

export const _probar = { limpiarCache: () => { cache = null; } };
