import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Printers from './components/Printers';
import Inventory from './components/Inventory';
import Movements from './components/Movements';
import Reports from './components/Reports';
import Equipments from './components/Equipments';
import Suppliers from './components/Suppliers';
import Collaborators from './components/Collaborators';
import Vouchers from './components/Vouchers';
import ServerConfig from './components/ServerConfig';
import DataSync from './components/DataSync';

function PageRouter() {
  const { currentPage } = useApp();

  switch (currentPage) {
    case 'dashboard':
      return <Dashboard />;
    case 'printers':
      return <Printers />;
    case 'inventory':
      return <Inventory />;
    case 'movements':
      return <Movements />;
    case 'reports':
      return <Reports />;
    case 'equipments':
      return <Equipments />;
    case 'suppliers':
      return <Suppliers />;
    case 'collaborators':
      return <Collaborators />;
    case 'vouchers':
      return <Vouchers />;
    case 'server-config':
      return <ServerConfig />;
    case 'data-sync':
      return <DataSync />;
    default:
      return <Dashboard />;
  }
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

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

  return (
    <AppProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
