import { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Page } from '../types';
import {
  LayoutDashboard,
  Printer,
  Package,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';

const navItems: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { page: 'printers', label: 'Impresoras', icon: <Printer size={20} /> },
  { page: 'inventory', label: 'Inventario', icon: <Package size={20} /> },
  { page: 'movements', label: 'Movimientos', icon: <ArrowLeftRight size={20} /> },
  { page: 'reports', label: 'Reportes', icon: <BarChart3 size={20} /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { currentPage, setCurrentPage, unreadAlerts, alerts, markAlertRead } = useApp();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const unreadAlertList = alerts.filter(a => !a.read);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Printer size={22} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Control Tóner</h1>
              <p className="text-xs text-slate-400">Sistema de Gestión</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => {
                setCurrentPage(item.page);
                setSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                transition-all duration-200
                ${currentPage === item.page
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }
              `}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Usuario'}</p>
              <p className="text-xs text-slate-400">{user?.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 capitalize">
              {navItems.find(n => n.page === currentPage)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Alerts */}
            <div className="relative">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell size={20} className="text-gray-600" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              {/* Alerts dropdown */}
              {showAlerts && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                    <button
                      onClick={() => setShowAlerts(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {unreadAlertList.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">Sin notificaciones</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {unreadAlertList.map(alert => (
                        <div key={alert.id} className="p-3 hover:bg-gray-50 cursor-pointer" onClick={() => {
                          markAlertRead(alert.id);
                        }}>
                          <p className="text-sm text-gray-700">{alert.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{alert.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="hidden sm:block text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
              {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
