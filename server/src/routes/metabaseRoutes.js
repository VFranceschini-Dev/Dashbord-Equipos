import { Router } from 'express';
import { z } from 'zod';
import { getUsers, refreshUsers, getCacheStatus } from '../services/usersService.js';

const router = Router();

// GET /api/metabase/usuarios?q=texto
router.get('/usuarios', async (req, res, next) => {
  try {
    const q = z.string().max(120).optional().default('').parse(req.query.q);
    const usuarios = await getUsers(q);
    res.json({ success: true, count: usuarios.length, data: usuarios });
  } catch (err) {
    next(err);
  }
});

// POST /api/metabase/usuarios/refresh
router.post('/usuarios/refresh', async (_req, res, next) => {
  try {
    const users = await refreshUsers();
    res.json({ success: true, message: `Cache actualizado: ${users.length} usuarios`, cache: getCacheStatus() });
  } catch (err) {
    next(err);
  }
});

export default router;