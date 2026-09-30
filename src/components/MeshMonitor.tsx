import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Monitor, Wifi, WifiOff, RefreshCw, ExternalLink, Server, Clock, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { meshCentralService, MeshNode } from '../services/meshCentral';

const WORK_START_HOUR = 8;  // 8:00 AM
const WORK_END_HOUR = 18;   // 6:00 PM

export default function MeshMonitor() {
  const { alerts, setAlerts } = useApp();
  const [devices, setDevices] = useState<MeshNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [expandedView, setExpandedView] = useState(false);
  const [showIframe, setShowIframe] = useState(false);

  useEffect(() => {
    fetchMeshDevices();
    const interval = setInterval(fetchMeshDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMeshDevices = async () => {
    try {
      setLoading(true);
      const nodes = await meshCentralService.getNodes();
      setDevices(nodes);
      setLastUpdate(new Date());
      
      // Verificar equipos encendidos fuera de horario
      checkAfterHoursDevices(nodes);
    } catch (error) {
      console.error('Error al obtener dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAfterHoursDevices = (nodes: MeshNode[]) => {
    const now = new Date();
    const currentHour = now.getHours();
    const isAfterHours = currentHour < WORK_START_HOUR || currentHour >= WORK_END_HOUR;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    if (isAfterHours || isWeekend) {
      const onlineAfterHours = nodes.filter(n => n.status === 'connected');
      
      if (onlineAfterHours.length > 0) {
        const existingAlert = alerts.find(a => 
          a.type === 'after_hours' && 
          !a.read && 
          a.date === now.toISOString().split('T')[0]
        );

        if (!existingAlert) {
          const newAlert = {
            id: Date.now().toString(),
            type: 'after_hours' as const,
            message: `${onlineAfterHours.length} equipo(s) encendido(s) fuera de horario laboral: ${onlineAfterHours.map(n => n.name).join(', ')}`,
            severity: 'high' as const,
            date: now.toISOString().split('T')[0],
            read: false,
          };
          setAlerts(prev => [newAlert, ...prev]);
        }
      }
    }
  };

  const onlineCount = devices.filter(d => d.status === 'connected').length;
  const offlineCount = devices.filter(d => d.status === 'disconnected').length;
  const totalCount = devices.length;

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

  const isAfterHours = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    return currentHour < WORK_START_HOUR || currentHour >= WORK_END_HOUR || isWeekend;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${expandedView ? 'fixed inset-4 z-50 overflow-auto' : ''}`}>
      {expandedView && <div className="fixed inset-0 bg-black/50 -z-10" onClick={() => setExpandedView(false)} />}
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Monitoreo Remoto - MeshCentral</h3>
              <p className="text-sm text-gray-500">Equipos gestionados desde mesh.donnet.com.ar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandedView(!expandedView)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={expandedView ? 'Minimizar' : 'Expandir'}
            >
              {expandedView ? <Minimize2 className="w-5 h-5 text-gray-600" /> : <Maximize2 className="w-5 h-5 text-gray-600" />}
            </button>
            <button
              onClick={fetchMeshDevices}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowIframe(!showIframe)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              {showIframe ? 'Ocultar Panel' : 'Abrir MeshCentral'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-gray-500" />
              <p className="text-sm text-gray-600">Total Equipos</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">Conectados</p>
            </div>
            <p className="text-3xl font-bold text-green-900">{onlineCount}</p>
            {totalCount > 0 && (
              <p className="text-xs text-green-600 mt-1">{((onlineCount / totalCount) * 100).toFixed(0)}% del total</p>
            )}
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="flex items-center gap-2 mb-1">
              <WifiOff className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">Desconectados</p>
            </div>
            <p className="text-3xl font-bold text-red-900">{offlineCount}</p>
            {totalCount > 0 && (
              <p className="text-xs text-red-600 mt-1">{((offlineCount / totalCount) * 100).toFixed(0)}% del total</p>
            )}
          </div>
        </div>

        {/* After Hours Alert */}
        {isAfterHours() && onlineCount > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Equipos encendidos fuera de horario laboral</p>
              <p className="text-xs text-amber-700 mt-1">
                {onlineCount} equipo(s) conectado(s) fuera del horario de trabajo ({WORK_START_HOUR}:00 - {WORK_END_HOUR}:00)
              </p>
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Clock className="w-3 h-3" />
          Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
          <span className="text-gray-400">• Actualización automática cada 30s</span>
        </div>

        {/* MeshCentral Iframe */}
        {showIframe && (
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Panel MeshCentral</span>
              <a 
                href="https://mesh.donnet.com.ar" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Abrir en nueva pestaña <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <iframe
              src="https://mesh.donnet.com.ar"
              title="MeshCentral"
              className="w-full h-[500px] border-0"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        )}

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
                      device.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}></span>
                    {device.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{formatLastSeen(device.lastSeen)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Monitoreo en tiempo real vía{' '}
            <a 
              href="https://mesh.donnet.com.ar" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline font-medium"
            >
              mesh.donnet.com.ar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
