import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Collaborators from './Collaborators';
import { MovimientosEquipos } from './EquipmentAssignments';
import ListadoComprobantes from './comprobante/ListadoComprobantes';
import { Users, History, FileText } from 'lucide-react';

type Pestana = 'asignar' | 'historial' | 'comprobantes';

const PESTANAS: { id: Pestana; label: string; icon: JSX.Element }[] = [
  { id: 'asignar', label: 'Asignar equipos', icon: <Users size={16} /> },
  { id: 'historial', label: 'Historial de movimientos', icon: <History size={16} /> },
  { id: 'comprobantes', label: 'Comprobantes de entrega', icon: <FileText size={16} /> },
];

/**
 * Usuarios y asignaciones: una sola pantalla para las personas y los movimientos de equipos.
 * - Asignar equipos: tablero de dos paneles (usuarios / equipos disponibles) con arrastrar y soltar.
 * - Historial de movimientos: registro manual de asignaciones y devoluciones + historial.
 * - Comprobantes de entrega.
 */
export default function UsuariosAsignaciones() {
  const { currentPage } = useApp();
  // Quien entra por la ruta anterior de "Movimientos" cae en el historial.
  const [pestana, setPestana] = useState<Pestana>(
    currentPage === 'movements' || currentPage === 'asignaciones' ? 'historial' : 'asignar',
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones">
        {PESTANAS.map(p => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pestana === p.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {pestana === 'asignar' && <Collaborators />}
      {pestana === 'historial' && <MovimientosEquipos />}
      {pestana === 'comprobantes' && <ListadoComprobantes />}
    </div>
  );
}
