/**
 * api/_lib/zammad-facturas.ts — Lectura de facturas de proveedores que llegan por
 * email a Zammad (soporte@donnet.com.ar, asunto con "factura", "fact" o derivados).
 *
 * La usan dos entradas:
 *   - api/facturas-buscar.ts   búsqueda periódica (GitHub Actions cada 30 min) y el
 *                              botón "Buscar en Zammad" de Proveedores → Facturas.
 *   - api/facturas-zammad.ts   webhook de Zammad (si algún día se configura).
 *
 * Por cada email: se leen los adjuntos (PDF o imagen), se extraen los datos
 * (QR de AFIP → texto del PDF → GPT de OpenAI como respaldo), se guarda el archivo
 * en Storage ("facturas") y la factura queda PENDIENTE de revisión. En el ticket
 * se deja una nota interna. Cada email se procesa una sola vez.
 *
 * Variables (Vercel):
 *   ZAMMAD_URL, ZAMMAD_TOKEN          (las mismas de los comprobantes)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY                    opcional: lectura con GPT si el QR y el texto no alcanzan
 *   OPENAI_MODEL                      opcional: modelo de OpenAI (por defecto gpt-5.4-mini)
 *   FACTURAS_USER_ID                  opcional: usuario dueño de las facturas automáticas
 *                                     (si falta, el administrador activo más antiguo)
 *   FACTURAS_CORREO                   opcional: casilla que recibe las facturas
 *                                     (por defecto soporte@donnet.com.ar; "*" = cualquiera)
 *   FACTURAS_DIAS                     opcional: días hacia atrás que revisa la búsqueda (por defecto 3)
 *   CUIT_EMPRESA                      opcional: CUIT propio (por defecto el de PEDSA)
 *   APP_URL                           opcional: dirección de la app para el enlace de la nota
 */
import { randomUUID } from 'node:crypto';
import { extraerFactura, datosCompletos, type DatosFactura } from './factura.js';

const TIMEOUT_MS = 20000;
const MAX_ARCHIVO = 10 * 1024 * 1024;
const MAX_ADJUNTOS = 5;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function env(name: string, fallbackName?: string): string | undefined {
  const raw = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const value = (raw || '').trim();
  return value || undefined;
}

export function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function fetchConTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Zammad
// ---------------------------------------------------------------------------
export function zammad(): { url: string; token: string } | null {
  const url = env('ZAMMAD_URL');
  const token = env('ZAMMAD_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export async function zGet(z: NonNullable<ReturnType<typeof zammad>>, path: string): Promise<Response> {
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
    console.error('[facturas] nota en Zammad:', (err as Error).message);
  }
}

const html = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * ¿El asunto indica una factura? "Factura", "Facturas", "Fact", "Fact.", "Fact-0001",
 * "Facturación", "Facturado"… (sin distinguir mayúsculas). No toma palabras como "factor".
 */
export function asuntoDeFactura(asunto: string): boolean {
  return /\bfact(?:ura(?:s|ci[oó]n|d[oa]s?)?)?(?![a-zñáéíóú])/i.test(asunto || '');
}

/** Casilla que recibe las facturas (FACTURAS_CORREO, por defecto soporte@donnet.com.ar; "*" = cualquiera). */
export function dirigidoACasilla(articulo: { to?: string; cc?: string }): boolean {
  const casilla = (env('FACTURAS_CORREO') || 'soporte@donnet.com.ar').toLowerCase();
  if (casilla === '*') return true;
  return `${articulo.to || ''} ${articulo.cc || ''}`.toLowerCase().includes(casilla);
}

// ---------------------------------------------------------------------------
// Supabase (service_role)
// ---------------------------------------------------------------------------
export function base(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

export type Base = NonNullable<ReturnType<typeof base>>;

export async function rest(b: Base, path: string, init: RequestInit = {}): Promise<any> {
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
export interface Resultado { archivo: string; estado: 'cargada' | 'duplicada' | 'ya_procesada' | 'error'; detalle: string }

export interface ResultadoArticulo { ignorado?: string; resultados: Resultado[] }

/**
 * Procesa un email de Zammad. Si el artículo ya se leyó (búsqueda periódica) se
 * pasa en "previo" para no pedirlo de nuevo. Cada email se procesa una sola vez:
 * queda registrado en facturas_zammad_procesados.
 */
export async function procesarArticulo(ticketId: number, articuloId: number, previo?: any): Promise<ResultadoArticulo> {
  const z = zammad();
  const b = base();
  if (!z || !b) throw new Error('Falta configurar Zammad o la base de datos en el servidor.');

  const articulo = previo && Number(previo.id) === articuloId ? previo : await (await zGet(z, `ticket_articles/${articuloId}`)).json();
  if (Number(articulo.ticket_id) !== ticketId) return { ignorado: 'el artículo no corresponde al ticket', resultados: [] };
  if (articulo.internal || articulo.sender === 'Agent' || articulo.sender === 'System') {
    return { ignorado: 'no es un email recibido', resultados: [] };
  }
  const adjuntos: any[] = Array.isArray(articulo.attachments) ? articulo.attachments : [];
  if (!dirigidoACasilla(articulo)) {
    return { ignorado: 'el email no fue enviado a la casilla de facturas', resultados: [] };
  }
  if (!asuntoDeFactura(String(articulo.subject || ''))) {
    return { ignorado: 'el asunto no indica una factura', resultados: [] };
  }
  if (await yaProcesado(b, articuloId)) return { ignorado: 'el email ya fue procesado', resultados: [] };

  const tipoDe = (a: any) => String(a.preferences?.['Content-Type'] || a.preferences?.['Mime-Type'] || '').split(';')[0].trim().toLowerCase()
    || (/\.pdf$/i.test(a.filename) ? 'application/pdf' : '');
  const candidatos = adjuntos.filter(a => TIPOS.includes(tipoDe(a)) && Number(a.size || 0) <= MAX_ARCHIVO);
  const hayPdf = candidatos.some(a => tipoDe(a) === 'application/pdf');
  // Imágenes solo si no hay PDF o si su nombre dice "factura" (evita logos y firmas del email)
  const aLeer = candidatos
    .filter(a => tipoDe(a) === 'application/pdf' || !hayPdf || /fact/i.test(a.filename))
    .filter(a => tipoDe(a) === 'application/pdf' || Number(a.size || 0) > 15_000)
    .slice(0, MAX_ADJUNTOS);

  if (!aLeer.length) {
    await nota(z, ticketId, 'El asunto indica una factura pero el email no trae un PDF o imagen para leer. Cargala a mano en <b>Proveedores → Facturas</b>.');
    await marcarProcesado(b, articuloId, ticketId, { ignorado: 'sin adjuntos para leer' });
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
      console.error('[facturas]', nombre, (err as Error).message);
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
  await marcarProcesado(b, articuloId, ticketId, { resultados });
  return { resultados };
}

// ---------------------------------------------------------------------------
// Registro de emails ya procesados (para no repetir notas ni lecturas)
// ---------------------------------------------------------------------------
async function yaProcesado(b: Base, articuloId: number): Promise<boolean> {
  try {
    const filas = await rest(b, `facturas_zammad_procesados?select=article_id&article_id=eq.${articuloId}&limit=1`);
    return Boolean(filas?.length);
  } catch (err) {
    if ((err as any).status === 404 || (err as any).code === '42P01') {
      throw new Error('Falta ejecutar la migración 20261117_facturas_zammad_procesados.sql en Supabase.');
    }
    throw err;
  }
}

async function marcarProcesado(b: Base, articuloId: number, ticketId: number, resultado: unknown): Promise<void> {
  try {
    await rest(b, 'facturas_zammad_procesados?on_conflict=article_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ article_id: articuloId, ticket_id: ticketId, resultado }),
    });
  } catch (err) {
    console.error('[facturas] no se pudo registrar el email procesado:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Búsqueda periódica: emails recientes con factura
// ---------------------------------------------------------------------------
export interface ResumenBusqueda {
  dias: number;
  ticketsRevisados: number;
  emailsDeFactura: number;
  cargadas: number;
  duplicadas: number;
  conError: number;
  sinAdjuntos: number;
  quedanPendientes: boolean;   // se cortó por tiempo: sigue en la próxima búsqueda
}

const fecha = (s: unknown) => { const t = Date.parse(String(s || '')); return Number.isFinite(t) ? t : 0; };

/**
 * Revisa los tickets con actividad de clientes en los últimos días y procesa los
 * emails de factura que todavía no se procesaron. Se corta antes del límite de
 * tiempo de la función: lo que falte queda para la próxima vez.
 */
export async function buscarFacturasRecientes(limiteMs = 45_000): Promise<ResumenBusqueda> {
  const z = zammad();
  const b = base();
  if (!z || !b) throw new Error('Falta configurar Zammad o la base de datos en el servidor.');
  const inicio = Date.now();
  const dias = Math.min(Math.max(Number(env('FACTURAS_DIAS')) || 3, 1), 30);
  const desde = inicio - dias * 86_400_000;
  const resumen: ResumenBusqueda = {
    dias, ticketsRevisados: 0, emailsDeFactura: 0, cargadas: 0, duplicadas: 0, conError: 0, sinAdjuntos: 0, quedanPendientes: false,
  };

  // Tickets actualizados recientemente (los más nuevos primero)
  const tickets: any[] = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const lote: any[] = await (await zGet(z, `tickets?expand=false&per_page=100&page=${pagina}&sort_by=updated_at&order_by=desc`)).json();
    if (!Array.isArray(lote) || !lote.length) break;
    if (pagina === 1 && lote.length > 1 && fecha(lote[0].updated_at) < fecha(lote[lote.length - 1].updated_at)) {
      throw new Error('Zammad no devolvió los tickets ordenados por fecha: no se puede buscar facturas recientes.');
    }
    tickets.push(...lote.filter(t => fecha(t.updated_at) >= desde));
    if (fecha(lote[lote.length - 1].updated_at) < desde || lote.length < 100) break;
  }
  // Solo los que recibieron algo del cliente en el período
  const candidatos = tickets.filter(t => !t.last_contact_customer_at || fecha(t.last_contact_customer_at) >= desde);

  // Emails ya procesados de esos tickets
  const procesados = new Set<number>();
  if (candidatos.length) {
    try {
      const filas: any[] = await rest(b, `facturas_zammad_procesados?select=article_id&ticket_id=in.(${candidatos.map(t => Number(t.id)).join(',')})`) ?? [];
      filas.forEach(f => procesados.add(Number(f.article_id)));
    } catch (err) {
      if ((err as any).status === 404 || (err as any).code === '42P01') {
        throw new Error('Falta ejecutar la migración 20261117_facturas_zammad_procesados.sql en Supabase.');
      }
      throw err;
    }
  }

  for (const t of candidatos) {
    if (Date.now() - inicio > limiteMs) { resumen.quedanPendientes = true; break; }
    resumen.ticketsRevisados++;
    const articulos: any[] = await (await zGet(z, `ticket_articles/by_ticket/${Number(t.id)}`)).json();
    for (const a of Array.isArray(articulos) ? articulos : []) {
      if (procesados.has(Number(a.id)) || fecha(a.created_at) < desde) continue;
      if (a.internal || (a.sender && a.sender !== 'Customer') || (a.type && a.type !== 'email')) continue;
      if (!dirigidoACasilla(a) || !asuntoDeFactura(String(a.subject || ''))) continue;
      if (Date.now() - inicio > limiteMs) { resumen.quedanPendientes = true; break; }
      resumen.emailsDeFactura++;
      const r = await procesarArticulo(Number(t.id), Number(a.id), a);
      if (r.ignorado === 'sin adjuntos para leer') resumen.sinAdjuntos++;
      for (const x of r.resultados) {
        if (x.estado === 'cargada') resumen.cargadas++;
        else if (x.estado === 'duplicada') resumen.duplicadas++;
        else if (x.estado === 'error') resumen.conError++;
      }
    }
  }
  return resumen;
}
