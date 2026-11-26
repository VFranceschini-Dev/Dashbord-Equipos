import type { Printer } from '../types';

/** Impresoras de un mismo modelo que usan un tóner, agrupadas para mostrarlas sin repetir. */
export interface ImpresoraCompatible {
  modelo: string;       // marca y modelo tal como se cargó en la impresora
  cantidad: number;     // equipos de ese modelo que usan el tóner
  nombres: string[];    // nombres de esos equipos (para el detalle)
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Impresoras cargadas cuyo "tóner asociado" es este modelo de tóner.
 * La compatibilidad se deriva de los datos existentes: no hay un campo aparte que mantener.
 * Los equipos sin modelo se agrupan bajo su nombre.
 */
export function impresorasCompatibles(modeloToner: string, printers: Printer[]): ImpresoraCompatible[] {
  const clave = norm(modeloToner);
  if (!clave) return [];

  const grupos = new Map<string, ImpresoraCompatible>();
  for (const p of printers) {
    if (norm(p.tonerModel) !== clave) continue;
    const modelo = p.model.trim() || p.name.trim() || 'Impresora sin modelo';
    const k = norm(modelo);
    const g = grupos.get(k) ?? { modelo, cantidad: 0, nombres: [] };
    g.cantidad += 1;
    g.nombres.push(p.name);
    grupos.set(k, g);
  }
  return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad || a.modelo.localeCompare(b.modelo, 'es'));
}
