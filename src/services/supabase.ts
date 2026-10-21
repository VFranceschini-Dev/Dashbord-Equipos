import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase (requerida vía variables de entorno .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Falla explícito en lugar de usar credenciales placeholder inválidas.
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
      'Definilas en el archivo .env antes de ejecutar la aplicación.'
  );
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);

// Tipos para las tablas de Supabase
export interface SupabasePrinter {
  id?: string;
  user_id: string;
  name: string;
  location: string;
  department: string;
  model: string;
  status: 'active' | 'inactive' | 'maintenance';
  toner_model: string;
  last_maintenance: string;
  total_pages: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseTonerItem {
  id?: string;
  user_id: string;
  model: string;
  brand: string;
  color: 'black' | 'cyan' | 'magenta' | 'yellow';
  stock: number;
  min_stock: number;
  max_stock: number;
  unit_price: number;
  supplier: string;
  last_restock: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseMovement {
  id?: string;
  user_id: string;
  type: 'delivery' | 'return' | 'restock' | 'disposal';
  toner_id: string;
  toner_model: string;
  printer_id?: string;
  printer_name?: string;
  quantity: number;
  date: string;
  user: string;
  notes: string;
  created_at?: string;
}

export interface SupabaseEquipment {
  id?: string;
  user_id: string;
  name: string;
  type: 'desktop' | 'laptop' | 'server' | 'monitor' | 'peripheral' | 'other';
  brand: string;
  model: string;
  serial_number: string;
  asset_tag: string;
  category: string;
  status: 'assigned' | 'available' | 'maintenance' | 'retired';
  collaborator_id?: string;
  purchase_date: string;
  warranty_end: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseSupplier {
  id?: string;
  user_id: string;
  name: string;
  cuit: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  category: string[]; // Array para soportar múltiples categorías
  active: boolean;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseCollaborator {
  id?: string;
  user_id: string;
  name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  active: boolean;
  equipment_count: number;
  join_date: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseVoucher {
  id?: string;
  user_id: string;
  number: string;
  type: 'invoice' | 'receipt' | 'order' | 'delivery' | 'return';
  supplier_id: string;
  supplier_name: string;
  date: string;
  amount: number;
  currency: 'ARS' | 'USD';
  description: string;
  equipment_ids: string[];
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseExternalServer {
  id?: string;
  user_id: string;
  name: string;
  type: 'meshcentral' | 'custom';
  url: string;
  username: string;
  password: string;
  auto_sync: boolean;
  sync_interval: number;
  last_sync?: string;
  status: 'active' | 'inactive' | 'error';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseSyncedDevice {
  id?: string;
  user_id: string;
  server_id: string;
  external_id: string;
  name: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'connected' | 'disconnected';
  last_seen: string;
  group?: string;
  cpu?: string;
  ram?: string;
  synced_at: string;
  local_equipment_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Funciones CRUD para cada tabla

// ===== PRINTERS =====
export const printersService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('app_printers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(printer: Omit<SupabasePrinter, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('app_printers')
      .insert([printer])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabasePrinter>) {
    const { data, error } = await supabase
      .from('app_printers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('app_printers')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== TONER ITEMS =====
export const tonersService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('toner_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(toner: Omit<SupabaseTonerItem, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('toner_items')
      .insert([toner])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseTonerItem>) {
    const { data, error } = await supabase
      .from('toner_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('toner_items')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== MOVEMENTS =====
export const movementsService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('toner_movements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(movement: Omit<SupabaseMovement, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('toner_movements')
      .insert([movement])
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('toner_movements')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== EQUIPMENT =====
export const equipmentsService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(equipment: Omit<SupabaseEquipment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('equipments')
      .insert([equipment])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseEquipment>) {
    const { data, error } = await supabase
      .from('equipments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('equipments')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== SUPPLIERS =====
export const suppliersService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(supplier: Omit<SupabaseSupplier, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseSupplier>) {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== COLLABORATORS =====
export const collaboratorsService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(collaborator: Omit<SupabaseCollaborator, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('collaborators')
      .insert([collaborator])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseCollaborator>) {
    const { data, error } = await supabase
      .from('collaborators')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('collaborators')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== VOUCHERS =====
export const vouchersService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(voucher: Omit<SupabaseVoucher, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('vouchers')
      .insert([voucher])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseVoucher>) {
    const { data, error } = await supabase
      .from('vouchers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('vouchers')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== EXTERNAL SERVERS =====
export const externalServersService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('external_servers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(server: Omit<SupabaseExternalServer, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('external_servers')
      .insert([server])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseExternalServer>) {
    const { data, error } = await supabase
      .from('external_servers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('external_servers')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ===== SYNCED DEVICES =====
export const syncedDevicesService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('synced_devices')
      .select('*')
      .eq('user_id', userId)
      .order('synced_at', { ascending: false });
    return { data, error };
  },

  async create(device: Omit<SupabaseSyncedDevice, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('synced_devices')
      .insert([device])
      .select()
      .single();
    return { data, error };
  },

  async update(id: string, updates: Partial<SupabaseSyncedDevice>) {
    const { data, error } = await supabase
      .from('synced_devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('synced_devices')
      .delete()
      .eq('id', id);
    return { error };
  },

  async deleteByServerId(serverId: string, userId: string) {
    const { error } = await supabase
      .from('synced_devices')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);
    return { error };
  },
};

// Función para verificar la conexión
export async function testConnection() {
  const { data, error } = await supabase
    .from('app_printers')
    .select('count')
    .limit(1);
  
  return { connected: !error, error };
}
// ===== EQUIPMENT MOVEMENTS (hardware -> usuarios de la base interna) =====
import type { EquipmentMovement } from '../types';

export interface SupabaseEquipmentMovement {
  id?: string;
  user_id: string;
  equipment_id: string;
  usuario_ref: string;
  usuario_nombre: string;
  usuario_area: string;
  tipo: 'asignacion' | 'devolucion' | 'traslado' | 'baja';
  fecha: string;
  observaciones?: string | null;
  registrado_por?: string | null;
  created_at?: string;
}

export const equipmentMovementsService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('equipment_movements')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false });
    return { data, error };
  },

  /** Alta atómica vía RPC: inserta el movimiento y actualiza el status del equipo. */
  async createWithStatus(params: {
    equipmentId: string;
    usuarioRef: string;
    usuarioNombre: string;
    usuarioArea: string;
    tipo: SupabaseEquipmentMovement['tipo'];
    observaciones?: string;
    registradoPor?: string;
  }) {
    const { data, error } = await supabase.rpc('registrar_equipment_movement', {
      p_equipment_id: params.equipmentId,
      p_usuario_ref: params.usuarioRef,
      p_usuario_nombre: params.usuarioNombre,
      p_usuario_area: params.usuarioArea,
      p_tipo: params.tipo,
      p_observaciones: params.observaciones ?? null,
      p_registrado_por: params.registradoPor ?? null,
    });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase.from('equipment_movements').delete().eq('id', id);
    return { error };
  },
};
