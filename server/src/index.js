import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import usuariosRoutes from './routes/usuariosRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/metabase', usuariosRoutes);

// 404 para rutas desconocidas de la API.
app.use((_req, res) => res.status(404).json({ error: 'Ruta inexistente' }));

app.use(errorHandler);

app.listen(config.port, () => {
  // Log sin API key ni datos personales.
  console.log(`[server] Backend Metabase escuchando en puerto ${config.port}`);
});
