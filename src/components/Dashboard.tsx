import { useApp } from '../context/AppContext';
import MeshMonitor from './MeshMonitor';
import {
  Printer, Package, AlertTriangle, ArrowLeftRight, Monitor, Server, Users, Building2, FileText
} from 'lucide-react';

export default function Dashboard() {
  const { printers, toners, movements, alerts, equipments, suppliers, collaborators } = useApp();

  const activePrinters = printers.filter(p => p.status === 'active').length;
  const lowStockItems = toners.filter(t => t.stock <= t.minStock).length;
  const totalTonerValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalMovements = movements.length;
  const unreadAlerts = alerts.filter(a => !a.read).length;
  const afterHoursAlerts = alerts.filter(a => a.type === 'after_hours' && !a.read).length;

  const stats = [
    {
      title: 'Equipamientos',
      value: equipments.length,
      subtitle: `${equipments.filter(e => e.status === 'assigned').length} asignados`,
      icon: <Monitor size={24} />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'Colaboradores',
      value: collaborators.length,
      subtitle: `${collaborators.filter(c => c.active).length} activos`,
      icon: <Users size={24} />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
    {
      title: 'Proveedores',
      value: suppliers.length,
      subtitle: `${suppliers.filter(s => s.active).length} activos`,
      icon: <Building2 size={24} />,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
    },
    {
      title: 'Impresoras',
      value: printers.length,
      subtitle: `${activePrinters} activas`,
      icon: <Printer size={24} />,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
    },
  ];

  const secondaryStats = [
    {
      title: 'Tóner en Inventario',
      value: toners.reduce((s, t) => s + t.stock, 0),
      subtitle: `Valor: $${totalTonerValue.toFixed(0)}`,
      icon: <Package size={20} />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'Comprobantes',
      value: movements.length,
      subtitle: `${totalMovements} movimientos`,
      icon: <FileText size={20} />,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
    },
    {
      title: 'Alertas Stock',
      value: lowStockItems,
      subtitle: `${unreadAlerts} sin leer`,
      icon: <AlertTriangle size={20} />,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
    },
    {
      title: 'Alertas After Hours',
      value: afterHoursAlerts,
      subtitle: 'Fuera de horario',
      icon: <AlertTriangle size={20} />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.textColor} p-3 rounded-xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MeshCentral Monitor - EMBEBIDO */}
      <MeshMonitor />

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {secondaryStats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`${stat.bgColor} ${stat.textColor} p-2 rounded-lg`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.title}</p>
                <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      {unreadAlerts > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Alertas Pendientes ({unreadAlerts})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.filter(a => !a.read).slice(0, 6).map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-200' :
                  alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <p className="text-sm font-medium text-gray-700">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">{alert.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome State */}
      {equipments.length === 0 && collaborators.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
          <div className="text-center">
            <div className="flex justify-center gap-4 mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm"><Monitor size={32} className="text-blue-600" /></div>
              <div className="p-3 bg-white rounded-xl shadow-sm"><Users size={32} className="text-purple-600" /></div>
              <div className="p-3 bg-white rounded-xl shadow-sm"><Printer size={32} className="text-emerald-600" /></div>
              <div className="p-3 bg-white rounded-xl shadow-sm"><Server size={32} className="text-amber-600" /></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Bienvenido al Sistema de Control de Tóner
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Comienza registrando equipamientos, colaboradores y proveedores para gestionar tu infraestructura
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-500">
              <span className="px-3 py-1 bg-white rounded-full">✓ ABM Equipamientos</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Gestión de Colaboradores</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Control de Proveedores</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Comprobantes</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Monitoreo MeshCentral</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Alertas After Hours</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Credits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Server className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Dashboard desarrollado por Sistemas PEDSA
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            Sistema integral de gestión de impresión, equipamientos y monitoreo remoto
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Integración con MeshCentral para monitoreo de equipos en tiempo real
            </p>
            <a href="https://mesh.donnet.com.ar" target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block">
              mesh.donnet.com.ar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
