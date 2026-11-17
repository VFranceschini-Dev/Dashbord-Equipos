/**
 * api/facturas-zammad.ts — Webhook de Zammad para facturas de proveedores.
 *
 * Alternativa a la búsqueda periódica (api/facturas-buscar.ts): si un administrador
 * de Zammad configura un webhook + disparador, Zammad avisa al instante cuando
 * llega un email. La lectura es la misma (api/_lib/zammad-facturas.ts).
 *
 * Seguridad:
 *   - El webhook se firma con un secreto (HMAC-SHA1, encabezado X-Hub-Signature).
 *     Sin firma válida no se hace nada.
 *   - Del aviso solo se usan los números de ticket y artículo: el email y los
 *     adjuntos se vuelven a leer desde Zammad con el token del servidor.
 *   - Cada email se procesa una sola vez.
 *
 * Variables (Vercel): ZAMMAD_WEBHOOK_SECRET (el mismo que se carga en Zammad),
 * más las de api/_lib/zammad-facturas.ts.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { env, jsonResponse, procesarArticulo } from './_lib/zammad-facturas.js';

export { asuntoDeFactura, dirigidoACasilla, procesarArticulo } from './_lib/zammad-facturas.js';

export function firmaValida(cuerpo: string, encabezado: string | null, secreto: string): boolean {
  const recibida = (encabezado || '').trim().replace(/^sha1=/i, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(recibida)) return false;
  const esperada = createHmac('sha1', secreto).update(cuerpo, 'utf8').digest('hex');
  return timingSafeEqual(Buffer.from(recibida, 'hex'), Buffer.from(esperada, 'hex'));
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
