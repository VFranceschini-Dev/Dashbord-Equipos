import { ExternalServer, SyncRecord, SyncedDevice } from '../types';

const STORAGE_KEYS = {
  SERVERS: 'external_servers',
  SYNC_RECORDS: 'sync_records',
  SYNCED_DEVICES: 'synced_devices',
};

// ============================================
// SERVIDORES EXTERNOS
// ============================================

export function getServers(): ExternalServer[] {
  const data = localStorage.getItem(STORAGE_KEYS.SERVERS);
  return data ? JSON.parse(data) : [];
}

export function saveServer(server: ExternalServer): void {
  const servers = getServers();
  const existingIndex = servers.findIndex(s => s.id === server.id);
  
  if (existingIndex >= 0) {
    servers[existingIndex] = server;
  } else {
    servers.push(server);
  }
  
  localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
}

export function deleteServer(id: string): void {
  const servers = getServers().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
  
  // También eliminar dispositivos sincronizados de este servidor
  const devices = getSyncedDevices().filter(d => d.serverId !== id);
  localStorage.setItem(STORAGE_KEYS.SYNCED_DEVICES, JSON.stringify(devices));
}

export function getServerById(id: string): ExternalServer | undefined {
  return getServers().find(s => s.id === id);
}

// ============================================
// REGISTROS DE SINCRONIZACIÓN
// ============================================

export function getSyncRecords(): SyncRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.SYNC_RECORDS);
  return data ? JSON.parse(data) : [];
}

export function addSyncRecord(record: SyncRecord): void {
  const records = getSyncRecords();
  records.unshift(record); // Agregar al inicio
  
  // Mantener solo los últimos 100 registros
  const limited = records.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.SYNC_RECORDS, JSON.stringify(limited));
}

export function getSyncRecordsByServer(serverId: string): SyncRecord[] {
  return getSyncRecords().filter(r => r.serverId === serverId);
}

// ============================================
// DISPOSITIVOS SINCRONIZADOS
// ============================================

export function getSyncedDevices(): SyncedDevice[] {
  const data = localStorage.getItem(STORAGE_KEYS.SYNCED_DEVICES);
  return data ? JSON.parse(data) : [];
}

export function saveSyncedDevices(devices: SyncedDevice[]): void {
  localStorage.setItem(STORAGE_KEYS.SYNCED_DEVICES, JSON.stringify(devices));
}

export function upsertSyncedDevice(device: SyncedDevice): void {
  const devices = getSyncedDevices();
  const existingIndex = devices.findIndex(
    d => d.serverId === device.serverId && d.externalId === device.externalId
  );
  
  if (existingIndex >= 0) {
    devices[existingIndex] = device;
  } else {
    devices.push(device);
  }
  
  saveSyncedDevices(devices);
}

export function upsertSyncedDevices(newDevices: SyncedDevice[]): void {
  const devices = getSyncedDevices();
  
  newDevices.forEach(newDevice => {
    const existingIndex = devices.findIndex(
      d => d.serverId === newDevice.serverId && d.externalId === newDevice.externalId
    );
    
    if (existingIndex >= 0) {
      devices[existingIndex] = newDevice;
    } else {
      devices.push(newDevice);
    }
  });
  
  saveSyncedDevices(devices);
}

export function getSyncedDevicesByServer(serverId: string): SyncedDevice[] {
  return getSyncedDevices().filter(d => d.serverId === serverId);
}

export function deleteSyncedDevicesByServer(serverId: string): void {
  const devices = getSyncedDevices().filter(d => d.serverId !== serverId);
  saveSyncedDevices(devices);
}

// ============================================
// ESTADÍSTICAS
// ============================================

export function getSyncStats() {
  const devices = getSyncedDevices();
  const servers = getServers();
  const records = getSyncRecords();
  
  return {
    totalServers: servers.length,
    activeServers: servers.filter(s => s.status === 'active').length,
    totalDevices: devices.length,
    connectedDevices: devices.filter(d => d.status === 'connected').length,
    disconnectedDevices: devices.filter(d => d.status === 'disconnected').length,
    totalSyncs: records.length,
    successfulSyncs: records.filter(r => r.status === 'success').length,
    failedSyncs: records.filter(r => r.status === 'error').length,
    lastSync: records.length > 0 ? records[0].timestamp : null,
  };
}

// ============================================
// UTILIDADES
// ============================================

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.SERVERS);
  localStorage.removeItem(STORAGE_KEYS.SYNC_RECORDS);
  localStorage.removeItem(STORAGE_KEYS.SYNCED_DEVICES);
}

export function exportDatabase(): string {
  const data = {
    servers: getServers(),
    syncRecords: getSyncRecords(),
    syncedDevices: getSyncedDevices(),
    exportedAt: new Date().toISOString(),
    version: '2.0.0',
  };
  
  return JSON.stringify(data, null, 2);
}

export function importDatabase(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.servers) {
      localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(data.servers));
    }
    if (data.syncRecords) {
      localStorage.setItem(STORAGE_KEYS.SYNC_RECORDS, JSON.stringify(data.syncRecords));
    }
    if (data.syncedDevices) {
      localStorage.setItem(STORAGE_KEYS.SYNCED_DEVICES, JSON.stringify(data.syncedDevices));
    }
    
    return true;
  } catch (error) {
    console.error('Error al importar base de datos:', error);
    return false;
  }
}
