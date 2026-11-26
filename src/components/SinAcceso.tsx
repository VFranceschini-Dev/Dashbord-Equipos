import { ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';

/** Se muestra cuando el usuario abre una pantalla para la que no tiene permiso. */
export default function SinAcceso() {
  const { setCurrentPage } = useApp();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4">
        <ShieldAlert size={28} className="text-amber-600 dark:text-amber-300" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">No tenés acceso a esta sección</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-slate-400">
        Tu usuario no tiene permiso para verla. Si la necesitás, pedile a un administrador que te lo habilite.
      </p>
      <button
        onClick={() => setCurrentPage('dashboard')}
        className="mt-5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        Ir al Dashboard
      </button>
    </div>
  );
}
