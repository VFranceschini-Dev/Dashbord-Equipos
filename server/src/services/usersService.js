import { usuariosAccesos } from '../queries/saiTest.js';
import { config } from '../config.js';

/**
 * Servicio de usuarios desde Metabase (SAI_TEST/UsuariosAccesos).
 * Cachea la lista completa en memoria con TTL configurable.
 * Las búsquedas se hacen sobre el cache, nunca generan SQL con texto libre.
 *
 * Columnas REALES confirmadas por npm run test:metabase:
 *   usuariosaccesoid | nombre | descripcion | tipo | perfil | ubicacionid |
 *   identityrecord | contrasenia | vencimiento | gestionid |
 *   contraseniavencimiento | contraseniaperiodo | servicekey_path |
 *   ultimoacceso | activo
 *
 * SEGURIDAD: solo se exponen id, nombre, área (descripcion), perfil y estado (activo).
 * Se excluyen SIEMPRE: contrasenia, servicekey_path, identityrecord, vencimientos.
 */

let cache = {
  data: null,
  timestamp: 0,
};

function isCacheValid() {
  return cache.data && (Date.now() - cache.timestamp) < config.usersCacheTtlMs;
}

/** Normaliza un registro crudo de UsuariosAccesos a los campos seguros. */
function toUsuario(u) {
  const id = String(u.usuariosaccesoid ?? '').trim();
  if (!id || id === 'null') return null; // sin id no es referenciable

  const estado =
    u.activo === true || u.activo === 1 ? 'activo' :
    u.activo === false || u.activo === 0 ? 'inactivo' :
    String(u.activo ?? '');

  return {
    id,
    nombre: String(u.nombre ?? '').trim(),
    area: String(u.descripcion ?? '').trim(),      // "descripcion" identifica el área/acceso
    perfil: String(u.perfil ?? '').trim(),
    ubicacionid: String(u.ubicacionid ?? '').trim(),
    estado,
  };
}

/** Carga usuarios desde Metabase y actualiza el cache. */
async function loadUsers() {
  console.log('[usersService] Consultando Metabase...');
  const rawUsers = await usuariosAccesos();

  const normalized = rawUsers.map(toUsuario).filter(Boolean);

  cache = { data: normalized, timestamp: Date.now() };
  console.log(`[usersService] Cache actualizado: ${normalized.length} usuarios`);
  return normalized;
}

/** Obtiene lista de usuarios (usa cache si es válido). Búsqueda en memoria. */
export async function getUsers(query = '') {
  if (!isCacheValid()) {
    await loadUsers();
  }

  const users = cache.data;
  if (!query) return users;

  // Búsqueda case-insensitive y sin tildes sobre nombre, área e id.
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const q = norm(query);
  return users.filter(u =>
    norm(u.id).includes(q) ||
    norm(u.nombre).includes(q) ||
    norm(u.area).includes(q)
  );
}

/** Fuerza recarga desde Metabase (ignora TTL). */
export async function refreshUsers() {
  return loadUsers();
}

/** Estado del cache para diagnóstico (sin datos personales). */
export function getCacheStatus() {
  return {
    valid: isCacheValid(),
    count: cache.data?.length || 0,
    ageSeconds: cache.data ? Math.floor((Date.now() - cache.timestamp) / 1000) : null,
  };
}