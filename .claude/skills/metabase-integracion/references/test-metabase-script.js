/**
 * Prueba mínima de conexión a Metabase (npm run test:metabase).
 * Muestra motor SQL, cantidad de filas y nombres de columnas de UsuariosAccesos.
 * NO imprime datos personales ni la API key.
 */
import { databaseEngine } from '../src/clients/metabaseClient.js';
import { columnasUsuariosAccesos, usuariosAccesos } from '../src/queries/saiTest.js';
import { config } from '../src/config.js';

try {
  console.log('URL:', config.metabase.url, '| DB id:', config.metabase.dbId);

  const engine = await databaseEngine();
  console.log('Motor SQL detectado:', engine);

  const { tableName, columns } = await columnasUsuariosAccesos();
  console.log(`\nTabla ${tableName} (id ${config.metabase.usuariosTableId}) — ${columns.length} columnas:`);
  for (const c of columns) {
    console.log(`  - ${c.name}${c.displayName !== c.name ? ` (display: ${c.displayName})` : ''} [${c.type}]${c.pk ? ' PK' : ''}`);
  }

  const rows = await usuariosAccesos();
  console.log(`\nFilas devueltas por /api/dataset: ${rows.length}` + (rows.length >= 2000 ? ' (posible truncamiento: configurar METABASE_CARD_ID)' : ''));

  console.log('\nConfirmá cuáles columnas identifican al usuario (id, nombre, área, estado) y ajustá');
  console.log('los candidatos en src/services/usuariosService.js si no figuran entre los actuales.');
  process.exit(0);
} catch (err) {
  console.error('FALLÓ la prueba de conexión:', err.message);
  process.exit(1);
}
