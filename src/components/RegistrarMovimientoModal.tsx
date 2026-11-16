import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Equipment } from '../types';
import { buscarUsuariosCompat, type UsuarioCompat } from '../services/usuarios';
import { syncEquipmentMovementToSupabase, syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import { asignacionesActuales, type AsignacionActual } from '../utils/asignaciones';
import { X, Loader2, Search, AlertTriangle, PenLine, Plus } from 'lucide-react';
import { obtenerMiFirma, correoGuardado, guardarCorreo, crearComprobante, listarSucursales, type ComprobanteCreado } from '../services/comprobantes';
import ComprobanteGenerado from './comprobante/ComprobanteGenerado';
import MiFirmaModal from './comprobante/MiFirmaModal';

export type TipoMovimiento = 'asignacion' | 'devolucion';

/** Persona elegida para el movimiento (de la búsqueda o ya conocida). */
export interface UsuarioMovimiento {
  ref: string;
  nombre: string;
  area: string;
  correo?: string;   // si la fuente lo trae
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TITULOS: Record<TipoMovimiento, string> = {
  asignacion: 'Asignar equipos',
  devolucion: 'Registrar devolución',
};

/**
 * Formulario de movimiento reutilizable (asignación o devolución). Se abre
 * desde Equipamientos (con el equipo ya elegido) o desde Usuarios (con la
 * persona ya elegida); lo que no viene, se elige en el formulario.
 * En una asignación se pueden elegir varios equipos: cada uno genera su
 * movimiento y todos van en una sola constancia de entrega.
 */
export default function RegistrarMovimientoModal({ tipo, equipo, usuario, observacionesIniciales, onClose, onRegistrado }: {
  tipo: TipoMovimiento;
  equipo?: Equipment;
  usuario?: UsuarioMovimiento;
  observacionesIniciales?: string;
  onClose: () => void;
  onRegistrado?: () => void;
}) {
  const { equipments, setEquipments } = useApp();
  const { user } = useAuth();

  const [asignaciones, setAsignaciones] = useState<Map<string, AsignacionActual> | null>(null);
  const [equipmentId, setEquipmentId] = useState(equipo?.id ?? '');           // devolución: un equipo
  const [seleccion, setSeleccion] = useState<string[]>(equipo ? [equipo.id] : []); // asignación: uno o varios
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [sucursal, setSucursal] = useState('');
  const [sector, setSector] = useState('');
  const [sectorEditado, setSectorEditado] = useState(false);
  const [persona, setPersona] = useState<UsuarioMovimiento | null>(usuario ?? null);
  const [observaciones, setObservaciones] = useState(observacionesIniciales ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comprobante de entrega (solo asignaciones): correo del usuario y firma del responsable
  const [correo, setCorreo] = useState('');
  const [tengoFirma, setTengoFirma] = useState<boolean | null>(null);
  const [verFirma, setVerFirma] = useState(false);
  const [resultado, setResultado] = useState<{ movementIds?: number[]; creado?: ComprobanteCreado; error?: string } | null>(null);

  useEffect(() => {
    if (tipo === 'asignacion') obtenerMiFirma().then(f => setTengoFirma(Boolean(f))).catch(() => setTengoFirma(false));
  }, [tipo, verFirma]);

  useEffect(() => {
    if (tipo === 'asignacion') listarSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, [tipo]);

  // Sector: se propone el del primer equipo (el que informa el servidor de monitoreo); se puede cambiar.
  const primerEquipo = equipments.find(e => e.id === seleccion[0]);
  useEffect(() => {
    if (!sectorEditado) setSector(primerEquipo?.meshGrupo ?? '');
  }, [primerEquipo?.meshGrupo, sectorEditado]);
  const sectoresConocidos = [...new Set(equipments.map(e => e.meshGrupo).filter((g): g is string => Boolean(g)))].sort();

  // Correo: el de la fuente, o el que se guardó la última vez
  useEffect(() => {
    if (tipo !== 'asignacion' || !persona) { setCorreo(''); return; }
    if (persona.correo) { setCorreo(persona.correo); return; }
    correoGuardado(persona.ref).then(setCorreo).catch(() => setCorreo(''));
  }, [tipo, persona]);

  // Búsqueda de usuario (solo si no vino elegido)
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<UsuarioCompat[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    syncEquipmentMovementsFromSupabase()
      .then(movs => setAsignaciones(asignacionesActuales(movs)))
      .catch(() => setAsignaciones(new Map()));
  }, []);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    if (usuario || persona || !query.trim()) { setResultados([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await buscarUsuariosCompat(query.trim()));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => window.clearTimeout(debounceRef.current);
  }, [query, usuario, persona]);

  const asignacionDelEquipo = equipmentId ? asignaciones?.get(equipmentId) : undefined;

  // Devolución de un equipo: la persona es quien lo tiene asignado.
  useEffect(() => {
    if (tipo === 'devolucion' && !usuario && asignacionDelEquipo) {
      setPersona({ ref: asignacionDelEquipo.usuarioRef, nombre: asignacionDelEquipo.usuarioNombre, area: asignacionDelEquipo.usuarioArea });
    }
  }, [tipo, usuario, asignacionDelEquipo]);

  // Equipos que se pueden elegir: para asignar, los libres; para devolver, los de esa persona.
  const opcionesEquipo = equipments.filter(e => {
    const a = asignaciones?.get(e.id);
    if (tipo === 'asignacion') return !a && e.status !== 'retired';
    return persona ? a?.usuarioRef === persona.ref : Boolean(a);
  });

  const validar = (): string | null => {
    if (tipo === 'asignacion' && seleccion.length === 0) return 'Elegí al menos un equipo.';
    if (tipo === 'devolucion' && !equipmentId) return 'Elegí un equipo.';
    if (!persona) return 'Elegí un usuario.';
    if (tipo === 'asignacion' && !tengoFirma) return 'Configurá tu firma antes de asignar (se usa en el comprobante).';
    if (tipo === 'asignacion' && !EMAIL_RE.test(correo.trim())) return 'Cargá un correo válido para enviarle el comprobante.';
    if (tipo === 'asignacion') {
      for (const id of seleccion) {
        const a = asignaciones?.get(id);
        if (a) return `${equipments.find(e => e.id === id)?.name ?? 'Un equipo'} ya está asignado a ${a.usuarioNombre}. Registrá primero la devolución.`;
      }
    }
    if (tipo === 'devolucion' && asignacionDelEquipo?.usuarioRef !== persona.ref) {
      return 'Ese equipo no está asignado a esta persona.';
    }
    return null;
  };

  const registrar = (id: string) => syncEquipmentMovementToSupabase({
    equipmentId: id,
    usuarioRef: persona!.ref,
    usuarioNombre: persona!.nombre,
    usuarioArea: persona!.area,
    tipo,
    observaciones: observaciones.trim() || undefined,
    registradoPor: user?.email || undefined,
  });

  const handleGuardar = async () => {
    const problema = validar();
    if (problema) { setError(problema); return; }
    setGuardando(true);
    setError(null);

    if (tipo === 'devolucion') {
      const r = await registrar(equipmentId);
      setGuardando(false);
      if (!r.success) { setError(r.error || 'No se pudo registrar el movimiento.'); return; }
      setEquipments(prev => prev.map(e => e.id === equipmentId ? { ...e, status: 'available' as Equipment['status'] } : e));
      onRegistrado?.();
      onClose();
      return;
    }

    // Asignación: un movimiento por equipo (la base actualiza el estado de cada uno)
    const movementIds: number[] = [];
    const fallidos: string[] = [];
    for (const id of seleccion) {
      const r = await registrar(id);
      if (r.success && r.movementId) {
        movementIds.push(r.movementId);
        setEquipments(prev => prev.map(e => e.id === id ? { ...e, status: 'assigned' as Equipment['status'] } : e));
      } else {
        fallidos.push(equipments.find(e => e.id === id)?.name ?? id);
      }
    }
    setGuardando(false);
    if (movementIds.length > 0) onRegistrado?.();
    if (movementIds.length === 0) { setError(`No se pudo registrar la asignación de: ${fallidos.join(', ')}.`); return; }

    // Constancia única con todos los equipos asignados; se guarda el correo si no venía de la fuente
    const correoFinal = correo.trim().toLowerCase();
    if (correoFinal !== (persona!.correo || '').toLowerCase()) guardarCorreo(persona!.ref, correoFinal).catch(() => undefined);
    const aviso = fallidos.length ? `No se pudo asignar: ${fallidos.join(', ')}. ` : '';
    try {
      const creado = await crearComprobante(movementIds, correoFinal, { sucursal, sector: sector.trim() });
      setResultado({ movementIds, creado, error: undefined });
      if (aviso) setError(aviso.trim());
    } catch (err) {
      setResultado({ movementIds, error: `${aviso}${(err as Error).message}` });
    }
  };

  const equipoElegido = equipments.find(e => e.id === equipmentId);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{TITULOS[tipo]}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        {resultado ? (
          <div className="p-5 space-y-4">
            {error && <p className="text-sm text-amber-700">{error}</p>}
            <ComprobanteGenerado movementIds={resultado.movementIds} resultado={resultado.creado} error={resultado.error} correo={correo.trim()} />
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700">Listo</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          {/* Equipo */}
          {tipo === 'asignacion' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipos *</label>
            <div className="space-y-1.5">
              {seleccion.map(id => {
                const eq = equipments.find(e => e.id === id);
                return (
                  <div key={id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 text-sm">
                    <span className="text-gray-800">{eq?.name ?? id}{eq?.serialNumber ? <span className="text-gray-400"> · {eq.serialNumber}</span> : null}</span>
                    <button onClick={() => { setSeleccion(sel => sel.filter(x => x !== id)); setError(null); }}
                      className="p-0.5 rounded hover:bg-gray-200 text-gray-500" title="Quitar"><X size={14} /></button>
                  </div>
                );
              })}
              <div className="relative">
                <Plus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select value="" onChange={e => { if (e.target.value) { setSeleccion(sel => [...sel, e.target.value]); setError(null); } }}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                  <option value="">{asignaciones ? (seleccion.length ? 'Agregar otro equipo...' : 'Seleccionar equipo...') : 'Cargando...'}</option>
                  {opcionesEquipo.filter(e => !seleccion.includes(e.id)).map(e => (
                    <option key={e.id} value={e.id}>{e.name}{e.serialNumber ? ` · ${e.serialNumber}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            {asignaciones && opcionesEquipo.length === 0 && seleccion.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No hay equipos disponibles para asignar.</p>
            )}
          </div>
          ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipo *</label>
            {equipo ? (
              <p className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-800">{equipo.name}</p>
            ) : (
              <select value={equipmentId} onChange={e => { setEquipmentId(e.target.value); setError(null); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                <option value="">{asignaciones ? 'Seleccionar equipo...' : 'Cargando...'}</option>
                {opcionesEquipo.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.serialNumber ? ` · ${e.serialNumber}` : ''}</option>
                ))}
              </select>
            )}
          </div>
          )}

          {/* Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
            {usuario || persona ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-sm">
                <span className="text-gray-800">{(usuario ?? persona)!.nombre}</span>
                {!usuario && tipo === 'asignacion' && (
                  <button onClick={() => { setPersona(null); setQuery(''); }} className="text-xs text-blue-600 hover:underline">cambiar</button>
                )}
              </div>
            ) : tipo === 'devolucion' ? (
              <p className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-500">
                {equipoElegido ? 'El equipo no está asignado a nadie.' : 'Elegí el equipo a devolver.'}
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar por nombre, apellido o código..."
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                  {buscando && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
                </div>
                {resultados.length > 0 && (
                  <ul className="mt-1 border border-gray-100 rounded-lg max-h-40 overflow-y-auto shadow-sm">
                    {resultados.map(u => (
                      <li key={u.id}>
                        <button onClick={() => { setPersona({ ref: u.id, nombre: u.nombreCompleto, area: u.area, correo: u.correo }); setError(null); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                          {u.nombreCompleto}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {tipo === 'asignacion' && persona && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo del usuario *</label>
              <input type="email" value={correo} onChange={e => { setCorreo(e.target.value); setError(null); }}
                placeholder="Para enviarle el comprobante a firmar"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
            </div>
          )}

          {tipo === 'asignacion' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                <select value={sucursal} onChange={e => setSucursal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                  <option value="">{sucursales.length ? 'Seleccionar...' : 'Sin sucursales'}</option>
                  {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sector que recibe</label>
                <input type="text" list="sectores-equipos" value={sector}
                  onChange={e => { setSector(e.target.value); setSectorEditado(true); }}
                  placeholder="Del equipo o escribilo"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                <datalist id="sectores-equipos">
                  {sectoresConocidos.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
          )}

          {tipo === 'asignacion' && tengoFirma === false && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              <span>Para generar el comprobante necesitás cargar tu firma.</span>
              <button onClick={() => setVerFirma(true)} className="flex items-center gap-1 font-medium hover:underline shrink-0">
                <PenLine size={13} /> Mi firma
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando || !asignaciones}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
              {guardando && <Loader2 size={15} className="animate-spin" />}
              {tipo === 'asignacion' ? 'Asignar' : 'Registrar devolución'}
            </button>
          </div>
        </div>
        )}
      </div>
      {verFirma && <MiFirmaModal onClose={() => setVerFirma(false)} />}
    </div>
  );
}

