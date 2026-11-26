import { useState } from 'react';
import { supabase } from '../services/supabase';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

/** Cambio de contraseña del usuario que tiene la sesión abierta. */
export default function CambiarContrasenaModal({ onClose }: { onClose: () => void }) {
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const guardar = async () => {
    setError(null);
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return; }
    setGuardando(true);
    const { error: err } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (err) { setError(err.message || 'No se pudo cambiar la contraseña.'); return; }
    setListo(true);
  };

  const campo = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-900 outline-none text-sm focus:border-blue-400';
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Cambiar mi contraseña</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Cerrar"><X size={20} /></button>
        </div>
        {listo ? (
          <div className="p-5 space-y-4">
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle size={16} /> Tu contraseña se cambió.</p>
            <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700">Listo</button></div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Contraseña nueva</label>
              <input type="password" autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} className={campo} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Repetila</label>
              <input type="password" autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} className={campo}
                onKeyDown={e => { if (e.key === 'Enter') guardar(); }} />
              <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres.</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
                {guardando && <Loader2 size={15} className="animate-spin" />} Cambiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
