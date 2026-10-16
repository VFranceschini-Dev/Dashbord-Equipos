#!/usr/bin/env node
/**
 * scripts/test-ipa.mjs — Prueba de conectividad con Metabase (SAI_TEST, solo lectura).
 *
 * Uso:  npm run test:ipa   (node --env-file=.env.local scripts/test-ipa.mjs)
 * Lee:  IPA_API_URL, IPA_API_KEY, IPA_DB_ID, IPA_USUARIOS_TABLE_ID
 * No imprime la API key ni valores de filas (solo nombres de columnas y conteos).
 */

const apiUrl = (process.env.IPA_API_URL || 'https://ipa.donnet.com.ar').replace(/\/+$/, '');
const apiKey = process.env.IPA_API_KEY || '';
const dbId = parseInt(process.env.IPA_DB_ID || '', 10);
const tableId = parseInt(process.env.IPA_USUARIOS_TABLE_ID || '', 10);

const REQUIRED_COLUMNS = [
  'usuariosaccesoid',
  'nombre',
  'descripcion',
  'perfil',
  'ubicacionid',
  'tipo',
  'activo',
];

let failed = false;
const ok = msg => console.log(`✅ ${msg}`);
const bad = msg => {
  console.log(`❌ ${msg}`);
  failed = true;
};

async function withTimeout(url, init, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Paso 0: variables -------------------------------------------------------
if (!apiKey) bad('Falta IPA_API_KEY (definila en .env.local o en el entorno).');
if (!Number.isFinite(dbId)) bad('Falta IPA_DB_ID o no es numérico.');
if (!Number.isFinite(tableId)) bad('Falta IPA_USUARIOS_TABLE_ID o no es numérico.');
if (failed) {
  console.log('\nNo se puede continuar sin las variables necesarias.');
  process.exitCode = 1;
  process.exit();
}

// --- Paso 1: versión de Metabase --------------------------------------------
try {
  const res = await withTimeout(`${apiUrl}/api/session/properties`, { method: 'GET' });
  if (res.ok) {
    const json = await res.json();
    ok(`Metabase accesible. Versión: ${json?.version?.version ?? 'desconocida'} (${apiUrl})`);
  } else {
    bad(`/api/session/properties respondió HTTP ${res.status}`);
  }
} catch (err) {
  bad(`No se pudo conectar a ${apiUrl}: ${err.message}`);
}

// --- Paso 2: API key válida ---------------------------------------------------
try {
  const res = await withTimeout(`${apiUrl}/api/user/current`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  if (res.ok) {
    const json = await res.json().catch(() => ({}));
    ok(`API key válida (usuario: ${json?.common_name ? '[nombre presente]' : '[sin nombre]'}).`);
  } else {
    bad(`API key rechazada por /api/user/current (HTTP ${res.status}).`);
  }
} catch (err) {
  bad(`Error al validar la API key: ${err.message}`);
}

// --- Paso 3: consulta con limit 1 + total + nombres de columnas --------------
let columns = [];
try {
  const res = await withTimeout(`${apiUrl}/api/dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      database: dbId,
      type: 'query',
      query: { 'source-table': tableId, limit: 1, offset: 0 },
    }),
  });
  if (res.ok) {
    const json = await res.json();
    if (json?.error) {
      bad(`Metabase devolvió error en /api/dataset: ${String(json.error).slice(0, 200)}`);
    } else {
      columns = (json?.data?.cols || []).map(c =>
        (typeof c === 'string' ? c : c?.name || '').toLowerCase()
      );
      const totalRows = json?.data?.rows?.length ?? 0;
      ok(`Consulta OK (limit 1): ${totalRows} fila(s) devuelta(s).`);
      ok(`Columnas (${columns.length}): ${columns.join(', ')}`);

      // --- Paso 4: verificar las 7 columnas usadas --------------------------
      const missing = REQUIRED_COLUMNS.filter(c => !columns.includes(c));
      if (missing.length === 0) {
        ok(`Las 7 columnas requeridas están presentes: ${REQUIRED_COLUMNS.join(', ')}`);
      } else {
        bad(`Faltan columnas requeridas: ${missing.join(', ')}`);
      }
    }
  } else {
    bad(`/api/dataset respondió HTTP ${res.status}.`);
  }
} catch (err) {
  bad(`Error al consultar /api/dataset: ${err.message}`);
}

console.log(failed ? '\nResultado: FALLO.' : '\nResultado: TODO OK.');
if (failed) process.exitCode = 1;
