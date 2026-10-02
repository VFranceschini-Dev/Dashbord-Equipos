import { useApp } from '../context/AppContext';
import {
  Printer, Package, AlertTriangle, Monitor, Server, Users, Building2, FileText,
  TrendingUp, TrendingDown, Activity, Shield, Clock, ChevronRight, Zap, Target
} from 'lucide-react';

export default function Dashboard() {
  const { printers, toners, movements, alerts, equipments, suppliers, collaborators, setCurrentPage } = useApp();

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
    <div className="space-y-8 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Hero Header - Figma Style */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-3xl p-8 lg:p-10 shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }} />
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <Shield size={16} className="text-blue-300" />
              </div>
              <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Panel de Control</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
              Bienvenido al Sistema de Control
            </h1>
            <p className="text-blue-200 text-base lg:text-lg max-w-2xl">
              Gestión integral de equipamientos, impresoras e inventario
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="glass-card rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-xs text-blue-200 font-medium mb-1">Fecha</p>
              <p className="text-sm font-bold text-white">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="glass-card rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-xs text-blue-200 font-medium mb-1">Hora</p>
              <p className="text-sm font-bold text-white">
                {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats - Premium Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {mainStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-300 text-left overflow-hidden card-interactive"
            >
              {/* Decorative gradient blob */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity duration-500`} />
              
              <div className="relative space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${stat.lightBg} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <Icon size={24} className={stat.iconColor} />
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    stat.trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {stat.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {stat.trend}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-4xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.subtitle}</p>
                </div>
                
                <div className="pt-3 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-blue-600 transition-colors">
                  Ver detalles <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Secondary Stats - Compact Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-200 text-left card-interactive"
            >
              <div className="flex items-center gap-4">
                <div className={`${stat.bg} ${stat.color} p-2.5 rounded-lg group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium truncate">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-400 truncate">{stat.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Alerts Section */}
      {unreadAlerts > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fadeInUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Alertas Pendientes</h3>
                <p className="text-sm text-gray-400">{unreadAlerts} notificación{unreadAlerts !== 1 ? 'es' : ''} sin leer</p>
              </div>
            </div>
            <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
              {unreadAlerts}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.filter(a => !a.read).slice(0, 6).map(alert => (
              <div
                key={alert.id}
                className={`p-5 rounded-xl border transition-all hover:shadow-md cursor-pointer ${
                  alert.severity === 'high' ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 hover:border-red-300' :
                  alert.severity === 'medium' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300' :
                  'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-500' :
                    alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 leading-snug">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-2">{alert.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome State */}
      {equipments.length === 0 && collaborators.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-10 border border-blue-100 animate-fadeInUp">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-200 to-purple-200 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-blue-700 border border-blue-200 shadow-sm">
              <Activity size={14} /> Sistema inicializado
            </div>
            <h3 className="text-2xl font-bold text-gray-800">
              ¡Bienvenido al Sistema de Control de Tóner!
            </h3>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Comienza registrando tus recursos para gestionar tu infraestructura de forma eficiente
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              {[
                { label: 'Equipamientos', icon: Monitor, color: 'bg-blue-100 text-blue-700' },
                { label: 'Colaboradores', icon: Users, color: 'bg-violet-100 text-violet-700' },
                { label: 'Proveedores', icon: Building2, color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Comprobantes', icon: FileText, color: 'bg-amber-100 text-amber-700' },
                { label: 'Impresoras', icon: Printer, color: 'bg-rose-100 text-rose-700' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <span key={i} className={`inline-flex items-center gap-2 px-4 py-2 ${item.color} rounded-full text-sm font-semibold shadow-sm`}>
                    <Icon size={14} /> {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Credits - Premium Design */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-sm border border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-[0.03]" />
        <div className="relative p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Server className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white shadow-sm" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Dashboard desarrollado por Sistemas PEDSA
                </h3>
                <p className="text-sm text-gray-500">
                  Sistema integral de gestión de impresión y equipamientos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-400 font-medium">Versión</p>
                <p className="text-sm font-bold text-gray-700">2.0.0</p>
              </div>
              <div className="h-12 w-px bg-gray-200" />
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
