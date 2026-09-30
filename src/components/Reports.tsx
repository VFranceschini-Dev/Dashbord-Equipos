import { useApp } from '../context/AppContext';
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
  AreaChart,
  Area,
} from 'recharts';
import {
  Download,
  DollarSign,
  TrendingUp,
  Package,
  Printer,
  Calendar,
} from 'lucide-react';

export default function Reports() {
  const { printers, toners, movements } = useApp();

  // Cost analysis
  const totalInventoryValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const totalDelivered = movements.filter(m => m.type === 'delivery').reduce((sum, m) => sum + m.quantity, 0);
  const totalRestocked = movements.filter(m => m.type === 'restock').reduce((sum, m) => sum + m.quantity, 0);
  const totalDisposed = movements.filter(m => m.type === 'disposal').reduce((sum, m) => sum + m.quantity, 0);

  // Department usage
  const deptUsage = printers.reduce((acc, p) => {
    const dept = p.department;
    if (!acc[dept]) acc[dept] = { name: dept, pages: 0, printers: 0 };
    acc[dept].pages += p.totalPages;
    acc[dept].printers += 1;
    return acc;
  }, {} as Record<string, { name: string; pages: number; printers: number }>);
  const deptData = Object.values(deptUsage).sort((a, b) => b.pages - a.pages);

  // Monthly spending (simulated)
  const monthlySpending = [
    { month: 'Ago', gasto: 420, entregas: 3 },
    { month: 'Sep', gasto: 580, entregas: 5 },
    { month: 'Oct', gasto: 310, entregas: 2 },
    { month: 'Nov', gasto: 690, entregas: 6 },
    { month: 'Dic', gasto: 850, entregas: 7 },
    { month: 'Ene', gasto: 520, entregas: 4 },
  ];

  // Toner brand distribution
  const brandData = toners.reduce((acc, t) => {
    const existing = acc.find(a => a.name === t.brand);
    if (existing) {
      existing.value += t.stock;
    } else {
      acc.push({ name: t.brand, value: t.stock });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Printer efficiency
  const printerEfficiency = printers
    .filter(p => p.status === 'active')
    .map(p => ({
      name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
      pages: p.totalPages,
      dept: p.department,
    }))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 6);

  const handleExport = () => {
    const report = {
      fecha: new Date().toISOString(),
      resumen: {
        totalImpresoras: printers.length,
        impresorasActivas: printers.filter(p => p.status === 'active').length,
        totalToners: toners.length,
        stockTotal: toners.reduce((s, t) => s + t.stock, 0),
        valorInventario: totalInventoryValue,
        movimientosTotales: movements.length,
        entregas: totalDelivered,
        reposiciones: totalRestocked,
        desechos: totalDisposed,
      },
      impresoras: printers,
      inventario: toners,
      movimientos: movements,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-toner-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Download size={16} />
          Exportar Reporte
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium">Valor Inventario</p>
              <p className="text-2xl font-bold mt-1">${totalInventoryValue.toFixed(0)}</p>
            </div>
            <DollarSign size={28} className="text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-medium">Entregas Realizadas</p>
              <p className="text-2xl font-bold mt-1">{totalDelivered}</p>
            </div>
            <TrendingUp size={28} className="text-emerald-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs font-medium">Reposiciones</p>
              <p className="text-2xl font-bold mt-1">{totalRestocked}</p>
            </div>
            <Package size={28} className="text-purple-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-xs font-medium">Total Movimientos</p>
              <p className="text-2xl font-bold mt-1">{movements.length}</p>
            </div>
            <Calendar size={28} className="text-amber-200" />
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spending */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-500" />
            Gasto Mensual en Tóner
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlySpending}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value: number) => [`$${value}`, 'Gasto']} />
              <Area type="monotone" dataKey="gasto" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Brand Distribution */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={18} className="text-blue-500" />
            Distribución por Marca
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={brandData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {brandData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Usage */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Printer size={18} className="text-purple-500" />
            Uso por Departamento
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deptData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="name" type="category" fontSize={11} width={100} />
              <Tooltip />
              <Bar dataKey="pages" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Printer Efficiency */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" />
            Eficiencia de Impresoras
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={printerEfficiency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="pages" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Consumed Toners */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Tóners Más Utilizados</h3>
          <div className="space-y-3">
            {toners
              .map(t => ({
                ...t,
                deliveries: movements.filter(m => m.tonerModel === t.model && m.type === 'delivery').reduce((s, m) => s + m.quantity, 0),
              }))
              .sort((a, b) => b.deliveries - a.deliveries)
              .slice(0, 5)
              .map((toner, i) => (
                <div key={toner.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{toner.model}</span>
                      <span className="text-sm text-gray-500">{toner.deliveries} entregas</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min((toner.deliveries / Math.max(...toners.map(t => movements.filter(m => m.tonerModel === t.model && m.type === 'delivery').reduce((s, m) => s + m.quantity, 0)))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Department Summary */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Resumen por Departamento</h3>
          <div className="space-y-3">
            {deptData.map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold`} style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                  {dept.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{dept.name}</p>
                  <p className="text-xs text-gray-400">{dept.printers} impresora{dept.printers !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{dept.pages.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">páginas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
