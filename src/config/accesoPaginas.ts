import type { Page } from '../types';
import type { Modulo } from './permisos';

/**
 * Módulo de permisos que controla cada pantalla.
 * `null` = abierta a cualquier usuario con sesión; 'admin' = solo administradores.
 * Facturas y Proveedores comparten módulo; Movimientos, Usuarios y Monitoreo, también.
 */
export const MODULO_DE_PAGINA: Record<Page, Modulo | 'admin' | null> = {
  dashboard: null,
  equipments: 'equipos',
  collaborators: 'equipos',
  movements: 'equipos',
  asignaciones: 'equipos',
  suppliers: 'proveedores',
  vouchers: 'proveedores',
  printers: 'impresoras',
  inventory: 'impresoras',
  reports: 'reportes',
  'server-config': 'servidores',
  'admin-usuarios': 'admin',
};
