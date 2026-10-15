/**
 * Referencia: servicio de usuarios con PROYECCIÓN SEGURA sobre columnas REALES.
 * Patrón confirmado en Dashbord-Equipos: primero se descubren las columnas con
 * npm run test:metabase y recién después se mapea — nunca se inventan nombres.
 *
 * UsuariosAccesos (source-table 1406, SAI_TEST) — columnas reales detectadas:
 *   usuariosaccesoid(PK), nombre, descripcion, tipo, perfil, ubicacionid,
 *   identityrecord*, contrasenia*, vencimiento*, gestionid,
 *   contraseniavencimiento*, contraseniaperiodo*, servicekey_path*, ultimoacceso, activo
 *   (*) sensibles: EXCLUIDAS de toda proyección hacia el frontend.
 */

let cache = { users: null, fetchedAt: 0 };
let inflight = null;

const SENSITIVE_KEYS = [
  'contrasenia', 'password', 'identityrecord', 'servicekey_path',
  'vencimiento', 'contraseniavencimiento', 'contraseniaperiodo',
];

/** Proyección segura: SOLO id, nombre, área/perfil y estado. */
function toPublicUser(row) {
  const val = k => (row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : null);
  return {
    id: val('usuariosaccesoid'),                 // PK real de la tabla fuente
    nombre: val('nombre') || val('descripcion'),
    area: val('perfil') || val('ubicacionid'),
    estado: val('activo'),
  };
}

async function fetchUsers() {
  const rows = await usuariosAccesos();          // desde queries/<db>.js
  return rows.map(toPublicUser).filter(u => u.id);
}

/** Caché TTL + dedupe de recargas concurrentes. */
export async function getUsuarios({ force = false } = {}) {
  const fresh = cache.users && (Date.now() - cache.fetchedAt) < config.usersCacheTtlMs;
  if (fresh && !force) return cache.users;
  if (!inflight) {
    inflight = fetchUsers()
      .then(users => { cache = { users, fetchedAt: Date.now() }; return users; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Búsqueda incremental SOBRE LA CACHÉ (nunca con SQL armado desde input). */
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
