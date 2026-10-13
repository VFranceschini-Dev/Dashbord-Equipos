# Servidor MCP — Puente Metabase ⇄ Mesh

Servidor **MCP (Model Context Protocol)** en **TypeScript/Node.js** que actúa como
puente entre la aplicación web principal (cliente MCP) y dos servicios externos:
**Metabase** (reportes) y **Mesh** (datos operativos).

## Arquitectura

```
Aplicación web (cliente MCP)
   │  SSE: GET /sse   +   JSON-RPC: POST /messages?sessionId=<id>
   ▼
Express + @modelcontextprotocol/sdk  (este servidor)
   │                                │
   ▼                                ▼
Metabase API                     Mesh API
POST /api/card/:id/query         GET /<endpoint>?filtros…
(x-api-key)                      (Authorization: Bearer)
```

> Nota: el transporte clásico SSE (`SSEServerTransport`) está marcado como
> *deprecated* por el SDK oficial en favor de *Streamable HTTP*, pero sigue
> siendo ampliamente soportado y es lo solicitado aquí. Si tu cliente MCP
> soporta Streamable HTTP, migrar es trivial cambiando solo `index.ts`.

## Estructura

```
mcp-server/
├── src/
│   ├── index.ts                    # Arranque: Express + transporte SSE + sesiones
│   ├── config.ts                   # Variables de entorno (sin credenciales en duro)
│   ├── tools.ts                    # Registro de tools MCP (zod schemas + try/catch)
│   ├── responses.ts                # Helpers ok()/fail() → formato { content:[{type:'text'}] }
│   └── services/
│       ├── metabase.service.ts     # POST /api/card/:id/query  (x-api-key)
│       └── mesh.service.ts         # GET /<endpoint>?filtros   (Bearer token)
├── .env.example                    # Plantilla de configuración
├── tsconfig.json
└── package.json
```

## Herramientas expuestas

| Tool | Parámetros | Descripción |
|---|---|---|
| `consultar_reporte` | `card_id: string`, `parametros?: object` | Ejecuta una tarjeta de Metabase vía `POST /api/card/:id/query`. El objeto `parametros` se traduce automáticamente al formato `[{type, dimension, value}]` de Metabase. |
| `obtener_datos_mesh` | `endpoint: string`, `filtros?: object` | Consulta un recurso de Mesh pasando `filtros` como query params. Valida el endpoint contra path traversal. |

### Formato de respuesta

Todas las tools devuelven el formato MCP estándar:

```json
{ "content": [ { "type": "text", "text": "<JSON del resultado>" } ] }
```

En caso de error (API caída, credencial inválida, timeout…), **no se lanza una
excepción al SDK**: se devuelve un error limpio y estructurado que la IA puede interpretar:

```json
{
  "content": [ { "type": "text", "text": "{\"error\":true,\"tool\":\"consultar_reporte\",\"message\":\"...\",\"detail\":\"HTTP 401 — …\",\"hint\":\"…\"}" } ],
  "isError": true
}
```

## Configuración

### 1. Variables de entorno (`.env`)

Copia `.env.example` a `.env` y completa tus valores reales:

```bash
PORT=3000                          # Puerto HTTP del servidor MCP
METABASE_URL=https://metabase.midominio.com
METABASE_API_KEY=re_xxxxx          # Administrador > Ajustes > Claves de API (header x-api-key)
MESH_URL=https://mesh.midominio.com
MESH_API_KEY=sk_xxxxx              # Se envía como Authorization: Bearer <key>
REQUEST_TIMEOUT_MS=30000           # Opcional
```

El servidor **falla al arrancar** si falta alguna variable obligatoria
(mensaje claro indicando cuál), y `.env` está excluido de Git.

### 2. Instalar y ejecutar

```bash
cd mcp-server
npm install
cp .env.example .env   # y edita tus credenciales
npm run build
npm start              # http://localhost:3000/sse
```

### 3. Conectar tu aplicación web (cliente MCP)

Puntero SSE: `https://<host>/sse` (los mensajes JSON-RPC se envían solos
al `/messages?sessionId=…` que el servidor indica en el primer evento).

Ejemplo con el SDK en el navegador/backend de tu app:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const client = new Client({ name: 'mi-app-web', version: '1.0.0' });
await client.connect(new SSEClientTransport(new URL('https://mcp.midominio.com/sse')));
const res = await client.callTool({
  name: 'consultar_reporte',
  arguments: { card_id: '42', parametros: { region: 'Norte' } },
});
```

O en cualquier cliente compatible (Claude Desktop, Inspector, etc.):

```json
{ "mcpServers": { "puente-metabase-mesh": { "url": "http://localhost:3000/sse" } } }
```

### 4. Verificación rápida

```bash
curl http://localhost:3000/health
npx @modelcontextprotocol/inspector   # elige transporte SSE y /sse
```

## Seguridad y buenas prácticas incluidas

- Credenciales **solo** vía `process.env` (dotenv), nunca en el código.
- `try/catch` en cada tool → errores como `isError:true` con JSON descriptivo
  (status HTTP + cuerpo truncado del servicio externo).
- Validación de argumentos con **zod** (schemas declarados en la herramienta).
- Prevención de path traversal en el `endpoint` de Mesh.
- Un `McpServer`/transporte por sesión SSE + limpieza en `res.on('close')`.
- Health-check para balanceadores y apagado limpio con `SIGINT`.
- **No** usar `express.json()` globalmente: el transporte SSE lee el body crudo
  (haría fallar los POST con *"stream is not readable"*).
