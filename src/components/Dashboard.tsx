import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  Printer, Package, AlertTriangle, Monitor, Server, Users, Building2, FileText,
  TrendingUp, TrendingDown, Activity, Shield, Clock, ChevronRight, Sun, Moon
} from 'lucide-react';

export default function Dashboard() {
  const { printers, toners, movements, alerts, equipments, suppliers, collaborators, setCurrentPage } = useApp();
  const { theme, toggleTheme } = useTheme();

  const activePrinters = printers.filter(p => p.status === 'active').length;
  const lowStockItems = toners.filter(t => t.stock <= t.minStock).length;
  const totalTonerValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalMovements = movements.length;
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const mainStats = [
    {
      title: 'Equipamientos',
      value: equipments.length,
      subtitle: `${equipments.filter(e => e.status === 'assigned').length} asignados`,
      icon: Monitor,
      gradient: 'from-blue-500 to-blue-600',
      lightBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12%',
      trendUp: true,
      page: 'equipments' as const,
    },
    {
      title: 'Colaboradores',
      value: collaborators.length,
      subtitle: `${collaborators.filter(c => c.active).length} activos`,
      icon: Users,
      gradient: 'from-violet-500 to-purple-600',
      lightBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      trend: '+5%',
      trendUp: true,
      page: 'collaborators' as const,
    },
    {
      title: 'Proveedores',
      value: suppliers.length,
      subtitle: `${suppliers.filter(s => s.active).length} activos`,
      icon: Building2,
      gradient: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      trend: '+3%',
      trendUp: true,
      page: 'suppliers' as const,
    },
    {
      title: 'Impresoras',
      value: printers.length,
      subtitle: `${activePrinters} activas`,
      icon: Printer,
      gradient: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: '0%',
      trendUp: true,
      page: 'printers' as const,
    },
  ];

  const secondaryStats = [
    {
      title: 'Inventario Tóner',
      value: toners.reduce((s, t) => s + t.stock, 0),
      subtitle: `Valor: $${totalTonerValue.toLocaleString('es-AR')}`,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      page: 'inventory' as const,
    },
    {
      title: 'Comprobantes',
      value: movements.length,
      subtitle: 'Este período',
      icon: FileText,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      page: 'vouchers' as const,
    },
    {
      title: 'Alertas Stock',
      value: lowStockItems,
      subtitle: `${unreadAlerts} sin leer`,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      page: 'inventory' as const,
    },
    {
      title: 'Movimientos',
      value: totalMovements,
      subtitle: 'Total registrado',
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      page: 'movements' as const,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-2xl p-6 lg:p-8 shadow-xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-blue-300" />
              <span className="text-xs font-medium text-blue-300 uppercase tracking-wider">Panel de Control</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
              Bienvenido al Sistema de Control
            </h1>
            <p className="text-blue-200 text-sm lg:text-base">
              Gestión integral de equipamientos, impresoras e inventario
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-white hover:bg-white/20 transition-colors"
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            </button>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-white">
              <p className="text-xs text-blue-200">Fecha</p>
              <p className="text-sm font-semibold">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-white">
              <p className="text-xs text-blue-200">Hora</p>
              <p className="text-sm font-semibold">
                {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group relative bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 text-left overflow-hidden"
            >
              <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${stat.lightBg} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={22} className={stat.iconColor} />
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    stat.trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {stat.trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {stat.trend}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-0.5">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
                  Ver detalles <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {secondaryStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`${stat.bg} ${stat.color} p-2 rounded-lg group-hover:scale-110 transition-transform`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{stat.title}</p>
                  <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-400 truncate">{stat.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {unreadAlerts > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Alertas Pendientes</h3>
                <p className="text-xs text-gray-400">{unreadAlerts} notificación{unreadAlerts !== 1 ? 'es' : ''} sin leer</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {unreadAlerts}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.filter(a => !a.read).slice(0, 6).map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all hover:shadow-sm ${
                  alert.severity === 'high' ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100' :
                  alert.severity === 'medium' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100' :
                  'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-500' :
                    alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 leading-snug">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{alert.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {equipments.length === 0 && collaborators.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200 to-purple-200 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-xs font-medium text-blue-700 mb-4 border border-blue-100">
              <Activity size={12} /> Sistema inicializado
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              ¡Bienvenido al Sistema de Control de Tóner!
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto">
              Comienza registrando tus recursos para gestionar tu infraestructura de forma eficiente
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: 'Equipamientos', icon: Monitor, color: 'bg-blue-100 text-blue-700' },
                { label: 'Colaboradores', icon: Users, color: 'bg-violet-100 text-violet-700' },
                { label: 'Proveedores', icon: Building2, color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Comprobantes', icon: FileText, color: 'bg-amber-100 text-amber-700' },
                { label: 'Impresoras', icon: Printer, color: 'bg-rose-100 text-rose-700' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${item.color} rounded-full text-xs font-medium`}>
                    <Icon size={12} /> {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-[0.03]" />
        <div className="relative p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Desarrollado por Area Sistemas PEDSA
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-400">Versión</p>
                <p className="text-xs font-semibold text-gray-700">2.0.0</p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-emerald-700">Sistema Activo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
