/** Tipos de letra disponibles para la firma electrónica tipográfica (cargados en index.html). */
export const FUENTES_FIRMA = [
  { id: 'dancing', nombre: 'Clásica', css: "'Dancing Script', cursive" },
  { id: 'greatvibes', nombre: 'Elegante', css: "'Great Vibes', cursive" },
  { id: 'allura', nombre: 'Estilizada', css: "'Allura', cursive" },
  { id: 'caveat', nombre: 'Manuscrita', css: "'Caveat', cursive" },
] as const;

export type FuenteFirma = (typeof FUENTES_FIRMA)[number]['id'];

export function cssDeFuente(id: string): string {
  return FUENTES_FIRMA.find(f => f.id === id)?.css ?? FUENTES_FIRMA[0].css;
}

/** DNI con puntos: 30123456 → 30.123.456 */
export function formatearDni(dni: string): string {
  return dni.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
