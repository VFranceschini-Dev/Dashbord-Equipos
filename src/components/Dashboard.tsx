import { useApp } from '../context/AppContext';
import {
  Printer,
  Package,
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

export default function Dashboard() {
  const { printers, toners, movements, alerts } = useApp();

  const activePrinters = printers.filter(p => p.status === 'active').length;
  const maintenancePrinters = printers.filter(p => p.status === 'maintenance').length;
  const lowStockItems = toners.filter(t => t.stock <= t.minStock).length;
  const totalTonerValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalMovementsThisMonth = movements.filter(m => {
    const d = new Date(m.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const unreadAlerts = alerts.filter(a => !a.read).length;

  // Chart data
  const movementTypeData = [
    { name: 'Entregas', value: movements.filter(m => m.type === 'delivery').length, color: '#3b82f6' },
    { name: 'Reposiciones', value: movements.filter(m => m.type === 'restock').length, color: '#10b981' },
    { name: 'Devoluciones', value: movements.filter(m => m.type === 'return').length, color: '#f59e0b' },
    { name: 'Desechos', value: movements.filter(m => m.type === 'disposal').length, color: '#ef4444' },
  ];

  const stockData = toners.map(t => ({
    name: t.model,
    stock: t.stock,
    min: t.minStock,
    max: t.maxStock,
  }));

  const monthlyData = [
    { month: 'Ago', entregas: 3, reposiciones: 2 },
    { month: 'Sep', entregas: 4, reposiciones: 3 },
    { month: 'Oct', entregas: 2, reposiciones: 4 },
    { month: 'Nov', entregas: 5, reposiciones: 2 },
    { month: 'Dic', entregas: 3, reposiciones: 5 },
    { month: 'Ene', entregas: 4, reposiciones: 3 },
  ];

  const stats = [
    {
      title: 'Impresoras Activas',
      value: activePrinters,
      total: printers.length,
      icon: <Printer size={24} />,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      trend: '+2 este mes',
      trendUp: true,
    },
    {
      title: 'Total en Inventario',
      value: toners.reduce((s, t) => s + t.stock, 0),
      icon: <Package size={24} />,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      trend: `Valor: $${totalTonerValue.toFixed(0)}`,
      trendUp: true,
    },
    {
      title: 'Alertas de Stock',
      value: lowStockItems,
      icon: <AlertTriangle size={24} />,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      trend: `${unreadAlerts} sin leer`,
      trendUp: false,
    },
    {
      title: 'Movimientos del Mes',
      value: totalMovementsThisMonth,
      icon: <ArrowLeftRight size={24} />,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      trend: 'Promedio diario: 2',
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.textColor} p-3 rounded-xl`}>
                {stat.icon}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {stat.trendUp ? (
                <TrendingUp size={14} className="text-emerald-500" />
              ) : (
                <TrendingDown size={14} className="text-amber-500" />
              )}
              <span className={`text-xs font-medium ${stat.trendUp ? 'text-emerald-600' : 'text-amber-600'}`}>
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Activity */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Actividad Mensual</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="entregas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="reposiciones" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-500">Entregas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">Reposiciones</span>
            </div>
          </div>
        </div>

        {/* Movement Types Pie */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Tipos de Movimiento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={movementTypeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {movementTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {movementTypeData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-500">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Chart & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Levels */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Niveles de Stock por Modelo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stockData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="name" type="category" fontSize={11} width={80} />
              <Tooltip />
              <Bar dataKey="stock" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="min" fill="#ef4444" radius={[0, 4, 4, 0]} opacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {movements.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${m.type === 'delivery' ? 'bg-blue-100 text-blue-600' :
                    m.type === 'restock' ? 'bg-emerald-100 text-emerald-600' :
                    m.type === 'return' ? 'bg-amber-100 text-amber-600' :
                    'bg-red-100 text-red-600'}
                `}>
                  {m.type === 'delivery' ? <CheckCircle size={16} /> :
                   m.type === 'restock' ? <Package size={16} /> :
                   m.type === 'return' ? <ArrowLeftRight size={16} /> :
                   <AlertTriangle size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {m.tonerModel} × {m.quantity}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {m.date} • {m.user}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {unreadAlerts > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Alertas Pendientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.filter(a => !a.read).map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-200' :
                  alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <p className="text-sm font-medium text-gray-700">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">{alert.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
