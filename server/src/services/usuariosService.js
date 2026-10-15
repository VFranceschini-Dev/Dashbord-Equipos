import { usuariosAccesos } from '../queries/saiTest.js';
import { config } from '../config.js';

/**
 * Service de usuarios: único punto que consume la query de Metabase.
 * Cachea en memoria (TTL configurable) y expone solo los campos necesarios.
 * La búsqueda por texto se hace SOBRE la lista cacheada (nunca se arma SQL
 * con el input del usuario).
 *
 * Mapeo confirmado con `npm run test:metabase` contra UsuariosAccesos
 * (source-table 1406, SAI_TEST). Columnas REALES de la tabla:
 *   usuariosaccesoid (PK), nombre, descripcion, tipo, perfil, ubicacionid,
 *   identityrecord, contrasenia, vencimiento, gestionid,
 *   contraseniavencimiento, contraseniaperiodo, servicekey_path,
 *   ultimoacceso, activo
 *
 * SEGURIDAD: las columnas sensibles (contrasenia, contraseniavencimiento,
 * contraseniaperiodo, servicekey_path, identityrecord, vencimiento) se
 * EXCLUYEN explícitamente: nunca salen de este servicio ni se exponen por la API.
 */

let cache = { users: null, fetchedAt: 0 };
let inflight = null;

// Campos prohibidos: jamás deben proyectarse hacia el frontend.
const SENSITIVE_KEYS = [
  'contrasenia', 'password', 'identityrecord', 'servicekey_path',
  'vencimiento', 'contraseniavencimiento', 'contraseniaperiodo',
];

/** Proyección segura: SOLO id, nombre, área/perfil y estado. */
function toPublicUser(row) {
  const val = k => (row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : null);
  return {
    id: val('usuariosaccesoid'),                       // PK real de UsuariosAccesos
    nombre: val('nombre') || val('descripcion'),       // nombre visible
    area: val('perfil') || val('ubicacionid'),         // perfil/ubicación como "área"
    estado: val('activo'),                             // activo/inactivo
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

// Re-export para tests/herramientas internas.
export { SENSITIVE_KEYS };
