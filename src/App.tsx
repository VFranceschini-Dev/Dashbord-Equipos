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
import AdminPanel from './components/AdminPanel';
import MeshTestConnection from './components/MeshTestConnection';

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
    case 'admin':
      return <AdminPanel />;
    case 'mesh-test':
      return <MeshTestConnection />;
    default:
      return <Dashboard />;
  }
}

function AppContent() {
  const { isAuthenticated } = useAuth();

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
