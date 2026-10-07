import { supabase, printersService, tonersService, movementsService, equipmentsService, suppliersService, collaboratorsService, vouchersService, externalServersService, syncedDevicesService } from './supabase';
import * as localDb from './localDatabase';
import { Printer, TonerItem, Movement, Equipment, Supplier, Collaborator, Voucher, ExternalServer, SyncedDevice } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ID del usuario actual (en producción, esto vendría de la autenticación)
const getCurrentUserId = (): string => {
  const userId = localStorage.getItem('current_user_id');
  if (!userId) {
    // Generar un ID de usuario por defecto para desarrollo
    const defaultUserId = '00000000-0000-0000-0000-000000000001';
    localStorage.setItem('current_user_id', defaultUserId);
    return defaultUserId;
  }
  return userId;
};

// ===== SINCRONIZACIÓN DE IMPRESORAS =====
export async function syncPrintersFromSupabase(): Promise<Printer[]> {
  const userId = getCurrentUserId();
  const { data, error } = await printersService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener impresoras de Supabase:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    location: p.location,
    department: p.department,
    model: p.model,
    status: p.status as 'active' | 'inactive' | 'maintenance',
    tonerModel: p.toner_model,
    lastMaintenance: p.last_maintenance,
    totalPages: p.total_pages,
  }));
}

export async function syncPrinterToSupabase(printer: Printer): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabasePrinter = {
    user_id: userId,
    name: printer.name,
    location: printer.location,
    department: printer.department,
    model: printer.model,
    status: printer.status,
    toner_model: printer.tonerModel,
    last_maintenance: printer.lastMaintenance,
    total_pages: printer.totalPages,
  };
  
  if (printer.id && printer.id.length === 36) {
    // Actualizar existente
    const { error } = await printersService.update(printer.id, supabasePrinter);
    return !error;
  } else {
    // Crear nuevo
    const { data, error } = await printersService.create(supabasePrinter);
    if (!error && data) {
      printer.id = data.id;
    }
    return !error;
  }
}

export async function deletePrinterFromSupabase(id: string): Promise<boolean> {
  const { error } = await printersService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE TÓNERS =====
export async function syncTonersFromSupabase(): Promise<TonerItem[]> {
  const userId = getCurrentUserId();
  const { data, error } = await tonersService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener tóners de Supabase:', error);
    return [];
  }
  
  return (data || []).map(t => ({
    id: t.id,
    model: t.model,
    brand: t.brand,
    color: t.color as 'black' | 'cyan' | 'magenta' | 'yellow',
    stock: t.stock,
    minStock: t.min_stock,
    maxStock: t.max_stock,
    unitPrice: t.unit_price,
    supplier: t.supplier,
    lastRestock: t.last_restock,
  }));
}

export async function syncTonerToSupabase(toner: TonerItem): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseToner = {
    user_id: userId,
    model: toner.model,
    brand: toner.brand,
    color: toner.color,
    stock: toner.stock,
    min_stock: toner.minStock,
    max_stock: toner.maxStock,
    unit_price: toner.unitPrice,
    supplier: toner.supplier,
    last_restock: toner.lastRestock,
  };
  
  if (toner.id && toner.id.length === 36) {
    const { error } = await tonersService.update(toner.id, supabaseToner);
    return !error;
  } else {
    const { data, error } = await tonersService.create(supabaseToner);
    if (!error && data) {
      toner.id = data.id;
    }
    return !error;
  }
}

export async function deleteTonerFromSupabase(id: string): Promise<boolean> {
  const { error } = await tonersService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE MOVIMIENTOS =====
export async function syncMovementsFromSupabase(): Promise<Movement[]> {
  const userId = getCurrentUserId();
  const { data, error } = await movementsService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener movimientos de Supabase:', error);
    return [];
  }
  
  return (data || []).map(m => ({
    id: m.id,
    type: m.type as 'delivery' | 'return' | 'restock' | 'disposal',
    tonerId: m.toner_id,
    tonerModel: m.toner_model,
    printerId: m.printer_id || undefined,
    printerName: m.printer_name || undefined,
    quantity: m.quantity,
    date: m.date,
    user: m.user,
    notes: m.notes,
  }));
}

export async function syncMovementToSupabase(movement: Movement): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseMovement = {
    user_id: userId,
    type: movement.type,
    toner_id: movement.tonerId,
    toner_model: movement.tonerModel,
    printer_id: movement.printerId || '',
    printer_name: movement.printerName || '',
    quantity: movement.quantity,
    date: movement.date,
    user: movement.user,
    notes: movement.notes,
  };
  
  const { data, error } = await movementsService.create(supabaseMovement);
  if (!error && data) {
    movement.id = data.id;
  }
  return !error;
}

// ===== SINCRONIZACIÓN DE EQUIPAMIENTOS =====
export async function syncEquipmentsFromSupabase(): Promise<Equipment[]> {
  const userId = getCurrentUserId();
  const { data, error } = await equipmentsService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener equipamientos de Supabase:', error);
    return [];
  }
  
  return (data || []).map(e => ({
    id: e.id,
    name: e.name,
    type: e.type as 'desktop' | 'laptop' | 'server' | 'monitor' | 'peripheral' | 'other',
    brand: e.brand,
    model: e.model,
    serialNumber: e.serial_number,
    assetTag: e.asset_tag,
    category: e.category,
    status: e.status as 'assigned' | 'available' | 'maintenance' | 'retired',
    collaboratorId: e.collaborator_id || undefined,
    purchaseDate: e.purchase_date,
    warrantyEnd: e.warranty_end,
    notes: e.notes,
  }));
}

export async function syncEquipmentToSupabase(equipment: Equipment): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseEquipment = {
    user_id: userId,
    name: equipment.name,
    type: equipment.type,
    brand: equipment.brand,
    model: equipment.model,
    serial_number: equipment.serialNumber,
    asset_tag: equipment.assetTag,
    category: equipment.category,
    status: equipment.status,
    collaborator_id: equipment.collaboratorId,
    purchase_date: equipment.purchaseDate,
    warranty_end: equipment.warrantyEnd,
    notes: equipment.notes,
  };
  
  if (equipment.id && equipment.id.length === 36) {
    const { error } = await equipmentsService.update(equipment.id, supabaseEquipment);
    return !error;
  } else {
    const { data, error } = await equipmentsService.create(supabaseEquipment);
    if (!error && data) {
      equipment.id = data.id;
    }
    return !error;
  }
}

export async function deleteEquipmentFromSupabase(id: string): Promise<boolean> {
  const { error } = await equipmentsService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE PROVEEDORES =====
export async function syncSuppliersFromSupabase(): Promise<Supplier[]> {
  const userId = getCurrentUserId();
  const { data, error } = await suppliersService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener proveedores de Supabase:', error);
    return [];
  }
  
  return (data || []).map(s => ({
    id: s.id,
    name: s.name,
    cuit: s.cuit,
    contact: s.contact,
    email: s.email,
    phone: s.phone,
    address: s.address,
    category: s.category,
    active: s.active,
    notes: s.notes,
  }));
}

export async function syncSupplierToSupabase(supplier: Supplier): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseSupplier = {
    user_id: userId,
    name: supplier.name,
    cuit: supplier.cuit,
    contact: supplier.contact,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    category: supplier.category,
    active: supplier.active,
    notes: supplier.notes,
  };
  
  if (supplier.id && supplier.id.length === 36) {
    const { error } = await suppliersService.update(supplier.id, supabaseSupplier);
    return !error;
  } else {
    const { data, error } = await suppliersService.create(supabaseSupplier);
    if (!error && data) {
      supplier.id = data.id;
    }
    return !error;
  }
}

export async function deleteSupplierFromSupabase(id: string): Promise<boolean> {
  const { error } = await suppliersService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE COLABORADORES =====
export async function syncCollaboratorsFromSupabase(): Promise<Collaborator[]> {
  const userId = getCurrentUserId();
  const { data, error } = await collaboratorsService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener colaboradores de Supabase:', error);
    return [];
  }
  
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    lastName: c.last_name,
    dni: c.dni,
    email: c.email,
    phone: c.phone,
    department: c.department,
    position: c.position,
    active: c.active,
    equipmentCount: c.equipment_count,
    joinDate: c.join_date,
    notes: c.notes,
  }));
}

export async function syncCollaboratorToSupabase(collaborator: Collaborator): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseCollaborator = {
    user_id: userId,
    name: collaborator.name,
    last_name: collaborator.lastName,
    dni: collaborator.dni,
    email: collaborator.email,
    phone: collaborator.phone,
    department: collaborator.department,
    position: collaborator.position,
    active: collaborator.active,
    equipment_count: collaborator.equipmentCount,
    join_date: collaborator.joinDate,
    notes: collaborator.notes,
  };
  
  if (collaborator.id && collaborator.id.length === 36) {
    const { error } = await collaboratorsService.update(collaborator.id, supabaseCollaborator);
    return !error;
  } else {
    const { data, error } = await collaboratorsService.create(supabaseCollaborator);
    if (!error && data) {
      collaborator.id = data.id;
    }
    return !error;
  }
}

export async function deleteCollaboratorFromSupabase(id: string): Promise<boolean> {
  const { error } = await collaboratorsService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE COMPROBANTES =====
export async function syncVouchersFromSupabase(): Promise<Voucher[]> {
  const userId = getCurrentUserId();
  const { data, error } = await vouchersService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener comprobantes de Supabase:', error);
    return [];
  }
  
  return (data || []).map(v => ({
    id: v.id,
    number: v.number,
    type: v.type as 'invoice' | 'receipt' | 'order' | 'delivery' | 'return',
    supplierId: v.supplier_id,
    supplierName: v.supplier_name,
    date: v.date,
    amount: v.amount,
    currency: v.currency as 'ARS' | 'USD',
    description: v.description,
    equipmentIds: v.equipment_ids,
    status: v.status as 'pending' | 'approved' | 'rejected' | 'processed',
    notes: v.notes,
  }));
}

export async function syncVoucherToSupabase(voucher: Voucher): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseVoucher = {
    user_id: userId,
    number: voucher.number,
    type: voucher.type,
    supplier_id: voucher.supplierId,
    supplier_name: voucher.supplierName,
    date: voucher.date,
    amount: voucher.amount,
    currency: voucher.currency,
    description: voucher.description,
    equipment_ids: voucher.equipmentIds,
    status: voucher.status,
    notes: voucher.notes,
  };
  
  if (voucher.id && voucher.id.length === 36) {
    const { error } = await vouchersService.update(voucher.id, supabaseVoucher);
    return !error;
  } else {
    const { data, error } = await vouchersService.create(supabaseVoucher);
    if (!error && data) {
      voucher.id = data.id;
    }
    return !error;
  }
}

export async function deleteVoucherFromSupabase(id: string): Promise<boolean> {
  const { error } = await vouchersService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE SERVIDORES EXTERNOS =====
export async function syncExternalServersFromSupabase(): Promise<ExternalServer[]> {
  const userId = getCurrentUserId();
  const { data, error } = await externalServersService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener servidores de Supabase:', error);
    return [];
  }
  
  return (data || []).map(s => ({
    id: s.id,
    name: s.name,
    type: s.type as 'meshcentral' | 'custom',
    url: s.url,
    username: s.username,
    password: s.password,
    autoSync: s.auto_sync,
    syncInterval: s.sync_interval,
    lastSync: s.last_sync,
    status: s.status as 'active' | 'inactive' | 'error',
    notes: s.notes,
    createdAt: s.created_at || new Date().toISOString(),
    updatedAt: s.updated_at || new Date().toISOString(),
  }));
}

export async function syncExternalServerToSupabase(server: ExternalServer): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseServer = {
    user_id: userId,
    name: server.name,
    type: server.type,
    url: server.url,
    username: server.username,
    password: server.password,
    auto_sync: server.autoSync,
    sync_interval: server.syncInterval,
    last_sync: server.lastSync,
    status: server.status,
    notes: server.notes,
  };
  
  if (server.id && server.id.length === 36) {
    const { error } = await externalServersService.update(server.id, supabaseServer);
    return !error;
  } else {
    const { data, error } = await externalServersService.create(supabaseServer);
    if (!error && data) {
      server.id = data.id;
    }
    return !error;
  }
}

export async function deleteExternalServerFromSupabase(id: string): Promise<boolean> {
  const { error } = await externalServersService.delete(id);
  return !error;
}

// ===== SINCRONIZACIÓN DE DISPOSITIVOS SINCRONIZADOS =====
export async function syncSyncedDevicesFromSupabase(): Promise<SyncedDevice[]> {
  const userId = getCurrentUserId();
  const { data, error } = await syncedDevicesService.getAll(userId);
  
  if (error) {
    console.error('Error al obtener dispositivos sincronizados de Supabase:', error);
    return [];
  }
  
  return (data || []).map(d => ({
    id: d.id,
    serverId: d.server_id,
    externalId: d.external_id,
    name: d.name,
    hostname: d.hostname,
    ip: d.ip,
    os: d.os,
    status: d.status as 'connected' | 'disconnected',
    lastSeen: d.last_seen,
    group: d.group_name,
    cpu: d.cpu,
    ram: d.ram,
    syncedAt: d.synced_at,
    localEquipmentId: d.local_equipment_id,
  }));
}

export async function syncSyncedDeviceToSupabase(device: SyncedDevice): Promise<boolean> {
  const userId = getCurrentUserId();
  const supabaseDevice = {
    user_id: userId,
    server_id: device.serverId,
    external_id: device.externalId,
    name: device.name,
    hostname: device.hostname,
    ip: device.ip,
    os: device.os,
    status: device.status,
    last_seen: device.lastSeen,
    group_name: device.group,
    cpu: device.cpu,
    ram: device.ram,
    synced_at: device.syncedAt,
    local_equipment_id: device.localEquipmentId,
  };
  
  if (device.id && device.id.length === 36) {
    const { error } = await syncedDevicesService.update(device.id, supabaseDevice);
    return !error;
  } else {
    const { data, error } = await syncedDevicesService.create(supabaseDevice);
    if (!error && data) {
      device.id = data.id;
    }
    return !error;
  }
}

// ===== SINCRONIZACIÓN COMPLETA =====
export async function syncAllFromSupabase(): Promise<{
  printers: Printer[];
  toners: TonerItem[];
  movements: Movement[];
  equipments: Equipment[];
  suppliers: Supplier[];
  collaborators: Collaborator[];
  vouchers: Voucher[];
  externalServers: ExternalServer[];
  syncedDevices: SyncedDevice[];
}> {
  const [printers, toners, movements, equipments, suppliers, collaborators, vouchers, externalServers, syncedDevices] = await Promise.all([
    syncPrintersFromSupabase(),
    syncTonersFromSupabase(),
    syncMovementsFromSupabase(),
    syncEquipmentsFromSupabase(),
    syncSuppliersFromSupabase(),
    syncCollaboratorsFromSupabase(),
    syncVouchersFromSupabase(),
    syncExternalServersFromSupabase(),
    syncSyncedDevicesFromSupabase(),
  ]);
  
  return {
    printers,
    toners,
    movements,
    equipments,
    suppliers,
    collaborators,
    vouchers,
    externalServers,
    syncedDevices,
  };
}

// ===== VERIFICAR CONEXIÓN =====
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    return !error;
  } catch (error) {
    console.error('Error al verificar conexión con Supabase:', error);
    return false;
  }
}
