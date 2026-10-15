import { tabla } from '../clients/metabaseClient.js';
import { config } from '../config.js';

/**
 * Queries a la base SAI_TEST vía Metabase (SOLO lectura).
 * Para agregar una nueva consulta: crear una función acá que use tabla() o sql().
 * Ninguna otra capa necesita modificarse.
 */

/** Devuelve todos los registros de UsuariosAccesos (paginado automáticamente). */
export async function usuariosAccesos() {
  return tabla(config.metabase.usuariosTableId);
}

/**
 * Detecta las columnas reales de la tabla UsersAccesos consultando 1 fila.
 * Se usa en test:metabase para confirmar nombres antes de escribir código.
 */
export async function detectarColumnasUsuariosAccesos() {
  const rows = await usuariosAccesos();
  if (rows.length === 0) return { columns: [], sampleRow: null, totalRows: 0 };
  
  // Retornar solo nombres de columnas y una muestra anonimizada
  const columns = Object.keys(rows[0]);
  const sampleRow = columns.reduce((acc, col) => {
    acc[col] = typeof rows[0][col] === 'string' && rows[0][col].length > 2 
      ? `${rows[0][col].substring(0, 2)}...${rows[0][col].slice(-2)}` 
      : '[REDACTED]';
    return acc;
  }, {});
  
  return { columns, sampleRow, totalRows: rows.length };
}