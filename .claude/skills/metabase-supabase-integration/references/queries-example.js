import { tabla, databaseMetadata } from '../clients/metabaseClient.js';
import { config } from '../config.js';

/**
 * Consultas a SAI_TEST (Metabase, SOLO lectura).
 * Para agregar una consulta nueva: crear una función acá y nada más.
 */

/** Devuelve todas las filas de UsuariosAccesos como objetos con claves en minúsculas. */
export async function usuariosAccesos() {
  return tabla(config.metabase.usuariosTableId);
}

/**
 * Descubre las columnas reales de una tabla de SAI_TEST vía /api/database/:id/metadata.
 * Se usa en scripts/testMetabase.js para confirmar los nombres antes de mapear campos.
 */
export async function columnasUsuariosAccesos() {
  const meta = await databaseMetadata();
  const tables = (meta.databases || [meta]).flatMap(db => db.tables || []);
  const table = tables.find(t => t.id === config.metabase.usuariosTableId);
  if (!table) {
    throw new Error(
      `No se encontró la tabla ${config.metabase.usuariosTableId} en la base ${config.metabase.dbId}. ` +
      'Verificá SAI_USUARIOS_TABLE_ID y METABASE_DB_ID.'
    );
  }
  return {
    tableName: table.display_name || table.name,
    columns: (table.fields || []).map(f => ({
      name: f.name,
      displayName: f.display_name,
      type: f.database_type,
      semanticType: f.semantic_type,
      pk: Boolean(f.primary_key),
    })),
  };
}
