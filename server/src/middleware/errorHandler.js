/**
 * Middleware central de manejo de errores.
 * Captura errores de Metabase, validación Zod y otros.
 */

export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  
  // Errores de Metabase (conexión, auth, timeout)
  if (err.name === 'MetabaseError') {
    return res.status(502).json({
      success: false,
      error: 'Error de conexión con Metabase',
      details: err.message,
      hint: 'Verificar que el backend tenga acceso a la red interna y las credenciales sean correctas.',
    });
  }
  
  // Errores de validación Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos',
      details: err.errors,
    });
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}