import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { listarUsuarios } from '../services/usuarios';
import { getLowStockGroups } from '../utils/tonerCompatibility';
import {
  Printer, Package, AlertTriangle, Monitor, Users, Building2, FileText,
  Activity, Shield, Clock, ChevronRight
} from 'lucide-react';
import LowStockAlerts from './LowStockAlerts';
import LogoVLF from './LogoVLF';

export default function Dashboard() {
  const { printers, toners, movements, alerts, equipments, suppliers, vouchers, setCurrentPage, dataLoading } = useApp();
//                              ^^^^^^^^ ← AGREGADO (necesario para leer los comprobantes reales)
  // Usuarios: misma fuente que la sección Usuarios (solo se necesitan los totales)
  const [usuarios, setUsuarios] = useState({ total: 0, activos: 0 });
  useEffect(() => {
    listarUsuarios('', { soloActivos: false, limit: 1 })
      .then(({ total, activos }) => setUsuarios({ total, activos }))
      .catch(() => setUsuarios({ total: 0, activos: 0 }));
  }, []);

  const activePrinters = printers.filter(p => p.status === 'active').length;

  // Calcular alertas de stock bajo agrupando por compatibilidad
  const lowStockGroups = getLowStockGroups(toners);
  const lowStockItems = lowStockGroups.length;

  const totalTonerValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalMovements = movements.length;
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const mainStats = [
    {
      title: 'Equipamientos',
      value: equipments.length,
      subtitle: `${equipments.filter(e => e.status === 'assigned').length} asignados`,
      icon: Monitor,
      color: 'blue',
      page: 'equipments' as const,
    },
    {
      title: 'Usuarios',
      value: usuarios.total,
      subtitle: `${usuarios.activos} activos`,
      icon: Users,
      color: 'violet',
      page: 'collaborators' as const,
    },
    {
      title: 'Proveedores',
      value: suppliers.length,
      subtitle: `${suppliers.filter(s => s.active).length} activos`,
      icon: Building2,
      color: 'emerald',
      page: 'suppliers' as const,
    },
    {
      title: 'Impresoras',
      value: printers.length,
      subtitle: `${activePrinters} activas`,
      icon: Printer,
      color: 'amber',
      page: 'printers' as const,
    },
  ];

  const secondaryStats = [
    {
      title: 'Inventario Tóner',
      value: toners.reduce((s, t) => s + t.stock, 0),
      subtitle: `Valor: $${totalTonerValue.toLocaleString('es-AR')}`,
      icon: Package,
      color: 'blue',
      page: 'inventory' as const,
    },
    {
      title: 'Comprobantes',
      value: vouchers.length,          // ← antes: movements.length  (mostraba movimientos bajo un título de comprobantes)
      subtitle: 'Total registrado',    // ← antes: 'Este período'    (tampoco era un dato real)
      icon: FileText,
      color: 'emerald',
      page: 'vouchers' as const,       // ← sin cambios: ya navegaba a la pantalla de comprobantes
    },
    {
      title: 'Alertas Stock',
      value: lowStockItems,
      subtitle: `${unreadAlerts} sin leer`,
      icon: AlertTriangle,
      color: 'amber',
      page: 'inventory' as const,
    },
    {
      title: 'Movimientos',
      value: totalMovements,
      subtitle: 'Total registrado',
      icon: Clock,
      color: 'purple',
      page: 'movements' as const,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
      },
      violet: {
        bg: 'bg-violet-50 dark:bg-violet-900/20',
        text: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-200 dark:border-violet-800',
      },
      emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
      },
      amber: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-6">
      {dataLoading.global && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cargando datos...
        </div>
      )}
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 rounded-2xl p-6 lg:p-8 shadow-lg dark:shadow-2xl border border-blue-200 dark:border-slate-700">
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Panel de Control</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              Dashboard de Equipamiento
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-sm lg:text-base">
              Gestión integral de recursos e inventario
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-xl px-4 py-2.5">
              <p className="text-xs text-gray-600 dark:text-slate-400">Fecha</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-xl px-4 py-2.5">
              <p className="text-xs text-gray-600 dark:text-slate-400">Hora</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, i) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 hover:shadow-xl hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 text-left overflow-hidden"
            >
              <div className={`absolute -top-8 -right-8 w-24 h-24 ${colors.bg} opacity-20 rounded-full blur-2xl group-hover:opacity-30 transition-opacity`} />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${colors.bg} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={22} className={colors.text} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400 mb-0.5">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{stat.subtitle}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Ver detalles <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {secondaryStats.map((stat, i) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <button
              key={i}
              onClick={() => setCurrentPage(stat.page)}
              className="group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`${colors.bg} ${colors.text} p-2 rounded-lg group-hover:scale-110 transition-transform`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{stat.title}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{stat.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts />

      {/* Alerts */}
      {unreadAlerts > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${getColorClasses('amber').bg} rounded-xl`}>
                <AlertTriangle size={20} className={getColorClasses('amber').text} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Alertas Pendientes</h3>
                <p className="text-xs text-gray-600 dark:text-slate-400">{unreadAlerts} notificación{unreadAlerts !== 1 ? 'es' : ''} sin leer</p>
              </div>
            </div>
            <span className={`px-3 py-1 ${getColorClasses('amber').bg} ${getColorClasses('amber').text} rounded-full text-xs font-bold`}>
              {unreadAlerts}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.filter(a => !a.read).slice(0, 6).map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all hover:shadow-lg ${
                  alert.severity === 'high'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                  alert.severity === 'medium'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-500' :
                    alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300 leading-snug">{alert.message}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1.5">{alert.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome State */}
      {equipments.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded-2xl p-8 border border-blue-200 dark:border-slate-600">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-full text-xs font-semibold text-blue-700 dark:text-blue-400 mb-4 border border-blue-200 dark:border-slate-600">
              <Activity size={12} /> Sistema inicializado
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              ¡Bienvenido al Dashboard de Equipamiento!
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 max-w-lg mx-auto">
              Comienza registrando tus recursos para gestionar tu infraestructura de forma eficiente
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: 'Equipamientos', icon: Monitor, color: 'blue' },
                { label: 'Usuarios', icon: Users, color: 'violet' },
                { label: 'Proveedores', icon: Building2, color: 'emerald' },
                { label: 'Comprobantes', icon: FileText, color: 'amber' },
                { label: 'Impresoras', icon: Printer, color: 'purple' },
              ].map((item, i) => {
                const Icon = item.icon;
                const colors = getColorClasses(item.color);
                return (
                  <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${colors.bg} ${colors.text} rounded-full text-xs font-semibold`}>
                    <Icon size={12} /> {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-[0.02] dark:opacity-[0.05]" />
        <div className="relative p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <LogoVLF size="md" showName={true} />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-slate-400">Versión</p>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-300">2.9.0</p>
              </div>
              <div className="h-10 w-px bg-gray-200 dark:bg-slate-700" />
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border border-emerald-200 dark:border-emerald-800">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Sistema Activo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}