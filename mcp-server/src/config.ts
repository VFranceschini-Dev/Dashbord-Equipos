/**
 * config.ts
 * ------------------------------------------------------------
 * Centraliza la lectura de variables de entorno.
 * NUNCA hardcodear credenciales: todo viene del archivo .env
 * (cargado por dotenv en el punto de entrada, index.ts).
 */
import 'dotenv/config';

export interface AppConfig {
  /** Puerto HTTP donde escucha el servidor MCP (transporte SSE) */
  port: number;
  /** URL base de Metabase, ej: https://metabase.midominio.com */
  metabaseUrl: string;
  /** API Key de Metabase (header x-api-key) o Session Token */
  metabaseApiKey: string;
  /** URL base de Mesh, ej: https://mesh.midominio.com */
  meshUrl: string;
  /** API Key de Mesh (header Authorization o x-api-key) */
  meshApiKey: string;
  /** Timeout de las peticiones HTTP a servicios externos (ms) */
  requestTimeoutMs: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[CONFIG] Falta la variable de entorno obligatoria "${name}". ` +
        `Revisa tu archivo .env (puedes partir de .env.example).`
    );
  }
  return value.trim().replace(/\/+$/, ''); // sin barra final
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(optional('PORT', '3000'), 10),
    metabaseUrl: required('METABASE_URL'),
    metabaseApiKey: required('METABASE_API_KEY'),
    meshUrl: required('MESH_URL'),
    meshApiKey: required('MESH_API_KEY'),
    requestTimeoutMs: parseInt(optional('REQUEST_TIMEOUT_MS', '30000'), 10),
  };
}
