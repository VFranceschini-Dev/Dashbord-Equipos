/**
 * metabase.service.ts
 * ------------------------------------------------------------
 * Cliente HTTP hacia la API de Metabase.
 * Autentica con x-api-key (API Key) — también compatible con un
 * Session Token si tu instancia lo requiere.
 */
import axios, { AxiosInstance } from 'axios';
import type { AppConfig } from '../config.js';

export interface MetabaseQueryRequest {
  /** Parámetros declarados de la tarjeta: {{variable}} → valor */
  parameters?: Array<{ type: string; dimension: string; value: unknown }>;
  /** Opcional: filtro temporal nativo de Metabase */
  filtering?: Record<string, unknown>;
}

export class MetabaseService {
  private client: AxiosInstance;

  constructor(cfg: AppConfig) {
    this.client = axios.create({
      baseURL: cfg.metabaseUrl,
      timeout: cfg.requestTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        // Metabase acepta API Keys vía header x-api-key
        'x-api-key': cfg.metabaseApiKey,
      },
    });
  }

  /**
   * Ejecuta la consulta de una tarjeta/reportes existente.
   * POST /api/card/:id/query
   */
  async queryCard(
    cardId: string,
    parametros: Record<string, unknown> = {},
    opts: MetabaseQueryRequest = {}
  ): Promise<unknown> {
    // Convertimos el objeto libre `parametros` al formato que espera Metabase.
    const parameters =
      opts.parameters ??
      Object.entries(parametros).map(([dimension, value]) => ({
        type: typeof value === 'string' ? 'text' : 'category',
        dimension,
        value,
      }));

    const body: Record<string, unknown> = { parameters };
    if (opts.filtering) body.filtering = opts.filtering;

    const { data } = await this.client.post(`/api/card/${encodeURIComponent(cardId)}/query`, body);
    return data;
  }

  /**
   * Obtiene los metadatos de una tarjeta (nombre, parámetros esperados…).
   * GET /api/card/:id  — útil para validar antes de consultar.
   */
  async getCard(cardId: string): Promise<unknown> {
    const { data } = await this.client.get(`/api/card/${encodeURIComponent(cardId)}`);
    return data;
  }
}
