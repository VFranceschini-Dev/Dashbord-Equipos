import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getLowStockGroups, type TonerCompatibilityGroup } from '../utils/tonerCompatibility';
import ImpresorasCompatibles from './ImpresorasCompatibles';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

/** Mismos colores y rótulos que el inventario de tóner. */
const colorMap = {
  black: { label: 'Negro', dot: 'bg-gray-800' },
  cyan: { label: 'Cian', dot: 'bg-cyan-500' },
  magenta: { label: 'Magenta', dot: 'bg-pink-500' },
  yellow: { label: 'Amarillo', dot: 'bg-yellow-400' },
} as const;

const VISIBLES = 5;

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Sin stock primero; después, las más lejos de su mínimo (menor stock relativo al mínimo). */
function urgencia(g: TonerCompatibilityGroup): number {
  if (g.totalStock <= 0) return -1;
  return g.minStock > 0 ? g.totalStock / g.minStock : g.totalStock;
}

export default function LowStockAlerts() {
  const { toners, printers } = useApp();
  const [verTodas, setVerTodas] = useState(false);

  const grupos = useMemo(
    () => getLowStockGroups(toners).sort((a, b) =>
      urgencia(a) - urgencia(b) || `${a.key.brand} ${a.key.model}`.localeCompare(`${b.key.brand} ${b.key.model}`, 'es')),
    [toners],
  );

  if (grupos.length === 0) return null;

  const visibles = verTodas ? grupos : grupos.slice(0, VISIBLES);
  const sinStock = grupos.filter(g => g.totalStock <= 0).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-500" />
          Alertas de Stock Bajo ({grupos.length})
        </h3>
        {sinStock > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
            {sinStock} sin stock
          </span>
        )}
      </div>

      <div className="space-y-2">
        {visibles.map(group => {
          const toner = group.toners[0];
          const color = colorMap[group.key.color as keyof typeof colorMap] ?? colorMap.black;
          const agotado = group.totalStock <= 0;
          const pct = group.maxStock > 0 ? Math.min((group.totalStock / group.maxStock) * 100, 100) : 0;
          return (
            <div
              key={`${group.key.brand}|${group.key.model}|${group.key.color}`}
              className={`rounded-lg border border-gray-100 dark:border-slate-700 border-l-4 p-3 flex items-start justify-between gap-4 ${
                agotado ? 'border-l-red-500' : 'border-l-amber-400'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`w-4 h-4 rounded-full shrink-0 ring-1 ring-gray-300 dark:ring-slate-500 ${color.dot}`} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{group.key.model}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-400">{group.key.brand} · {color.label}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    agotado
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}>
                    {agotado ? 'Sin stock' : 'Stock bajo'}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{group.totalStock}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-400">/ {group.maxStock} · mínimo {group.minStock}</span>
                  <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                    <div className={`h-full rounded-full ${agotado ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <ImpresorasCompatibles modeloToner={toner.model} printers={printers} className="mt-1.5" />
                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                  Proveedores: {[...new Set(group.suppliers.filter(Boolean))].join(', ') || '—'}
                  {group.toners.length > 1 && ` · ${group.toners.length} registros compatibles`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400 dark:text-slate-400">Precio promedio</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{pesos(group.avgPrice)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {grupos.length > VISIBLES && (
        <button
          onClick={() => setVerTodas(v => !v)}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-sky-300 hover:underline"
        >
          {verTodas ? <><ChevronUp size={16} /> Ver menos</> : <><ChevronDown size={16} /> Ver todas ({grupos.length})</>}
        </button>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
        El stock se suma entre tóneres compatibles (misma marca, modelo y color) de distintos proveedores.
      </p>
    </div>
  );
}
