/**
 * Cliente del proxy local de Vercel (función serverless, mismo dominio).
 *
 * El navegador NUNCA habla con los servidores internos ni conoce credenciales:
 * todo pasa por /api/usuarios, que valida la sesión y combina dos fuentes de
 * usuarios en el servidor (solo lectura). La respuesta trae únicamente
 * { id, nombre, usuario } — sin origen, base ni tabla visibles.
 */

import { supabase } from './supabase';

// Endpoint único del proxy serverless.
export const USERS_PROXY_ENDPOINT = '/api/usuarios';

export interface Usuario {
  id: string;             // identificador opaco (no revela la fuente)
  nombre: string;         // nombre completo
  usuario: string;        // login/código
  // Campos derivados en el cliente (compatibilidad con EquipmentAssignments.tsx):
  nombreCompleto: string; // = nombre
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
  data?: Array<{ id: string; nombre: string; usuario: string }>;
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
    throw new ProxyError('No se pudo conectar con el servidor de usuarios.');
  } finally {
    clearTimeout(timer);
  }

  let json: ApiUsuariosResponse;
  try {
    json = await res.json();
  } catch {
    throw new ProxyError('Respuesta inválida del servidor.', res.status);
  }
  if (!res.ok || !json.success) {
    // Mensaje genérico: no reenviamos detalles internos al usuario.
    throw new ProxyError('No se pudo cargar la lista de usuarios.', res.status);
  }

  // Derivar los campos que usa la UI a partir de { id, nombre, usuario }.
  if (json.data) {
    json.data = json.data.map((u) => ({
      ...u,
      nombre: u.nombre ?? u.usuario ?? '',
    })) as ApiUsuariosResponse['data'];
  }
  return json;
}

function toUsuario(u: { id: string; nombre: string; usuario: string }): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    usuario: u.usuario,
    nombreCompleto: u.nombre,
    area: u.usuario,
    estado: 'activo', // el backend ya filtró inactivos cuando soloActivos=true
  };
}

/**
 * Lista/busca usuarios combinando las dos fuentes del servidor vía /api/usuarios.
 * El filtro q se aplica en memoria en el backend (sin tildes ni mayúsculas);
 * nunca se arma SQL con el texto. Por defecto solo activos.
 */
export async function getUsuarios(
  q = '',
  opts?: { soloActivos?: boolean; soloPersonas?: boolean; limit?: number },
): Promise<Usuario[]> {
  const json = await fetchUsuariosApi({
    q: q || undefined,
    soloActivos: opts?.soloActivos ?? true,
    soloPersonas: opts?.soloPersonas ?? undefined,
    limit: opts?.limit ?? undefined,
  });
  return (json.data || []).map(toUsuario);
}

/** Fuerza recarga de la caché de usuarios en la función serverless (TTL 5 min). */
export async function refreshUsuarios(): Promise<{ count: number }> {
  const json = await fetchUsuariosApi({ refresh: true, limit: 500, soloActivos: false });
  return { count: json.total ?? json.count ?? 0 };
}

/** Healthcheck del endpoint de usuarios (sesión + variables del servidor). */
export async function checkProxy(): Promise<boolean> {
  try {
    await fetchUsuariosApi({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
