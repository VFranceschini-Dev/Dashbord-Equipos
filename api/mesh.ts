/**
 * api/mesh.ts — Función serverless de Vercel (runtime Node).
 *
 * GET /api/mesh → lista las PC y notebooks del servidor de monitoreo remoto
 *                 (MeshCentral), SOLO LECTURA: nunca envía órdenes a los equipos.
 *
 * Respuesta: { success, total, ignorados, data: EquipoMesh[] }
 *
 * Variables de entorno (Vercel > Settings > Environment Variables):
 *   MESH_URL   ej. https://mesh.ejemplo.com
 *   MESH_USER  usuario (o usuario de un Login Token) — solo servidor
 *   MESH_PASS  contraseña (o la del Login Token) — solo servidor
 *   SUPABASE_URL / SUPABASE_ANON_KEY  validación de sesión (fallback: VITE_*)
 */
import WebSocket from 'ws';

export interface EquipoMesh {
  meshNodeId: string;
  nombre: string;
  tipo: 'desktop' | 'laptop';
  so: string;
  ip: string;
  sector: string;
  enLinea: boolean;
  ultimaConexion: string | null; // ISO
}

const TIMEOUT_MS = 20000;
const GRACIA_LASTCONNECTS_MS = 2500;

// Iconos de MeshCentral: el agente informa si el equipo es de escritorio o portátil.
const ICONO_ESCRITORIO = 1;
const ICONO_NOTEBOOK = 2;
const ICONO_VIRTUAL = 6;

function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

// ---------------------------------------------------------------------------
// Validación de sesión (Bearer token → endpoint de autenticación)
// ---------------------------------------------------------------------------
async function validateSession(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return false;

  const baseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!baseUrl || !anonKey) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Consulta a MeshCentral por WebSocket (control.ashx + cabecera x-meshauth)
// ---------------------------------------------------------------------------
interface NodoMesh {
  _id: string;
  name?: string;
  host?: string;
  ip?: string;
  osdesc?: string;
  icon?: number;
  conn?: number;
  lastconnect?: number;
}

interface RespuestaMesh {
  nodos: (NodoMesh & { grupo: string })[];
  ultimasConexiones: Record<string, number>;
}

function consultarMesh(url: string, usuario: string, clave: string): Promise<RespuestaMesh> {
  return new Promise((resolve, reject) => {
    const wsUrl = `${url.replace(/^http/i, 'ws').replace(/\/+$/, '')}/control.ashx`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        'x-meshauth': `${Buffer.from(usuario).toString('base64')},${Buffer.from(clave).toString('base64')}`,
      },
      handshakeTimeout: TIMEOUT_MS,
    });

    let grupos: Record<string, string> | null = null;
    let nodosPorGrupo: Record<string, NodoMesh[]> | null = null;
    let ultimasConexiones: Record<string, number> = {};
    let terminado = false;
    let gracia: NodeJS.Timeout | undefined;

    const fin = (err?: Error & { status?: number }) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      clearTimeout(gracia);
      try { ws.close(); } catch { /* ya cerrado */ }
      if (err) { reject(err); return; }
      const nodos = Object.entries(nodosPorGrupo || {}).flatMap(([meshId, lista]) =>
        (lista || []).map(n => ({ ...n, grupo: grupos?.[meshId] || '' })));
      resolve({ nodos, ultimasConexiones });
    };
    const error = (mensaje: string, status: number) => Object.assign(new Error(mensaje), { status });

    const limite = setTimeout(() => fin(error('timeout', 504)), TIMEOUT_MS);

    // Con grupos y nodos alcanza; se espera un instante por las últimas conexiones (opcional).
    const quizasTerminar = () => {
      if (grupos && nodosPorGrupo && !gracia) gracia = setTimeout(() => fin(), GRACIA_LASTCONNECTS_MS);
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'meshes', responseid: 'meshes' }));
      ws.send(JSON.stringify({ action: 'nodes', responseid: 'nodes' }));
      ws.send(JSON.stringify({ action: 'lastconnects', responseid: 'lastconnects' }));
    });

    ws.on('message', raw => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg?.action === 'close' || msg?.cause === 'noauth') {
        fin(error('autenticación rechazada', 401));
      } else if (msg?.action === 'meshes' && Array.isArray(msg.meshes)) {
        grupos = Object.fromEntries(msg.meshes.map((m: any) => [String(m._id), String(m.name ?? '')]));
        quizasTerminar();
      } else if (msg?.action === 'nodes' && msg.nodes && typeof msg.nodes === 'object') {
        nodosPorGrupo = msg.nodes;
        quizasTerminar();
      } else if (msg?.action === 'lastconnects' && msg.lastconnects && typeof msg.lastconnects === 'object') {
        ultimasConexiones = msg.lastconnects;
        if (grupos && nodosPorGrupo) fin();
      }
    });

    ws.on('unexpected-response', (_req, res) => {
      fin(error(`HTTP ${res.statusCode}`, res.statusCode === 401 || res.statusCode === 403 ? 401 : 502));
    });
    ws.on('error', () => fin(error('no se pudo conectar', 502)));
    ws.on('close', () => {
      if (grupos && nodosPorGrupo) fin();
      else fin(error('la conexión se cerró antes de recibir datos (¿credenciales?)', 401));
    });
  });
}

// ---------------------------------------------------------------------------
// Clasificación: solo PC y notebooks (se ignoran servidores, celulares, etc.)
// ---------------------------------------------------------------------------
function clasificar(n: NodoMesh): EquipoMesh['tipo'] | null {
  const so = (n.osdesc || '').toLowerCase();
  if (/server|android|ios|ipados/.test(so)) return null;
  if (n.icon === ICONO_NOTEBOOK) return 'laptop';
  if (n.icon === ICONO_ESCRITORIO || n.icon === ICONO_VIRTUAL || n.icon === undefined) return 'desktop';
  return null; // teléfono, servidor, router, etc.
}

/** Sector: primera parte del nombre (adm-pfernandez2 → adm); si no hay guion, el grupo. */
function sectorDe(nombre: string, grupo: string): string {
  const i = nombre.indexOf('-');
  return i > 0 ? nombre.slice(0, i).toLowerCase() : grupo;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: Request): Promise<Response> {
  if (!(await validateSession(request))) {
    return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });
  }

  const url = env('MESH_URL');
  const usuario = env('MESH_USER');
  const clave = env('MESH_PASS');
  if (!url || !usuario || !clave) {
    return jsonResponse(500, { success: false, error: 'Falta configuración del servidor de monitoreo.' });
  }

  let respuesta: RespuestaMesh;
  try {
    respuesta = await consultarMesh(url, usuario, clave);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    if (status === 401) return jsonResponse(502, { success: false, error: 'El servidor de monitoreo rechazó las credenciales.' });
    if (status === 504) return jsonResponse(504, { success: false, error: 'El servidor de monitoreo no respondió a tiempo.' });
    return jsonResponse(502, { success: false, error: 'No se pudo conectar con el servidor de monitoreo.' });
  }

  const data: EquipoMesh[] = [];
  let ignorados = 0;
  for (const n of respuesta.nodos) {
    const tipo = clasificar(n);
    if (!tipo || !n._id) { ignorados++; continue; }
    const nombre = String(n.name || n.host || n._id);
    const ultima = respuesta.ultimasConexiones[n._id] ?? n.lastconnect;
    data.push({
      meshNodeId: n._id,
      nombre,
      tipo,
      so: n.osdesc || '',
      ip: n.ip || n.host || '',
      sector: sectorDe(nombre, n.grupo),
      enLinea: ((n.conn ?? 0) & 1) === 1,
      ultimaConexion: typeof ultima === 'number' && ultima > 0 ? new Date(ultima).toISOString() : null,
    });
  }
  data.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return jsonResponse(200, { success: true, total: data.length, ignorados, data });
}
