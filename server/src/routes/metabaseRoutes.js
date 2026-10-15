import { Router } from 'express';
import { z } from 'zod';
import { getUsers, refreshUsers, getCacheStatus } from '../services/usersService.js';

const router = Router();

// Parámetros aceptados en GET /usuarios
const usuariosQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  soloActivos: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform(v => v === 'true'),
});

// GET /api/metabase/usuarios?q=texto&soloActivos=true
router.get('/usuarios', async (req, res, next) => {
  try {
    const { q, soloActivos } = usuariosQuerySchema.parse(req.query);
    const usuarios = await getUsers(q, { soloActivos });
    res.json({ success: true, count: usuarios.length, data: usuarios });
  } catch (err) {
    next(err);
  }
});

// POST /api/metabase/usuarios/refresh
router.post('/usuarios/refresh', async (_req, res, next) => {
  try {
    const users = await refreshUsers();
    res.json({
      success: true,
      message: `Cache actualizado: ${users.length} usuarios`,
      cache: getCacheStatus(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;