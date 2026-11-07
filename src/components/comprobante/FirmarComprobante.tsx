import { useEffect, useState } from 'react';
import { Loader2, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { obtenerComprobante, firmarComprobante, type Comprobante } from '../../services/comprobantes';
import ComprobanteVista from './ComprobanteVista';
import SelectorFirma from './SelectorFirma';

/**
 * Página pública /firmar/<token>: el usuario ve su comprobante de entrega y lo
 * firma (sin cuenta en la app). Con ?ver=1 solo se muestra (uso interno).
 */
export default function FirmarComprobante({ token }: { token: string }) {
  const soloVer = new URLSearchParams(window.location.search).get('ver') === '1';
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firma, setFirma] = useState({ nombre: '', dni: '', fuente: 'dancing' });
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = () => obtenerComprobante(token, soloVer).then(setComprobante).catch(err => setError((err as Error).message));
  useEffect(() => { cargar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirmar = async () => {
    setFormError(null);
    if (firma.nombre.trim().length < 3) { setFormError('Escribí tu nombre y apellido.'); return; }
    if (!/^\d{7,8}$/.test(firma.dni)) { setFormError('El DNI debe tener 7 u 8 números.'); return; }
    if (!acepto) { setFormError('Tenés que aceptar el texto de conformidad.'); return; }
    setEnviando(true);
    try {
      await firmarComprobante(token, { ...firma, acepto });
      await cargar();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md text-center space-y-2">
          <AlertTriangle className="mx-auto text-amber-500" />
          <p className="text-gray-800">{error}</p>
        </div>
      </div>
    );
  }
  if (!comprobante) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  const firmado = comprobante.estado === 'firmado';
  const numero = comprobante.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-4">
        {firmado && (
          <div className="print:hidden flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle size={18} /> Comprobante firmado. Podés guardarlo o imprimirlo.
            </span>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-white border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-100">
              <Printer size={15} /> Imprimir / PDF
            </button>
          </div>
        )}

        <ComprobanteVista numero={numero} datos={comprobante.datos} hashDocumento={comprobante.hash_documento}
          firmaUsuario={firmado ? {
            nombre: comprobante.firmado_nombre!, dni: comprobante.firmado_dni!, fuente: comprobante.firmado_fuente!,
            fecha: comprobante.firmado_at!, ip: comprobante.firmado_ip ?? '', hash: comprobante.hash_firma ?? '',
          } : null} />

        {!firmado && comprobante.estado === 'pendiente' && !soloVer && (
          <section className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Firmar el comprobante</h2>
              <p className="text-sm text-gray-500">Escribí tu nombre, elegí cómo se ve tu firma y cargá tu DNI.</p>
            </div>
            <SelectorFirma {...firma} onChange={c => { setFirma(f => ({ ...f, ...c })); setFormError(null); }} />
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
              Leí el comprobante y acepto el texto de conformidad. Entiendo que esta firma electrónica tiene el mismo
              valor que mi firma en papel para este comprobante.
            </label>
            {formError && <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700">{formError}</div>}
            <button onClick={handleFirmar} disabled={enviando}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
              {enviando && <Loader2 size={16} className="animate-spin" />} Firmar comprobante
            </button>
          </section>
        )}
        {!firmado && soloVer && (
          <p className="print:hidden text-center text-sm text-amber-700">Pendiente de firma del usuario.</p>
        )}
      </div>
    </div>
  );
}
