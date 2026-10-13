/**
 * index.ts — Punto de entrada del Servidor MCP
 * ------------------------------------------------------------
 * Arquitectura:
 *   Aplicación web (cliente MCP)  ⇄  SSE (GET /sse + POST /messages)  ⇄  Express
 *        Servidor MCP (este proceso)  ⇄  HTTP  ⇄  Metabase / Mesh
 *
 * Transporte: Server-Sent Events (SSEServerTransport del SDK oficial).
 * Cada conexión SSE crea su propia sesión/transporte; los mensajes
 * JSON-RPC entrantes llegan por POST a /messages con sessionId.
 */
import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { loadConfig } from './config.js';
import { MetabaseService } from './services/metabase.service.js';
import { MeshService } from './services/mesh.service.js';
import { registerTools } from './tools.js';

const config = loadConfig();

/* ------------------------------------------------------------------ */
/* Factory: un McpServer por sesión (recomendado por el propio SDK)   */
/* ------------------------------------------------------------------ */
function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'puente-metabase-mesh', version: '1.0.0' },
    {
      // Versión explícita del protocolo para entornos de producción
      instructions:
        'Servidor MCP puente hacia Metabase (reportes) y Mesh (datos operativos). ' +
        'Usa consultar_reporte para tarjetas de Metabase y obtener_datos_mesh para recursos de Mesh.',
    }
  );

  registerTools(server, {
    metabase: new MetabaseService(config),
    mesh: new MeshService(config),
  });

  return server;
}

/* ------------------------------------------------------------------ */
/* Express + transporte SSE                                            */
/* ------------------------------------------------------------------ */
// IMPORTANTE: NO usar app.use(express.json()) a nivel global.
// SSEServerTransport.handlePostMessage() lee el cuerpo crudo del stream;
// si un middleware de JSON ya lo consumió, el POST falla con "stream is not readable".
const app = express();

// Sesiones SSE activas: sessionId → transporte
const sessions = new Map<string, SSEServerTransport>();

// 1) Endpoint SSE: el cliente abre aquí la conexión de eventos
app.get('/sse', async (req: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  const sessionId = transport.sessionId ?? randomUUID();
  sessions.set(sessionId, transport);

  // Limpieza automática cuando el cliente cierra la conexión
  res.on('close', () => {
    sessions.delete(sessionId);
    console.log(`[SSE] Sesión cerrada: ${sessionId}`);
  });

  try {
    const server = createMcpServer();
    await server.connect(transport);
    console.log(`[SSE] Nueva sesión establecida: ${sessionId}`);
  } catch (err) {
    console.error('[SSE] Error al conectar la sesión:', err);
    sessions.delete(sessionId);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo establecer la sesión MCP' });
    }
  }
});

// 2) Endpoint de mensajes: aquí envía el cliente los JSON-RPC (POST)
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const transport = sessionId ? sessions.get(sessionId) : undefined;

  if (!transport) {
    res
      .status(400)
      .json({ error: 'Sesión inválida. Abre primero la conexión GET /sse y usa su sessionId.' });
    return;
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error('[MCP] Error procesando mensaje:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno procesando el mensaje MCP' });
    }
  }
});

// Health-check simple para balanceadores / monitoreo en producción
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'puente-metabase-mesh',
    sesiones_activas: sessions.size,
  });
});

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */
const httpServer = app.listen(config.port, () => {
  console.log('=====================================================');
  console.log(' Servidor MCP "Puente Metabase ⇄ Mesh" listo');
  console.log(`   SSE endpoint : http://localhost:${config.port}/sse`);
  console.log(`   Messages     : http://localhost:${config.port}/messages?sessionId=<id>`);
  console.log(`   Health       : http://localhost:${config.port}/health`);
  console.log(`   Metabase URL : ${config.metabaseUrl}`);
  console.log(`   Mesh URL     : ${config.meshUrl}`);
  console.log('=====================================================');
});

// Apagado limpio (Ctrl+C / orquestadores como Docker/K8s)
process.on('SIGINT', () => {
  console.log('\n[CERRANDO] Finalizando sesiones SSE…');
  for (const [, t] of sessions) {
    t.close().catch(() => undefined);
  }
  httpServer.close(() => process.exit(0));
});
