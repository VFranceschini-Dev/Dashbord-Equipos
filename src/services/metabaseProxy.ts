/**
 * Cliente del proxy local de Vercel (función serverless, mismo dominio).
 *
 * El navegador NUNCA habla con el servidor interno ni conoce la API key:
 * todo pasa por /api/users, que valida la sesión de Supabase y consulta
 * SAI_TEST (Metabase) en modo SOLO LECTURA.
 */

import { supabase } from './supabase';

// Endpoint único del proxy serverless (misma función para ambas rutas históricas).
export const USERS_PROXY_ENDPOINT = '/api/users';

export interface MetabaseUsuario {
  id: string;             // usuariosaccesoid
  usuario: string;        // login/código (campo "nombre" en UsuariosAccesos)
  nombreCompleto: string; // descripción del acceso
  perfilId: string;       // perfil
  ubicacionId: string;    // ubicacionid
  tipo: string;           // 'U' | ... (mayúsculas)
  activo: boolean;        // activo como boolean
  // Alias de compatibilidad para EquipmentAssignments.tsx:
  nombre: string;         // = nombreCompleto
  area: string;           // = usuario (login)
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

interface ApiUsuariosResponse {
  success: boolean;
  total?: number;
  count?: number;
  data?: MetabaseUsuario[];
  error?: string;
  message?: string;
}

async function fetchUsuariosApi(
  params: Record<string, string | number | boolean | undefined>,
): Promise<ApiUsuariosResponse> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new ProxyError('Sesión expirada. Volvé a iniciar sesión.', 401);
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const url = `${USERS_PROXY_ENDPOINT}${qs.toString() ? `?${qs.toString()}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ProxyError('Tiempo de espera agotado al buscar usuarios.');
    throw new ProxyError(`No se pudo conectar con el proxy /api/users: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  let json: ApiUsuariosResponse;
  try {
    json = await res.json();
  } catch {
    throw new ProxyError(`Respuesta no JSON del servidor (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || !json.success) {
    throw new ProxyError(json.error || json.message || `El servidor respondió HTTP ${res.status}`, res.status);
  }

  // Asegurar los alias de compatibilidad aunque el backend solo devuelva los 7 campos.
  if (json.data) {
    json.data = json.data.map((u: any) => ({
      ...u,
      nombre: u.nombre ?? u.nombreCompleto ?? '',
      area: u.area ?? u.usuario ?? '',
      estado: u.estado ?? (u.activo ? 'activo' : 'inactivo'),
    }));
  }
  return json;
}

/**
 * Lista/busca usuarios de UsuariosAccesos vía /api/users (proxy serverless).
 * El filtro q se aplica en memoria sobre la caché del servidor (sin tildes ni
 * mayúsculas); nunca se arma SQL con el texto. Por defecto solo activos.
 */
export async function getUsuarios(
  q = '',
  opts?: { soloActivos?: boolean; soloPersonas?: boolean; limit?: number },
): Promise<MetabaseUsuario[]> {
  const json = await fetchUsuariosApi({
    q: q || undefined,
    soloActivos: opts?.soloActivos ?? true,
    soloPersonas: opts?.soloPersonas ?? undefined,
    limit: opts?.limit ?? undefined,
  });
  return json.data || [];
}

/** Fuerza recarga de la caché de usuarios en la función serverless (TTL 5 min). */
export async function refreshUsuarios(): Promise<{ count: number }> {
  const json = await fetchUsuariosApi({ refresh: true, limit: 500, soloActivos: false });
  return { count: json.total ?? json.count ?? 0 };
}

/** Healthcheck del puente /api/users (sesión + variables del servidor). */
export async function checkProxy(): Promise<boolean> {
  try {
    await fetchUsuariosApi({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
