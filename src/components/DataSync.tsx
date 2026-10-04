import { useState, useEffect } from 'react';
import { ExternalServer, SyncRecord, SyncedDevice } from '../types';
import * as db from '../services/localDatabase';
import {
  RefreshCw, CheckCircle, AlertCircle, Clock, Database,
  Server, Download, Upload, Trash2, Activity, TrendingUp,
  Wifi, WifiOff, HardDrive, Calendar
} from 'lucide-react';

export default function DataSync() {
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);
  const [syncedDevices, setSyncedDevices] = useState<SyncedDevice[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [stats, setStats] = useState(db.getSyncStats());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setServers(db.getServers());
    setSyncRecords(db.getSyncRecords());
    setSyncedDevices(db.getSyncedDevices());
    setStats(db.getSyncStats());
  };

  const handleSyncServer = async (server: ExternalServer) => {
    setSyncing(server.id);
    
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Simular sincronización con el servidor
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generar dispositivos de ejemplo (en producción, esto vendría del servidor real)
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
      
      // Guardar dispositivos en la base de datos local
      db.upsertSyncedDevices(mockDevices);
      
      // Crear registro de sincronización
      const duration = Date.now() - startTime;
      const record: SyncRecord = {
        id: `sync-${Date.now()}`,
        serverId: server.id,
        serverName: server.name,
        timestamp: new Date().toISOString(),
        status: 'success',
        recordsImported: mockDevices.length,
        recordsUpdated: 0,
        recordsDeleted: 0,
        errors: [],
        duration,
      };
      
      db.addSyncRecord(record);
      
      // Actualizar último sync del servidor
      db.saveServer({
        ...server,
        lastSync: new Date().toISOString(),
        status: 'active',
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
}
