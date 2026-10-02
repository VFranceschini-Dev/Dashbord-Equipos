import { useState, useEffect } from 'react';
import { meshCentralService, MeshNode } from '../services/meshCentral';
import { Monitor, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Server } from 'lucide-react';

interface MeshPCWidgetProps {
  serverUrl?: string;
  username?: string;
  password?: string;
}

export default function MeshPCWidget({ serverUrl, username, password }: MeshPCWidgetProps) {
  const [pcs, setPcs] = useState<MeshNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Configurar si se proporcionan credenciales
    if (serverUrl && username && password) {
      meshCentralService.setConfig({
        serverUrl,
        username,
        password,
        autoSync: false,
        syncInterval: 5,
      });
    }

    loadPCs();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadPCs, 30000);
    return () => clearInterval(interval);
  }, [serverUrl, username, password]);

  const loadPCs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const nodes = await meshCentralService.getNodes();
      setPcs(nodes);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Error al conectar con MeshCentral');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const connectedCount = pcs.filter(pc => pc.status === 'connected').length;
  const disconnectedCount = pcs.filter(pc => pc.status === 'disconnected').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl">
            <Server size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              PCs en MeshCentral
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
            </p>
          </div>
        </div>
        <button
          onClick={loadPCs}
          disabled={loading}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw size={20} className={`text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pcs.length}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Conectadas</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{connectedCount}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <p className="text-xs text-red-600 dark:text-red-400">Desconectadas</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{disconnectedCount}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* PC List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading && pcs.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw size={32} className="mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando PCs...</p>
          </div>
        ) : pcs.length === 0 ? (
          <div className="text-center py-8">
            <Monitor size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay PCs configuradas
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Configure la conexión en Administración
            </p>
          </div>
        ) : (
          pcs.map(pc => (
            <div
              key={pc.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  pc.status === 'connected'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {pc.status === 'connected' ? (
                    <Wifi size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff size={16} className="text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {pc.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pc.ip} • {pc.os}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  pc.status === 'connected'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    pc.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  {pc.status === 'connected' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
