/**
 * mesh.service.ts
 * ------------------------------------------------------------
 * Cliente HTTP hacia la API de Mesh.
 * Autentica con API Key vía header Authorization: Bearer <key>.
 * (Si tu Mesh usa otro header —p. ej. x-api-key—, solo hay que
 * cambiar la línea de headers del constructor.)
 */
import axios, { AxiosInstance } from 'axios';
import type { AppConfig } from '../config.js';

export class MeshService {
  private client: AxiosInstance;

  constructor(cfg: AppConfig) {
    this.client = axios.create({
      baseURL: cfg.meshUrl,
      timeout: cfg.requestTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.meshApiKey}`,
      },
    });
  }

  /**
   * Consulta un endpoint arbitrario de Mesh aplicando filtros como query params.
   * Ej: obtener('dispositivos', { estado: 'activo', page: 1 })
   *   → GET {MESH_URL}/dispositivos?estado=activo&page=1
   */
  async fetch(
    endpoint: string,
    filtros: Record<string, unknown> = {}
  ): Promise<unknown> {
    // Normalizamos el endpoint: sin barra inicial duplicada y validado
    const clean = endpoint.replace(/^\/+/, '');
    if (!/^[A-Za-z0-9._/-]+$/.test(clean)) {
      throw new Error(
        `Endpoint no válido: "${endpoint}". Solo se permiten caracteres alfanuméricos, ".", "_" , "-" y "/".`
      );
    }

    // Los filtros se pasan como query params; los objetos/arrays se serializan a JSON
    const params: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(filtros)) {
      if (v === undefined || v === null) continue;
      params[k] = typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean);
    }

    const { data } = await this.client.get(`/${clean}`, { params });
    return data;
  }
}
