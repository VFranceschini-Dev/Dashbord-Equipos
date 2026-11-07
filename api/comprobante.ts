/**
 * api/comprobante.ts — Comprobantes de entrega con firma electrónica.
 *
 * POST { accion: 'crear', movementId, correo }   (requiere sesión)
 *      Crea el comprobante de una asignación: guarda una copia fija del
 *      contenido (equipo, usuario, responsable y su firma), su huella SHA-256
 *      y un enlace secreto para firmar. Si ya existe, devuelve el mismo.
 * GET  ?token=...[&interno=1]                     (público, con el enlace)
 *      Devuelve el comprobante para mostrarlo y, si está firmado, la firma.
 *      La primera vez que lo abre el usuario (sin interno=1) queda registrado
 *      como "visto" y se avisa en el ticket.
 * POST { accion: 'firmar', token, nombre, dni, fuente, acepto }   (público)
 *      Registra la firma tipográfica del usuario con fecha, IP y huella.
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY: el navegador nunca escribe en la tabla.
 *
 * Envío por Zammad (opcional; si falta configuración, el comprobante se crea
 * igual y el enlace se puede copiar desde la app):
 *   ZAMMAD_URL    ej. https://soporte.ejemplo.com
 *   ZAMMAD_TOKEN  token de acceso (permiso ticket.agent) — solo servidor
 *   ZAMMAD_GROUP  grupo donde se crean los tickets (nombre exacto)
 *   ZAMMAD_CERRAR_AL_FIRMAR  "si" para cerrar el ticket cuando el usuario firma
 *   APP_URL       opcional: dirección pública de la app para el enlace
 */
import { createHash, randomBytes } from 'node:crypto';

const TIMEOUT_MS = 15000;
const FUENTES_VALIDAS = ['dancing', 'greatvibes', 'allura', 'caveat'];

export const TEXTO_CONFORMIDAD =
  'Recibo el equipamiento detallado en condiciones de funcionamiento y me comprometo a darle un uso '
  + 'adecuado, exclusivamente para tareas laborales, a cuidarlo y a devolverlo cuando me sea requerido o '
  + 'al finalizar la relación laboral. Ante pérdida, robo o daño me comprometo a informarlo de inmediato '
  + 'al área de Sistemas.';

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

async function fetchConTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Acceso a la base (REST con service_role) y sesión
// ---------------------------------------------------------------------------
function base(): { url: string; key: string; anon: string } | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const anon = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!url || !key || !anon) return null;
  return { url: url.replace(/\/+$/, ''), key, anon };
}

async function rest(b: NonNullable<ReturnType<typeof base>>, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetchConTimeout(`${b.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: b.key,
      Authorization: `Bearer ${b.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

/** Devuelve el usuario de la sesión (id y email) o null. */
async function usuarioDeSesion(request: Request, b: NonNullable<ReturnType<typeof base>>): Promise<{ id: string; email: string } | null> {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  try {
    const res = await fetchConTimeout(`${b.url}/auth/v1/user`, { headers: { apikey: b.anon, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? { id: String(u.id), email: String(u.email || '') } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Huellas
// ---------------------------------------------------------------------------
/** JSON con claves ordenadas: la misma información siempre produce la misma huella. */
function jsonEstable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${jsonEstable((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

// ---------------------------------------------------------------------------
// Zammad: el ticket envía el email al usuario y avisa al grupo cuando firma
// ---------------------------------------------------------------------------
function zammad(): { url: string; token: string; grupo: string; cerrar: boolean } | null {
  const url = env('ZAMMAD_URL');
  const token = env('ZAMMAD_TOKEN');
  const grupo = env('ZAMMAD_GROUP');
  if (!url || !token || !grupo) return null;
  return { url: url.replace(/\/+$/, ''), token, grupo, cerrar: /^(si|sí|true|1)$/i.test(env('ZAMMAD_CERRAR_AL_FIRMAR') || '') };
}

async function llamarZammad(z: NonNullable<ReturnType<typeof zammad>>, path: string, method: string, body: unknown): Promise<any> {
  const res = await fetchConTimeout(`${z.url}/api/v1/${path}`, {
    method,
    headers: { Authorization: `Token token=${z.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const texto = await res.text();
  if (!res.ok) {
    let detalle = `HTTP ${res.status}`;
    try { const j = JSON.parse(texto); if (j?.error) detalle += `: ${j.error}`; } catch { /* sin detalle */ }
    throw new Error(detalle.slice(0, 160));
  }
  return texto ? JSON.parse(texto) : null;
}

const html = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function urlPublica(request: Request): string {
  return (env('APP_URL') || new URL(request.url).origin).replace(/\/+$/, '');
}

/** Crea el ticket que le envía al usuario el enlace para firmar. Nunca lanza: devuelve el resultado. */
async function enviarPorZammad(
  request: Request, b: NonNullable<ReturnType<typeof base>>,
  c: { id: string; token: string; datos: any; correo_destino: string },
): Promise<{ enviado: boolean; ticket?: string; error?: string }> {
  const z = zammad();
  if (!z) return { enviado: false, error: 'el envío por email no está configurado' };
  const enlace = `${urlPublica(request)}/firmar/${c.token}`;
  const d = c.datos;
  const equipo = [d.equipo?.nombre, d.equipo?.marca, d.equipo?.modelo].filter(Boolean).join(' · ');
  const cuerpo = `<p>Hola ${html(d.usuario?.nombre || '')}:</p>
<p>El área de Sistemas te entregó el siguiente equipamiento:</p>
<p><strong>${html(equipo)}</strong>${d.equipo?.serial ? `<br>Serial: ${html(d.equipo.serial)}` : ''}</p>
<p>Para confirmar la recepción, firmá el comprobante de entrega desde este enlace:</p>
<p><a href="${enlace}">${enlace}</a></p>
<p>Si tenés alguna consulta, respondé este correo.</p>
<p>Sistemas ${html(d.empresa || '')}</p>`;
  try {
    const ticket = await llamarZammad(z, 'tickets', 'POST', {
      title: `Comprobante de entrega – ${d.equipo?.nombre || 'equipo'} – ${d.usuario?.nombre || ''}`.slice(0, 250),
      group: z.grupo,
      customer_id: `guess:${c.correo_destino}`,
      article: {
        subject: `Comprobante de entrega de equipamiento: ${d.equipo?.nombre || ''}`.slice(0, 250),
        body: cuerpo,
        content_type: 'text/html',
        type: 'email',
        internal: false,
        to: c.correo_destino,
      },
    });
    if (!ticket?.id) return { enviado: false, error: 'Zammad no devolvió el ticket' };
    await rest(b, `comprobantes_entrega?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ zammad_ticket_id: ticket.id }) });
    return { enviado: true, ticket: String(ticket.number ?? ticket.id) };
  } catch (err) {
    console.error('[api/comprobante] envío por Zammad:', (err as Error).message);
    return { enviado: false, error: `no se pudo crear el ticket (${(err as Error).message})` };
  }
}

/** Nota interna en el ticket. Nunca lanza. */
async function notaEnTicket(ticketId: number, asunto: string, cuerpo: string): Promise<void> {
  const z = zammad();
  if (!z) return;
  try {
    await llamarZammad(z, 'ticket_articles', 'POST', {
      ticket_id: ticketId, subject: asunto, body: cuerpo, content_type: 'text/html', type: 'note', internal: true,
    });
  } catch (err) {
    console.error('[api/comprobante] nota en Zammad:', (err as Error).message);
  }
}

const fechaAr = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

/** Avisa en el ticket que el usuario firmó (y lo cierra si está configurado). Nunca lanza. */
async function avisarFirma(ticketId: number, nombre: string, fechaIso: string): Promise<void> {
  const z = zammad();
  if (!z) return;
  await notaEnTicket(ticketId, 'Comprobante firmado',
    `<p>${html(nombre)} firmó el comprobante de entrega el ${fechaAr(fechaIso)}.</p>`);
  if (!z.cerrar) return;
  try {
    await llamarZammad(z, `tickets/${ticketId}`, 'PUT', { state: 'closed' });
  } catch (err) {
    console.error('[api/comprobante] cierre del ticket en Zammad:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function crear(request: Request, body: any): Promise<Response> {
  const b = base();
  if (!b) return jsonResponse(500, { success: false, error: 'Falta configuración del servidor.' });
  const sesion = await usuarioDeSesion(request, b);
  if (!sesion) return jsonResponse(401, { success: false, error: 'No autenticado. Se requiere una sesión válida.' });

  const movementId = Number(body?.movementId);
  const correo = String(body?.correo ?? '').trim().toLowerCase();
  if (!Number.isInteger(movementId) || movementId <= 0) return jsonResponse(400, { success: false, error: 'Movimiento inválido.' });
  if (!EMAIL_RE.test(correo)) return jsonResponse(400, { success: false, error: 'El correo del usuario no es válido.' });

  // ¿Ya existe? (un comprobante por movimiento)
  const existentes = await rest(b, `comprobantes_entrega?movement_id=eq.${movementId}&select=id,token,estado,datos,correo_destino,zammad_ticket_id`);
  const previo = Array.isArray(existentes) ? existentes[0] : null;
  if (previo) {
    // Ya existe: si no se pudo enviar antes y sigue pendiente, se reintenta el envío.
    const envio = !previo.zammad_ticket_id && previo.estado === 'pendiente'
      ? await enviarPorZammad(request, b, { ...previo, correo_destino: previo.correo_destino || correo })
      : { enviado: Boolean(previo.zammad_ticket_id) };
    return jsonResponse(200, { success: true, data: { id: previo.id, token: previo.token, estado: previo.estado, ...envio } });
  }

  const [mov] = await rest(b, `equipment_movements?id=eq.${movementId}&select=*`) ?? [];
  if (!mov || mov.user_id !== sesion.id) return jsonResponse(404, { success: false, error: 'No se encontró el movimiento.' });
  if (mov.tipo !== 'asignacion') return jsonResponse(400, { success: false, error: 'Solo las asignaciones generan comprobante.' });

  const [eq] = await rest(b, `equipments?id=eq.${mov.equipment_id}&select=name,type,brand,model,serial_number,asset_tag`) ?? [];
  const [firma] = await rest(b, `firmas_responsables?user_id=eq.${sesion.id}&select=nombre,dni,fuente`) ?? [];
  if (!firma) return jsonResponse(400, { success: false, error: 'Configurá tu firma ("Mi firma") antes de generar comprobantes.' });

  const datos = {
    version: 1,
    empresa: 'Donnet',
    fecha: mov.fecha,
    equipo: {
      nombre: eq?.name ?? '',
      tipo: eq?.type ?? '',
      marca: eq?.brand ?? '',
      modelo: eq?.model ?? '',
      serial: eq?.serial_number ?? '',
      etiqueta: eq?.asset_tag ?? '',
    },
    usuario: { nombre: mov.usuario_nombre ?? '', area: mov.usuario_area ?? '', correo },
    responsable: { nombre: firma.nombre, dni: firma.dni, fuente: firma.fuente, correo: sesion.email },
    observaciones: mov.observaciones ?? '',
    conformidad: TEXTO_CONFORMIDAD,
  };

  const [creado] = await rest(b, 'comprobantes_entrega', {
    method: 'POST',
    body: JSON.stringify({
      user_id: sesion.id,
      movement_id: movementId,
      token: randomBytes(24).toString('base64url'),
      datos,
      hash_documento: sha256(jsonEstable(datos)),
      correo_destino: correo,
    }),
  }) ?? [];
  const envio = await enviarPorZammad(request, b, creado);
  return jsonResponse(201, { success: true, data: { id: creado.id, token: creado.token, estado: creado.estado, ...envio } });
}

async function firmar(request: Request, body: any): Promise<Response> {
  const b = base();
  if (!b) return jsonResponse(500, { success: false, error: 'Falta configuración del servidor.' });

  const token = String(body?.token ?? '');
  const nombre = String(body?.nombre ?? '').trim().replace(/\s+/g, ' ');
  const dni = String(body?.dni ?? '').replace(/\D/g, '');
  const fuente = String(body?.fuente ?? '');
  if (!/^[\w-]{20,64}$/.test(token)) return jsonResponse(400, { success: false, error: 'Enlace inválido.' });
  if (!/^[\p{L}\p{M} .'-]{3,120}$/u.test(nombre)) return jsonResponse(400, { success: false, error: 'Escribí tu nombre y apellido.' });
  if (!/^\d{7,8}$/.test(dni)) return jsonResponse(400, { success: false, error: 'El DNI debe tener 7 u 8 números.' });
  if (!FUENTES_VALIDAS.includes(fuente)) return jsonResponse(400, { success: false, error: 'Elegí un tipo de letra.' });
  if (body?.acepto !== true) return jsonResponse(400, { success: false, error: 'Tenés que aceptar el texto de conformidad.' });

  const [c] = await rest(b, `comprobantes_entrega?token=eq.${token}&select=id,estado,datos,hash_documento,zammad_ticket_id`) ?? [];
  if (!c) return jsonResponse(404, { success: false, error: 'El comprobante no existe.' });
  if (c.estado !== 'pendiente') return jsonResponse(409, { success: false, error: 'Este comprobante ya fue firmado.' });
  if (sha256(jsonEstable(c.datos)) !== c.hash_documento) {
    return jsonResponse(409, { success: false, error: 'El comprobante fue modificado y no se puede firmar. Contactá a Sistemas.' });
  }

  const firmadoAt = new Date().toISOString();
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '';
  const actualizado = await rest(b, `comprobantes_entrega?token=eq.${token}&estado=eq.pendiente`, {
    method: 'PATCH',
    body: JSON.stringify({
      estado: 'firmado',
      firmado_nombre: nombre,
      firmado_dni: dni,
      firmado_fuente: fuente,
      firmado_at: firmadoAt,
      firmado_ip: ip,
      firmado_user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
      hash_firma: sha256(`${c.hash_documento}|${nombre}|${dni}|${fuente}|${firmadoAt}`),
    }),
  });
  if (!Array.isArray(actualizado) || actualizado.length === 0) {
    return jsonResponse(409, { success: false, error: 'Este comprobante ya fue firmado.' });
  }
  if (c.zammad_ticket_id) await avisarFirma(Number(c.zammad_ticket_id), nombre, firmadoAt);
  return jsonResponse(200, { success: true });
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
export async function GET(request: Request): Promise<Response> {
  const b = base();
  if (!b) return jsonResponse(500, { success: false, error: 'Falta configuración del servidor.' });
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[\w-]{20,64}$/.test(token)) return jsonResponse(400, { success: false, error: 'Enlace inválido.' });
  try {
    const [c] = await rest(b, `comprobantes_entrega?token=eq.${token}&select=id,estado,datos,hash_documento,created_at,firmado_nombre,firmado_dni,firmado_fuente,firmado_at,firmado_ip,hash_firma,visto_at,zammad_ticket_id`) ?? [];
    if (!c) return jsonResponse(404, { success: false, error: 'El comprobante no existe.' });

    // Primera apertura del usuario: se registra (no cuenta cuando Sistemas lo abre para verlo).
    const interno = new URL(request.url).searchParams.get('interno') === '1';
    if (!interno && c.estado === 'pendiente' && !c.visto_at) {
      const ahora = new Date().toISOString();
      const marcado = await rest(b, `comprobantes_entrega?token=eq.${token}&visto_at=is.null`, {
        method: 'PATCH', body: JSON.stringify({ visto_at: ahora }),
      }).catch(() => null);
      if (Array.isArray(marcado) && marcado.length > 0) {
        c.visto_at = ahora;
        if (c.zammad_ticket_id) {
          await notaEnTicket(Number(c.zammad_ticket_id), 'Comprobante visto',
            `<p>${html(c.datos?.usuario?.nombre || 'El usuario')} abrió el comprobante de entrega el ${fechaAr(ahora)}.</p>`);
        }
      }
    }
    delete c.zammad_ticket_id;
    return jsonResponse(200, { success: true, data: c });
  } catch {
    return jsonResponse(502, { success: false, error: 'No se pudo obtener el comprobante en este momento.' });
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Los datos enviados no son válidos.' });
  }
  try {
    if (body?.accion === 'crear') return await crear(request, body);
    if (body?.accion === 'firmar') return await firmar(request, body);
    return jsonResponse(400, { success: false, error: 'Acción desconocida.' });
  } catch (err) {
    console.error('[api/comprobante]', (err as Error).message);
    return jsonResponse(502, { success: false, error: 'No se pudo completar la operación. Intentá de nuevo más tarde.' });
  }
}
