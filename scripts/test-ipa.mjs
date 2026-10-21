#!/usr/bin/env node
/**
 * Test de diagnóstico de la fuente primaria de usuarios (solo lectura),
 * ejecutado en tu máquina contra el servidor interno usando las variables
 * de .env.local (npm run test:ipa). Sirve para verificar conectividad,
 * credencial y esquema ANTES de configurar la función serverless /api/usuarios.
 * No imprime la API key en ningún paso.
 */

const BASE = (process.env.IPA_API_URL || 'https://ipa.donnet.com.ar').replace(/\/+$/, '');
const KEY = process.env.IPA_API_KEY || '';
const DB_ID = Number(process.env.IPA_DB_ID || 5);

const PAGE_SIZE_TEST = 2000;

const COLUMNAS_REQUERIDAS = [
  'usuariosaccesoid', 'nombre', 'descripcion', 'perfil', 'ubicacionid', 'tipo', 'activo',
];

let fallos = 0;
const ok = (msg) => console.log(`✅ ${msg}`);
const fail = (msg) => { console.log(`❌ ${msg}`); fallos++; };
const warn = (msg) => console.log(`⚠️ ${msg}`);

// Clave primaria de la tabla (se detecta en runtime desde data.cols; default 'tipo')
let PK_COL = null;
function detectarPk(cols) {
  if (cols.includes('usuariosaccesoid')) return 'usuariosaccesoid';
  return cols.find((c) => c.endsWith('id')) ?? 'tipo';
}

async function main() {
  if (!KEY) {
    fail('Falta IPA_API_KEY en el entorno (.env.local). No la escribas en el repo: agregala como variable de entorno.');
    process.exitCode = 1;
    return;
  }

  // 1) Versión del servicio de datos
  try {
    const res = await fetch(`${BASE}/api/session/properties`, { signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    const version = json?.version?.value ?? 'desconocida';
    if (res.ok) ok(`Servicio de datos accesible. Versión: ${version}`);
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

  // 3) Consultas nativas al dataset (SQL Server / T-SQL; sin valores de filas
  //    ni columnas sensibles). La base subyacente es SQL Server, por eso se usa
  //    type:'native' con sintaxis TOP/OFFSET-FETCH en lugar del query builder.
  // Columnas sensibles que JAMÁS deben proyectarse en un SELECT (se verifican
  // contra las columnas devueltas por la proyección segura).
  const SENSIBLES = ['contrasenia', 'contrasenavencimiento', 'contraseniaperiodo', 'servicekey_path'];
  const TABLA = 'UsuariosAccesos';

  async function consultarNativo(sql, etiqueta) {
    const res = await fetch(`${BASE}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ database: DB_ID, type: 'native', native: { query: sql } }),
      signal: AbortSignal.timeout(15000),
    });
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { /* respuesta no JSON */ }

    // Diagnóstico seguro: SOLO status, claves de nivel superior y conteos.
    // Nunca se imprimen valores de filas ni la columna Contrasenia.
    console.log(`[diag:${etiqueta}] HTTP: ${res.status} | Status: ${json?.status ?? 'N/A'} | Claves: [${Object.keys(json ?? {}).join(', ')}] | rows.length: ${json?.data?.rows?.length ?? 0} | row_count: ${json?.data?.row_count ?? 'undefined'}`);

    if (!res.ok || json?.error || json?.status === 'failed') {
      fail(`[${etiqueta}] Consulta falló: HTTP ${res.status}${json?.error ? ` (${String(json.error).slice(0, 200)})` : ''}`);
      return null;
    }
    return json;
  }

  // Conteo correcto: mapear directamente data.rows.length (row_count no viene
  // en respuestas normales de /api/dataset).
  const contarFilas = (json) => json?.data?.rows?.length ?? 0;

  // Proyección segura: solo las 7 columnas requeridas (nunca sensibles).
  const PROYECCION = COLUMNAS_REQUERIDAS.join(', ');

  // 3a) SELECT TOP 1 con la proyección segura de las 7 columnas requeridas.
  let cols = [];
  try {
    const jsonFull = await consultarNativo(`SELECT TOP 1 ${PROYECCION} FROM ${TABLA}`, 'select-top1');
    if (jsonFull) {
      cols = (jsonFull?.data?.cols ?? [])
        .map((c) => (typeof c === 'string' ? c : String(c?.name ?? '')).toLowerCase())
        .filter(Boolean);
      PK_COL = detectarPk(cols);
      ok(`SELECT TOP 1 OK: filas devueltas = ${contarFilas(jsonFull)}`);
      console.log(`   Columnas: ${cols.join(', ')}`);
      const sensiblesPresentes = cols.filter((c) => SENSIBLES.includes(c));
      if (sensiblesPresentes.length > 0) fail(`La proyección incluyó columnas sensibles: ${sensiblesPresentes.join(', ')}`);
      else ok('Proyección sin columnas sensibles (Contrasenia/ServiceKey_Path excluidas).');
      const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !cols.includes(c));
      if (faltantes.length === 0) ok('Las 7 columnas usadas están presentes.');
      else fail(`Faltan columnas esperadas: ${faltantes.join(', ')}`);
    }
  } catch (err) {
    fail(`Error consultando el dataset (SELECT TOP 1): ${err.message}`);
  }

  // 3b) Conteo total real con COUNT(*) nativo (no depende del limit).
  let totalReal = null;
  try {
    const json = await consultarNativo(`SELECT COUNT(*) FROM ${TABLA}`, 'count-total');
    if (json) {
      const v = json?.data?.rows?.[0]?.[0];
      totalReal = Number(v);
      if (Number.isFinite(totalReal)) ok(`Total de filas en la tabla (COUNT nativo): ${totalReal}`);
      else fail(`El COUNT devolvió un valor no numérico.`);
    }
  } catch (err) {
    fail(`Error obteniendo el COUNT nativo: ${err.message}`);
  }

  // 3c) Fallback: si el COUNT no funcionó, contar paginando (T-SQL OFFSET/FETCH)
  //     sin exponer valores de filas.
  if (totalReal === null || !Number.isFinite(totalReal)) {
    try {
      let suma = 0;
      let offset = 0;
      for (let i = 0; i < 30 && offset < 50000; i++) {
        const json = await consultarNativo(
          `SELECT TOP ${PAGE_SIZE_TEST} ${PROYECCION} FROM ${TABLA} ORDER BY usuariosaccesoid OFFSET ${offset} ROWS FETCH NEXT ${PAGE_SIZE_TEST} ROWS ONLY`,
          `paginar-${offset}`,
        );
        if (!json) break;
        const n = contarFilas(json);
        suma += n;
        if (n < PAGE_SIZE_TEST) break;
        offset += PAGE_SIZE_TEST;
      }
      ok(`Total de filas (fallback por paginación T-SQL): ${suma}`);
    } catch (err) {
      fail(`Error contando por paginación: ${err.message}`);
    }
  }

  // 5) Prueba filtrando Tipo = 'U' (personas), con la misma proyección segura.
  try {
    const json = await consultarNativo(
      `SELECT TOP 1 ${PROYECCION} FROM ${TABLA} WHERE Tipo = 'U'`,
      'filtro-tipo-U',
    );
    if (json) {
      const n = contarFilas(json);
      if (n > 0) ok(`Con filtro Tipo='U' la consulta devuelve filas.`);
      else fail(`Con filtro Tipo='U' no devuelve filas (revisar columna tipo).`);
    }
  } catch (err) {
    fail(`Error probando el filtro Tipo='U': ${err.message}`);
  }

  if (fallos > 0) {
    process.exitCode = 1;
    console.log(`\n${fallos} paso(s) con errores.`);
  } else {
    console.log('\nTodos los pasos pasaron. La función /api/usuarios debería funcionar en Vercel.');
  }
}

main();
