import { Router } from 'express';
import { z } from 'zod';
import { buscarUsuarios, getUsuarios, cacheInfo } from '../services/usuariosService.js';

const router = Router();

const querySchema = z.object({
  q: z.string().max(100).optional(),
});

// GET /api/metabase/usuarios?q=texto → búsqueda sobre la caché (no toca Metabase si está fresca).
router.get('/usuarios', async (req, res, next) => {
  try {
    const { q } = querySchema.parse(req.query);
    const usuarios = await buscarUsuarios(q ?? '');
    res.json({ usuarios, cache: cacheInfo() });
  } catch (err) {
    next(err);
  }
});

// POST /api/metabase/usuarios/refresh → fuerza recarga desde Metabase.
router.post('/usuarios/refresh', async (_req, res, next) => {
  try {
    const usuarios = await getUsuarios({ force: true });
    res.json({ count: usuarios.length, cache: cacheInfo() });
  } catch (err) {
    next(err);
  }
});

export default router;
