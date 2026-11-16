import { useState } from 'react';
import { CheckCircle, Copy, ExternalLink, AlertTriangle, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { enlaceComprobante, crearComprobante, type ComprobanteCreado } from '../../services/comprobantes';

/**
 * Resultado de generar un comprobante: estado del envío por email (ticket de
 * Zammad), enlace para firmar (copiar / ver) y reintento si el envío falló.
 */
export default function ComprobanteGenerado({ movementIds, correo, resultado, error }: {
  movementIds?: number | number[];
  correo: string;
  resultado?: ComprobanteCreado;
  error?: string;
}) {
  const [actual, setActual] = useState(resultado);
  const [copiado, setCopiado] = useState(false);
  const [reintentando, setReintentando] = useState(false);

  if (error || !actual) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>El movimiento quedó registrado, pero no se pudo generar el comprobante: {error}. Podés generarlo después desde Movimientos.</span>
      </div>
    );
  }

  const enlace = actual.enlace || enlaceComprobante(actual.token);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); } catch { /* sin portapapeles */ }
  };
  const reintentar = async () => {
    if (!movementIds) return;
    setReintentando(true);
    try { setActual(await crearComprobante(movementIds, correo)); } catch (err) { setActual({ ...actual, enviado: false, error: (err as Error).message }); }
    finally { setReintentando(false); }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800 space-y-2">
        <p className="flex items-center gap-2 font-medium"><CheckCircle size={16} /> Comprobante de entrega generado</p>
        {actual.enviado ? (
          <p className="flex items-center gap-2"><Mail size={14} /> Enviado por email a {correo}{actual.ticket ? ` (ticket #${actual.ticket})` : ''}.</p>
        ) : (
          <p>Enlace para que {correo} lo firme:</p>
        )}
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
      {!actual.enviado && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> No se envió el email: {actual.error}. Podés copiar el enlace y mandarlo a mano, o reintentar.</span>
          {movementIds && (
            <button onClick={reintentar} disabled={reintentando} className="flex items-center gap-1 font-medium hover:underline shrink-0 disabled:opacity-60">
              {reintentando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
