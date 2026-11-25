// Validaciones de datos que se importan (CUIT y correo). Ambas aceptan vacío: el campo es opcional.

const norm = (v: unknown): string => String(v ?? '').trim();

/** CUIT solo con números (quita puntos, guiones y espacios). */
export function parseCuit(value: string): string {
  return norm(value).replace(/[.\-\s]/g, '');
}

/** CUIT de 11 dígitos con dígito verificador correcto. Vacío es válido. */
export function validateCuit(value: string): boolean {
  const cuit = parseCuit(value);
  if (cuit === '') return true; // opcional
  if (!/^\d{11}$/.test(cuit)) return false;
  const digits = cuit.split('').map(Number);
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * weights[i];
  const check = 11 - (sum % 11);
  const final = check === 11 ? 0 : check === 10 ? 9 : check;
  return final === digits[10];
}

export function validateEmail(value: string): boolean {
  if (!norm(value)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(value));
}
