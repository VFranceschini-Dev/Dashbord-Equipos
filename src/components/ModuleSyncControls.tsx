import { useState } from 'react';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ModuleKey } from '../services/supabaseSync';

/** Barra de estado de un módulo: "Cargando datos...", error de lectura y botón Actualizar. */
export default function ModuleSyncControls({ module }: { module: ModuleKey }) {
  const { dataLoading, moduleErrors, refreshModule } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const loading = dataLoading.global || dataLoading.module === module || refreshing;
  const error = moduleErrors[module];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshModule(module);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-3 text-sm">
        {loading && (
          <span className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Cargando datos...
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Volver a leer los datos de la base"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      {error && !loading && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}