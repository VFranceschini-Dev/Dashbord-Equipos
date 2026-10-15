import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import metabaseRoutes from './routes/metabaseRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Seguridad
app.use(helmet());
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Parsing
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dashbord-equipos-metabase-proxy' });
});

// Rutas API
app.use('/api/metabase', metabaseRoutes);

// Middleware de errores (siempre al final)
app.use(errorHandler);

// Iniciar servidor
app.listen(config.port, () => {
  console.log(`✅ Backend Metabase corriendo en http://localhost:${config.port}`);
  console.log(`   Metabase URL: ${config.metabase.url}`);
  console.log(`   DB ID: ${config.metabase.dbId}`);
  console.log(`   Tabla usuarios: ${config.metabase.usuariosTableId}`);
  console.log(`   CORS permitido: ${config.allowedOrigins.join(', ')}`);
});