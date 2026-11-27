import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';

/**
 * Primer ingreso con contraseña temporal: pantalla que no se puede cerrar hasta que la persona elige la suya.
 * La marca la pone el administrador al crear la cuenta o restablecer la clave (api/usuarios-sistema.ts).
 */
export default function CambiarContrasenaObligatorio() {
  const { user, logout, claveElegida } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva.length > 72) { setError('La contraseña es demasiado larga (máximo 72 caracteres).'); return; }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return; }
    setGuardando(true);
    const { error: err } = await supabase.auth.updateUser({ password: nueva, data: { debe_cambiar_clave: false } });
    setGuardando(false);
    if (err) {
      setError(/different from the old/i.test(err.message) ? 'La contraseña nueva tiene que ser distinta de la temporal.' : (err.message || 'No se pudo cambiar la contraseña.'));
      return;
    }
    claveElegida();
  };

  const campo = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 outline-none text-sm focus:border-blue-400';
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={20} className="text-blue-600" />
          <h1 className="font-semibold text-lg text-gray-900 dark:text-white">Elegí tu contraseña</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {user?.name ? `Hola, ${user.name}. ` : ''}Ingresaste con una contraseña temporal. Para continuar, elegí una propia.
        </p>
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
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => logout()} disabled={guardando} className="text-sm text-gray-500 hover:underline">Cerrar sesión</button>
          <button onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
            {guardando && <Loader2 size={15} className="animate-spin" />} Guardar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
