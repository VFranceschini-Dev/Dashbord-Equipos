/**
 * api/mesh.ts — Función serverless de Vercel (runtime Node).
 *
 * GET /api/mesh → lista las PC y notebooks del servidor de monitoreo remoto
 *                 (MeshCentral), SOLO LECTURA: nunca envía órdenes a los equipos.
 * GET /api/mesh?estado=1 → solo indica si está configurado y a qué servidor
 *                 apunta (sin conectarse y sin revelar el usuario).
 * GET /api/mesh?nodo=<id> → detalle de un equipo: sistema, hardware, redes,
 *                 antivirus y usuario activo de Windows.
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
const GRACIA_DETALLE_MS = 5000;

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
  lastbootuptime?: number;
  users?: string[];
  av?: { product?: string; enabled?: boolean; updated?: boolean }[];
}

export interface DetalleMesh {
  meshNodeId: string;
  nombre: string;
  enLinea: boolean;
  so: string;
  versionSo: string;
  arquitectura: string;
  ultimoArranque: string | null; // ISO
  fabricante: string;
  modelo: string;
  serial: string;
  procesador: string;
  memoriaGb: number | null;
  discos: { nombre: string; tamanoGb: number | null }[];
  redes: { nombre: string; ipv4: string[]; mac: string }[];
  ipPrincipal: string;
  antivirus: { nombre: string; activo: boolean | null; actualizado: boolean | null }[];
  usuariosActivos: string[];
}

/**
 * Abre una sesión de solo lectura, envía los pedidos y junta las respuestas
 * por acción. Termina cuando llegaron todas las esperadas; las "requeridas"
 * son obligatorias y, una vez que están, se espera como máximo `graciaMs`
 * por las demás (algunos servidores no responden todas las acciones).
 */
function sesionMesh(
  url: string, usuario: string, clave: string,
  pedidos: Record<string, unknown>[], requeridas: string[], graciaMs: number,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const wsUrl = `${url.replace(/^http/i, 'ws').replace(/\/+$/, '')}/control.ashx`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        'x-meshauth': `${Buffer.from(usuario).toString('base64')},${Buffer.from(clave).toString('base64')}`,
      },
      handshakeTimeout: TIMEOUT_MS,
    });

    const esperadas = pedidos.map(p => String(p.action));
    const respuestas: Record<string, any> = {};
    let terminado = false;
    let gracia: NodeJS.Timeout | undefined;
    const tieneRequeridas = () => requeridas.every(a => a in respuestas);

    const fin = (err?: Error & { status?: number }) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      clearTimeout(gracia);
      try { ws.close(); } catch { /* ya cerrado */ }
      if (err) reject(err);
      else resolve(respuestas);
    };
    // detalle: causa técnica del fallo, sin credenciales (se muestra al usuario para diagnóstico)
    const error = (mensaje: string, status: number, detalle: string) =>
      Object.assign(new Error(mensaje), { status, detalle: detalle.slice(0, 120) });

    const limite = setTimeout(() => fin(error('timeout', 504, `sin respuesta en ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS);

    ws.on('open', () => {
      for (const p of pedidos) ws.send(JSON.stringify({ ...p, responseid: p.action }));
    });

    ws.on('message', raw => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg?.action === 'close' || msg?.cause === 'noauth') {
        fin(error('autenticación rechazada', 401, `servidor: ${msg?.cause || msg?.msg || 'close'}`));
        return;
      }
      if (!esperadas.includes(msg?.action)) return;
      respuestas[msg.action] = msg;
      if (esperadas.every(a => a in respuestas)) fin();
      else if (tieneRequeridas() && !gracia) gracia = setTimeout(() => fin(), graciaMs);
    });

    ws.on('unexpected-response', (_req, res) => {
      const server = res.headers['server'] ? `, server: ${res.headers['server']}` : '';
      fin(error(`HTTP ${res.statusCode}`, res.statusCode === 401 || res.statusCode === 403 ? 401 : 502,
        `HTTP ${res.statusCode}${server}`));
    });
    ws.on('error', err => fin(error('no se pudo conectar', 502, (err as NodeJS.ErrnoException).code || err.message)));
    ws.on('close', (code, reason) => {
      if (tieneRequeridas()) fin();
      else fin(error('la conexión se cerró antes de recibir datos', 401,
        `cerró la conexión sin datos, código ${code}${reason.length ? `: ${reason.toString()}` : ''}`));
    });
  });
}

interface RespuestaMesh {
  nodos: (NodoMesh & { grupo: string })[];
  ultimasConexiones: Record<string, number>;
}

/** Lista de equipos: grupos + nodos (+ últimas conexiones, si el servidor las informa). */
async function consultarMesh(url: string, usuario: string, clave: string): Promise<RespuestaMesh> {
  const r = await sesionMesh(url, usuario, clave,
    [{ action: 'meshes' }, { action: 'nodes' }, { action: 'lastconnects' }],
    ['meshes', 'nodes'], GRACIA_LASTCONNECTS_MS);
  const grupos: Record<string, string> = Object.fromEntries(
    (Array.isArray(r.meshes?.meshes) ? r.meshes.meshes : []).map((m: any) => [String(m._id), String(m.name ?? '')]));
  const nodosPorGrupo: Record<string, NodoMesh[]> =
    r.nodes?.nodes && typeof r.nodes.nodes === 'object' ? r.nodes.nodes : {};
  const nodos = Object.entries(nodosPorGrupo).flatMap(([meshId, lista]) =>
    (Array.isArray(lista) ? lista : []).map(n => ({ ...n, grupo: grupos[meshId] || '' })));
  const ultimasConexiones = r.lastconnects?.lastconnects && typeof r.lastconnects.lastconnects === 'object'
    ? r.lastconnects.lastconnects : {};
  return { nodos, ultimasConexiones };
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

/**
 * Sector: primera parte del nombre (ADM-PFERNANDEZ2 → adm). Si el nombre empieza
 * con el tipo de equipo (NOTE-, PC-), el sector es la segunda parte
 * (PC-RECEP-CENTRAL → recep). Sin guion, el grupo de dispositivos.
 */
const PREFIJOS_DE_TIPO = ['note', 'pc'];

function sectorDe(nombre: string, grupo: string): string {
  const partes = nombre.split('-').map(p => p.trim().toLowerCase()).filter(Boolean);
  if (partes.length < 2) return grupo;
  return PREFIJOS_DE_TIPO.includes(partes[0]) ? partes[1] : partes[0];
}

// ---------------------------------------------------------------------------
// Detalle de un equipo (los datos varían según la versión del agente: todo es opcional)
// ---------------------------------------------------------------------------
const VALOR_BASURA = /^(to be filled by o\.?e\.?m\.?|default string|system (product name|serial number|manufacturer)|not applicable|none|0+|n\/a)$/i;

function primero(...valores: unknown[]): string {
  for (const v of valores) {
    const t = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
    if (t && !VALOR_BASURA.test(t)) return t;
  }
  return '';
}

function aGb(bytes: unknown): number | null {
  const n = typeof bytes === 'string' ? Number(bytes) : typeof bytes === 'number' ? bytes : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round((n / 1024 ** 3) * 10) / 10 : null;
}

/** Fecha WMI (20261029101540.500000-180), ISO o milisegundos → ISO. */
function aFecha(v: unknown): string | null {
  if (typeof v === 'number' && v > 0) return new Date(v).toISOString();
  if (typeof v !== 'string' || !v) return null;
  // WMI: el sufijo es el desfasaje en minutos respecto de UTC (-180 = Argentina)
  const wmi = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?([+-]\d{1,4})?$/);
  let d: Date;
  if (wmi) {
    const minutos = Number(wmi[7] ?? 0);
    const offset = `${minutos < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutos) / 60)).padStart(2, '0')}:${String(Math.abs(minutos) % 60).padStart(2, '0')}`;
    d = new Date(`${wmi[1]}-${wmi[2]}-${wmi[3]}T${wmi[4]}:${wmi[5]}:${wmi[6]}${offset}`);
  } else {
    d = new Date(v);
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ipUtil(ip: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('127.') && !ip.startsWith('169.254.');
}

function armarDetalle(nodo: NodoMesh, sys: any, net: any): DetalleMesh {
  const hw = sys?.hardware ?? sys?.data?.hardware ?? {};
  const id = hw.identifiers ?? {};
  const win = hw.windows ?? {};
  const os = win.osinfo ?? {};

  const memoriaBytes = Array.isArray(win.memory)
    ? win.memory.reduce((t: number, m: any) => t + (Number(m?.Capacity) || 0), 0)
    : 0;
  const discosFuente: any[] = Array.isArray(win.drives) ? win.drives
    : Array.isArray(id.storage_devices) ? id.storage_devices : [];

  // Redes: formato nuevo (netif2: { nombre: [direcciones] }) o anterior (netif: [...])
  const redes: DetalleMesh['redes'] = [];
  const netif2 = net?.netif2 ?? net?.netinfo?.netif2;
  if (netif2 && typeof netif2 === 'object') {
    for (const [nombre, dirs] of Object.entries(netif2)) {
      const lista = Array.isArray(dirs) ? dirs as any[] : [];
      const ipv4 = lista.filter(d => d?.family === 'IPv4' || d?.family === 4).map(d => String(d.address || ''));
      const mac = primero(...lista.map(d => d?.mac));
      redes.push({ nombre, ipv4: ipv4.filter(Boolean), mac });
    }
  } else if (Array.isArray(net?.netif)) {
    for (const i of net.netif) redes.push({ nombre: String(i?.name ?? ''), ipv4: [i?.v4addr].filter(Boolean).map(String), mac: String(i?.mac ?? '') });
  }
  const ipPrincipal = redes.flatMap(r => r.ipv4).find(ipUtil) || '';

  return {
    meshNodeId: nodo._id,
    nombre: String(nodo.name || nodo.host || nodo._id),
    enLinea: ((nodo.conn ?? 0) & 1) === 1,
    so: primero(os.Caption, nodo.osdesc),
    versionSo: primero(os.Version, os.BuildNumber),
    arquitectura: primero(os.OSArchitecture),
    ultimoArranque: aFecha(os.LastBootUpTime) ?? aFecha(nodo.lastbootuptime),
    fabricante: primero(id.sys_vendor, id.product_vendor, id.board_vendor, id.bios_vendor),
    modelo: primero(id.product_name, id.product_version, id.board_name),
    serial: primero(id.product_serial, id.bios_serial, id.board_serial),
    procesador: primero(id.cpu_name, Array.isArray(win.cpu) ? win.cpu[0]?.Name : ''),
    memoriaGb: aGb(memoriaBytes),
    discos: discosFuente.map(d => ({ nombre: primero(d?.Caption, d?.Model, d?.Name), tamanoGb: aGb(d?.Size) }))
      .filter(d => d.nombre || d.tamanoGb),
    redes: redes.filter(r => r.ipv4.length || r.mac),
    ipPrincipal,
    antivirus: (Array.isArray(nodo.av) ? nodo.av : []).map(a => ({
      nombre: String(a?.product ?? ''),
      activo: typeof a?.enabled === 'boolean' ? a.enabled : null,
      actualizado: typeof a?.updated === 'boolean' ? a.updated : null,
    })).filter(a => a.nombre),
    usuariosActivos: Array.isArray(nodo.users) ? nodo.users.map(String) : [],
  };
}

async function consultarDetalle(url: string, usuario: string, clave: string, nodeId: string): Promise<DetalleMesh | null> {
  const r = await sesionMesh(url, usuario, clave,
    [{ action: 'nodes' }, { action: 'getsysinfo', nodeid: nodeId, nodeinfo: true }, { action: 'getnetworkinfo', nodeid: nodeId }],
    ['nodes'], GRACIA_DETALLE_MS);
  const todos: NodoMesh[] = Object.values(r.nodes?.nodes ?? {}).flatMap(l => (Array.isArray(l) ? l : []) as NodoMesh[]);
  const nodo = todos.find(n => n._id === nodeId);
  if (!nodo) return null;
  const sys = r.getsysinfo?.nodeid === nodeId ? (r.getsysinfo.data ?? r.getsysinfo) : null;
  const net = r.getnetworkinfo?.nodeid === nodeId ? r.getnetworkinfo : null;
  return armarDetalle(nodo, sys, net);
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

  if (new URL(request.url).searchParams.get('estado') === '1') {
    let host = '';
    try { host = url ? new URL(url).host : ''; } catch { /* URL inválida: queda vacío */ }
    return jsonResponse(200, { success: true, configurado: Boolean(url && usuario && clave), host });
  }

  if (!url || !usuario || !clave) {
    return jsonResponse(500, { success: false, error: 'Falta configuración del servidor de monitoreo.' });
  }

  const nodo = new URL(request.url).searchParams.get('nodo');
  if (nodo !== null && !/^node\/[\w@$/+=-]{1,200}$/.test(nodo)) {
    return jsonResponse(400, { success: false, error: 'Identificador de equipo inválido.' });
  }

  let respuesta: RespuestaMesh;
  try {
    if (nodo) {
      const detalle = await consultarDetalle(url, usuario, clave, nodo);
      if (!detalle) return jsonResponse(404, { success: false, error: 'El equipo ya no figura en el servidor de monitoreo.' });
      return jsonResponse(200, { success: true, data: detalle });
    }
    respuesta = await consultarMesh(url, usuario, clave);
  } catch (err) {
    const { status = 502, detalle = '' } = err as { status?: number; detalle?: string };
    console.error('[api/mesh] fallo al consultar:', detalle || (err as Error).message);
    const extra = detalle ? ` (${detalle})` : '';
    if (status === 401) return jsonResponse(502, { success: false, error: `El servidor de monitoreo rechazó las credenciales${extra}.` });
    if (status === 504) return jsonResponse(504, { success: false, error: `El servidor de monitoreo no respondió a tiempo${extra}.` });
    return jsonResponse(502, { success: false, error: `No se pudo conectar con el servidor de monitoreo${extra}.` });
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
