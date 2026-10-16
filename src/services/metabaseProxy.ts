/**
 * metabaseProxy.ts — Cliente del endpoint propio /api/usuarios (función de Vercel).
 *
 * El navegador NUNCA habla con ipa.donnet.com.ar: la lectura de SAI_TEST
 * (UsuariosAccesos, SOLO LECTURA) pasa por la función serverless del mismo
 * dominio, que es la única que conoce la API key de Metabase.
 *
 * Exportaciones estables (usadas por EquipmentAssignments.tsx):
 *   getUsuarios, ProxyError, MetabaseUsuario, refreshUsuarios, checkProxy
 */

import { supabase } from './supabase';

const TIMEOUT_MS = 20000; // timeout del lado del navegador (la función corta a los 15 s)

export interface MetabaseUsuario {
  id: string;             // usuariosaccesoid
  usuario: string;        // login (nombre)
  nombreCompleto: string; // descripcion
  perfilId: string;       // perfil
  ubicacionId: string;    // ubicacionid
  tipo: string;           // mayúsculas ('U' = persona)
  activo: boolean;
  // --- Alias de compatibilidad (no romper EquipmentAssignments.tsx) ---
  nombre: string;         // = nombreCompleto
  area: string;           // = usuario (login)
  estado: 'activo' | 'inactivo';
}

interface RawUsuario {
  id: string;
  usuario: string;
  nombreCompleto: string;
  perfilId: string;
  ubicacionId: string;
  tipo: string;
  activo: boolean;
}

export class ProxyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
  }
}

function withCompat(u: RawUsuario): MetabaseUsuario {
  return {
    ...u,
    nombre: u.nombreCompleto,
    area: u.usuario,
    estado: u.activo ? 'activo' : 'inactivo',
  };
}

async function authedFetch(pathAndQuery: string, init: RequestInit = {}): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ProxyError('Sesión no válida: volvé a iniciar sesión.', 401);

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
    if ((err as Error).name === 'AbortError') throw new ProxyError(`Timeout de /api/usuarios (${TIMEOUT_MS} ms)`);
    throw new ProxyError(`No se pudo conectar a /api/usuarios: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ProxyError(`Respuesta no JSON de /api/usuarios (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || json?.success === false) {
    throw new ProxyError(json?.error || `/api/usuarios respondió HTTP ${res.status}`, res.status);
  }
  return json;
}

export interface GetUsuariosOptions {
  soloActivos?: boolean;  // default true
  soloPersonas?: boolean; // tipo 'U'
  limit?: number;         // 1..500, default 50
  refresh?: boolean;      // ignora la caché del servidor
}

/** Lista/busca usuarios de UsuariosAccesos vía /api/usuarios (mismo dominio). */
export async function getUsuarios(q = '', options: GetUsuariosOptions = {}): Promise<MetabaseUsuario[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('soloActivos', String(options.soloActivos ?? true));
  if (options.soloPersonas) params.set('soloPersonas', 'true');
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.refresh) params.set('refresh', 'true');

  const qs = params.toString();
  const json = await authedFetch(qs ? `?${qs}` : '');
  const rows: RawUsuario[] = json.data || [];
  return rows.map(withCompat);
}

/** Fuerza recarga de la caché de usuarios en la función serverless. */
export async function refreshUsuarios(): Promise<{ count: number }> {
  const users = await getUsuarios('', { soloActivos: false, limit: 500, refresh: true });
  return { count: users.length };
}

/** Healthcheck del endpoint propio (para mostrar aviso si la función no responde). */
export async function checkProxy(): Promise<boolean> {
  try {
    const json = await authedFetch('?limit=1');
    return json?.success === true;
  } catch {
    return false;
  }
}
