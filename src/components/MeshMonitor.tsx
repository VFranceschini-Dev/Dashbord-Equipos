import { useState, useEffect } from 'react';
import { Monitor, Wifi, WifiOff, RefreshCw, ExternalLink, Server } from 'lucide-react';
import { meshCentralService, MeshNode } from '../services/meshCentral';

export default function MeshMonitor() {
  const [devices, setDevices] = useState<MeshNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchMeshDevices();
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchMeshDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMeshDevices = async () => {
    try {
      setLoading(true);
      
      // Obtener dispositivos desde Mesh Central
      const nodes = await meshCentralService.getNodes();
      
      setDevices(nodes);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error al obtener dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const onlineCount = devices.filter(d => d.status === 'connected').length;
  const offlineCount = devices.filter(d => d.status === 'disconnected').length;

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Hace menos de 1 minuto';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} minutos`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`;
    return date.toLocaleDateString('es-AR');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Monitor className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Monitoreo Remoto</h3>
            <p className="text-sm text-gray-500">Computadoras gestionadas desde MeshCentral</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMeshDevices}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={meshCentralService.getMeshCentralUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir MeshCentral
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Equipos</p>
          <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-700 mb-1">Conectados</p>
          <p className="text-2xl font-bold text-green-900">{onlineCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-700 mb-1">Desconectados</p>
          <p className="text-2xl font-bold text-red-900">{offlineCount}</p>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 mb-4">
        Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
      </div>

      {/* Devices List */}
      <div className="space-y-3">
        {devices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Server className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">Sin dispositivos monitoreados</p>
            <p className="text-sm">Los equipos aparecerán aquí cuando se conecten a MeshCentral</p>
          </div>
        ) : (
          devices.map(device => (
            <div
              key={device.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  device.status === 'connected' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {device.status === 'connected' ? (
                    <Wifi className="w-5 h-5 text-green-600" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{device.name}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {device.ip && <span>IP: {device.ip}</span>}
                    {device.os && <span>• {device.os}</span>}
                    {device.group && <span>• {device.group}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  device.status === 'connected'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    device.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  {device.status === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
                <p className="text-xs text-gray-500 mt-1">{formatLastSeen(device.lastSeen)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Monitoreo en tiempo real vía{' '}
          <a 
            href={meshCentralService.getMeshCentralUrl()} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline font-medium"
          >
            mesh.donnet.com.ar
          </a>
        </p>
      </div>
    </div>
  );
}
