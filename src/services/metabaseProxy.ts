/**
 * Cliente del proxy interno ipa.donnet.com.ar/api (Metabase SAI_TEST, SOLO LECTURA).
 * La app alojada en Vercel NUNCA habla con Metabase directamente: siempre pasa
 * por este proxy, que vive en la red interna y guarda la API key.
 *
 * Configuración:
 *   VITE_METABASE_PROXY_URL  → base del proxy (default https://ipa.donnet.com.ar/api)
 *   VITE_METABASE_TIMEOUT_MS → timeout de las llamadas (default 15000)
 */

const PROXY_BASE = (import.meta.env.VITE_METABASE_PROXY_URL || 'https://ipa.donnet.com.ar/api').replace(/\/+$/, '');
const TIMEOUT_MS = parseInt(import.meta.env.VITE_METABASE_TIMEOUT_MS || '15000', 10);

export interface MetabaseUsuario {
  id: string;        // usuariosaccesoid (identificador en UsuariosAccesos)
  nombre: string;    // login/código del usuario
  area: string;      // descripción del acceso/área
  perfil: string;
  ubicacionid: string;
  estado: string;    // activo | inactivo
}

export class ProxyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
  }
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${PROXY_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ProxyError(`Timeout del proxy (${TIMEOUT_MS} ms)`);
    throw new ProxyError(`No se pudo conectar al proxy (${PROXY_BASE}): ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ProxyError(`Respuesta no JSON del proxy (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || json?.error) {
    throw new ProxyError(json?.message || json?.error || `El proxy respondió HTTP ${res.status}`, res.status);
  }
  return json as T;
}

/** Lista/busca usuarios de UsuariosAccesos vía el proxy (?q= sobre la caché del backend). */
export async function getUsuarios(q = ''): Promise<MetabaseUsuario[]> {
  const url = `/usuarios${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const json = await fetchJson<{ success: boolean; count: number; data: MetabaseUsuario[] }>(url);
  return json.data || [];
}

/** Fuerza recarga de la caché de usuarios en el proxy. */
export async function refreshUsuarios(): Promise<{ count: number }> {
  const json = await fetchJson<{ success: boolean; message: string; cache?: { count: number } }>(
    '/usuarios/refresh',
    { method: 'POST' }
  );
  return { count: json.cache?.count ?? 0 };
}

/** Healthcheck del proxy (para mostrar aviso si la red interna no responde). */
export async function checkProxy(): Promise<boolean> {
  try {
    await fetchJson('/health');
    return true;
  } catch {
    return false;
  }
}
