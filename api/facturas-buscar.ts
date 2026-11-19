/**
 * api/facturas-buscar.ts — Busca en Zammad los emails de factura recientes y los carga.
 *
 * POST, con una de estas dos autorizaciones:
 *   - GitHub Actions (cada 30 minutos): Authorization: Bearer <FACTURAS_CRON_SECRET>
 *     Revisa los últimos FACTURAS_DIAS días (por defecto 7).
 *   - Botón "Buscar en Zammad" de Proveedores → Facturas: la sesión del usuario.
 *     Revisa desde la fecha elegida ({ desde: "AAAA-MM-DD" }, hasta 180 días; por defecto 30) y vuelve a
 *     leer los emails cuyos adjuntos no se pudieron leer antes.
 *
 * Devuelve un resumen: tickets revisados, emails de factura, cargadas, duplicadas…
 * Cada email se procesa una sola vez, así que llamarla seguido no duplica nada.
 *
 * Variables (Vercel): FACTURAS_CRON_SECRET (el mismo que el secreto de GitHub),
 * más las de api/_lib/zammad-facturas.ts.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { env, jsonResponse, fetchConTimeout, buscarFacturasRecientes } from './_lib/zammad-facturas.js';

/** Compara secretos sin revelar por el tiempo de respuesta cuánto coinciden. */
function mismoSecreto(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** ¿La llamada viene de GitHub Actions (secreto) o de un usuario con sesión? */
async function autorizado(request: Request): Promise<'cron' | 'usuario' | null> {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const secreto = env('FACTURAS_CRON_SECRET');
  if (secreto && mismoSecreto(token, secreto)) return 'cron';
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!url || !anon) return null;
  try {
    const res = await fetchConTimeout(`${url.replace(/\/+$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? 'usuario' : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const quien = await autorizado(request);
  if (!quien) return jsonResponse(401, { success: false, error: 'No autorizado.' });
  try {
    let dias: number | undefined;
    if (quien === 'usuario') {
      const cuerpo = await request.json().catch(() => ({}));
      // "desde" (AAAA-MM-DD, elegido en la pantalla) o "dias"; por defecto 30 días
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo?.desde || '')) ? Date.parse(`${cuerpo.desde}T00:00:00-03:00`) : NaN;
      dias = Number.isFinite(desde) ? Math.ceil((Date.now() - desde) / 86_400_000)
        : Number(cuerpo?.dias) > 0 ? Number(cuerpo.dias) : 30;
    }
    // El botón además vuelve a leer los emails que fallaron antes; la búsqueda automática no
    // (así no se repiten las notas en los tickets cada 30 minutos).
    const resumen = await buscarFacturasRecientes({ dias, reintentarErrores: quien === 'usuario' });
    console.log('[api/facturas-buscar]', quien, JSON.stringify(resumen));
    return jsonResponse(200, { success: true, data: resumen });
  } catch (err) {
    console.error('[api/facturas-buscar]', quien, (err as Error).message);
    return jsonResponse(500, { success: false, error: (err as Error).message });
  }
}

export async function GET(): Promise<Response> {
  return jsonResponse(405, { success: false, error: 'Usar POST.' });
}
