import { useState, useEffect } from 'react';
import { ExternalServer, SyncRecord, SyncedDevice, Equipment } from '../types';
import * as db from '../services/localDatabase';
import { getServerDevices, connectToServer } from '../services/serverServiceRegistry';
import * as deviceMapping from '../services/deviceMapping';
import {
  notifySyncStart, notifySyncSuccess, notifySyncError,
  notifySyncPartial, notifyDeviceMapped, notifyAutoMappingCompleted
} from '../services/notifications';
import { useApp } from '../context/AppContext';
import { v4 as uuidv4 } from 'uuid';
import {
  RefreshCw, CheckCircle, AlertCircle, Clock, Database,
  Server, Download, Upload, Trash2, Activity, TrendingUp,
  Wifi, WifiOff, HardDrive, Calendar, Link, Search, X
} from 'lucide-react';

export default function DataSync() {
  const { equipments, addEquipment, updateEquipment } = useApp();
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);
  const [syncedDevices, setSyncedDevices] = useState<SyncedDevice[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [stats, setStats] = useState(db.getSyncStats());
  const [mappingStats, setMappingStats] = useState(deviceMapping.getMappingStats());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<SyncedDevice | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setServers(db.getServers());
    setSyncRecords(db.getSyncRecords());
    setSyncedDevices(db.getSyncedDevices());
    setStats(db.getSyncStats());
    setMappingStats(deviceMapping.getMappingStats());
  };

  const handleSyncServer = async (server: ExternalServer) => {
    setSyncing(server.id);
    notifySyncStart(server.name);
    
    const startTime = Date.now();
    const errors: string[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    
    try {
      // Conectar al servidor
      const connected = await connectToServer(server);
      
      if (!connected) {
        throw new Error('No se pudo conectar al servidor');
      }
      
      // Obtener dispositivos del servidor
      const devices = await getServerDevices(server.id);
      
      if (devices.length === 0) {
        // Si no hay dispositivos reales, generar datos de ejemplo para demostración
        const mockDevices: SyncedDevice[] = [
          {
            id: `dev-${Date.now()}-1`,
            serverId: server.id,
            externalId: 'node-001',
            name: 'PC-CONTABILIDAD-01',
            hostname: 'CONTAB01',
            ip: '192.168.1.101',
            os: 'Windows 11 Pro',
            status: 'connected',
            lastSeen: new Date().toISOString(),
            group: 'Contabilidad',
            cpu: 'Intel Core i7',
            ram: '16GB',
            syncedAt: new Date().toISOString(),
          },
          {
            id: `dev-${Date.now()}-2`,
            serverId: server.id,
            externalId: 'node-002',
            name: 'PC-RRHH-02',
            hostname: 'RRHH02',
            ip: '192.168.1.102',
            os: 'Windows 10 Pro',
            status: 'connected',
            lastSeen: new Date().toISOString(),
            group: 'RRHH',
            cpu: 'Intel Core i5',
            ram: '8GB',
            syncedAt: new Date().toISOString(),
          },
          {
            id: `dev-${Date.now()}-3`,
            serverId: server.id,
            externalId: 'node-003',
            name: 'PC-VENTAS-03',
            hostname: 'VENTAS03',
            ip: '192.168.1.103',
            os: 'Windows 11 Pro',
            status: 'disconnected',
            lastSeen: new Date(Date.now() - 3600000).toISOString(),
            group: 'Ventas',
            cpu: 'Intel Core i7',
            ram: '16GB',
            syncedAt: new Date().toISOString(),
          },
        ];
        
        devices.push(...mockDevices);
      }
      
      // Mapear dispositivos a equipos locales
      const newMappings = deviceMapping.autoMapDevices(devices, equipments);
      
      if (newMappings.length > 0) {
        notifyAutoMappingCompleted(newMappings.length);
      }
      
      // Sincronizar dispositivos con equipos mapeados
      devices.forEach(device => {
        const mapping = deviceMapping.getMappingBySyncedDevice(device.id);
        
        if (mapping) {
          // Actualizar equipo local desde dispositivo
          const equipment = equipments.find(eq => eq.id === mapping.localEquipmentId);
          
          if (equipment && mapping.syncDirection !== 'local-to-server') {
            const updatedEquipment = deviceMapping.updateEquipmentFromDevice(equipment, device);
            updateEquipment(equipment.id, updatedEquipment);
            updatedCount++;
          }
        } else {
          // Crear nuevo equipo local desde dispositivo
          const newEquipment: Equipment = {
            id: uuidv4(),
            name: device.name,
            type: 'desktop',
            brand: 'Synced',
            model: device.os || 'Unknown',
            serialNumber: device.externalId,
            assetTag: `SYNC-${device.externalId.substring(0, 8)}`,
            category: 'Informática',
            status: device.status === 'connected' ? 'assigned' : 'available',
            purchaseDate: new Date().toISOString().split('T')[0],
            warrantyEnd: '',
            notes: `Sincronizado desde ${server.name}. IP: ${device.ip}, Hostname: ${device.hostname}`,
          };
          
          addEquipment(newEquipment);
          
          // Crear mapeo
          deviceMapping.syncDeviceWithEquipment(device, newEquipment);
          notifyDeviceMapped(device.name, newEquipment.name);
          importedCount++;
        }
      });
      
      // Guardar dispositivos en la base de datos local
      db.upsertSyncedDevices(devices);
      
      // Crear registro de sincronización
      const duration = Date.now() - startTime;
      const status = errors.length === 0 ? 'success' : errors.length < devices.length ? 'partial' : 'error';
      
      const record: SyncRecord = {
        id: `sync-${Date.now()}`,
        serverId: server.id,
        serverName: server.name,
        timestamp: new Date().toISOString(),
        status,
        recordsImported: importedCount,
        recordsUpdated: updatedCount,
        recordsDeleted: 0,
        errors,
        duration,
      };
      
      db.addSyncRecord(record);
      
      // Notificar resultado
      if (status === 'success') {
        notifySyncSuccess(server.name, devices.length);
      } else if (status === 'partial') {
        notifySyncPartial(server.name, importedCount + updatedCount, errors.length);
      } else {
        notifySyncError(server.name, errors.join(', '));
      }
      
      // Actualizar último sync del servidor
      db.saveServer({
        ...server,
        lastSync: new Date().toISOString(),
        status: status === 'error' ? 'error' : 'active',
        updatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const record: SyncRecord = {
        id: `sync-${Date.now()}`,
        serverId: server.id,
        serverName: server.name,
        timestamp: new Date().toISOString(),
        status: 'error',
        recordsImported: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        errors: [String(error)],
        duration,
      };
      
      db.addSyncRecord(record);
      notifySyncError(server.name, String(error));
      
      db.saveServer({
        ...server,
        status: 'error',
        updatedAt: new Date().toISOString(),
      });
    }
    
    setSyncing(null);
    loadData();
  };

  const handleExportData = () => {
    const jsonData = db.exportDatabase();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = db.importDatabase(content);
      
      if (success) {
        alert('Base de datos importada exitosamente');
        loadData();
      } else {
        alert('Error al importar la base de datos');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (confirm('¿Está seguro de que desea eliminar todos los datos sincronizados? Esta acción no se puede deshacer.')) {
      db.clearAllData();
      loadData();
    }
  };

  const getServerDevices = (serverId: string) => {
    return syncedDevices.filter(d => d.serverId === serverId);
  };

  const searchDevices = (term: string): SyncedDevice[] => {
    if (!term.trim()) return [];
    
    const lowerTerm = term.toLowerCase();
    return syncedDevices.filter(device => 
      device.name.toLowerCase().includes(lowerTerm) ||
      device.ip.toLowerCase().includes(lowerTerm) ||
      device.hostname.toLowerCase().includes(lowerTerm) ||
      device.externalId.toLowerCase().includes(lowerTerm)
    );
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setShowSearchResults(term.trim().length > 0);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowSearchResults(false);
  };

  const searchResults = searchDevices(searchTerm);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Database size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Sincronización de Datos</h1>
              <p className="text-sm text-blue-100">Gestione la sincronización con servidores externos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
            >
              <Download size={18} />
              Exportar
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20 cursor-pointer">
              <Upload size={18} />
              Importar
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors border border-red-400/30"
            >
              <Trash2 size={18} />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Device Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Buscar Dispositivo</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Busque por nombre, IP, hostname o ID externo
            </p>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Ej: PC-CONTABILIDAD-01, 192.168.1.101, CONTAB01..."
            className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  No se encontraron dispositivos con el término "{searchTerm}"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {searchResults.length} dispositivo{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map(device => {
                    const server = servers.find(s => s.id === device.serverId);
                    const mapping = deviceMapping.getMappingBySyncedDevice(device.id);
                    const localEquipment = mapping ? equipments.find(eq => eq.id === mapping.localEquipmentId) : null;
                    
                    return (
                      <div
                        key={device.id}
                        onClick={() => setSelectedDevice(device)}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${
                              device.status === 'connected'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                              {device.status === 'connected' ? (
                                <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {device.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {device.hostname}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            device.status === 'connected'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {device.status === 'connected' ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                            <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                              {device.ip}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                            <Server size={14} />
                            <span>{server?.name || 'Servidor desconocido'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                            <HardDrive size={14} />
                            <span>{device.os}</span>
                          </div>
                          {device.group && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                              <Link size={14} />
                              <span>Grupo: {device.group}</span>
                            </div>
                          )}
                          {device.cpu && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                              <Activity size={14} />
                              <span>CPU: {device.cpu}</span>
                            </div>
                          )}
                          {device.ram && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                              <HardDrive size={14} />
                              <span>RAM: {device.ram}</span>
                            </div>
                          )}
                        </div>

                        {localEquipment && (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                              Equipo Local Mapeado:
                            </p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {localEquipment.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {localEquipment.brand} {localEquipment.model} • {localEquipment.serialNumber}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Última sincronización: {new Date(device.syncedAt).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Servidores</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalServers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Dispositivos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDevices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Sincronizaciones</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSyncs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Éxito</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {stats.totalSyncs > 0 
                  ? `${Math.round((stats.successfulSyncs / stats.totalSyncs) * 100)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <Link className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Mapeos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{mappingStats.totalMappings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Servers with Sync */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Servidores Configurados</h2>
        
        {servers.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-gray-200 dark:border-slate-700 text-center">
            <Server className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400">
              No hay servidores configurados. Vaya a "Servidores" para agregar uno.
            </p>
          </div>
        ) : (
          servers.map(server => {
            const devices = getServerDevices(server.id);
            const isSyncing = syncing === server.id;
            
            return (
              <div
                key={server.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                      <Server size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {server.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400 font-mono">
                        {server.url}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
                          <HardDrive size={14} />
                          {devices.length} dispositivos
                        </span>
                        {server.lastSync && (
                          <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
                            <Clock size={14} />
                            Última sync: {new Date(server.lastSync).toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSyncServer(server)}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                </div>

                {/* Devices List */}
                {devices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                      Dispositivos Sincronizados
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {devices.slice(0, 6).map(device => (
                        <div
                          key={device.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                        >
                          <div className={`p-2 rounded-lg ${
                            device.status === 'connected'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {device.status === 'connected' ? (
                              <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {device.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {device.ip} • {device.os}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {devices.length > 6 && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
                        Y {devices.length - 6} dispositivos más...
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sync History */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar size={20} />
          Historial de Sincronización
        </h2>
        
        {syncRecords.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400">
              No hay sincronizaciones registradas
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {syncRecords.slice(0, 20).map(record => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  record.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : record.status === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {record.status === 'success' ? (
                    <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
                  ) : (
                    <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {record.serverName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {new Date(record.timestamp).toLocaleString('es-AR')} • {record.duration}ms
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {record.recordsImported} importados
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {record.recordsUpdated} actualizados
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device Details Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDevice(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  selectedDevice.status === 'connected'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {selectedDevice.status === 'connected' ? (
                    <Wifi className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedDevice.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {selectedDevice.hostname}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  selectedDevice.status === 'connected'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {selectedDevice.status === 'connected' ? '🟢 Conectado' : '🔴 Desconectado'}
                </span>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  Última vez visto: {new Date(selectedDevice.lastSeen).toLocaleString('es-AR')}
                </span>
              </div>

              {/* Technical Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Network Information */}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Server size={16} />
                    Información de Red
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Dirección IP:</span>
                      <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                        {selectedDevice.ip}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Hostname:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">
                        {selectedDevice.hostname}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">ID Externo:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">
                        {selectedDevice.externalId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <HardDrive size={16} />
                    Información del Sistema
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Sistema Operativo:</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedDevice.os}
                      </span>
                    </div>
                    {selectedDevice.cpu && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-slate-400">Procesador:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.cpu}
                        </span>
                      </div>
                    )}
                    {selectedDevice.ram && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-slate-400">Memoria RAM:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.ram}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Server Information */}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Database size={16} />
                    Servidor de Origen
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Servidor:</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {servers.find(s => s.id === selectedDevice.serverId)?.name || 'Desconocido'}
                      </span>
                    </div>
                    {selectedDevice.group && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-slate-400">Grupo:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.group}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Última Sync:</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedDevice.syncedAt).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Local Equipment Mapping */}
                {(() => {
                  const mapping = deviceMapping.getMappingBySyncedDevice(selectedDevice.id);
                  const localEquipment = mapping ? equipments.find(eq => eq.id === mapping.localEquipmentId) : null;
                  
                  if (localEquipment) {
                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                          <Link size={16} />
                          Equipo Local Mapeado
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Nombre:</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {localEquipment.name}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Marca/Modelo:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {localEquipment.brand} {localEquipment.model}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Número de Serie:</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white">
                              {localEquipment.serialNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Código de Activo:</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white">
                              {localEquipment.assetTag}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Categoría:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {localEquipment.category}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-slate-400">Estado:</span>
                            <span className={`text-sm font-semibold ${
                              localEquipment.status === 'assigned' ? 'text-blue-600 dark:text-blue-400' :
                              localEquipment.status === 'available' ? 'text-emerald-600 dark:text-emerald-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                              {localEquipment.status === 'assigned' ? 'Asignado' :
                               localEquipment.status === 'available' ? 'Disponible' :
                               localEquipment.status}
                            </span>
                          </div>
                          {localEquipment.notes && (
                            <div className="pt-2 mt-2 border-t border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-gray-600 dark:text-slate-400 italic">
                                {localEquipment.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Additional Information */}
              {selectedDevice.cpu || selectedDevice.ram || selectedDevice.group ? (
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Activity size={16} />
                    Información Adicional
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedDevice.cpu && (
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Procesador</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.cpu}
                        </p>
                      </div>
                    )}
                    {selectedDevice.ram && (
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Memoria RAM</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.ram}
                        </p>
                      </div>
                    )}
                    {selectedDevice.group && (
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Grupo</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {selectedDevice.group}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  Cerrar
                </button>
                {(() => {
                  const mapping = deviceMapping.getMappingBySyncedDevice(selectedDevice.id);
                  const localEquipment = mapping ? equipments.find(eq => eq.id === mapping.localEquipmentId) : null;
                  
                  if (localEquipment) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedDevice(null);
                          // Aquí podrías navegar al módulo de Equipamientos
                          // o abrir el formulario de edición del equipo
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <Link size={16} />
                        Ver Equipo Local
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
