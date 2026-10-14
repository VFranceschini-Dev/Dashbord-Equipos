import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Variable de entorno obligatoria faltante: ${name}. Copiá server/.env.example a server/.env y completala.`
    );
  }
  return value.trim();
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  metabase: {
    url: required('METABASE_URL').replace(/\/+$/, ''),
    apiKey: required('METABASE_API_KEY'),
    dbId: parseInt(process.env.METABASE_DB_ID || '5', 10),
    timeoutMs: parseInt(process.env.METABASE_TIMEOUT_MS || '15000', 10),
    pageSize: Math.min(parseInt(process.env.METABASE_PAGE_SIZE || '2000', 10), 2000),
    cardId: (process.env.METABASE_CARD_ID || '').trim() || null,
    usuariosTableId: parseInt(process.env.SAI_USUARIOS_TABLE_ID || '1406', 10),
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  usersCacheTtlMs: parseInt(process.env.USERS_CACHE_TTL_MS || '300000', 10),
};
