/**
 * api/_lib/factura.ts — Lectura de los datos de una factura (PDF o imagen).
 *
 * Orden (opción C):
 *   1. QR de AFIP/ARCA del PDF: CUIT emisor, punto de venta, tipo, número,
 *      fecha, total, moneda y CAE (datos firmados por AFIP, los más confiables).
 *   2. Texto del PDF: neto, IVA, vencimiento del CAE, vencimiento del pago y
 *      todo lo que falte del QR.
 *   3. GPT de OpenAI (solo si falta CUIT, número o total, y está OPENAI_API_KEY):
 *      lee el documento y devuelve los datos como JSON. Modelo: OPENAI_MODEL
 *      (por defecto gpt-5.4-mini).
 *
 * Las carpetas que empiezan con "_" dentro de api/ no son funciones públicas.
 */
import jsQRModulo from 'jsqr';
import OpenAI from 'openai';

export interface DatosFactura {
  tipoComprobante: string;   // "Factura", "Nota de crédito", ...
  letra: string;
  puntoVenta: string;        // 5 dígitos
  numero: string;            // 8 dígitos
  cuitEmisor: string;        // 11 dígitos
  razonSocial: string;
  fecha: string;             // YYYY-MM-DD
  vencimientoPago: string;
  cae: string;
  caeVencimiento: string;
  neto: number | null;
  iva: number | null;
  total: number | null;
  moneda: 'ARS' | 'USD';
  fuentes: string[];         // qr / texto / gpt
}

const vacio = (): DatosFactura => ({
  tipoComprobante: '', letra: '', puntoVenta: '', numero: '', cuitEmisor: '', razonSocial: '',
  fecha: '', vencimientoPago: '', cae: '', caeVencimiento: '', neto: null, iva: null, total: null,
  moneda: 'ARS', fuentes: [],
});

// Códigos de comprobante de AFIP → tipo y letra
const TIPOS_AFIP: Record<number, [string, string]> = {
  1: ['Factura', 'A'], 2: ['Nota de débito', 'A'], 3: ['Nota de crédito', 'A'],
  6: ['Factura', 'B'], 7: ['Nota de débito', 'B'], 8: ['Nota de crédito', 'B'],
  11: ['Factura', 'C'], 12: ['Nota de débito', 'C'], 13: ['Nota de crédito', 'C'],
  19: ['Factura', 'E'], 20: ['Nota de débito', 'E'], 21: ['Nota de crédito', 'E'],
  51: ['Factura', 'M'], 52: ['Nota de débito', 'M'], 53: ['Nota de crédito', 'M'],
  201: ['Factura de crédito electrónica', 'A'], 206: ['Factura de crédito electrónica', 'B'],
  211: ['Factura de crédito electrónica', 'C'],
};

// jsqr es CommonJS: según cómo se cargue, la función está en el módulo o en .default
const jsQR: typeof import('jsqr').default = ((jsQRModulo as any).default ?? jsQRModulo);

const soloDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** CUIT de la empresa (receptora de las facturas): nunca es el emisor. */
export const cuitPropio = () => soloDigitos(process.env.CUIT_EMPRESA || '30538457627');

/** Valida el dígito verificador del CUIT. */
export function cuitValido(cuit: string): boolean {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(d[10]);
}

/** "121.000,50" / "121000.50" / "$ 1,234.56" → número. */
export function importe(texto: string): number | null {
  let t = texto.replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma > punto) t = t.replace(/\./g, '').replace(',', '.');      // 1.234,56
  else if (punto > coma && coma >= 0) t = t.replace(/,/g, '');        // 1,234.56
  else if (coma >= 0 && punto < 0) t = t.replace(',', '.');           // 1234,56
  else if (punto >= 0 && /\.\d{3}$/.test(t) && (t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** "10/11/2026" → "2026-11-10". */
function fecha(texto: string): string {
  const m = texto.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

// ---------------------------------------------------------------------------
// 1. QR de AFIP
// ---------------------------------------------------------------------------
/** Decodifica la URL del QR (https://www.afip.gob.ar/fe/qr/?p=<base64 JSON>). */
export function datosDeQrAfip(url: string): Partial<DatosFactura> | null {
  const m = url.match(/[?&]p=([^&#\s]+)/);
  if (!/afip\.gob\.ar|arca\.gob\.ar/i.test(url) || !m) return null;
  try {
    const b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    const [tipo, letra] = TIPOS_AFIP[Number(j.tipoCmp)] ?? ['Factura', ''];
    return {
      tipoComprobante: tipo,
      letra,
      puntoVenta: soloDigitos(j.ptoVta).padStart(5, '0'),
      numero: soloDigitos(j.nroCmp).padStart(8, '0'),
      cuitEmisor: soloDigitos(j.cuit),
      fecha: typeof j.fecha === 'string' ? j.fecha.slice(0, 10) : '',
      total: typeof j.importe === 'number' ? Math.round(j.importe * 100) / 100 : importe(String(j.importe ?? '')),
      moneda: j.moneda === 'DOL' ? 'USD' : 'ARS',
      cae: soloDigitos(j.codAut),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lectura del PDF (texto, enlaces y QR de las imágenes)
// ---------------------------------------------------------------------------
async function pdfjs(): Promise<any> {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/** Pasa la imagen de pdf.js a RGBA para el lector de QR. */
function aRgba(img: any): Uint8ClampedArray | null {
  const { width, height, data, kind } = img || {};
  if (!width || !height || !data) return null;
  const n = width * height;
  if (kind === 3 || data.length === n * 4) return new Uint8ClampedArray(data);
  const out = new Uint8ClampedArray(n * 4);
  if (kind === 2 || data.length === n * 3) {
    for (let i = 0; i < n; i++) { out[i * 4] = data[i * 3]; out[i * 4 + 1] = data[i * 3 + 1]; out[i * 4 + 2] = data[i * 3 + 2]; out[i * 4 + 3] = 255; }
    return out;
  }
  if (kind === 1) { // 1 bit por píxel, filas alineadas a byte
    const fila = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const bit = (data[y * fila + (x >> 3)] >> (7 - (x & 7))) & 1;
      const v = bit ? 255 : 0, i = (y * width + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
    }
    return out;
  }
  return null;
}

/** Agranda la imagen (vecino más cercano): los QR muy chicos se leen mejor. */
function escalar(rgba: Uint8ClampedArray, w: number, h: number, f: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * f * h * f * 4);
  for (let y = 0; y < h * f; y++) for (let x = 0; x < w * f; x++) {
    const s = ((Math.floor(y / f) * w) + Math.floor(x / f)) * 4, d = (y * w * f + x) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = 255;
  }
  return out;
}

function leerQr(img: any): string | null {
  const rgba = aRgba(img);
  if (!rgba) return null;
  const { width: w, height: h } = img;
  const r = jsQR(rgba, w, h, { inversionAttempts: 'attemptBoth' });
  if (r?.data) return r.data;
  if (w < 300 && h < 300) {
    const f = Math.ceil(300 / Math.max(w, h));
    return jsQR(escalar(rgba, w, h, f), w * f, h * f, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }
  return null;
}

/** Texto (por renglones) y QR/enlaces de AFIP de las primeras páginas del PDF. */
export async function leerPdf(pdf: Uint8Array): Promise<{ texto: string; qrs: string[] }> {
  const lib = await pdfjs();
  const tarea = lib.getDocument({
    data: new Uint8Array(pdf), useSystemFonts: false, isEvalSupported: false,
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false, verbosity: 0,
  });
  const doc = await tarea.promise;
  const renglones: string[] = [];
  const qrs: string[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
      const page = await doc.getPage(p);
      // Texto agrupado por renglón (misma altura)
      const contenido = await page.getTextContent();
      const filas = new Map<number, { x: number; s: string }[]>();
      for (const it of contenido.items as any[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5] / 3) * 3;
        filas.set(y, [...(filas.get(y) || []), { x: it.transform[4], s: it.str }]);
      }
      [...filas.entries()].sort((a, b) => b[0] - a[0])
        .forEach(([, items]) => renglones.push(items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()));
      // Enlaces (algunos sistemas ponen el QR también como link)
      for (const a of await page.getAnnotations()) {
        if (typeof a.url === 'string' && /afip\.gob\.ar|arca\.gob\.ar/i.test(a.url)) qrs.push(a.url);
      }
      // Imágenes → QR
      if (!qrs.length) {
        const ops = await page.getOperatorList();
        const nombres = new Set<string>();
        ops.fnArray.forEach((fn: number, i: number) => {
          if (fn === lib.OPS.paintImageXObject || fn === lib.OPS.paintInlineImageXObject) {
            const arg = ops.argsArray[i]?.[0];
            if (typeof arg === 'string') nombres.add(arg);
            else if (arg?.data) { const q = leerQr(arg); if (q) qrs.push(q); }
          }
        });
        for (const nombre of [...nombres].slice(0, 20)) {
          const img = await new Promise<any>(res => {
            const store = nombre.startsWith('g_') ? page.commonObjs : page.objs;
            try { store.get(nombre, res); } catch { res(null); }
            setTimeout(() => res(null), 3000);
          });
          const q = img ? leerQr(img) : null;
          if (q) qrs.push(q);
        }
      }
      page.cleanup();
    }
  } finally {
    await tarea.destroy();
  }
  return { texto: renglones.join('\n'), qrs };
}

// ---------------------------------------------------------------------------
// 2. Texto del PDF
// ---------------------------------------------------------------------------
function buscar(texto: string, re: RegExp): string {
  return texto.match(re)?.[1]?.trim() ?? '';
}

const MONTO = '\\$?\\s*(-?[\\d.,]+\\d)';

export function datosDeTexto(texto: string): Partial<DatosFactura> {
  const t = texto.replace(/[ \t]+/g, ' ');
  const d: Partial<DatosFactura> = {};
  if (/nota\s+de\s+cr[eé]dito/i.test(t)) d.tipoComprobante = 'Nota de crédito';
  else if (/nota\s+de\s+d[eé]bito/i.test(t)) d.tipoComprobante = 'Nota de débito';
  else if (/factura/i.test(t)) d.tipoComprobante = 'Factura';
  const letra = buscar(t, /^\s*([ABCEM])\s*$/m) || buscar(t, /FACTURA\s+([ABCEM])\b/i) || buscar(t, /C[oó]d(?:igo)?\.?\s*0?(?:1|6|11|51|19)\b.*?\b([ABCEM])\b/i);
  if (letra) d.letra = letra.toUpperCase();
  const pv = buscar(t, /Punto\s+de\s+Venta:?\s*(\d{1,5})/i);
  const nro = buscar(t, /Comp(?:robante)?\.?\s*N(?:ro|°|º|o)?\.?:?\s*(\d{1,8})/i);
  const conGuion = t.match(/\b(\d{4,5})\s*-\s*(\d{8})\b/);
  if (pv) d.puntoVenta = pv.padStart(5, '0');
  if (nro) d.numero = nro.padStart(8, '0');
  if ((!pv || !nro) && conGuion) { d.puntoVenta ||= conGuion[1].padStart(5, '0'); d.numero ||= conGuion[2]; }
  // El primer CUIT válido del documento suele ser el del emisor (se saltea el propio: es el cliente)
  for (const m of t.matchAll(/C\.?U\.?I\.?T\.?\s*(?:N[°º]|Nro\.?)?:?\s*(\d{2}-?\d{8}-?\d)/gi)) {
    const c = soloDigitos(m[1]);
    if (cuitValido(c) && c !== cuitPropio()) { d.cuitEmisor = c; break; }
  }
  const rs = buscar(t, /Raz[oó]n\s+Social:?\s*(.+)/i);
  if (rs) d.razonSocial = rs.slice(0, 120);
  const emision = buscar(t, /Fecha\s+(?:de\s+)?Emisi[oó]n:?\s*([\d/.-]{8,10})/i);
  if (emision) d.fecha = fecha(emision);
  const vtoPago = buscar(t, /(?:Vto\.?|Vencimiento)\s+(?:para\s+el\s+)?pago:?\s*([\d/.-]{8,10})/i);
  if (vtoPago) d.vencimientoPago = fecha(vtoPago);
  const cae = buscar(t, /C\.?A\.?E\.?\s*(?:N[°º]|Nro\.?)?:?\s*(\d{14})/i);
  if (cae) d.cae = cae;
  const vtoCae = buscar(t, /(?:Vto\.?|Vencimiento)\s+(?:de(?:l)?\s+)?C\.?A\.?E\.?:?\s*([\d/.-]{8,10})/i);
  if (vtoCae) d.caeVencimiento = fecha(vtoCae);
  const neto = buscar(t, new RegExp(`(?:Importe\\s+)?Neto\\s+Gravado:?\\s*${MONTO}`, 'i')) || buscar(t, new RegExp(`Subtotal:?\\s*${MONTO}`, 'i'));
  if (neto) d.neto = importe(neto);
  // IVA: suma de todas las alícuotas ("IVA 21%: $ ...", "IVA 10.5%: ...")
  let iva = 0, hayIva = false;
  for (const m of t.matchAll(new RegExp(`IVA\\s*\\d{1,2}(?:[.,]\\d+)?\\s*%:?\\s*${MONTO}`, 'gi'))) {
    const v = importe(m[1]); if (v != null) { iva += v; hayIva = true; }
  }
  if (hayIva) d.iva = Math.round(iva * 100) / 100;
  const total = buscar(t, new RegExp(`(?:Importe\\s+)?Total:?\\s*${MONTO}`, 'i'));
  if (total) d.total = importe(total);
  if (/U\$S|USD|D[oó]lar/i.test(t) && !/Pesos/i.test(t)) d.moneda = 'USD';
  return d;
}

// ---------------------------------------------------------------------------
// 3. GPT (respaldo)
// ---------------------------------------------------------------------------
const ESQUEMA = {
  type: 'object',
  properties: {
    es_factura: { type: 'boolean', description: 'true si el documento es una factura, nota de crédito o nota de débito' },
    tipo_comprobante: { type: 'string' },
    letra: { type: 'string', description: 'A, B, C, E o M; vacío si no figura' },
    punto_venta: { type: 'string' },
    numero: { type: 'string' },
    cuit_emisor: { type: 'string', description: 'CUIT de quien emite la factura (no el del cliente), 11 dígitos' },
    razon_social_emisor: { type: 'string' },
    fecha_emision: { type: 'string', description: 'YYYY-MM-DD o vacío' },
    vencimiento_pago: { type: 'string', description: 'YYYY-MM-DD o vacío' },
    cae: { type: 'string' },
    vencimiento_cae: { type: 'string', description: 'YYYY-MM-DD o vacío' },
    neto: { type: ['number', 'null'] },
    iva: { type: ['number', 'null'], description: 'suma de todas las alícuotas de IVA' },
    total: { type: ['number', 'null'] },
    moneda: { type: 'string', enum: ['ARS', 'USD'] },
  },
  required: ['es_factura', 'tipo_comprobante', 'letra', 'punto_venta', 'numero', 'cuit_emisor', 'razon_social_emisor',
    'fecha_emision', 'vencimiento_pago', 'cae', 'vencimiento_cae', 'neto', 'iva', 'total', 'moneda'],
  additionalProperties: false,
};

const INSTRUCCIONES = 'Extraés datos de comprobantes fiscales argentinos (AFIP/ARCA). Respondé solo con lo que figura en el documento; '
  + 'si un dato no aparece, dejalo vacío o null. Los importes van como número, sin separador de miles. '
  + 'El CUIT del emisor es el de quien vende, no el del cliente.';

export function iaDisponible(): boolean {
  return Boolean((process.env.OPENAI_API_KEY || '').trim());
}

/** Convierte la respuesta JSON del modelo en datos de factura (null si no es una factura). */
export function datosDeRespuestaIa(texto: string): Partial<DatosFactura> | null {
  const j = JSON.parse(texto);
  if (!j?.es_factura) return null;
  const fechaIso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const pv = soloDigitos(j.punto_venta), nro = soloDigitos(j.numero);
  return {
    tipoComprobante: String(j.tipo_comprobante || 'Factura').slice(0, 60),
    letra: /^[ABCEM]$/i.test(String(j.letra || '').trim()) ? String(j.letra).trim().toUpperCase() : '',
    puntoVenta: pv ? pv.slice(-5).padStart(5, '0') : '',
    numero: nro ? nro.slice(-8).padStart(8, '0') : '',
    cuitEmisor: soloDigitos(j.cuit_emisor),
    razonSocial: String(j.razon_social_emisor || '').slice(0, 120),
    fecha: fechaIso(j.fecha_emision),
    vencimientoPago: fechaIso(j.vencimiento_pago),
    cae: soloDigitos(j.cae),
    caeVencimiento: fechaIso(j.vencimiento_cae),
    neto: typeof j.neto === 'number' ? Math.round(j.neto * 100) / 100 : null,
    iva: typeof j.iva === 'number' ? Math.round(j.iva * 100) / 100 : null,
    total: typeof j.total === 'number' ? Math.round(j.total * 100) / 100 : null,
    moneda: j.moneda === 'USD' ? 'USD' : 'ARS',
  };
}

/** Pide a GPT los datos de la factura. Devuelve null si no hay clave o si no es una factura. */
export async function datosConIa(archivo: Uint8Array, tipoMime: string, nombre = 'factura.pdf'): Promise<Partial<DatosFactura> | null> {
  if (!iaDisponible()) return null;
  const client = new OpenAI({ timeout: 50_000, maxRetries: 1 });
  const dataUrl = `data:${tipoMime};base64,${Buffer.from(archivo).toString('base64')}`;
  const adjunto: OpenAI.Responses.ResponseInputContent = tipoMime === 'application/pdf'
    ? { type: 'input_file', filename: nombre.toLowerCase().endsWith('.pdf') ? nombre : `${nombre}.pdf`, file_data: dataUrl }
    : { type: 'input_image', image_url: dataUrl, detail: 'high' };
  const respuesta = await client.responses.create({
    model: (process.env.OPENAI_MODEL || '').trim() || 'gpt-5.4-mini',
    instructions: INSTRUCCIONES,
    input: [{ role: 'user', content: [adjunto, { type: 'input_text', text: 'Extraé los datos de este comprobante.' }] }],
    text: { format: { type: 'json_schema', name: 'factura', schema: ESQUEMA, strict: true } },
    store: false,
  });
  if (respuesta.status === 'incomplete' || !respuesta.output_text) return null;
  return datosDeRespuestaIa(respuesta.output_text);
}

// ---------------------------------------------------------------------------
// Todo junto
// ---------------------------------------------------------------------------
/** Completa "base" con lo que falte de "extra" (no pisa datos ya encontrados). */
function completar(base: DatosFactura, extra: Partial<DatosFactura> | null, fuente: string): void {
  if (!extra) return;
  let aporto = false;
  for (const [k, v] of Object.entries(extra) as [keyof DatosFactura, any][]) {
    if (k === 'fuentes' || v === null || v === undefined || v === '') continue;
    const actual = base[k];
    if (actual === null || actual === '' || (k === 'moneda' && !base.fuentes.length)) { (base as any)[k] = v; aporto = true; }
  }
  if (aporto) base.fuentes.push(fuente);
}

export const datosCompletos = (d: DatosFactura) => Boolean(d.cuitEmisor && d.numero && d.total != null);

/** Lee la factura: QR → texto → GPT (solo si faltan datos clave). */
export async function extraerFactura(archivo: Uint8Array, tipoMime: string, nombre?: string): Promise<{ datos: DatosFactura; texto: string }> {
  const datos = vacio();
  let texto = '';
  if (tipoMime === 'application/pdf') {
    try {
      const leido = await leerPdf(archivo);
      texto = leido.texto;
      for (const q of leido.qrs) { const qr = datosDeQrAfip(q); if (qr) { completar(datos, qr, 'qr'); break; } }
      completar(datos, datosDeTexto(texto), 'texto');
    } catch (err) {
      console.error('[factura] no se pudo leer el PDF:', (err as Error).message);
    }
  }
  if (datos.cuitEmisor && (!cuitValido(datos.cuitEmisor) || datos.cuitEmisor === cuitPropio())) datos.cuitEmisor = '';
  if (!datosCompletos(datos)) {
    try {
      completar(datos, await datosConIa(archivo, tipoMime, nombre), 'gpt');
    } catch (err) {
      console.error('[factura] GPT:', (err as Error).message);
    }
  }
  if (datos.cuitEmisor && (!cuitValido(datos.cuitEmisor) || datos.cuitEmisor === cuitPropio())) datos.cuitEmisor = '';
  return { datos, texto };
}
