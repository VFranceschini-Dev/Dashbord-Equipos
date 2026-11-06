import type { EquipmentMovement } from '../types';

/** A quién está asignado hoy un equipo, según su último movimiento. */
export interface AsignacionActual {
  usuarioRef: string;
  usuarioNombre: string;
  usuarioArea: string;
}

/**
 * Calcula la asignación vigente de cada equipo a partir del historial de
 * movimientos: si el último movimiento del equipo es una asignación o un
 * traslado, el equipo está a nombre de ese usuario; si es una devolución o
 * una baja, no está asignado a nadie (no aparece en el mapa).
 */
export function asignacionesActuales(movements: EquipmentMovement[]): Map<string, AsignacionActual> {
  const ultimo = new Map<string, EquipmentMovement>();
  for (const m of movements) {
    const prev = ultimo.get(m.equipmentId);
    if (!prev || m.fecha > prev.fecha) ultimo.set(m.equipmentId, m);
  }
  const result = new Map<string, AsignacionActual>();
  for (const [equipmentId, m] of ultimo) {
    if (m.tipo === 'asignacion' || m.tipo === 'traslado') {
      result.set(equipmentId, { usuarioRef: m.usuarioRef, usuarioNombre: m.usuarioNombre, usuarioArea: m.usuarioArea });
    }
  }
  return result;
}
