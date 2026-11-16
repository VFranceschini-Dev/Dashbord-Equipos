/**
 * api/facturas-zammad.ts — Carga automática de facturas que llegan por email a Zammad.
 *
 * Zammad (Disparador → Webhook) llama a esta función cuando entra un email al
 * grupo de soporte. Si en el asunto, el texto o el nombre de un adjunto dice
 * "factura", se leen los adjuntos (PDF o imagen), se extraen los datos
 * (QR de AFIP → texto del PDF → GPT de OpenAI como respaldo), se guarda el archivo en
 * Storage ("facturas") y la factura queda PENDIENTE de revisión en
 * Proveedores → Facturas. En el ticket se deja una nota interna con el resultado.
 *
 * Seguridad:
 *   - El webhook se firma con un secreto (HMAC-SHA1, encabezado X-Hub-Signature).
 *     Sin firma válida no se hace nada.
 *   - Del aviso solo se usan los números de ticket y artículo: el email y los
 *     adjuntos se vuelven a leer desde Zammad con el token del servidor.
 *   - Si el mismo aviso llega dos veces, no se duplica la factura.
 *
 * Variables (Vercel):
 *   ZAMMAD_URL, ZAMMAD_TOKEN          (las mismas de los comprobantes)
 *   ZAMMAD_WEBHOOK_SECRET             secreto del webhook (el mismo que se carga en Zammad)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY                    opcional: lectura con GPT si el QR y el texto no alcanzan
 *   OPENAI_MODEL                      opcional: modelo de OpenAI (por defecto gpt-5.4-mini)
 *   FACTURAS_USER_ID                  opcional: usuario dueño de las facturas automáticas
 *                                     (si falta, el administrador activo más antiguo)
 *   CUIT_EMPRESA                      opcional: CUIT propio (por defecto el de PEDSA)
 *   APP_URL                           opcional: dirección de la app para el enlace de la nota
 */
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { extraerFactura, datosCompletos, type DatosFactura } from './_lib/factura.js';

const TIMEOUT_MS = 20000;
const MAX_ARCHIVO = 10 * 1024 * 1024;
const MAX_ADJUNTOS = 5;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
// Firma del webhook
// ---------------------------------------------------------------------------
export function firmaValida(cuerpo: string, encabezado: string | null, secreto: string): boolean {
  const recibida = (encabezado || '').trim().replace(/^sha1=/i, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(recibida)) return false;
  const esperada = createHmac('sha1', secreto).update(cuerpo, 'utf8').digest('hex');
  return timingSafeEqual(Buffer.from(recibida, 'hex'), Buffer.from(esperada, 'hex'));
}

// ---------------------------------------------------------------------------
// Zammad
// ---------------------------------------------------------------------------
function zammad(): { url: string; token: string } | null {
  const url = env('ZAMMAD_URL');
  const token = env('ZAMMAD_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function zGet(z: NonNullable<ReturnType<typeof zammad>>, path: string): Promise<Response> {
  const res = await fetchConTimeout(`${z.url}/api/v1/${path}`, { headers: { Authorization: `Token token=${z.token}` } });
  if (!res.ok) throw new Error(`Zammad respondió HTTP ${res.status} (${path.split('/')[0]})`);
  return res;
}

async function nota(z: NonNullable<ReturnType<typeof zammad>>, ticketId: number, cuerpo: string): Promise<void> {
  try {
    await fetchConTimeout(`${z.url}/api/v1/ticket_articles`, {
      method: 'POST',
      headers: { Authorization: `Token token=${z.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId, subject: 'Factura de proveedor', body: cuerpo,
        content_type: 'text/html', type: 'note', internal: true,
      }),
    });
  } catch (err) {
    console.error('[api/facturas-zammad] nota en Zammad:', (err as Error).message);
  }
}

const html = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const sinHtml = (t: string) => t.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');

/** ¿El email habla de una factura? (asunto, texto o nombre de algún adjunto). */
export function mencionaFactura(asunto: string, cuerpo: string, nombres: string[]): boolean {
  return [asunto, sinHtml(cuerpo), ...nombres].some(t => /factura/i.test(t || ''));
}

// ---------------------------------------------------------------------------
// Supabase (service_role)
// ---------------------------------------------------------------------------
function base(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

type Base = NonNullable<ReturnType<typeof base>>;

async function rest(b: Base, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetchConTimeout(`${b.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: b.key, Authorization: `Bearer ${b.key}`, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(init.headers || {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) {
    let code = '';
    try { code = JSON.parse(texto)?.code ?? ''; } catch { /* sin detalle */ }
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, code });
  }
  return texto ? JSON.parse(texto) : null;
}

async function subirArchivo(b: Base, nombre: string, tipo: string, datos: Uint8Array): Promise<string> {
  const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${new Date().getFullYear()}/${randomUUID()}-${limpio}`;
  const res = await fetchConTimeout(`${b.url}/storage/v1/object/facturas/${path}`, {
    method: 'POST',
    headers: { apikey: b.key, Authorization: `Bearer ${b.key}`, 'Content-Type': tipo, 'x-upsert': 'false' },
    body: new Uint8Array(datos),
  });
  if (!res.ok) throw new Error(`no se pudo guardar el archivo (HTTP ${res.status})`);
  return path;
}

async function borrarArchivo(b: Base, path: string): Promise<void> {
  try {
    await fetchConTimeout(`${b.url}/storage/v1/object/facturas/${path}`, {
      method: 'DELETE', headers: { apikey: b.key, Authorization: `Bearer ${b.key}` },
    });
  } catch { /* queda huérfano: no afecta a la factura */ }
}

/** Dueño de las facturas automáticas: FACTURAS_USER_ID o el administrador activo más antiguo. */
async function duenio(b: Base): Promise<string | null> {
  const fijo = env('FACTURAS_USER_ID');
  if (fijo) return fijo;
  const filas = await rest(b, 'perfiles_usuarios?select=id&rol=eq.admin&or=(activo.is.null,activo.eq.true)&order=created_at.asc&limit=1');
  return filas?.[0]?.id ?? null;
}

interface Proveedor { id: string; name: string; cuit: string | null; email: string | null }

function buscarProveedor(proveedores: Proveedor[], cuit: string, remitente: string): Proveedor | null {
  const dig = (s: string | null) => (s || '').replace(/\D/g, '');
  if (cuit) {
    const p = proveedores.find(x => dig(x.cuit) === cuit);
    if (p) return p;
  }
  const correo = (remitente.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || '').toLowerCase();
  if (correo) {
    const p = proveedores.find(x => (x.email || '').toLowerCase().split(/[,;\s]+/).includes(correo));
    if (p) return p;
    // Mismo dominio (ej. facturacion@proveedor.com.ar y ventas@proveedor.com.ar)
    const dominio = correo.split('@')[1];
    const genericos = /^(gmail|hotmail|outlook|yahoo|live)\./i;
    if (dominio && !genericos.test(dominio)) {
      const q = proveedores.filter(x => (x.email || '').toLowerCase().includes(`@${dominio}`));
      if (q.length === 1) return q[0];
    }
  }
  return null;
}

const FALTANTES: [keyof DatosFactura, string][] = [
  ['cuitEmisor', 'CUIT'], ['numero', 'número'], ['total', 'total'], ['fecha', 'fecha'], ['cae', 'CAE'],
];

const pesos = (n: number | null) => n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Proceso de un email
// ---------------------------------------------------------------------------
interface Resultado { archivo: string; estado: 'cargada' | 'duplicada' | 'ya_procesada' | 'error'; detalle: string }

export async function procesarArticulo(ticketId: number, articuloId: number): Promise<{ ignorado?: string; resultados: Resultado[] }> {
  const z = zammad();
  const b = base();
  if (!z || !b) throw new Error('Falta configurar Zammad o la base de datos en el servidor.');

  const articulo = await (await zGet(z, `ticket_articles/${articuloId}`)).json();
  if (Number(articulo.ticket_id) !== ticketId) return { ignorado: 'el artículo no corresponde al ticket', resultados: [] };
  if (articulo.internal || articulo.sender === 'Agent' || articulo.sender === 'System') {
    return { ignorado: 'no es un email recibido', resultados: [] };
  }
  const adjuntos: any[] = Array.isArray(articulo.attachments) ? articulo.attachments : [];
  const nombres = adjuntos.map(a => String(a.filename || ''));
  if (!mencionaFactura(String(articulo.subject || ''), String(articulo.body || ''), nombres)) {
    return { ignorado: 'el email no menciona una factura', resultados: [] };
  }

  const tipoDe = (a: any) => String(a.preferences?.['Content-Type'] || a.preferences?.['Mime-Type'] || '').split(';')[0].trim().toLowerCase()
    || (/\.pdf$/i.test(a.filename) ? 'application/pdf' : '');
  const candidatos = adjuntos.filter(a => TIPOS.includes(tipoDe(a)) && Number(a.size || 0) <= MAX_ARCHIVO);
  const hayPdf = candidatos.some(a => tipoDe(a) === 'application/pdf');
  // Imágenes solo si no hay PDF o si su nombre dice "factura" (evita logos y firmas del email)
  const aLeer = candidatos
    .filter(a => tipoDe(a) === 'application/pdf' || !hayPdf || /factura/i.test(a.filename))
    .filter(a => tipoDe(a) === 'application/pdf' || Number(a.size || 0) > 15_000)
    .slice(0, MAX_ADJUNTOS);

  if (!aLeer.length) {
    await nota(z, ticketId, 'El email menciona una factura pero no trae un PDF o imagen para leer. Cargala a mano en <b>Proveedores → Facturas</b>.');
    return { ignorado: 'sin adjuntos para leer', resultados: [] };
  }

  const userId = await duenio(b);
  if (!userId) throw new Error('No hay un administrador activo para registrar las facturas (FACTURAS_USER_ID).');
  const proveedores: Proveedor[] = await rest(b, 'suppliers?select=id,name,cuit,email') ?? [];
  const resultados: Resultado[] = [];

  for (const a of aLeer) {
    const nombre = String(a.filename || 'factura');
    try {
      // Mismo aviso repetido: no duplicar
      const previas = await rest(b, `vouchers?select=id&zammad_ticket_id=eq.${ticketId}&archivo_nombre=eq.${encodeURIComponent(nombre)}&limit=1`);
      if (previas?.length) { resultados.push({ archivo: nombre, estado: 'ya_procesada', detalle: '' }); continue; }

      const res = await zGet(z, `ticket_attachment/${ticketId}/${articuloId}/${a.id}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_ARCHIVO) { resultados.push({ archivo: nombre, estado: 'error', detalle: 'supera 10 MB' }); continue; }
      const tipo = tipoDe(a);
      const { datos } = await extraerFactura(bytes, tipo, nombre);
      // Un PDF que no parece factura y del que no se pudo leer nada (ej. un remito) se saltea
      if (!datos.fuentes.length) { resultados.push({ archivo: nombre, estado: 'error', detalle: 'no se pudieron leer datos de factura' }); continue; }

      const prov = buscarProveedor(proveedores, datos.cuitEmisor, String(articulo.from || ''));
      const faltan = FALTANTES.filter(([k]) => datos[k] == null || datos[k] === '').map(([, n]) => n);
      const path = await subirArchivo(b, nombre, tipo, bytes);
      const fila = {
        user_id: userId,
        number: datos.numero || '',
        type: 'invoice',
        supplier_id: prov?.id ?? '',
        supplier_name: prov?.name ?? (datos.razonSocial || String(articulo.from || '').replace(/<.*>/, '').trim()),
        date: datos.fecha || new Date().toISOString().slice(0, 10),
        amount: datos.total ?? 0,
        currency: datos.moneda,
        description: `${datos.tipoComprobante || 'Factura'} recibida por email (ticket #${ticketId})`,
        equipment_ids: [],
        status: 'pending',
        notes: [
          `Leída automáticamente (${datos.fuentes.join(' + ')}).`,
          faltan.length ? `Revisar: falta ${faltan.join(', ')}.` : '',
          prov ? '' : 'Proveedor no encontrado en la lista: asignarlo al revisar.',
        ].filter(Boolean).join(' '),
        letra: datos.letra || null,
        punto_venta: datos.puntoVenta || null,
        cuit_emisor: datos.cuitEmisor || null,
        cae: datos.cae || null,
        cae_vencimiento: datos.caeVencimiento || null,
        neto: datos.neto,
        iva: datos.iva,
        vencimiento_pago: datos.vencimientoPago || null,
        archivo_path: path,
        archivo_nombre: nombre,
        origen: 'zammad',
        zammad_ticket_id: ticketId,
        cargada_por: 'Email (Zammad)',
      };
      try {
        await rest(b, 'vouchers', { method: 'POST', body: JSON.stringify(fila) });
      } catch (err) {
        await borrarArchivo(b, path);
        if ((err as any).code === '23505') {
          resultados.push({ archivo: nombre, estado: 'duplicada', detalle: `${datos.letra} ${datos.puntoVenta}-${datos.numero} ya estaba cargada` });
          continue;
        }
        throw err;
      }
      const numero = [datos.letra, datos.puntoVenta && datos.numero ? `${datos.puntoVenta}-${datos.numero}` : datos.numero].filter(Boolean).join(' ');
      resultados.push({
        archivo: nombre, estado: 'cargada',
        detalle: `${datos.tipoComprobante || 'Factura'} ${numero || 's/n'} · ${fila.supplier_name || 'proveedor sin identificar'} · `
          + `${datos.moneda} ${pesos(datos.total)}${datosCompletos(datos) ? '' : ' · con datos a completar'}`
          + (faltan.length ? ` (falta ${faltan.join(', ')})` : ''),
      });
    } catch (err) {
      console.error('[api/facturas-zammad]', nombre, (err as Error).message);
      resultados.push({ archivo: nombre, estado: 'error', detalle: 'no se pudo procesar' });
    }
  }

  // Nota interna en el ticket (solo si hubo algo nuevo que contar)
  const nuevos = resultados.filter(r => r.estado !== 'ya_procesada');
  if (nuevos.length) {
    const app = env('APP_URL');
    const etiqueta = { cargada: 'Cargada (pendiente de revisión)', duplicada: 'Ya estaba cargada', error: 'No se cargó', ya_procesada: '' };
    const lineas = nuevos.map(r => `<li><b>${html(r.archivo)}</b>: ${etiqueta[r.estado]}${r.detalle ? ` — ${html(r.detalle)}` : ''}</li>`).join('');
    await nota(z, ticketId, `<p>Facturas de este email:</p><ul>${lineas}</ul>`
      + `<p>Revisalas en ${app ? `<a href="${html(app)}">el Dashboard</a>` : 'el Dashboard'}: <b>Proveedores → Facturas</b>.</p>`);
  }
  return { resultados };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  const secreto = env('ZAMMAD_WEBHOOK_SECRET');
  if (!secreto) return jsonResponse(503, { success: false, error: 'Webhook no configurado.' });
  const cuerpo = await request.text();
  if (cuerpo.length > 2_000_000) return jsonResponse(413, { success: false, error: 'Aviso demasiado grande.' });
  if (!firmaValida(cuerpo, request.headers.get('x-hub-signature'), secreto)) {
    return jsonResponse(401, { success: false, error: 'Firma inválida.' });
  }
  let aviso: any;
  try { aviso = JSON.parse(cuerpo); } catch { return jsonResponse(400, { success: false, error: 'JSON inválido.' }); }
  const ticketId = Number(aviso?.ticket?.id);
  const articuloId = Number(aviso?.article?.id);
  if (!Number.isInteger(ticketId) || !Number.isInteger(articuloId) || ticketId <= 0 || articuloId <= 0) {
    return jsonResponse(200, { success: true, ignorado: 'el aviso no trae ticket y artículo' });
  }
  // Se responde enseguida a Zammad y la lectura sigue en segundo plano
  waitUntil(procesarArticulo(ticketId, articuloId)
    .then(r => console.log('[api/facturas-zammad]', ticketId, JSON.stringify(r)))
    .catch(err => console.error('[api/facturas-zammad]', ticketId, (err as Error).message)));
  return jsonResponse(202, { success: true, recibido: true });
}

export async function GET(): Promise<Response> {
  return jsonResponse(405, { success: false, error: 'Usar POST.' });
}
