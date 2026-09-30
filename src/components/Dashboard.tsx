import { useApp } from '../context/AppContext';
import MeshMonitor from './MeshMonitor';
import {
  Printer,
  Package,
  AlertTriangle,
  ArrowLeftRight,
  Monitor,
  Server,
} from 'lucide-react';

export default function Dashboard() {
  const { printers, toners, movements, alerts } = useApp();

  const activePrinters = printers.filter(p => p.status === 'active').length;
  const lowStockItems = toners.filter(t => t.stock <= t.minStock).length;
  const totalTonerValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalMovements = movements.length;
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const stats = [
    {
      title: 'Impresoras Registradas',
      value: printers.length,
      subtitle: `${activePrinters} activas`,
      icon: <Printer size={24} />,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'Tóner en Inventario',
      value: toners.reduce((s, t) => s + t.stock, 0),
      subtitle: `Valor: $${totalTonerValue.toFixed(0)}`,
      icon: <Package size={24} />,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
    },
    {
      title: 'Alertas de Stock',
      value: lowStockItems,
      subtitle: `${unreadAlerts} sin leer`,
      icon: <AlertTriangle size={24} />,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
    },
    {
      title: 'Movimientos',
      value: totalMovements,
      subtitle: 'Total registrado',
      icon: <ArrowLeftRight size={24} />,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.textColor} p-3 rounded-xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mesh Central Monitor */}
      <MeshMonitor />

      {/* Empty States */}
      {printers.length === 0 && toners.length === 0 && movements.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
          <div className="text-center">
            <div className="flex justify-center gap-4 mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Printer size={32} className="text-blue-600" />
              </div>
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Package size={32} className="text-emerald-600" />
              </div>
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Monitor size={32} className="text-purple-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Bienvenido al Sistema de Control de Tóner
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Comienza agregando impresoras y tóner al inventario para gestionar tu parque de impresión
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-500">
              <span className="px-3 py-1 bg-white rounded-full">✓ Gestión de impresoras</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Control de inventario</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Monitoreo remoto</span>
              <span className="px-3 py-1 bg-white rounded-full">✓ Reportes detallados</span>
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
            Sistema integral de gestión de impresión y monitoreo remoto
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Integración con MeshCentral para monitoreo de equipos en tiempo real
            </p>
            <a 
              href="https://mesh.donnet.com.ar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
            >
              mesh.donnet.com.ar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
