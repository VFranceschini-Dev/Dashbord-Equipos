// Configuración por tabla para el asistente de importación reutilizable.
// Un único componente (DataImportWizard) lee esta configuración; no se duplica
// lógica en cada módulo.

import type { SupabaseSupplier } from '../services/supabase';

export type ColumnKind = 'text' | 'cuit' | 'email' | 'number' | 'date' | 'boolean' | 'array';

export interface ImportColumnConfig {
  /** Nombre exacto de la columna en la tabla destino (minúsculas, sin tildes). */
  column: string;
  /** Etiqueta visible para el usuario. */
  label: string;
  required?: boolean;
  kind?: ColumnKind;
  /** Encabezados alternativos del Excel que mapean a esta columna. */
  aliases?: string[];
  /** Para kind=array: separador permitido en el Excel (coma por defecto). */
  arraySeparator?: string;
}

export type RowStatus = 'new' | 'update' | 'unchanged' | 'error';

export interface ImportRowResult {
  status: RowStatus;
  values: Record<string, unknown>; // fila lista para insertar (sin user_id/id)
  errors: { column?: string; message: string }[];
  changes?: { column: string; label: string; previous: unknown; next: unknown }[];
}

export interface TableImportConfig {
  moduleLabel: string; // "Proveedores"
  table: string; // "suppliers"
  columns: ImportColumnConfig[];
  /** Clave(s) lógicas de coincidencia (no necesariamente UNIQUE en BD). */
  matchKeys: string[];
  /** Columna que identifica a la fila ante el usuario (para mensajes de error). */
  displayColumn: string;
  /** Tamaño de lote al insertar. Por defecto 500. */
  batchSize?: number;
  /** Normaliza un registro existente de la BD a la forma comparable de fila. */
  existingToValues: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Compara dos filas y devuelve true si hay cambios. */
  rowsDiffer: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean;
  /** Construye la clave de coincidencia a partir de los valores de la fila. */
  matchKeyOf: (values: Record<string, unknown>) => string;
  /** Busca registros existentes del usuario. */
  fetchExisting: () => Promise<Record<string, unknown>[]>;
  /** Inserta filas nuevas (en lotes internos de config.batchSize). Devuelve cuantas quedaron y las fallidas con su motivo. */
  insertRows: (rows: Record<string, unknown>[]) => Promise<{ inserted: number; failed: { label: string; error: string }[] }>;
  /** Actualiza una fila existente por su id. */
  updateRow: (id: string, values: Record<string, unknown>) => Promise<{ error: string | null }>;
  /** Referencias obligatorias: avisar si hay que importar otra tabla primero. */
  dependsOn?: { moduleLabel: string }[];
}

const norm = (v: unknown): string => String(v ?? '').trim();

const normalizeName = (v: unknown): string =>
  norm(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');

/** Compara campos simples; arrays como sets ordenados. */
export function fieldChanged(a: unknown, b: unknown): boolean {
  const toStr = (v: unknown): string => {
    if (Array.isArray(v)) return [...v].map((x) => norm(x)).sort().join('|');
    if (typeof v === 'boolean') return v ? '1' : '0';
    return norm(v);
  };
  return toStr(a) !== toStr(b);
}

/** Convierte texto libre de estado booleano. */
export function parseBoolean(value: string): boolean | null {
  const v = norm(value).toLowerCase();
  if (!v) return true; // vacío => activo por defecto
  if (['si', 'sí', 'activo', 'true', '1', 'yes', 'alta'].includes(v)) return true;
  if (['no', 'inactivo', 'false', '0', 'baja'].includes(v)) return false;
  return null;
}

export function parseCuit(value: string): string {
  return norm(value).replace(/[.\-\s]/g, '');
}

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

export function parseNumber(value: string): number | null {
  const cleaned = norm(value).replace(/\s/g, '');
  if (cleaned === '') return null;
  // Formato argentino 1.234,56 -> 1234.56
  const normalized = /,/.test(cleaned) && /\./.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseArray(value: string, separator = ','): string[] {
  return norm(value)
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// ============================ PROVEEDORES ============================

import { supabase, suppliersService } from '../services/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import { getCurrentUserId } from '../services/supabaseSync';

/** Traduce errores técnicos de Supabase/Postgres a lenguaje simple para el usuario. */
export function friendlyDbError(err: PostgrestError | { message: string } | null, moduleLabel = 'los datos'): string {
  if (!err) return `No se pudo guardar ${moduleLabel}.`;
  const msg = String(err.message ?? '');
  console.error('Error técnico de Supabase:', { code: (err as PostgrestError).code, message: msg, details: (err as PostgrestError).details, hint: (err as PostgrestError).hint });
  const m = /column(?:m)?\s+(\w+)\D/i.exec(msg);
  switch ((err as PostgrestError).code) {
    case '23505': // unique_violation
      if (/cuit/i.test(msg)) return 'Ya existe un proveedor con ese CUIT.';
      return 'El registro ya existe en la base de datos.';
    case '23502': // not_null_violation
      return m ? `Falta un dato obligatorio: ${m[1]}.` : `Falta un dato obligatorio en ${moduleLabel}.`;
    case '23503': // foreign_key_violation
      return 'Hay un dato que referencia a otro registro que no existe (por ejemplo una categoría o un proveedor inexistente).';
    case '23514': // check_violation
      return 'Algún valor no tiene el formato esperado (por ejemplo una lista vacía donde se requiere al menos un elemento).';
    case '42501': // insufficient_privilege
      return `No tenés permiso para guardar ${moduleLabel}.`;
    case 'PGRST116':
      return 'El registro que se quería actualizar ya no existe en la base de datos.';
    default:
      if (/invalid input syntax for type json|is not an array|array must not contain nulls/i.test(msg)) {
        return 'Un campo de lista (por ejemplo Categorías) quedó vacío o inválido.';
      }
      if (/new row violates row-level security policy/i.test(msg)) {
        return 'Tu sesión no coincide con los datos que estás intentando guardar. Volvé a iniciar sesión e intentá de nuevo.';
      }
      if (/failed to fetch|networkerror|timeout/i.test(msg)) {
        return 'Se perdió la conexión con la base de datos. Revisá tu internet e intentá de nuevo.';
      }
      return `No se pudo guardar: ${msg}`;
  }
}

/** Devuelve el id del usuario autenticado REAL (auth.uid()), o null si no hay sesión.
 *  Es imprescindible: las políticas RLS comparan auth.uid() = user_id, y un UUID
 *  inventado (localStorage) haría fallar el INSERT aunque el formato sea válido. */
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export function buildSuppliersConfig(): TableImportConfig {
  let cachedUserId: string | null | undefined;
  const ctx = {
    async getUserId(): Promise<string | null> {
      if (cachedUserId === undefined) {
        cachedUserId = await getAuthenticatedUserId();
      }
      return cachedUserId ?? getCurrentUserId();
    },
    create: (row: Omit<SupabaseSupplier, 'id' | 'created_at' | 'updated_at'>) => suppliersService.create(row),
    update: (id: string, patch: Partial<SupabaseSupplier>) => suppliersService.update(id, patch),
    getAll: (userId: string) => suppliersService.getAll(userId),
  };
  // Comparación insensible a mayúsculas/tildes para "name".
  const normName = (v: unknown) => normalizeName(v);
  return {
    moduleLabel: 'Proveedores',
    table: 'suppliers',
    columns: [
      { column: 'name', label: 'Nombre', required: true },
      { column: 'cuit', label: 'CUIT', kind: 'cuit' },
      { column: 'contact', label: 'Contacto' },
      { column: 'email', label: 'Email', kind: 'email', aliases: ['correo', 'mail'] },
      { column: 'phone', label: 'Teléfono', aliases: ['telefono', 'tel'] },
      { column: 'address', label: 'Dirección', aliases: ['localidad', 'direccion'] },
      { column: 'category', label: 'Categorías', kind: 'array', aliases: ['categorias'] },
      { column: 'active', label: 'Estado', kind: 'boolean', aliases: ['estado'] },
      { column: 'notes', label: 'Notas', aliases: ['observaciones'] },
    ],
    matchKeys: ['name'],
    displayColumn: 'name',
    batchSize: 500,
    existingToValues: (row) => ({
      name: norm(row.name),
      cuit: parseCuit(String(row.cuit ?? '')),
      contact: norm(row.contact),
      email: norm(row.email),
      phone: norm(row.phone),
      address: norm(row.address),
      category: Array.isArray(row.category) ? row.category : [],
      active: row.active !== false,
      notes: norm(row.notes),
    }),
    rowsDiffer: (a, b) =>
      ['cuit', 'contact', 'email', 'phone', 'address', 'active', 'notes'].some(
        (key) => fieldChanged(a[key], b[key]),
      ) || normName(a.name) !== normName(b.name) || fieldChanged(a.category, b.category),
    matchKeyOf: (values) => normalizeName(values.name),
    fetchExisting: async () => {
      const userId = await ctx.getUserId();
      if (!userId) return [];
      const { data } = await ctx.getAll(userId);
      return (data ?? []) as unknown as Record<string, unknown>[];
    },
    insertRows: async (rows) => {
      const userId = await ctx.getUserId();
      if (!userId) {
        // Sin sesión real no hay forma de cumplir la RLS: fallar temprano con motivo claro.
        return {
          inserted: 0,
          failed: rows.map((r) => ({ label: String(r.name ?? ''), error: 'No iniciaste sesión en la base de datos. Volvé a iniciar sesión e intentá de nuevo.' })),
        };
      }
      const payload = rows.map((r) => ({ ...r, user_id: userId })) as Omit<
        SupabaseSupplier,
        'id' | 'created_at' | 'updated_at'
      >[];
      let inserted = 0;
      const failed: { label: string; error: string }[] = [];
      // Insertamos de a una fila para identificar fallas individuales.
      for (const row of payload) {
        const res = await ctx.create(row);
        if (res.error) {
          failed.push({ label: String(row.name ?? ''), error: friendlyDbError(res.error, 'proveedores') });
        } else {
          inserted += 1;
        }
      }
      return { inserted, failed };
    },
    updateRow: async (id, values) => {
      const { error } = await ctx.update(id, values as Partial<SupabaseSupplier>);
      return { error: error ? friendlyDbError(error, 'el proveedor') : null };
    },
  };
}
