import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Monitor, Wifi, WifiOff, RefreshCw, ExternalLink, Server, Clock, 
  AlertTriangle, Maximize2, Minimize2, Globe, Shield, Activity,
  ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { meshCentralService, MeshNode } from '../services/meshCentral';

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;

export default function MeshMonitor() {
  const { alerts, setAlerts } = useApp();
  const [devices, setDevices] = useState<MeshNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [expandedView, setExpandedView] = useState(false);
  const [showIframe, setShowIframe] = useState(true);
  const [showDevices, setShowDevices] = useState(true);

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
          a.type === 'after_hours' && !a.read && a.date === now.toISOString().split('T')[0]
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
  const onlinePercentage = totalCount > 0 ? ((onlineCount / totalCount) * 100).toFixed(0) : '0';

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
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
      expandedView ? 'fixed inset-4 z-50 overflow-auto' : ''
    }`}>
      {expandedView && <div className="fixed inset-0 bg-black/50 -z-10" onClick={() => setExpandedView(false)} />}
      
      {/* Header con gradiente */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                  <Monitor className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                  <Activity className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Monitoreo Remoto</h3>
                <p className="text-blue-100 text-sm">Equipos gestionados desde MeshCentral</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedView(!expandedView)}
                className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-colors border border-white/20"
                title={expandedView ? 'Minimizar' : 'Expandir'}
              >
                {expandedView ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
              <button
                onClick={fetchMeshDevices}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-colors border border-white/20 text-white text-sm font-medium disabled:opacity-50"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>

          {/* Stats Cards en el header */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-blue-200" />
                <p className="text-xs font-medium text-blue-100">Total Equipos</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-emerald-300" />
                <p className="text-xs font-medium text-blue-100">Conectados</p>
              </div>
              <p className="text-3xl font-bold text-white">{onlineCount}</p>
              {totalCount > 0 && (
                <p className="text-xs text-emerald-300 mt-1">{onlinePercentage}% del total</p>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <WifiOff className="w-4 h-4 text-rose-300" />
                <p className="text-xs font-medium text-blue-100">Desconectados</p>
              </div>
              <p className="text-3xl font-bold text-white">{offlineCount}</p>
              {totalCount > 0 && (
                <p className="text-xs text-rose-300 mt-1">{(100 - parseInt(onlinePercentage))}% del total</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* After Hours Alert */}
        {isAfterHours() && onlineCount > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Equipos encendidos fuera de horario laboral</p>
              <p className="text-xs text-amber-700 mt-1">
                {onlineCount} equipo(s) conectado(s) fuera del horario de trabajo ({WORK_START_HOUR}:00 - {WORK_END_HOUR}:00)
              </p>
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400">Actualización automática cada 30s</span>
          </div>
        </div>

        {/* MeshCentral Iframe - Diseño tipo ventana de aplicación */}
        <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-gray-50">
          {/* Barra de título del iframe */}
          <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-md border border-gray-200 text-xs text-gray-600">
                <Globe className="w-3 h-3" />
                <span className="font-mono">mesh.donnet.com.ar</span>
                <Shield className="w-3 h-3 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowIframe(!showIframe)}
                className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700 transition-colors"
              >
                {showIframe ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showIframe ? 'Ocultar' : 'Mostrar'}
              </button>
              <a 
                href="https://mesh.donnet.com.ar" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Nueva pestaña
              </a>
            </div>
          </div>
          
          {/* Iframe content */}
          {showIframe && (
            <div className="relative bg-white">
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-0">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Cargando MeshCentral...</p>
                </div>
              </div>
              <iframe
                src="https://mesh.donnet.com.ar"
                title="MeshCentral"
                className="w-full h-[600px] border-0 relative z-10"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
              />
            </div>
          )}
        </div>

        {/* Devices List */}
        <div>
          <button
            onClick={() => setShowDevices(!showDevices)}
            className="flex items-center justify-between w-full mb-4 group"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-700">Dispositivos Monitoreados</h4>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                {devices.length}
              </span>
            </div>
            {showDevices ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showDevices && (
            <div className="space-y-2">
              {devices.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <Server className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">Sin dispositivos monitoreados</p>
                  <p className="text-sm text-gray-500">Los equipos aparecerán aquí cuando se conecten a MeshCentral</p>
                </div>
              ) : (
                devices.map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${
                        device.status === 'connected' 
                          ? 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200' 
                          : 'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200'
                      }`}>
                        {device.status === 'connected' ? (
                          <Wifi className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{device.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          {device.ip && <span className="font-mono">{device.ip}</span>}
                          {device.ip && device.os && <span>•</span>}
                          {device.os && <span>{device.os}</span>}
                          {device.group && <><span>•</span><span className="px-2 py-0.5 bg-gray-100 rounded">{device.group}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        device.status === 'connected'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          device.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                        }`}></span>
                        {device.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatLastSeen(device.lastSeen)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Monitoreo en tiempo real vía{' '}
            <a 
              href="https://mesh.donnet.com.ar" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              mesh.donnet.com.ar
            </a>
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Shield className="w-3 h-3" />
            <span>Conexión segura</span>
          </div>
        </div>
      </div>
    </div>
  );
}
