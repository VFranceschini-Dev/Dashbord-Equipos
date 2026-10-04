import { SyncedDevice, Equipment } from '../types';

const STORAGE_KEY = 'device_equipment_mapping';

export interface DeviceEquipmentMapping {
  syncedDeviceId: string;
  localEquipmentId: string;
  serverId: string;
  externalId: string;
  createdAt: string;
  updatedAt: string;
  syncDirection: 'bidirectional' | 'server-to-local' | 'local-to-server';
  lastSync: string;
}

// Obtener todos los mapeos
export function getMappings(): DeviceEquipmentMapping[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Guardar mapeos
export function saveMappings(mappings: DeviceEquipmentMapping[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

// Crear nuevo mapeo
export function createMapping(
  syncedDeviceId: string,
  localEquipmentId: string,
  serverId: string,
  externalId: string,
  syncDirection: 'bidirectional' | 'server-to-local' | 'local-to-server' = 'bidirectional'
): DeviceEquipmentMapping {
  const now = new Date().toISOString();
  const mapping: DeviceEquipmentMapping = {
    syncedDeviceId,
    localEquipmentId,
    serverId,
    externalId,
    createdAt: now,
    updatedAt: now,
    syncDirection,
    lastSync: now,
  };

  const mappings = getMappings();
  mappings.push(mapping);
  saveMappings(mappings);

  return mapping;
}

// Actualizar mapeo
export function updateMapping(
  syncedDeviceId: string,
  updates: Partial<DeviceEquipmentMapping>
): DeviceEquipmentMapping | null {
  const mappings = getMappings();
  const index = mappings.findIndex(m => m.syncedDeviceId === syncedDeviceId);

  if (index === -1) return null;

  mappings[index] = {
    ...mappings[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveMappings(mappings);
  return mappings[index];
}

// Eliminar mapeo
export function deleteMapping(syncedDeviceId: string): boolean {
  const mappings = getMappings();
  const filtered = mappings.filter(m => m.syncedDeviceId !== syncedDeviceId);

  if (filtered.length === mappings.length) return false;

  saveMappings(filtered);
  return true;
}

// Obtener mapeo por dispositivo sincronizado
export function getMappingBySyncedDevice(syncedDeviceId: string): DeviceEquipmentMapping | null {
  const mappings = getMappings();
  return mappings.find(m => m.syncedDeviceId === syncedDeviceId) || null;
}

// Obtener mapeo por equipo local
export function getMappingByLocalEquipment(localEquipmentId: string): DeviceEquipmentMapping | null {
  const mappings = getMappings();
  return mappings.find(m => m.localEquipmentId === localEquipmentId) || null;
}

// Obtener mapeos por servidor
export function getMappingsByServer(serverId: string): DeviceEquipmentMapping[] {
  const mappings = getMappings();
  return mappings.filter(m => m.serverId === serverId);
}

// Sincronizar dispositivo con equipo local
export function syncDeviceWithEquipment(
  device: SyncedDevice,
  equipment: Equipment,
  syncDirection: 'bidirectional' | 'server-to-local' | 'local-to-server' = 'bidirectional'
): DeviceEquipmentMapping {
  const existingMapping = getMappingBySyncedDevice(device.id);

  if (existingMapping) {
    // Actualizar mapeo existente
    return updateMapping(device.id, {
      lastSync: new Date().toISOString(),
      syncDirection,
    })!;
  } else {
    // Crear nuevo mapeo
    return createMapping(
      device.id,
      equipment.id,
      device.serverId,
      device.externalId,
      syncDirection
    );
  }
}

// Actualizar equipo local desde dispositivo sincronizado
export function updateEquipmentFromDevice(
  equipment: Equipment,
  device: SyncedDevice
): Equipment {
  return {
    ...equipment,
    name: device.name,
    model: device.os || equipment.model,
    serialNumber: device.externalId || equipment.serialNumber,
    status: device.status === 'connected' ? 'assigned' : 'available',
    notes: `Sincronizado desde servidor externo. IP: ${device.ip}, Hostname: ${device.hostname}`,
  };
}

// Actualizar dispositivo sincronizado desde equipo local
export function updateDeviceFromEquipment(
  device: SyncedDevice,
  equipment: Equipment
): SyncedDevice {
  return {
    ...device,
    name: equipment.name,
    os: equipment.model || device.os,
    status: equipment.status === 'assigned' ? 'connected' : 'disconnected',
    syncedAt: new Date().toISOString(),
  };
}

// Auto-mapear dispositivos basándose en nombre o IP
export function autoMapDevices(
  devices: SyncedDevice[],
  equipments: Equipment[]
): DeviceEquipmentMapping[] {
  const newMappings: DeviceEquipmentMapping[] = [];

  devices.forEach(device => {
    // Buscar equipo con nombre similar
    const matchingEquipment = equipments.find(eq =>
      eq.name.toLowerCase() === device.name.toLowerCase() ||
      eq.name.toLowerCase().includes(device.hostname.toLowerCase()) ||
      device.name.toLowerCase().includes(eq.name.toLowerCase())
    );

    if (matchingEquipment) {
      const mapping = syncDeviceWithEquipment(device, matchingEquipment);
      newMappings.push(mapping);
    }
  });

  return newMappings;
}

// Obtener estadísticas de mapeo
export function getMappingStats() {
  const mappings = getMappings();

  return {
    totalMappings: mappings.length,
    bidirectional: mappings.filter(m => m.syncDirection === 'bidirectional').length,
    serverToLocal: mappings.filter(m => m.syncDirection === 'server-to-local').length,
    localToServer: mappings.filter(m => m.syncDirection === 'local-to-server').length,
    recentSyncs: mappings.filter(m => {
      const lastSync = new Date(m.lastSync);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return lastSync > oneHourAgo;
    }).length,
  };
}

// Limpiar todos los mapeos
export function clearAllMappings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Exportar mapeos
export function exportMappings(): string {
  return JSON.stringify(getMappings(), null, 2);
}

// Importar mapeos
export function importMappings(jsonString: string): boolean {
  try {
    const mappings = JSON.parse(jsonString);
    if (Array.isArray(mappings)) {
      saveMappings(mappings);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error al importar mapeos:', error);
    return false;
  }
}
