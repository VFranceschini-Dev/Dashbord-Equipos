// Importación y exportación de proveedores con el mismo asistente que impresoras (ImportModal).
// La plantilla descargable y la exportación de registros usan EXACTAMENTE estos encabezados,
// así un Excel exportado se puede editar y volver a importar tal cual.

import type { Supplier } from '../types';
import { validateCuit, validateEmail } from '../utils/validaciones';

/** Encabezados de la plantilla y de la exportación (en este orden). */
export const SUPPLIER_TEMPLATE_HEADERS = [
  'nombre', 'cuit', 'contacto', 'email', 'telefono', 'direccion', 'categoria', 'estado', 'notas',
];

/** Fila de ejemplo de la plantilla Excel. */
export const SUPPLIER_TEMPLATE_EXAMPLE: Record<string, string> = {
  nombre: 'Proveedor Ejemplo',
  cuit: '30712345671',
  contacto: 'Nombre Apellido',
  email: 'contacto@ejemplo.com',
  telefono: '011 4444-5555',
  direccion: 'Córdoba, Argentina',
  categoria: 'Hardware, Servicios',
  estado: 'Activo',
  notas: '',
};

/** Encabezado del archivo -> campo del proveedor. Acepta también los nombres de columna en inglés. */
export const SUPPLIER_IMPORT_MAPPING: Record<string, string> = {
  'nombre': 'name', 'name': 'name', 'proveedor': 'name', 'razon social': 'name', 'razón social': 'name', 'razon_social': 'name',
  'cuit': 'cuit',
  'contacto': 'contact', 'contact': 'contact',
  'email': 'email', 'correo': 'email', 'mail': 'email',
  'telefono': 'phone', 'teléfono': 'phone', 'phone': 'phone', 'tel': 'phone',
  'direccion': 'address', 'dirección': 'address', 'address': 'address', 'domicilio': 'address', 'localidad': 'address',
  'categoria': 'category', 'categoría': 'category', 'categorias': 'category', 'categorías': 'category', 'category': 'category', 'rubro': 'category',
  'estado': 'active', 'active': 'active', 'activo': 'active',
  'notas': 'notes', 'notes': 'notes', 'observaciones': 'notes',
};

/** Validación por fila (devuelve el motivo del error o null). */
export function validarProveedorImportado(row: any): string | null {
  if (!row.name || String(row.name).trim() === '') return 'Nombre es obligatorio';
  if (row.cuit && !validateCuit(String(row.cuit))) return `CUIT inválido (${row.cuit})`;
  if (row.email && !validateEmail(String(row.email))) return `Email inválido (${row.email})`;
  return null;
}

/** Filas para exportar, con las mismas columnas que la plantilla. */
export function proveedoresAFilas(suppliers: Supplier[]): string[][] {
  return suppliers.map((s) => [
    s.name ?? '',
    s.cuit ?? '',
    s.contact ?? '',
    s.email ?? '',
    s.phone ?? '',
    s.address ?? '',
    (s.category ?? []).join(', '),
    s.active === false ? 'Inactivo' : 'Activo',
    s.notes ?? '',
  ]);
}
