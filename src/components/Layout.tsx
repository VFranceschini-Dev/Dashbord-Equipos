import { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Page } from '../types';
import {
  LayoutDashboard, Printer, Package, ArrowLeftRight, BarChart3, Bell, Menu, X, LogOut,
  Monitor, Users, Building2, FileText, ChevronRight, Settings, Sun, Moon
} from 'lucide-react';
import { useState } from 'react';

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
  { page: 'admin', label: 'Administración', icon: <Settings size={20} /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { currentPage, setCurrentPage, unreadAlerts, alerts, markAlertRead } = useApp();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const unreadAlertList = alerts.filter(a => !a.read);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-fadeIn" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Figma Style */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        flex flex-col shadow-lg lg:shadow-sm
      `}>
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Printer size={24} className="text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">Control Tóner</h1>
              <p className="text-xs text-gray-500 font-medium">Sistema de Gestión</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => { setCurrentPage(item.page); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight size={16} className="text-white/70" />}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-100">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.email || 'Usuario'}</p>
                <p className="text-xs text-gray-500 font-medium">{user?.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
              </div>
              <button 
                onClick={logout} 
                className="p-2 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-all" 
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Figma Style */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={22} className="text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {navItems.find(n => n.page === currentPage)?.label || 'Dashboard'}
              </h2>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Alerts */}
            <div className="relative">
              <button 
                onClick={() => setShowAlerts(!showAlerts)} 
                className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-all"
              >
                <Bell size={22} className="text-gray-600" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 shadow-lg shadow-red-500/30 animate-scaleInBounce">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 top-full mt-3 w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-[500px] overflow-hidden animate-scaleIn">
                  <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">Notificaciones</h3>
                        <p className="text-sm text-gray-500 font-medium">{unreadAlerts} sin leer</p>
                      </div>
                      <button 
                        onClick={() => setShowAlerts(false)} 
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X size={18} className="text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-96">
                    {unreadAlertList.length === 0 ? (
                      <div className="p-10 text-center">
                        <Bell size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500 font-medium">Sin notificaciones</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {unreadAlertList.map(alert => (
                          <div 
                            key={alert.id} 
                            className="p-5 hover:bg-gray-50 cursor-pointer transition-colors" 
                            onClick={() => markAlertRead(alert.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                alert.type === 'after_hours' ? 'bg-amber-500' :
                                alert.type === 'low_stock' ? 'bg-red-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 leading-relaxed font-medium">{alert.message}</p>
                                <p className="text-xs text-gray-400 mt-2 font-medium">{alert.date}</p>
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

            {/* Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700">Sistema activo</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

// Theme Toggle Component
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
      title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      {theme === 'light' ? (
        <Moon size={22} className="text-gray-600" />
      ) : (
        <Sun size={22} className="text-yellow-500" />
      )}
    </button>
  );
}
