import { config } from '../config.js';

/**
 * Cliente HTTP de Metabase (v0.55.x) con autenticación por x-api-key.
 * SOLO LECTURA: este cliente únicamente consulta /api/dataset,
 * /api/database/:id/metadata y /api/card/:id/query/json.
 * La API key NUNCA sale del backend ni se loguea.
 */
class MetabaseError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'MetabaseError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, timeoutMs = config.metabase.timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${config.metabase.url}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'x-api-key': config.metabase.apiKey,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new MetabaseError(`Timeout de Metabase (${timeoutMs} ms) en ${path}`);
    }
    throw new MetabaseError(`No se pudo conectar a Metabase (${url}): ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new MetabaseError(`Respuesta no JSON de Metabase en ${path} (HTTP ${res.status})`, {
      status: res.status,
    });
  }

  if (!res.ok) {
    const detail = json?.message || json?.error || `HTTP ${res.status}`;
    // 401/403 suele significar API key inválida o grupo sin permisos de lectura sobre SAI_TEST.
    throw new MetabaseError(`Metabase respondió ${res.status}: ${detail}`, { status: res.status, body: json });
  }
  if (json && json.error) {
    throw new MetabaseError(`Error de Metabase en ${path}: ${json.error}`, { status: res.status, body: json });
  }
  return json;
}

/** Combina data.cols + data.rows en un array de objetos. */
export function datasetToObjects(data) {
  const cols = (data?.cols || []).map(c => c.name);
  const rows = data?.rows || [];
  return rows.map(row => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/** Normaliza nombres de columna a minúsculas (el motor de SAI_TEST puede devolver mayúsculas). */
function lowerCaseKeys(objects) {
  return objects.map(obj => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
    return out;
  });
}

/** POST /api/dataset con una pregunta de tipo "query" sobre una source-table.
 *  CORRECCIÓN: el body debe llevar "database" en el nivel superior del query,
 *  además de type y source-table (si no, Metabase responde 400). */
async function runQuery({ 'source-table': sourceTable, limit, offset }) {
  const innerQuery = { 'source-table': sourceTable };
  if (limit != null) innerQuery.limit = limit;
  if (offset != null) innerQuery.offset = offset;

  const json = await request('/api/dataset', {
    method: 'POST',
    body: {
      database: config.metabase.dbId,
      type: 'query',
      query: innerQuery,
    },
  });
  return datasetToObjects(json.data);
}

/** POST /api/dataset con SQL nativo. NO interpolar entradas libres del usuario. */
export async function sql(consulta, params = []) {
  const json = await request('/api/dataset', {
    method: 'POST',
    body: {
      database: config.metabase.dbId,
      type: 'native',
      native: { query: consulta, 'template-tags': {} },
      parameters: params,
    },
  });
  return lowerCaseKeys(datasetToObjects(json.data));
}

/** Lee una tabla completa. Estrategia según configuración:
 *  - METABASE_CARD_ID definido → pregunta guardada (una sola request, sin límite de 2000).
 *  - sino → paginación por offset hasta devolver < pageSize filas. */
export async function tabla(tableId) {
  if (config.metabase.cardId) {
    const json = await request(`/api/card/${config.metabase.cardId}/query/json`, { method: 'POST', body: {} });
    return lowerCaseKeys(datasetToObjects(json.data ?? json));
  }

  const all = [];
  const pageSize = config.metabase.pageSize;
  let offset = 0;
  for (;;) {
    const page = await runQuery({ 'source-table': tableId, limit: pageSize, offset });
    all.push(...lowerCaseKeys(page));
    if (page.length < pageSize) break;
    offset += pageSize;
    if (offset > 100000) throw new MetabaseError('Paginación excedió 100000 filas: revisar la consulta.');
  }
  return all;
}

/** GET /api/database/:id/metadata: estructura real de SAI_TEST (para descubrir columnas). */
export async function databaseMetadata(dbId = config.metabase.dbId) {
  return request(`/api/database/${dbId}/metadata`);
}

export { MetabaseError };