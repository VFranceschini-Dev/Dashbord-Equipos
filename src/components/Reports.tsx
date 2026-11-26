import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import ImpresorasCompatibles from './ImpresorasCompatibles';
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
import {
  consumoPorDepartamento,
  enPeriodo,
  entregasPorToner,
  etiquetaPeriodo,
  formatoPesos,
  gastoMensual,
  periodoMesActual,
  type Periodo,
} from '../utils/reportes';

const claseFecha =
  'px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-400';

/** Rótulo para lo que no depende del período (stock y contadores acumulados). */
function EstadoActual() {
  return (
    <span className="ml-2 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300 align-middle">
      Estado actual
    </span>
  );
}

export default function Reports() {
  const { printers, toners, movements } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoMesActual());
  const esMesActual = useMemo(() => {
    const actual = periodoMesActual();
    return periodo.desde === actual.desde && periodo.hasta === actual.hasta;
  }, [periodo]);
  const rangoInvalido = Boolean(periodo.desde && periodo.hasta && periodo.desde > periodo.hasta);

  // Todo lo que se calcula a partir de movimientos respeta el período elegido
  const movimientosPeriodo = useMemo(() => movements.filter(m => enPeriodo(m.date, periodo)), [movements, periodo]);
  const totalDelivered = movimientosPeriodo.filter(m => m.type === 'delivery').reduce((sum, m) => sum + m.quantity, 0);
  const totalRestocked = movimientosPeriodo.filter(m => m.type === 'restock').reduce((sum, m) => sum + m.quantity, 0);
  const totalDisposed = movimientosPeriodo.filter(m => m.type === 'disposal').reduce((sum, m) => sum + m.quantity, 0);

  // Stock actual (no depende del período)
  const totalInventoryValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);

  const deptData = useMemo(
    () => consumoPorDepartamento(movements, printers, toners, periodo),
    [movements, printers, toners, periodo],
  );
  const totalConsumo = deptData.reduce((s, d) => s + d.toners, 0);
  const totalCosto = deptData.reduce((s, d) => s + d.costo, 0);

  const monthlySpending = useMemo(() => gastoMensual(movements, toners, periodo), [movements, toners, periodo]);
  const topToners = useMemo(() => entregasPorToner(movements, toners, periodo).slice(0, 5), [movements, toners, periodo]);
  const maxEntregas = Math.max(1, ...topToners.map(t => t.entregas));

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
      periodo: { desde: periodo.desde || null, hasta: periodo.hasta || null },
      resumen: {
        totalImpresoras: printers.length,
        impresorasActivas: printers.filter(p => p.status === 'active').length,
        totalToners: toners.length,
        stockTotal: toners.reduce((s, t) => s + t.stock, 0),
        valorInventario: totalInventoryValue,
        movimientosEnPeriodo: movimientosPeriodo.length,
        entregas: totalDelivered,
        reposiciones: totalRestocked,
        desechos: totalDisposed,
        tonerConsumido: totalConsumo,
        costoConsumo: totalCosto,
      },
      consumoPorDepartamento: deptData,
      comprasPorMes: monthlySpending,
      impresoras: printers,
      inventario: toners,
      movimientos: movimientosPeriodo,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="rep-desde" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Desde</label>
            <input id="rep-desde" type="date" value={periodo.desde} max={periodo.hasta || undefined}
              onChange={e => setPeriodo(p => ({ ...p, desde: e.target.value }))} className={claseFecha} />
          </div>
          <div>
            <label htmlFor="rep-hasta" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Hasta</label>
            <input id="rep-hasta" type="date" value={periodo.hasta} min={periodo.desde || undefined}
              onChange={e => setPeriodo(p => ({ ...p, hasta: e.target.value }))} className={claseFecha} />
          </div>
          <button
            onClick={() => setPeriodo(periodoMesActual())}
            disabled={esMesActual}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-default"
          >
            Mes actual
          </button>
          <p className="text-sm text-gray-500 dark:text-slate-400 pb-2">
            Período: <span className="font-medium">{etiquetaPeriodo(periodo)}</span>
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Download size={16} />
          Exportar Reporte
        </button>
      </div>
      {rangoInvalido && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          La fecha "desde" es posterior a "hasta": no hay datos para mostrar. Corregí el rango.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium">Valor Inventario (estado actual)</p>
              <p className="text-2xl font-bold mt-1">{formatoPesos(totalInventoryValue)}</p>
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
              <p className="text-2xl font-bold mt-1">{movimientosPeriodo.length}</p>
            </div>
            <Calendar size={28} className="text-amber-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-500" />
            Gasto Mensual en Tóner
          </h3>
          <p className="text-xs text-gray-400 mb-3">Compras (reposiciones) del período, valuadas al precio unitario actual.</p>
          {monthlySpending.every(m => m.unidades === 0) ? (
            <p className="text-sm text-gray-500 text-center py-16">Sin compras en el período</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="etiqueta" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value, name) => (name === 'gasto' ? [formatoPesos(Number(value)), 'Gasto'] : [String(value), 'Unidades'])}
                />
                <Area type="monotone" dataKey="gasto" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={18} className="text-blue-500" />
            Distribución por Marca
            <EstadoActual />
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={brandData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Printer size={18} className="text-purple-500" />
            Uso por Departamento
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Costo del tóner consumido en el período (entregas menos devoluciones, al precio unitario actual).
          </p>
          {totalConsumo === 0 ? (
            <p className="text-sm text-gray-500 text-center py-16">Sin consumo de tóner en el período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, deptData.filter(d => d.toners > 0).length * 34 + 40)}>
              <BarChart data={deptData.filter(d => d.toners > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" fontSize={12} tickFormatter={v => formatoPesos(Number(v))} />
                <YAxis dataKey="name" type="category" fontSize={11} width={110} />
                <Tooltip
                  formatter={(value, _n, item) => [
                    `${formatoPesos(Number(value))} · ${item?.payload?.toners ?? 0} tóner`,
                    'Costo',
                  ]}
                />
                <Bar dataKey="costo" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" />
            Eficiencia de Impresoras
            <EstadoActual />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Tóners Más Utilizados</h3>
          <div className="space-y-3">
            {topToners.every(t => t.entregas === 0) ? (
              <p className="text-sm text-gray-500 text-center py-4">Sin entregas en el período</p>
            ) : (
              topToners
                .filter(t => t.entregas > 0)
                .map(({ toner, entregas }, i) => (
                  <div key={toner.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-6">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {toner.model}
                          <span className="ml-2 text-xs font-normal text-gray-400">{toner.brand}</span>
                        </span>
                        <span className="text-sm text-gray-500">{entregas} entregas</span>
                      </div>
                      <ImpresorasCompatibles modeloToner={toner.model} printers={printers} className="mt-0.5" />
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((entregas / maxEntregas) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-1">Resumen por Departamento</h3>
          <p className="text-xs text-gray-400 mb-3">
            Tóner y costo del período. Las páginas son el contador acumulado de las impresoras (no del período).
          </p>
          <div className="space-y-3">
            {deptData.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Sin datos disponibles</p>
            ) : (
              <>
                {deptData.map((dept, i) => (
                  <div key={dept.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0`} style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {dept.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{dept.name}</p>
                      <p className="text-xs text-gray-400">
                        {dept.impresoras} impresora{dept.impresoras !== 1 ? 's' : ''} · {dept.paginas.toLocaleString('es-AR')} páginas acumuladas
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-700">{formatoPesos(dept.costo)}</p>
                      <p className="text-xs text-gray-400">{dept.toners} tóner</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-100 text-sm font-semibold text-gray-700">
                  <span>Total del período</span>
                  <span>{formatoPesos(totalCosto)} · {totalConsumo} tóner</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
