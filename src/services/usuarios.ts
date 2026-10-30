/**
 * usuarios.ts — Servicio ÚNICO de búsqueda/alta de usuarios del frontend.
 *
 * Toda la app (Asignación de Equipos y la sección Usuarios) usa este servicio,
 * que habla SOLO con el endpoint propio de la misma función serverless.
 * La fusión de las fuentes de datos y la normalización ocurre en el backend;
 * el navegador no conoce sistemas, bases ni tablas internas.
 */

import { supabase } from './supabase';

const TIMEOUT_MS = 20000; // timeout del navegador (la función corta a los 15 s)

/** Clave de caché por consulta: sin tildes, minúsculas y espacios colapsados. */
function cacheKey(q: string): string {
  return q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
}

// Caché en memoria del navegador (5 min): la sección Usuarios y el buscador de
// Asignación de Equipos comparten resultados y no repiten llamadas al servidor.
const LIST_TTL_MS = 5 * 60 * 1000;
const listCache = new Map<string, { expiresAt: number; value: ListadoUsuarios }>();
const inFlight = new Map<string, Promise<ListadoUsuarios>>();

function remember(key: string, promise: Promise<ListadoUsuarios>): Promise<ListadoUsuarios> {
  const existing = inFlight.get(key);
  if (existing) return existing; // evita consultas duplicadas simultáneas
  const tracked = promise.then(
    value => {
      listCache.set(key, { expiresAt: Date.now() + LIST_TTL_MS, value });
      inFlight.delete(key);
      return value;
    },
    err => {
      inFlight.delete(key);
      throw err;
    },
  );
  inFlight.set(key, tracked);
  return tracked;
}

/** Invalida la caché local (tras un alta, por ejemplo). */
export function invalidarCacheUsuarios(): void {
  listCache.clear();
}

/** Perfil normalizado devuelto por el endpoint propio (id opaco, sin fuente visible). */
export interface Usuario {
  id: string;         // UUID opaco
  nombre: string;     // pila
  apellido: string;
  usuario: string;    // login
  correo: string;
  departamento: string;
  estado: 'activo' | 'inactivo';
}

export class ProxyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
  }
}

async function authedFetch(pathAndQuery: string, init: RequestInit = {}): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ProxyError('Sesión no válida.', 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api/usuarios${pathAndQuery}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ProxyError('Tiempo de espera agotado.', 504);
    throw new ProxyError('No se pudo conectar con el servidor.', 0);
  } finally {
    clearTimeout(timer);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ProxyError(`Respuesta inválida del servidor (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || json?.success === false) {
    throw new ProxyError(json?.error || `El servidor respondió HTTP ${res.status}`, res.status);
  }
  return json;
}

export interface BuscarUsuariosOptions {
  soloActivos?: boolean;  // default true
  limit?: number;         // 1..500, default 50
  refresh?: boolean;      // ignora la caché del servidor
}

/** Resultado de un listado: total y activos cuentan todas las coincidencias, no solo las devueltas. */
export interface ListadoUsuarios {
  total: number;
  activos: number;
  data: Usuario[];
}

/** Busca usuarios (nombre, apellido, login o correo). Nunca arma consultas con el texto: filtra el backend. */
export async function buscarUsuarios(q = '', options: BuscarUsuariosOptions = {}): Promise<Usuario[]> {
  return (await listarUsuarios(q, options)).data;
}

/** Igual que buscarUsuarios, pero devuelve también los totales (para tarjetas de resumen). */
export async function listarUsuarios(q = '', options: BuscarUsuariosOptions = {}): Promise<ListadoUsuarios> {
  const soloActivos = options.soloActivos ?? true;
  const limit = options.limit ?? 50;
  const key = `${cacheKey(q)}|${soloActivos ? 'a' : 't'}|${limit}`;

  if (!options.refresh) {
    const hit = listCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
  }

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('soloActivos', String(soloActivos));
  params.set('limit', String(limit));
  if (options.refresh) params.set('refresh', 'true');
  const qs = params.toString();

  return remember(key, (async () => {
    const json = await authedFetch(qs ? `?${qs}` : '');
    const data = (json.data || []) as Usuario[];
    return {
      total: typeof json.total === 'number' ? json.total : data.length,
      activos: typeof json.activos === 'number' ? json.activos : data.filter(u => u.estado === 'activo').length,
      data,
    };
  })());
}

/** Verifica si un usuario (login) o correo ya existe en alguna fuente. */
export async function existeUsuario({ usuario, correo }: { usuario?: string; correo?: string }): Promise<boolean> {
  const terminos = [usuario, correo].map(t => (t || '').trim()).filter(Boolean);
  for (const term of terminos) {
    try {
      // Con q='' se trae el listado completo (paginado por el servidor hasta 500);
      // comparar en memoria evita falsos negativos por coincidencias parciales.
      const found = term === (correo || '').trim() && correo
        ? await buscarUsuarios('', { soloActivos: false, limit: 500 })
        : await buscarUsuarios(term, { soloActivos: false, limit: 500 });
      const uLow = (usuario || '').toLowerCase().replace(/\s+/g, '');
      const cLow = (correo || '').toLowerCase();
      if (found.some(u => (uLow && u.usuario.toLowerCase().replace(/\s+/g, '') === uLow) || (cLow && u.correo.toLowerCase() === cLow))) {
        return true;
      }
    } catch {
      // Si una fuente no responde, seguir evaluando el resto de los términos.
    }
  }
  return false;
}

export interface AltaUsuarioInput {
  nombre: string;
  apellido: string;
  usuario: string;
  correo: string;
  departamento: string;
  estado: 'activo' | 'inactivo';
}

export type AltaUsuarioResultado =
  | { ok: true; usuario: Usuario }
  | { ok: false; code: 'invalido' | 'duplicado' | 'error'; message: string };

/** Alta de un usuario no registrado (se guarda en la base gestionada por el backend). */
export async function darDeAltaUsuario(input: AltaUsuarioInput): Promise<AltaUsuarioResultado> {
  try {
    const json = await authedFetch('', { method: 'POST', body: JSON.stringify(input) });
    invalidarCacheUsuarios(); // el alta cambia el listado fusionado
    return { ok: true, usuario: json.data as Usuario };
  } catch (err) {
    if (err instanceof ProxyError) {
      if (err.status === 409) return { ok: false, code: 'duplicado', message: 'Ya existe un usuario con esos datos.' };
      if (err.status === 400) return { ok: false, code: 'invalido', message: err.message || 'Los datos ingresados no son válidos.' };
    }
    return { ok: false, code: 'error', message: 'No se pudo guardar el usuario. Intentá de nuevo más tarde.' };
  }
}

/** Fuerza recarga de la caché del servidor y devuelve cuántos usuarios hay disponibles. */
export async function refreshUsuarios(): Promise<{ count: number }> {
  const users = await buscarUsuarios('', { soloActivos: false, limit: 500, refresh: true });
  return { count: users.length };
}

/** Healthcheck del endpoint propio (aviso genérico si no responde). */
export async function checkProxy(): Promise<boolean> {
  try {
    const json = await authedFetch('?limit=1');
    return json?.success === true;
  } catch {
    return false;
  }
}

// ===== Tipo de compatibilidad (forma antigua usada por Asignación de Equipos) =====
export interface UsuarioCompat extends Usuario {
  nombreCompleto: string;
  area: string;
}

/** Busca y devuelve además los campos de la forma antigua (nombreCompleto/area). */
export async function buscarUsuariosCompat(q = '', options: BuscarUsuariosOptions = {}): Promise<UsuarioCompat[]> {
  const rows = await buscarUsuarios(q, options);
  return rows.map(toCompat);
}

function toCompat(u: Usuario): UsuarioCompat {
  const full = `${u.nombre} ${u.apellido}`.trim() || u.usuario;
  return {
    ...u,
    nombreCompleto: full,
    area: u.departamento || u.usuario,
  };
}
