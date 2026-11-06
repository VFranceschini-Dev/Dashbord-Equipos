import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { obtenerMiFirma, guardarMiFirma } from '../../services/comprobantes';
import SelectorFirma from './SelectorFirma';

/** Firma del responsable de Sistemas: se carga una vez y se usa en todos sus comprobantes. */
export default function MiFirmaModal({ onClose }: { onClose: () => void }) {
  const [firma, setFirma] = useState({ nombre: '', dni: '', fuente: 'dancing' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    obtenerMiFirma()
      .then(f => { if (f) setFirma(f); })
      .finally(() => setCargando(false));
  }, []);

  const handleGuardar = async () => {
    if (firma.nombre.trim().length < 3) { setMsg({ ok: false, text: 'Escribí tu nombre y apellido.' }); return; }
    if (!/^\d{7,8}$/.test(firma.dni)) { setMsg({ ok: false, text: 'El DNI debe tener 7 u 8 números.' }); return; }
    setGuardando(true);
    setMsg(null);
    try {
      await guardarMiFirma({ ...firma, nombre: firma.nombre.trim().replace(/\s+/g, ' ') });
      setMsg({ ok: true, text: 'Firma guardada. Se va a usar en los comprobantes que generes.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-gray-900">Mi firma</h3>
            <p className="text-xs text-gray-500">Se agrega como "Entrega" en los comprobantes que generes.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {cargando ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : (
            <SelectorFirma {...firma} onChange={c => { setFirma(f => ({ ...f, ...c })); setMsg(null); }} />
          )}
          {msg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 text-gray-700">Cerrar</button>
            <button onClick={handleGuardar} disabled={guardando || cargando}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
              {guardando && <Loader2 size={15} className="animate-spin" />} Guardar firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
