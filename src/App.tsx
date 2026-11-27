import { AuthProvider, useAuth } from './context/AuthContext';
import { MODULO_DE_PAGINA } from './config/accesoPaginas';
import SinAcceso from './components/SinAcceso';
import CambiarContrasenaObligatorio from './components/CambiarContrasenaObligatorio';
import AdministracionUsuarios from './components/AdministracionUsuarios';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Printers from './components/Printers';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Equipments from './components/Equipments';
import Suppliers from './components/Suppliers';
import ServerConfig from './components/ServerConfig';
import UsuariosAsignaciones from './components/UsuariosAsignaciones';
import FirmarComprobante from './components/comprobante/FirmarComprobante';

function PageRouter() {
  const { currentPage } = useApp();
  const { can, esAdmin } = useAuth();

  // Permiso de la pantalla: un módulo ("ver"), solo administradores o abierta a todos
  const requerido = MODULO_DE_PAGINA[currentPage];
  if (requerido === 'admin' ? !esAdmin : requerido !== null && !can(requerido)) return <SinAcceso />;

  switch (currentPage) {
    case 'dashboard':
      return <Dashboard />;
    case 'printers':
      return <Printers />;
    case 'inventory':
      return <Inventory />;
    case 'movements':      // rutas anteriores: ahora todo está en Usuarios y asignaciones
    case 'asignaciones':
    case 'collaborators':
      return <UsuariosAsignaciones />;
    case 'reports':
      return <Reports />;
    case 'equipments':
      return <Equipments />;
    case 'suppliers':
      return <Suppliers />;
    case 'vouchers':
      return <Suppliers tab="facturas" />;
    case 'server-config':
      return <ServerConfig />;
    case 'admin-usuarios':
      return <AdministracionUsuarios />;
    default:
      return <Dashboard />;
  }
}

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Contraseña temporal entregada por un administrador: antes de usar la app hay que elegir la propia.
  if (user?.debeCambiarClave) {
    return <CambiarContrasenaObligatorio />;
  }

  return (
    <AppProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  );
}

export default function App() {
  // Página pública de firma de comprobantes: no requiere iniciar sesión.
  const firma = window.location.pathname.match(/^\/firmar\/([\w-]{20,64})\/?$/);
  if (firma) return <FirmarComprobante token={firma[1]} />;

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}