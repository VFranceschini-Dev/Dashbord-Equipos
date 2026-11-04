import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { correoGuardado, guardarCorreo, crearComprobante } from '../../services/comprobantes';
import ComprobanteGenerado from './ComprobanteGenerado';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Genera el comprobante de una asignación que no lo tiene (por ejemplo, registrada antes). */
export default function GenerarComprobanteModal({ movementId, usuarioRef, usuarioNombre, onClose, onGenerado }: {
  movementId: number;
  usuarioRef: string;
  usuarioNombre: string;
  onClose: () => void;
  onGenerado: () => void;
}) {
  const [correo, setCorreo] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { correoGuardado(usuarioRef).then(setCorreo).catch(() => undefined); }, [usuarioRef]);

  const handleGenerar = async () => {
    const c = correo.trim().toLowerCase();
    if (!EMAIL_RE.test(c)) { setError('Cargá un correo válido.'); return; }
    setGenerando(true);
    setError(null);
    try {
      guardarCorreo(usuarioRef, c).catch(() => undefined);
      const r = await crearComprobante(movementId, c);
      setToken(r.token);
      onGenerado();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-gray-900">Generar comprobante</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {token ? (
            <ComprobanteGenerado token={token} correo={correo.trim()} />
          ) : (
            <>
              <p className="text-sm text-gray-600">Comprobante de entrega para <span className="font-medium text-gray-900">{usuarioNombre}</span>.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo del usuario *</label>
                <input type="email" value={correo} onChange={e => { setCorreo(e.target.value); setError(null); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
              </div>
              {error && <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700">{error}</div>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 text-gray-700">
              {token ? 'Listo' : 'Cancelar'}
            </button>
            {!token && (
              <button onClick={handleGenerar} disabled={generando}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
                {generando && <Loader2 size={15} className="animate-spin" />} Generar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
