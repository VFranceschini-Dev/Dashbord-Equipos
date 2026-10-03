export interface Printer {
  id: string;
  name: string;
  location: string;
  department: string;
  model: string;
  status: 'active' | 'inactive' | 'maintenance';
  tonerModel: string;
  lastMaintenance: string;
  totalPages: number;
}

export interface TonerItem {
  id: string;
  model: string;
  brand: string;
  color: 'black' | 'cyan' | 'magenta' | 'yellow';
  stock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  supplier: string;
  lastRestock: string;
}

export interface Movement {
  id: string;
  type: 'delivery' | 'return' | 'restock' | 'disposal';
  tonerId: string;
  tonerModel: string;
  printerId?: string;
  printerName?: string;
  quantity: number;
  date: string;
  user: string;
  notes: string;
}

export interface Alert {
  id: string;
  type: 'low_stock' | 'maintenance' | 'info' | 'after_hours';
  message: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
  read: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'desktop' | 'laptop' | 'server' | 'monitor' | 'peripheral' | 'other';
  brand: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  category: string;
  status: 'assigned' | 'available' | 'maintenance' | 'retired';
  collaboratorId?: string;
  purchaseDate: string;
  warrantyEnd: string;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  cuit: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  active: boolean;
  notes: string;
}

export interface Collaborator {
  id: string;
  name: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  active: boolean;
  equipmentCount: number;
  joinDate: string;
  notes: string;
}

export interface Voucher {
  id: string;
  number: string;
  type: 'invoice' | 'receipt' | 'order' | 'delivery' | 'return';
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  currency: 'ARS' | 'USD';
  description: string;
  equipmentIds: string[];
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  notes: string;
}

export type Page = 'dashboard' | 'printers' | 'inventory' | 'movements' | 'reports' | 'equipments' | 'suppliers' | 'collaborators' | 'vouchers' | 'import';
