import { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Page } from '../types';
import {
  LayoutDashboard, Printer, Package, ArrowLeftRight, BarChart3, Bell, Menu, X, LogOut,
  Monitor, Users, Building2, FileText, ChevronRight, Settings, Server, RefreshCw
} from 'lucide-react';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';

const navItems: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { page: 'equipments', label: 'Equipamientos', icon: <Monitor size={20} /> },
  { page: 'collaborators', label: 'Colaboradores', icon: <Users size={20} /> },
  { page: 'suppliers', label: 'Proveedores', icon: <Building2 size={20} /> },
  { page: 'vouchers', label: 'Comprobantes', icon: <FileText size={20} /> },
  { page: 'printers', label: 'Impresoras', icon: <Printer size={20} /> },
  { page: 'inventory', label: 'Inventario', icon: <Package size={20} /> },
  { page: 'movements', label: 'Movimientos', icon: <ArrowLeftRight size={20} /> },
  { page: 'reports', label: 'Reportes', icon: <BarChart3 size={20} /> },
  { page: 'server-config', label: 'Servidores', icon: <Server size={20} /> },
  { page: 'data-sync', label: 'Sincronización', icon: <RefreshCw size={20} /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { currentPage, setCurrentPage, unreadAlerts, alerts, markAlertRead } = useApp();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const unreadAlertList = alerts.filter(a => !a.read);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col shadow-sm
      `}>
        <div className="p-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Printer size={20} className="text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
            </div>
            <div>
              <h1 className="font-bold text-base text-gray-900 dark:text-white">Dashboard Control</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">de Equipamientos</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => { setCurrentPage(item.page); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                <span className={`${isActive ? 'text-white' : 'text-gray-400 dark:text-slate-400 group-hover:text-gray-600 dark:group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight size={16} className="text-white/70" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-slate-700">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-600 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.email || 'Usuario'}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{user?.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
              </div>
              <button 
                onClick={logout} 
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-500 text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" 
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Menu size={20} className="text-gray-600 dark:text-slate-300" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {navItems.find(n => n.page === currentPage)?.label || 'Dashboard'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div className="relative">
              <button 
                onClick={() => setShowAlerts(!showAlerts)} 
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Bell size={20} className="text-gray-600 dark:text-slate-300" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 shadow-lg shadow-red-500/30">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-700 dark:to-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Notificaciones</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{unreadAlerts} sin leer</p>
                      </div>
                      <button 
                        onClick={() => setShowAlerts(false)} 
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <X size={16} className="text-gray-500 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-96">
                    {unreadAlertList.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={32} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-slate-400">Sin notificaciones</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-slate-700">
                        {unreadAlertList.map(alert => (
                          <div 
                            key={alert.id} 
                            className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors" 
                            onClick={() => markAlertRead(alert.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                alert.type === 'after_hours' ? 'bg-amber-500' :
                                alert.type === 'low_stock' ? 'bg-red-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 dark:text-slate-300 leading-snug">{alert.message}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{alert.date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Sistema activo</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50 dark:bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}
