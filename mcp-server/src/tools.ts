/**
 * tools.ts
 * ------------------------------------------------------------
 * Registro de las herramientas MCP sobre una instancia de McpServer.
 * Cada tool:
 *   - define su schema con zod (validación automática de argumentos)
 *   - envuelve la lógica en try/catch y responde siempre en formato
 *     MCP { content: [{ type: "text", text }] } vía los helpers ok/fail.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MetabaseService } from './services/metabase.service.js';
import type { MeshService } from './services/mesh.service.js';
import { ok, fail, describeHttpError } from './responses.js';

export interface ToolServices {
  metabase: MetabaseService;
  mesh: MeshService;
}

export function registerTools(server: McpServer, services: ToolServices): void {
  /* ------------------------- HERRAMIENTAS METABASE ------------------------ */

  server.registerTool(
    'consultar_reporte',
    {
      title: 'Consultar reporte de Metabase',
      description:
        'Ejecuta un reporte/tarjeta existente en Metabase (POST /api/card/:id/query). ' +
        'Recibe el id de la tarjeta y parámetros opcionales para sus variables {{filtro}}.',
      inputSchema: {
        card_id: z
          .string()
          .describe('ID numérico o slug de la tarjeta (card) en Metabase, ej: "42"'),
        parametros: z
          .record(z.string(), z.any())
          .optional()
          .describe(
            'Objeto opcional con los parámetros declarados de la tarjeta, ' +
              'ej: { "fecha_desde": "2026-01-01", "region": "Norte" }'
          ),
      },
    },
    async ({ card_id, parametros }) => {
      try {
        const data = await services.metabase.queryCard(card_id, parametros ?? {});
        return ok({ origen: 'metabase', card_id, datos: data });
      } catch (err) {
        return fail('consultar_reporte', err, describeHttpError(err));
      }
    }
  );

  /* --------------------------- HERRAMIENTAS MESH -------------------------- */

  server.registerTool(
    'obtener_datos_mesh',
    {
      title: 'Obtener datos de Mesh',
      description:
        'Consulta la API de Mesh sobre un endpoint determinado aplicando filtros como query params. ' +
        'Ej: endpoint="dispositivos", filtros={ estado: "activo" } → GET /dispositivos?estado=activo',
      inputSchema: {
        endpoint: z
          .string()
          .describe('Ruta del recurso en Mesh, sin dominio inicial, ej: "dispositivos" o "v1/ordenes"'),
        filtros: z
          .record(z.string(), z.any())
          .optional()
          .describe('Objeto opcional de filtros enviados como query parameters'),
      },
    },
    async ({ endpoint, filtros }) => {
      try {
        const data = await services.mesh.fetch(endpoint, filtros ?? {});
        return ok({ origen: 'mesh', endpoint, filtros: filtros ?? {}, datos: data });
      } catch (err) {
        return fail('obtener_datos_mesh', err, describeHttpError(err));
      }
    }
  );
}
