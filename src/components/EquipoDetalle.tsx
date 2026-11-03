import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Equipment, EquipmentMovement } from '../types';
import { detalleMesh, guardarIpReal, type DetalleMesh } from '../services/mesh';
import { syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import {
  X, Loader2, AlertTriangle, Monitor, Cpu, HardDrive, Network, ShieldCheck, User, History, Wand2, RefreshCw
} from 'lucide-react';

const TIPO_LABEL: Record<Equipment['type'], string> = {
  desktop: 'PC Escritorio', laptop: 'Notebook', server: 'Servidor',
  monitor: 'Monitor', peripheral: 'Periférico', other: 'Otro',
};
const ESTADO_LABEL: Record<Equipment['status'], string> = {
  assigned: 'Asignado', available: 'Disponible', maintenance: 'Mantenimiento', retired: 'Retirado',
};
const MOVIMIENTO_LABEL: Record<EquipmentMovement['tipo'], string> = {
  asignacion: 'Asignación', devolucion: 'Devolución', traslado: 'Traslado', baja: 'Baja',
};

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-AR') : 'Sin datos');

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800 text-right break-words min-w-0">{value || <span className="text-gray-400">Sin datos</span>}</span>
    </div>
  );
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">{icono} {titulo}</h4>
      <div className="bg-white rounded-lg border border-gray-100 px-3 py-1">{children}</div>
    </section>
  );
}

/** Panel lateral con el detalle de un equipo: datos de la app, monitoreo en vivo e historial. */
export default function EquipoDetalle({ equipment, asignadoA, onClose }: {
  equipment: Equipment;
  asignadoA: string;
  onClose: () => void;
}) {
  const { updateEquipment, setEquipments } = useApp();
  const [mesh, setMesh] = useState<DetalleMesh | null>(null);
  const [meshCargando, setMeshCargando] = useState(false);
  const [meshError, setMeshError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EquipmentMovement[] | null>(null);
  const [completando, setCompletando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; text: string } | null>(null);

  const cargarMesh = async () => {
    if (!equipment.meshNodeId) return;
    setMeshCargando(true);
    setMeshError(null);
    try {
      const d = await detalleMesh(equipment.meshNodeId);
      setMesh(d);
      // Guardar la IP real para que la lista la muestre (si cambió)
      if (d.ipPrincipal && d.ipPrincipal !== equipment.meshIp && await guardarIpReal(equipment.id, d.ipPrincipal)) {
        setEquipments(prev => prev.map(e => e.id === equipment.id ? { ...e, meshIp: d.ipPrincipal } : e));
      }
    } catch (err) {
      setMeshError((err as Error).message);
    } finally {
      setMeshCargando(false);
    }
  };

  useEffect(() => {
    setMesh(null);
    setAviso(null);
    cargarMesh();
    syncEquipmentMovementsFromSupabase()
      .then(movs => setHistorial(movs.filter(m => m.equipmentId === equipment.id)))
      .catch(() => setHistorial([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment.id]);

  // Completa marca, modelo y serial desde el hardware, solo en los campos vacíos.
  const datosHardware = mesh ? {
    brand: !equipment.brand.trim() ? mesh.fabricante : '',
    model: !equipment.model.trim() ? mesh.modelo : '',
    serialNumber: !equipment.serialNumber.trim() ? mesh.serial : '',
  } : null;
  const hayParaCompletar = Boolean(datosHardware && (datosHardware.brand || datosHardware.model || datosHardware.serialNumber));

  const completarDesdeMesh = async () => {
    if (!datosHardware) return;
    const cambios = Object.fromEntries(Object.entries(datosHardware).filter(([, v]) => v)) as Partial<Equipment>;
    setCompletando(true);
    const ok = await updateEquipment(equipment.id, cambios);
    setCompletando(false);
    setAviso(ok
      ? { ok: true, text: 'Datos completados desde el servidor de monitoreo.' }
      : { ok: false, text: 'No se pudieron guardar los datos. Intentá de nuevo más tarde.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative w-full max-w-xl h-full bg-gray-50 shadow-2xl overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-gray-800 truncate">{equipment.name}</h3>
            <p className="text-xs text-gray-500">
              {TIPO_LABEL[equipment.type]}{equipment.meshGrupo ? ` · ${equipment.meshGrupo}` : ''}
              {equipment.meshNodeId && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className={`w-2 h-2 rounded-full ${(mesh?.enLinea ?? equipment.meshEnLinea) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {(mesh?.enLinea ?? equipment.meshEnLinea) ? 'En línea' : 'Desconectado'}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </header>

        <div className="p-5 space-y-5">
          <Bloque titulo="Equipo" icono={<Monitor size={13} />}>
            <Fila label="Estado" value={ESTADO_LABEL[equipment.status]} />
            <Fila label="Asignado a" value={asignadoA !== '-' ? asignadoA : 'Sin asignar'} />
            <Fila label="Marca" value={equipment.brand} />
            <Fila label="Modelo" value={equipment.model} />
            <Fila label="Serial" value={equipment.serialNumber} />
            <Fila label="Categoría" value={equipment.category} />
            {equipment.notes && <Fila label="Notas" value={equipment.notes} />}
          </Bloque>

          {hayParaCompletar && (
            <button onClick={completarDesdeMesh} disabled={completando}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg hover:bg-indigo-100 text-sm font-medium disabled:opacity-60">
              {completando ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              Completar {[datosHardware?.brand && 'marca', datosHardware?.model && 'modelo', datosHardware?.serialNumber && 'serial']
                .filter(Boolean).join(', ')} desde Mesh
            </button>
          )}
          {aviso && (
            <div className={`rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{aviso.text}</div>
          )}

          {equipment.meshNodeId ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">Monitoreo (en vivo)</h4>
                <button onClick={cargarMesh} disabled={meshCargando}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 disabled:opacity-50">
                  <RefreshCw size={12} className={meshCargando ? 'animate-spin' : ''} /> Actualizar
                </button>
              </div>

              {meshCargando && !mesh && (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                  <Loader2 size={18} className="animate-spin text-blue-500" /> Consultando el servidor de monitoreo...
                </div>
              )}
              {meshError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {meshError}
                </div>
              )}

              {mesh && (
                <>
                  <Bloque titulo="Sistema" icono={<Monitor size={13} />}>
                    <Fila label="Sistema operativo" value={mesh.so} />
                    <Fila label="Versión" value={mesh.versionSo} />
                    <Fila label="Arquitectura" value={mesh.arquitectura} />
                    <Fila label="Último arranque" value={mesh.ultimoArranque ? fecha(mesh.ultimoArranque) : ''} />
                    {!mesh.enLinea && <Fila label="Última conexión" value={equipment.meshUltimaConexion ? fecha(equipment.meshUltimaConexion) : ''} />}
                  </Bloque>

                  <Bloque titulo="Usuario activo de Windows" icono={<User size={13} />}>
                    <Fila label="Sesión" value={mesh.usuariosActivos.join(', ')} />
                  </Bloque>

                  <Bloque titulo="Hardware" icono={<Cpu size={13} />}>
                    <Fila label="Fabricante" value={mesh.fabricante} />
                    <Fila label="Modelo" value={mesh.modelo} />
                    <Fila label="Serial" value={mesh.serial} />
                    <Fila label="Procesador" value={mesh.procesador} />
                    <Fila label="Memoria RAM" value={mesh.memoriaGb ? `${mesh.memoriaGb} GB` : ''} />
                  </Bloque>

                  <Bloque titulo="Discos" icono={<HardDrive size={13} />}>
                    {mesh.discos.length
                      ? mesh.discos.map((d, i) => <Fila key={i} label={d.nombre || `Disco ${i + 1}`} value={d.tamanoGb ? `${d.tamanoGb} GB` : ''} />)
                      : <Fila label="Discos" value="" />}
                  </Bloque>

                  <Bloque titulo="Redes" icono={<Network size={13} />}>
                    <Fila label="IP principal" value={mesh.ipPrincipal} />
                    {mesh.redes.map((r, i) => (
                      <Fila key={i} label={r.nombre} value={[r.ipv4.join(', '), r.mac && `MAC ${r.mac}`].filter(Boolean).join(' · ')} />
                    ))}
                  </Bloque>

                  <Bloque titulo="Antivirus" icono={<ShieldCheck size={13} />}>
                    {mesh.antivirus.length ? mesh.antivirus.map((a, i) => (
                      <Fila key={i} label={a.nombre} value={
                        <span className={a.activo === false ? 'text-red-600' : 'text-emerald-700'}>
                          {a.activo === null ? 'Estado desconocido' : a.activo ? 'Activo' : 'Desactivado'}
                          {a.actualizado === false ? ' · desactualizado' : ''}
                        </span>
                      } />
                    )) : <Fila label="Antivirus" value="" />}
                  </Bloque>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 bg-white rounded-lg border border-gray-100 px-3 py-3">
              Este equipo no está sincronizado con el servidor de monitoreo.
            </p>
          )}

          <Bloque titulo="Historial de movimientos" icono={<History size={13} />}>
            {historial === null ? (
              <p className="text-sm text-gray-500 py-2">Cargando...</p>
            ) : historial.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Sin movimientos registrados.</p>
            ) : historial.map(m => (
              <Fila key={m.id} label={new Date(m.fecha).toLocaleString('es-AR')}
                value={`${MOVIMIENTO_LABEL[m.tipo]} · ${m.usuarioNombre}`} />
            ))}
          </Bloque>
        </div>
      </aside>
    </div>
  );
}
