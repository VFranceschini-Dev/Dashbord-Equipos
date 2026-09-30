import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Printers from './components/Printers';
import Inventory from './components/Inventory';
import Movements from './components/Movements';
import Reports from './components/Reports';

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
    default:
      return <Dashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  );
}
