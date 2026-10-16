#!/usr/bin/env node
/**
 * Test de conexión con Metabase SAI_TEST (solo lectura) usando las variables
 * del servidor de .env.local (node --env-file=.env.local scripts/test-ipa.mjs).
 * No imprime la API key en ningún paso.
 */

const BASE = (process.env.IPA_API_URL || 'https://ipa.donnet.com.ar').replace(/\/+$/, '');
const KEY = process.env.IPA_API_KEY || '';
const DB_ID = Number(process.env.IPA_DB_ID || 5);
const TABLE_ID = Number(process.env.IPA_USUARIOS_TABLE_ID || 1406);

const COLUMNAS_REQUERIDAS = [
  'usuariosaccesoid', 'nombre', 'descripcion', 'perfil', 'ubicacionid', 'tipo', 'activo',
];

let fallos = 0;
const ok = (msg) => console.log(`✅ ${msg}`);
const fail = (msg) => { console.log(`❌ ${msg}`); fallos++; };

async function main() {
  if (!KEY) {
    fail('Falta IPA_API_KEY en el entorno (.env.local). No la escribas en el repo: agregala como variable de entorno.');
    process.exitCode = 1;
    return;
  }

  // 1) Versión de Metabase
  try {
    const res = await fetch(`${BASE}/api/session/properties`, { signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    const version = json?.version?.value ?? 'desconocida';
    if (res.ok) ok(`Metabase accesible. Versión: ${version}`);
    else fail(`/api/session/properties respondió HTTP ${res.status}`);
  } catch (err) {
    fail(`No se pudo conectar con ${BASE}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  // 2) API key válida
  try {
    const res = await fetch(`${BASE}/api/user/current`, {
      headers: { 'x-api-key': KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) ok('API key válida (/api/user/current respondió OK).');
    else fail(`API key rechazada: HTTP ${res.status}. Verifica IPA_API_KEY.`);
  } catch (err) {
    fail(`Error validando la API key: ${err.message}`);
  }

  // 3) Consulta con limit 1 + total de filas + NOMBRES de columnas (sin valores)
  try {
    const res = await fetch(`${BASE}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: 'query',
        query: { 'source-table': TABLE_ID, limit: 1 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    if (!res.ok || json?.error) {
      fail(`Consulta a UsuariosAccesos falló: HTTP ${res.status}${json?.error ? ` (${json.error})` : ''}`);
    } else {
      const cols = (json?.data?.cols ?? []).map((c) => String(c?.name ?? '').toLowerCase());
      const row_count = json?.data?.row_count ?? 0;
      ok(`Consulta OK. Total de filas en UsuariosAccesos: ${row_count}`);
      console.log(`   Columnas: ${cols.join(', ')}`);

      // 4) Verificación de las 7 columnas usadas por /api/usuarios
      const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !cols.includes(c));
      if (faltantes.length === 0) ok('Las 7 columnas usadas están presentes.');
      else fail(`Faltan columnas esperadas: ${faltantes.join(', ')}`);
    }
  } catch (err) {
    fail(`Error consultando el dataset: ${err.message}`);
  }

  if (fallos > 0) {
    process.exitCode = 1;
    console.log(`\n${fallos} paso(s) con errores.`);
  } else {
    console.log('\nTodos los pasos pasaron. La función /api/usuarios debería funcionar en Vercel.');
  }
}

main();
