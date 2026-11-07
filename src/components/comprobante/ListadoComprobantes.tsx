import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Loader2, ExternalLink, Mail, FileText, AlertTriangle } from 'lucide-react';
import {
  listarComprobantes, crearComprobante, enlaceComprobante, estadoVisible, ESTADO_COMPROBANTE,
  type ComprobanteListado, type EstadoVisible,
} from '../../services/comprobantes';

const FILTROS: { value: 'todos' | EstadoVisible; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'visto', label: 'Vistos sin firmar' },
  { value: 'firmado', label: 'Firmados' },
];

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-AR') : '—');

/** Listado de comprobantes de entrega con filtros por estado, texto y fecha. */
export default function ListadoComprobantes() {
  const [filas, setFilas] = useState<ComprobanteListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<'todos' | EstadoVisible>('todos');
  const [buscar, setBuscar] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try { setFilas(await listarComprobantes()); } catch (err) { setError((err as Error).message); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const conteo = useMemo(() => {
    const c: Record<string, number> = { todos: filas.length, pendiente: 0, visto: 0, firmado: 0 };
    for (const f of filas) c[estadoVisible(f)] = (c[estadoVisible(f)] ?? 0) + 1;
    return c;
  }, [filas]);

  const filtradas = filas.filter(f => {
    if (estado !== 'todos' && estadoVisible(f) !== estado) return false;
    const dia = f.created_at.slice(0, 10);
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    if (buscar.trim()) {
      const texto = norm(`${f.datos.usuario.nombre} ${f.datos.usuario.correo} ${f.datos.equipo.nombre} ${f.datos.equipo.serial}`);
      if (!texto.includes(norm(buscar.trim()))) return false;
    }
    return true;
  });

  const reenviar = async (f: ComprobanteListado) => {
    setReenviando(f.id);
    setAviso(null);
    try {
      const r = await crearComprobante(f.movement_id, f.correo_destino || f.datos.usuario.correo);
      setAviso(r.enviado
        ? { ok: true, text: `Email enviado a ${f.correo_destino}${r.ticket ? ` (ticket #${r.ticket})` : ''}.` }
        : { ok: false, text: `No se envió el email: ${r.error}.` });
      await cargar();
    } catch (err) {
      setAviso({ ok: false, text: (err as Error).message });
    } finally {
      setReenviando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(f => (
          <button key={f.value} onClick={() => setEstado(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              estado === f.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {f.label} <span className="opacity-70">({conteo[f.value] ?? 0})</span>
          </button>
        ))}
        <button onClick={cargar} disabled={cargando}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por usuario, correo, equipo o serial..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 outline-none text-sm bg-white" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
        </label>
      </div>

      {aviso && (
        <div className={`rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{aviso.text}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {cargando && filas.length === 0 ? (
          <div className="text-center py-10"><Loader2 size={28} className="mx-auto animate-spin text-blue-500" /></div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-10">
            <FileText size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">{filas.length ? 'Ningún comprobante coincide con el filtro.' : 'Todavía no hay comprobantes de entrega.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {['Generado', 'Usuario', 'Equipo', 'Estado', 'Visto', 'Firmado', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtradas.map(f => {
                  const e = ESTADO_COMPROBANTE[estadoVisible(f)];
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 text-sm">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fecha(f.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800">{f.datos.usuario.nombre}</p>
                        <p className="text-xs text-gray-400">{f.correo_destino}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800">{f.datos.equipo.nombre}</p>
                        {f.datos.equipo.serial && <p className="text-xs text-gray-400">Serial {f.datos.equipo.serial}</p>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.clase}`}>{e.label}</span>
                        {f.zammad_ticket_id ? <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1"><Mail size={10} /> Enviado por email</p> : null}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fecha(f.visto_at)}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fecha(f.firmado_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          {f.estado === 'pendiente' && !f.zammad_ticket_id && (
                            <button onClick={() => reenviar(f)} disabled={reenviando === f.id}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-60">
                              {reenviando === f.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Enviar email
                            </button>
                          )}
                          <a href={`${enlaceComprobante(f.token)}?ver=1`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink size={12} /> {f.estado === 'firmado' ? 'Ver / imprimir' : 'Ver'}
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
