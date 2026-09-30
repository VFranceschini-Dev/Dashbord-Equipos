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
  type: 'low_stock' | 'maintenance' | 'info';
  message: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
  read: boolean;
}

export type Page = 'dashboard' | 'printers' | 'inventory' | 'movements' | 'reports';
