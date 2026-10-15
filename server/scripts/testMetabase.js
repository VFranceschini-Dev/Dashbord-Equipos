#!/usr/bin/env node
/**
 * Script de prueba de conexión a Metabase.
 * Ejecutar: npm run test:metabase
 * Requiere acceso a la red interna (10.0.0.8:3000).
 */

import { detectarColumnasUsuariosAccesos } from '../src/queries/saiTest.js';
import { config } from '../src/config.js';

console.log('🧪 Probando conexión a Metabase...\n');
console.log('Configuración:');
console.log(`  URL: ${config.metabase.url}`);
console.log(`  DB ID: ${config.metabase.dbId}`);
console.log(`  Tabla usuarios: ${config.metabase.usuariosTableId}`);
console.log(`  Timeout: ${config.metabase.timeoutMs}ms\n`);

try {
  const result = await detectarColumnasUsuariosAccesos();
  
  console.log('✅ Conexión exitosa!\n');
  console.log(`Total de usuarios encontrados: ${result.totalRows}\n`);
  
  if (result.columns.length > 0) {
    console.log('📋 Columnas detectadas en UsuariosAccesos:');
    console.table(result.columns.map(col => ({ columna: col })));
    
    console.log('\n🔍 Muestra anonimizada de la primera fila:');
    console.log(JSON.stringify(result.sampleRow, null, 2));
    
    console.log('\n⚠️ IMPORTANTE: Confirmá cuáles de estas columnas corresponden a:');
    console.log('   - Identificador único del usuario');
    console.log('   - Nombre completo');
    console.log('   - Área/Departamento');
    console.log('   - Estado (activo/inactivo)');
    console.log('\nLuego ajustá usersService.js para mapear correctamente esos campos.');
  } else {
    console.log('⚠️ No se pudieron detectar columnas (tabla vacía o error).');
  }
  
} catch (err) {
  console.error('❌ Error de conexión:', err.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Verificar que estés en la red interna (acceso a 10.0.0.8)');
  console.error('  2. Confirmar que METABASE_API_KEY sea válida');
  console.error('  3. Chequear que el grupo de la API key tenga permisos de lectura sobre SAI_TEST');
  console.error('  4. Verificar que el source-table ID 1406 sea correcto');
  process.exit(1);
}