#!/usr/bin/env node
/**
 * Test de conexión con Metabase SAI_TEST (solo lectura) usando las variables
 * del servidor de .env.local (node --env-file=.env.local scripts/test-ipa.mjs).
 * No imprime la API key en ningún paso.
 */

const BASE = (process.env.IPA_API_URL || 'https://donnet.com.ar').replace(/\/+\$/, '');
const KEY = process.env.IPA_API_KEY || '';
const DB_ID = Number(process.env.IPA_DB_ID || 5);

// Definimos las columnas seguras requeridas de forma explícita
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
    if (res.ok) ok('API key válida (/api/user/current responded OK).');
    else fail(`API key rechazada: HTTP ${res.status}. Verifica IPA_API_KEY.`);
  } catch (err) {
    fail(`Error validando la API key: ${err.message}`);
  }

  // 3) Consulta con TOP 1 usando consulta SQL nativa compatible con SQL Server / Sybase
  try {
    const res = await fetch(`${BASE}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: 'native',
        native: {
          // Adaptamos la sintaxis T-SQL usando TOP 1 para la base de datos de Donnet
          query: `SELECT TOP 1 ${COLUMNAS_REQUERIDAS.join(', ')} FROM UsuariosAccesos WHERE Tipo = 'U'`,
          'template-tags': {}
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    
    // Log de diagnóstico seguro
    const topKeys = Object.keys(json ?? {}).join(', ');
    const rowsLength = json?.data?.rows?.length ?? 0;
    const rowCountField = json?.data?.row_count ?? 'undefined';
    console.log(`[diag:] HTTP: ${res.status} | Status: ${json?.status ?? 'N/A'} | Claves: [${topKeys}] | rows.length: ${rowsLength} | row_count: ${rowCountField}`);
    if (json?.error) console.log(`[diag:] Error detectado: ${json.error}`);

    if (!res.ok || json?.error || json?.status === 'failed') {
      const errMsg = json?.error || (json?.status === 'failed' ? 'Metabase status failed' : '');
      fail(`Consulta a UsuariosAccesos falló: HTTP ${res.status} (${errMsg})`);
    } else {
      const cols = (json?.data?.cols ?? []).map((c) => String(c?.name ?? '').toLowerCase());
      
      // Conteo correcto basado en las filas reales de la respuesta de la consulta nativa
      const totalFilas = json?.data?.rows?.length || 0;
      ok(`Consulta OK. Total de filas devueltas en UsuariosAccesos: ${totalFilas}`);
      console.log(`   Columnas devueltas de forma segura: ${cols.join(', ')}`);

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
