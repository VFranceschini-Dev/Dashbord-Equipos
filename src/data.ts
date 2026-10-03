import { Printer, TonerItem, Movement, Alert, Equipment, Supplier, Collaborator, Voucher } from './types';

export const initialPrinters: Printer[] = [];
export const initialToners: TonerItem[] = [];
export const initialMovements: Movement[] = [];
export const initialAlerts: Alert[] = [];
export const initialEquipments: Equipment[] = [];
export const initialSuppliers: Supplier[] = [];
export const initialCollaborators: Collaborator[] = [];
export const initialVouchers: Voucher[] = [];

export const EQUIPMENT_CATEGORIES = [
  'Informática',
  'Impresión',
  'Redes',
  'Almacenamiento',
  'Periféricos',
  'Mobiliario',
  'Otros'
];

export const SUPPLIER_CATEGORIES = [
  'Hardware',
  'Software',
  'Servicios',
  'Insumos',
  'Consultoría',
  'Otros'
];

export const DEPARTMENTS = [
  'Administración',
  'Contabilidad',
  'RRHH',
  'Marketing',
  'Ventas',
  'IT',
  'Dirección',
  'Operaciones',
  'Logística',
  'Otros'
];
