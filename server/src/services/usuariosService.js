import { usuariosAccesos } from '../queries/saiTest.js';
import { config } from '../config.js';

/**
 * Service de usuarios: único punto que consume la query de Metabase.
 * Cachea en memoria (TTL configurable) y expone solo los campos necesarios.
 * La búsqueda por texto se hace SOBRE la lista cacheada (nunca se arma SQL
 * con el input del usuario).
 */

let cache = { users: null, fetchedAt: 0 };
let inflight = null;

// Candidatos de nombre de columna (los reales se confirman con npm run test:metabase).
const ID_KEYS = ['id', 'idusuario', 'id_usuario', 'codigo', 'cod', 'legajo', 'usuario'];
const NAME_KEYS = ['nombre', 'name', 'nombrecompleto', 'nombre_completo', 'apellidos', 'apellido'];
const AREA_KEYS = ['area', 'región', 'region', 'departamento', 'sector', 'ubicacion', 'oficina'];
const STATUS_KEYS = ['estado', 'status', 'activo', 'active', 'habilitado'];

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return String(obj[k]).trim();
  }
  return null;
}

function toPublicUser(row) {
  return {
    id: pick(row, ID_KEYS),
    nombre: pick(row, NAME_KEYS),
    area: pick(row, AREA_KEYS),
    estado: pick(row, STATUS_KEYS),
  };
}

async function fetchUsers() {
  const rows = await usuariosAccesos();
  return rows.map(toPublicUser).filter(u => u.id);
}

/** Obtiene la lista cacheada; si venció o se fuerza, recarga de Metabase. */
export async function getUsuarios({ force = false } = {}) {
  const fresh = cache.users && (Date.now() - cache.fetchedAt) < config.usersCacheTtlMs;
  if (fresh && !force) return cache.users;

  // Dedupe de requests concurrentes mientras se recarga.
  if (!inflight) {
    inflight = fetchUsers()
      .then(users => {
        cache = { users, fetchedAt: Date.now() };
        return users;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Búsqueda incremental sobre la caché (nombre, área o id). Sin tocar Metabase. */
export async function buscarUsuarios(q) {
  const users = await getUsuarios();
  if (!q) return users;
  const needle = q.toLowerCase().trim();
  return users.filter(u =>
    (u.nombre && u.nombre.toLowerCase().includes(needle)) ||
    (u.area && u.area.toLowerCase().includes(needle)) ||
    (u.id && u.id.toLowerCase().includes(needle))
  ).slice(0, 50);
}

export function cacheInfo() {
  return {
    loaded: Boolean(cache.users),
    count: cache.users?.length ?? 0,
    fetchedAt: cache.fetchedAt || null,
    ttlMs: config.usersCacheTtlMs,
  };
}
