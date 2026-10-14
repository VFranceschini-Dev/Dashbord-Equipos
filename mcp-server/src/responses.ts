/**
 * responses.ts
 * ------------------------------------------------------------
 * Helpers para devolver SIEMPRE el formato exigido por MCP:
 *   { content: [{ type: "text", text: "..." }] }
 * y, en caso de error, además la bandera `isError: true`
 * para que el cliente/IA trate la respuesta como fallo.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Respuesta exitosa: serializa el payload a JSON legible dentro de 'content'. */
export function ok(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text:
          typeof payload === 'string'
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Respuesta de error "limpia y estructurada".
 * No se lanzan excepciones al SDK: se devuelve isError:true con un
 * objeto JSON descriptivo para que la IA pueda razonar sobre el fallo.
 */
export function fail(
  toolName: string,
  err: unknown,
  detail?: string
): CallToolResult {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Error desconocido';

  const structured = {
    error: true,
    tool: toolName,
    message,
    ...(detail ? { detail } : {}),
    hint: 'El servicio externo (Metabase/Mesh) no respondió correctamente o la solicitud fue inválida.',
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    isError: true,
  };
}

/** Extrae un mensaje amigable desde un error de axios (status + cuerpo). */
export function describeHttpError(err: unknown): string | undefined {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: { status?: number; data?: unknown } }).response
  ) {
    const res = (err as { response: { status?: number; data?: unknown } }).response;
    let body = '';
    try {
      body =
        typeof res.data === 'string'
          ? res.data
          : JSON.stringify(res.data);
    } catch {
      body = '[cuerpo no serializable]';
    }
    // Truncar para no inundar el contexto de la IA
    if (body.length > 800) body = `${body.slice(0, 800)}… (truncado)`;
    return `HTTP ${res.status ?? '?'} — ${body}`;
  }
  return undefined;
}
