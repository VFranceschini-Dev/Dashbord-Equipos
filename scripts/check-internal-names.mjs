import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Revisa solo lo que se publica (dist): lo que el navegador realmente recibe.
const DIST = 'dist';
const PROHIBIDOS = [
  /SAI_TEST/i, /UsuariosAccesos/i, /Users_Nuevos/i, /ipa_test/i,
  /ipa\.donnet\.com\.ar/i, /service_role/i, /solo lectura/i, /metabase/i,
];

function listar(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  }).filter((p) => /\.(js|html|css)$/.test(p));
}

let errores = 0;
for (const archivo of listar(DIST)) {
  const texto = readFileSync(archivo, 'utf8');
  for (const re of PROHIBIDOS) {
    const m = texto.match(re);
    if (m) { console.error(`✗ ${archivo} contiene "${m[0]}"`); errores++; }
  }
}
if (errores) {
  console.error(`\n✗ Control de nombres internos FALLÓ: ${errores} aparición(es).`);
  process.exit(1);
}
console.log('✓ Control de nombres internos OK');
