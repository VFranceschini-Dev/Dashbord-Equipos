/**
 * textos.ts — Única fuente de los textos visibles de la interfaz relacionados
 * con usuarios y asignaciones de equipos.
 *
 * IMPORTANTE: estos textos NUNCA deben mencionar sistemas, bases, tablas,
 * endpoints ni proveedores internos del origen de los datos. Está chequeado
 * en build por scripts/check-internal-names.js (postbuild).
 */

export const TEXTOS_USUARIOS = {
  /** Pantalla "Asignación de Equipos" */
  asignaciones: {
    subtitulo: 'Registrá y consultá las asignaciones de equipos',
    etiquetaUsuario: 'Usuario *',
    placeholderBusqueda: 'Buscar por nombre, apellido o código...',
    errorCargaUsuarios: 'No se pudo cargar la lista de usuarios. Intentá de nuevo más tarde.',
    sesionExpirada: 'Sesión expirada: volvé a iniciar sesión.',
    sinResultados: 'No se encontró el usuario',
    altaButton: 'Dar de alta',
    yaRegistrado: 'Este usuario ya está registrado',
    verFicha: 'Ver ficha del usuario',
    guardadoExistente: 'El usuario quedó seleccionado para el movimiento.',
    historialError: 'No se pudo cargar el historial. Intentá de nuevo más tarde.',
  },

  /** Sección "Usuarios" */
  usuarios: {
    titulo: 'Usuarios',
    buscarPlaceholder: 'Buscar usuario...',
    nuevo: 'Nuevo usuario',
    editar: 'Editar usuario',
    total: 'Total de usuarios',
    sinResultados: 'No se encontraron usuarios',
    eliminarTitulo: '¿Eliminar usuario?',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    altaOk: 'Usuario guardado correctamente.',
    edicionOk: 'Usuario actualizado correctamente.',
    errorGuardado: 'No se pudo guardar el usuario. Intentá de nuevo más tarde.',
    duplicado: 'Este usuario ya está registrado',
    errorGenerico: 'Ocurrió un error inesperado. Intentá de nuevo más tarde.',
    cargando: 'Buscando usuarios...',
  },
} as const;
