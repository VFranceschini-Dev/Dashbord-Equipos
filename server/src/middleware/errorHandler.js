import { ZodError } from 'zod';
import { MetabaseError } from '../clients/metabaseClient.js';

/** Middleware central de manejo de errores. No loguea API key ni datos personales. */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof MetabaseError) {
    // Errores de conexión/permisos de Metabase → 502 para que el frontend muestre aviso y use caché.
    console.error('[metabase]', err.message);
    return res.status(502).json({ error: 'Metabase no disponible', detail: err.message });
  }
  console.error('[server]', err.message || err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
