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
 * Significado verificado con los datos:
 *   nombre      → usuario de sistema (login), ej. "MSQUINA"
 *   descripcion → nombre completo de la persona, ej. "Marianela Quiña"
 *   perfil      → código numérico de perfil
 *   ubicacionid → código numérico de ubicación/sucursal
 *
 * SEGURIDAD: solo se exponen id, usuario, nombre completo, perfil, ubicación, tipo y estado.
 * Se excluyen SIEMPRE: contrasenia, servicekey_path, identityrecord, vencimientos.
 */

let cache = {
  data: null,
  timestamp: 0,
};

function isCacheValid() {
  return cache.data && (Date.now() - cache.timestamp) < config.usersCacheTtlMs;
}

/** Convierte valores vacíos o "null" de Metabase en cadena vacía. */
function texto(valor) {
  const s = String(valor ?? '').trim();
  return s === 'null' ? '' : s;
}

/** Interpreta el campo activo (puede venir como boolean, número o texto). */
function esActivo(valor) {
  if (valor === true || valor === 1) return true;
  if (valor === false || valor === 0) return false;
  const s = texto(valor).toLowerCase();
  return s === 'true' || s === '1' || s === 's' || s === 'si' || s === 'activo';
}

/**
 * Detecta registros sin nombre completo real (por ejemplo "[Descripción Usuario ...]").
 * No se excluyen: se marcan para que el frontend decida cómo mostrarlos.
 */
function sinDescripcion(descripcion) {
  return !descripcion || descripcion.startsWith('[');
}

/** Normaliza un registro crudo de UsuariosAccesos a los campos seguros. */
function toUsuario(u) {
  const id = texto(u.usuariosaccesoid);
  if (!id) return null; // sin id no es referenciable

  const usuario = texto(u.nombre);
  const descripcion = texto(u.descripcion);
  const activo = esActivo(u.activo);

  return {
    id,                                   // se guarda como usuario_ref en Supabase
    usuario,                              // login: "MSQUINA"
    nombreCompleto: sinDescripcion(descripcion) ? usuario : descripcion,
    perfilId: texto(u.perfil),
    ubicacionId: texto(u.ubicacionid),
    tipo: texto(u.tipo),
    activo,
    estado: activo ? 'activo' : 'inactivo',
    sinDescripcion: sinDescripcion(descripcion),
  };
}

/** Normaliza texto para búsquedas: minúsculas y sin tildes. */
function normalizar(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Carga usuarios desde Metabase y actualiza el cache. */
async function loadUsers() {
  console.log('[usersService] Consultando Metabase...');
  const rawUsers = await usuariosAccesos();

  const normalized = rawUsers
    .map(toUsuario)
    .filter(Boolean)
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));

  cache = { data: normalized, timestamp: Date.now() };
  console.log(`[usersService] Cache actualizado: ${normalized.length} usuarios`);
  return normalized;
}

/**
 * Obtiene la lista de usuarios (usa cache si es válido). Búsqueda en memoria.
 * @param {string} query - texto a buscar en id, usuario o nombre completo
 * @param {{ soloActivos?: boolean }} opciones
 */
export async function getUsers(query = '', { soloActivos = false } = {}) {
  if (!isCacheValid()) {
    await loadUsers();
  }

  let users = cache.data;
  if (soloActivos) users = users.filter(u => u.activo);
  if (!query) return users;

  const q = normalizar(query);
  return users.filter(u =>
    normalizar(u.id).includes(q) ||
    normalizar(u.usuario).includes(q) ||
    normalizar(u.nombreCompleto).includes(q)
  );
}

/** Busca un usuario por id (para validar usuario_ref al registrar un movimiento). */
export async function getUserById(id) {
  if (!isCacheValid()) {
    await loadUsers();
  }
  return cache.data.find(u => u.id === String(id)) || null;
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
    activos: cache.data?.filter(u => u.activo).length || 0,
    ageSeconds: cache.data ? Math.floor((Date.now() - cache.timestamp) / 1000) : null,
  };
}