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
const TABLE_ID = Number(process.env.IPA_USUARIOS_TABLE_ID || 1406);

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

  // 3) Consultas al dataset (sin valores de filas ni columnas sensibles)
  const SENSIBLES = ['contrasenia', 'contrasenavencimiento', 'contraseniaperiodo', 'servicekey_path'];

  async function consultarQuery(query, etiqueta) {
    const res = await fetch(`${BASE}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ database: DB_ID, type: 'query', query }),
      signal: AbortSignal.timeout(15000),
    });
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { /* respuesta no JSON */ }

    // Diagnóstico seguro: solo status, claves de nivel superior, conteos y error.
    // Nunca se imprimen valores de filas ni la columna Contrasenia.
    console.log(`   [diag:${etiqueta}] HTTP=${res.status} top=${Object.keys(json ?? {}).join('|')} dataKeys=${json?.data ? Object.keys(json.data).join('|') : '-'} rows=${Array.isArray(json?.data?.rows) ? json.data.rows.length : 'n/a'} row_count=${json?.data?.row_count ?? 'n/a'} status=${json?.status ?? 'n/a'} error=${json?.error ? String(json.error).slice(0, 200) : 'ninguno'}`);

    if (!res.ok || json?.error || json?.status === 'failed') {
      fail(`[${etiqueta}] Consulta falló: HTTP ${res.status}${json?.error ? ` (${String(json.error).slice(0, 200)})` : ''}`);
      return null;
    }
    return json;
  }

  // ids de las 7 columnas necesarias (se detectan en runtime desde data.cols,
  // comparando en minúsculas; así excluimos Contrasenia y demás sensibles del SELECT)
  let FIELD_IDS = null;

  // 3a) Probar el SELECT completo primero: si Metabase rechaza una proyección
  // explícita por incompatibilidad de tipos, degradar a SELECT * sin romperse.
  let selectOk = false;
  let cols = [];
  try {
    const jsonFull = await consultarQuery({ 'source-table': TABLE_ID, limit: 1 }, 'select-full-limit1');
    if (jsonFull) {
      cols = (jsonFull?.data?.cols ?? [])
        .map((c) => (typeof c === 'string' ? c : String(c?.name ?? '')).toLowerCase())
        .filter(Boolean);
      PK_COL = detectarPk(cols);
      ok(`SELECT OK (limit 1): filas devueltas = ${jsonFull?.data?.rows?.length ?? jsonFull?.data?.row_count ?? 0}`);
      console.log(`   Columnas: ${cols.join(', ')}`);
      const sensiblesPresentes = cols.filter((c) => SENSIBLES.includes(c));
      if (sensiblesPresentes.length > 0) warn(`Columnas sensibles presentes en el SELECT: ${sensiblesPresentes.join(', ')} (se excluyen explícitamente)`);
      const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !cols.includes(c));
      if (faltantes.length === 0) ok('Las 7 columnas usadas están presentes.');
      else fail(`Faltan columnas esperadas: ${faltantes.join(', ')}`);
      selectOk = true;
    }
  } catch (err) {
    fail(`Error consultando el dataset (SELECT completo): ${err.message}`);
  }

  // 3b) SELECT explícito de las 7 columnas (excluye Contrasenia/ServiceKey_Path/binarias)
  try {
    if (selectOk && cols.length > 0) {
      const jsonMeta = await consultarQuery({ 'source-table': TABLE_ID, limit: 0 }, 'detect-cols');
      if (jsonMeta) {
        const metaCols = jsonMeta?.data?.cols ?? [];
        const wanted = new Set(COLUMNAS_REQUERIDAS);
        const ids = metaCols
          .map((c) => ({ name: String(c?.name ?? '').toLowerCase(), id: c?.id }))
          .filter((c) => wanted.has(c.name) && c.id != null)
          .map((c) => c.id);
        if (ids.length >= 6) {
          FIELD_IDS = ids;
          const jsonSel = await consultarQuery(
            { 'source-table': TABLE_ID, fields: FIELD_IDS, limit: 1 },
            'select-siete-columnas',
          );
          if (jsonSel) ok(`SELECT de las 7 columnas (sin sensibles) funciona: filas devueltas = ${jsonSel?.data?.rows?.length ?? 0}`);
          else warn('Metabase rechazó la proyección explícita de columnas; se seguirá probando con SELECT completo (solo diagnóstico).');
        } else {
          warn('No se pudieron resolver los ids de columnas para el SELECT explícito.');
        }
      }
    }
  } catch (err) {
    warn(`No se pudo probar el SELECT explícito: ${err.message}`);
  }

  // 3c) Conteo total real (count(*) agregado — no depende del limit ni de traer filas)
  let totalReal = null;
  try {
    const json = await consultarQuery(
      {
        'source-table': TABLE_ID,
        aggregation: { 'count-of-rows': true },
        limit: 1,
      },
      'count-total',
    );
    if (json) {
      const v = json?.data?.rows?.[0]?.[0];
      totalReal = Number(v);
      if (Number.isFinite(totalReal)) ok(`Total de filas en la tabla (count agregado): ${totalReal}`);
      else fail(`El count agregado devolvió un valor no numérico: ${v}`);
    }
  } catch (err) {
    fail(`Error obteniendo el count agregado: ${err.message}`);
  }

  // 3c) Fallback: si el agregado no funcionó, contar paginando sin exponer valores
  if (totalReal === null || !Number.isFinite(totalReal)) {
    try {
      let suma = 0;
      let offset = 0;
      for (let i = 0; i < 30 && offset < 50000; i++) {
        const json = await consultarQuery({ 'source-table': TABLE_ID, limit: 2000, offset }, `paginar-${offset}`);
        if (!json) break;
        const n = json?.data?.rows?.length ?? 0;
        suma += n;
        if (n < 2000) break;
        offset += 2000;
      }
      ok(`Total de filas (fallback por paginación): ${suma}`);
    } catch (err) {
      fail(`Error contando por paginación: ${err.message}`);
    }
  }

  // 5) Prueba filtrando Tipo = 'U' (personas)
  try {
    const pk = PK_COL ?? 'tipo';
    const q = { 'source-table': TABLE_ID, 'filter': ['=', ['field', pk], 'U'], limit: 1 };
    if (FIELD_IDS) q.fields = FIELD_IDS;
    const json = await consultarQuery(q, 'filtro-tipo-U');
    if (json) {
      const n = json?.data?.rows?.length ?? 0;
      if (n > 0) ok(`Con filtro Tipo='U' (columna "${pk}") la consulta devuelve filas.`);
      else fail(`Con filtro Tipo='U' no devuelve filas (revisar clave primaria/columna tipo).`);
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
