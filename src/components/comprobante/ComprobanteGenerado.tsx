import { useState } from 'react';
import { CheckCircle, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { enlaceComprobante } from '../../services/comprobantes';

/** Resultado de generar un comprobante: enlace para firmar, copiar y ver. */
export default function ComprobanteGenerado({ token, correo, error }: { token?: string; correo: string; error?: string }) {
  const [copiado, setCopiado] = useState(false);
  if (error || !token) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>El movimiento quedó registrado, pero no se pudo generar el comprobante: {error}. Podés generarlo después desde Movimientos.</span>
      </div>
    );
  }
  const enlace = enlaceComprobante(token);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); } catch { /* sin portapapeles */ }
  };
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800 space-y-2">
      <p className="flex items-center gap-2 font-medium"><CheckCircle size={16} /> Comprobante de entrega generado</p>
      <p>Enlace para que {correo} lo firme:</p>
      <div className="flex items-center gap-2">
        <input readOnly value={enlace} className="flex-1 min-w-0 px-2 py-1 rounded border border-emerald-200 bg-white text-xs text-gray-700" />
        <button onClick={copiar} className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-100 text-xs">
          <Copy size={12} /> {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <a href={`${enlace}?ver=1`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-100 text-xs">
          <ExternalLink size={12} /> Ver
        </a>
      </div>
    </div>
  );
}
