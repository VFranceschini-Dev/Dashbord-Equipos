import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data';
import { TEXTOS_USUARIOS } from '../constants/textos';
import { listarUsuarios, darDeAltaUsuario, generarCodigoUsuario, codigoDisponible, ProxyError, type ListadoUsuarios, type AltaUsuarioInput } from '../services/usuarios';
import { syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import { asignacionesActuales, type AsignacionActual } from '../utils/asignaciones';
import RegistrarMovimientoModal, { type TipoMovimiento, type UsuarioMovimiento } from './RegistrarMovimientoModal';
import type { Equipment } from '../types';
import {
  Plus, Search, X, Users, Mail, Building, User, CheckCircle, XCircle, Monitor, Loader2, RefreshCw, AlertTriangle,
  UserPlus, Undo2, LayoutGrid, List, SquareUser
} from 'lucide-react';

const TU = TEXTOS_USUARIOS.usuarios;
const TA = TEXTOS_USUARIOS.asignaciones;

const LIMITE = 500;

type Vista = 'columnas' | 'lista' | 'tarjetas';
const VISTAS: { id: Vista; label: string; icon: JSX.Element }[] = [
  { id: 'columnas', label: 'Columnas', icon: <LayoutGrid size={16} /> },
  { id: 'lista', label: 'Lista', icon: <List size={16} /> },
  { id: 'tarjetas', label: 'Tarjetas', icon: <SquareUser size={16} /> },
];
const CLAVE_VISTA = 'usuarios.vista';
const CLAVE_AGRUPAR = 'usuarios.agrupar';
function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function guardar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}

/** Ícono del usuario, como los equipos en Mesh: color si está activo, gris si no. */
function IconoUsuario({ activo, size = 28 }: { activo: boolean; size?: number }) {
  return (
    <div className={`relative shrink-0 rounded-lg p-1.5 ${activo
      ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300'
      : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'}`}>
      <User size={size} strokeWidth={1.6} />
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${activo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-500'}`} />
    </div>
  );
}

const emptyForm: AltaUsuarioInput = {
  nombre: '', apellido: '', usuario: '', correo: '', departamento: '', estado: 'activo',
};

/**
 * Sección Usuarios: misma fuente que Asignación de Equipos (endpoint propio).
 * Lista de solo lectura + alta de usuarios nuevos; los equipos de cada usuario
 * se calculan a partir del último movimiento de cada equipo.
 */
export default function Collaborators() {
  const { equipments } = useApp();
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [listado, setListado] = useState<ListadoUsuarios>({ total: 0, activos: 0, data: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refreshNext = useRef(false);
  const debounceRef = useRef<number | undefined>(undefined);

  const [asignaciones, setAsignaciones] = useState<Map<string, AsignacionActual>>(new Map());
  const [movimiento, setMovimiento] = useState<{ tipo: TipoMovimiento; usuario: UsuarioMovimiento; equipo?: Equipment } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AltaUsuarioInput>(emptyForm);
  const [loginEditado, setLoginEditado] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [vista, setVista] = useState<Vista>(() => {
    const v = leer(CLAVE_VISTA);
    return v === 'lista' || v === 'tarjetas' ? v : 'columnas';
  });
  const [agrupar, setAgrupar] = useState(() => leer(CLAVE_AGRUPAR) !== 'no');
  const [abierto, setAbierto] = useState<string | null>(null);   // usuario desplegado en la vista de columnas
  const cambiarVista = (v: Vista) => { setVista(v); guardar(CLAVE_VISTA, v); };
  const cambiarAgrupar = (a: boolean) => { setAgrupar(a); guardar(CLAVE_AGRUPAR, a ? 'si' : 'no'); };

  // Lista de usuarios (con espera tras tipear, igual que Asignación de Equipos)
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const refresh = refreshNext.current;
      refreshNext.current = false;
      try {
        setListado(await listarUsuarios(search.trim(), { soloActivos: false, limit: LIMITE, refresh }));
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof ProxyError && err.status === 401 ? TA.sesionExpirada : TA.errorCargaUsuarios);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(debounceRef.current);
  }, [search, reloadKey]);

  // Equipos asignados hoy a cada usuario (según el historial de movimientos)
  useEffect(() => {
    syncEquipmentMovementsFromSupabase()
      .then(movs => setAsignaciones(asignacionesActuales(movs)))
      .catch(() => setAsignaciones(new Map()));
  }, [reloadKey]);

  const recargar = (refresh: boolean) => {
    refreshNext.current = refresh;
    setReloadKey(k => k + 1);
  };

  // Equipos asignados hoy a cada usuario (clave: id del usuario)
  const equiposDe = useMemo(() => {
    const porUsuario = new Map<string, Equipment[]>();
    for (const [equipmentId, a] of asignaciones) {
      const eq = equipments.find(e => e.id === equipmentId);
      if (eq) porUsuario.set(a.usuarioRef, [...(porUsuario.get(a.usuarioRef) ?? []), eq]);
    }
    return porUsuario;
  }, [asignaciones, equipments]);

  const departamentos = useMemo(
    () => [...new Set(listado.data.map(u => u.departamento.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [listado.data],
  );

  const filtered = filterDepartment === 'all'
    ? listado.data
    : listado.data.filter(u => u.departamento.trim() === filterDepartment);

  // Grupos por departamento (como los grupos de Mesh), ordenados por nombre
  const grupos: [string, typeof filtered][] = useMemo(() => {
    const orden = (a: (typeof filtered)[number], b: (typeof filtered)[number]) =>
      (`${a.nombre} ${a.apellido}`.trim() || a.usuario).localeCompare(`${b.nombre} ${b.apellido}`.trim() || b.usuario, 'es', { sensitivity: 'base' });
    if (!agrupar || vista === 'tarjetas') return [['', [...filtered].sort(orden)]];
    const mapa = new Map<string, typeof filtered>();
    for (const u of filtered) {
      const d = u.departamento.trim() || 'Sin departamento';
      mapa.set(d, [...(mapa.get(d) ?? []), u]);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([d, lista]) => [d, [...lista].sort(orden)] as [string, typeof filtered]);
  }, [filtered, agrupar, vista]);

  const updateNombre = (campo: 'nombre' | 'apellido', valor: string) => {
    const next = { ...form, [campo]: valor };
    if (!loginEditado) next.usuario = generarCodigoUsuario(next.nombre, next.apellido);
    setForm(next);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.usuario.trim()) {
      setFormMsg({ ok: false, text: 'Completá nombre, apellido y usuario.' });
      return;
    }
    setSavingUser(true);
    setFormMsg(null);
    // Código automático: si ya existe, se le agrega un número (vfranceschini2).
    // Si se editó a mano, se respeta y el servidor avisa si está repetido.
    const usuario = loginEditado ? form.usuario.trim() : await codigoDisponible(form.usuario.trim());
    if (usuario !== form.usuario) setForm(f => ({ ...f, usuario }));
    const resultado = await darDeAltaUsuario({
      ...form,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      usuario,
      correo: form.correo.trim(),
      departamento: form.departamento.trim(),
    });
    setSavingUser(false);
    if (resultado.ok) {
      resetForm();
      recargar(false); // darDeAltaUsuario ya invalidó la caché local
    } else {
      setFormMsg({ ok: false, text: resultado.code === 'duplicado' ? TA.yaRegistrado : resultado.message });
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setLoginEditado(false);
    setShowForm(false);
    setFormMsg(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-3 text-sm">
        {loading && (
          <span className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
            <Loader2 size={14} className="animate-spin" /> {TU.cargando}
          </span>
        )}
        <button onClick={() => recargar(true)} disabled={loading}
          className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-50">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {loadError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={TU.buscarPlaceholder} value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 outline-none text-sm w-64" />
          </div>
          <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los departamentos</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> {TU.nuevo}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">{TU.total}</p>
          <p className="text-2xl font-bold">{listado.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600">Activos</p>
          <p className="text-2xl font-bold text-emerald-700">{listado.activos}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600">Equipos Asignados</p>
          <p className="text-2xl font-bold text-blue-700">{equipments.filter(e => e.status === 'assigned').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Departamentos</p>
          <p className="text-2xl font-bold">{departamentos.length}</p>
        </div>
      </div>

      {listado.total > listado.data.length && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Se muestran {listado.data.length} de {listado.total} usuarios. Usá el buscador para encontrar al resto.
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{TU.nuevo}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={e => updateNombre('nombre', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input type="text" value={form.apellido} onChange={e => updateNombre('apellido', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (login) *</label>
                  <input type="text" value={form.usuario}
                    onChange={e => { setLoginEditado(true); setForm({ ...form, usuario: e.target.value }); }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Se genera automáticamente; podés modificarlo.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                  <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <input type="text" list="departamentos-usuarios" value={form.departamento}
                    onChange={e => setForm({ ...form, departamento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                  <datalist id="departamentos-usuarios">
                    {[...new Set([...departamentos, ...DEPARTMENTS])].map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.estado === 'activo'}
                      onChange={e => setForm({ ...form, estado: e.target.checked ? 'activo' : 'inactivo' })}
                      className="rounded border-gray-300" />
                    Usuario activo
                  </label>
                </div>
              </div>
              {formMsg && (
                <div className={`rounded-lg px-3 py-2 text-sm ${formMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {formMsg.text}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">{TU.cancelar}</button>
              <button onClick={handleSubmit} disabled={savingUser}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium disabled:opacity-50 inline-flex items-center gap-2">
                {savingUser && <Loader2 size={14} className="animate-spin" />}
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
        </p>
        <div className="flex items-center gap-3">
          {vista !== 'tarjetas' && (
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={agrupar} onChange={e => cambiarAgrupar(e.target.checked)} className="rounded" />
              Agrupar por departamento
            </label>
          )}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden" role="group" aria-label="Tipo de vista">
            {VISTAS.map(v => (
              <button key={v.id} onClick={() => cambiarVista(v.id)} title={v.label} aria-pressed={vista === v.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${vista === v.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                {v.icon} <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {vista !== 'tarjetas' && grupos.map(([grupo, lista]) => (
        <section key={grupo || 'todos'} className="space-y-2">
          {grupo && (
            <h3 className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-1 text-sm font-semibold text-gray-700 dark:text-slate-200">
              {grupo}
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500">{lista.length} {lista.length === 1 ? 'usuario' : 'usuarios'}</span>
            </h3>
          )}
          <div className={vista === 'columnas' ? 'grid items-start gap-2' : 'divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800'}
            style={vista === 'columnas' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' } : undefined}>
            {lista.map(u => {
              const susEquipos = equiposDe.get(u.id) ?? [];
              const nombre = `${u.nombre} ${u.apellido}`.trim() || u.usuario;
              const persona: UsuarioMovimiento = { ref: u.id, nombre, area: u.departamento, correo: u.correo || undefined };
              const activo = u.estado === 'activo';
              const estado = (
                <span className={activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>
                  {activo ? 'Activo' : 'Inactivo'}
                </span>
              );
              const botonAsignar = activo && (
                <button onClick={() => setMovimiento({ tipo: 'asignacion', usuario: persona })} title="Asignar equipo"
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-slate-700">
                  <UserPlus size={13} /> Asignar
                </button>
              );
              const equiposConDevolucion = susEquipos.map(eq => (
                <span key={eq.id} className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-gray-700 dark:text-slate-200">
                  <Monitor size={11} className="shrink-0" /> <span className="truncate max-w-[9rem]" title={eq.name}>{eq.name}</span>
                  <button onClick={() => setMovimiento({ tipo: 'devolucion', usuario: persona, equipo: eq })} title={`Devolución de ${eq.name}`}
                    className="text-emerald-700 dark:text-emerald-400 hover:opacity-70"><Undo2 size={12} /></button>
                </span>
              ));

              if (vista === 'lista') {
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/60">
                    <IconoUsuario activo={activo} size={16} />
                    <p className="w-52 shrink-0 truncate text-sm font-medium text-gray-800 dark:text-slate-100" title={nombre}>{nombre}</p>
                    <p className="hidden md:block w-32 shrink-0 truncate text-xs text-gray-500 dark:text-slate-400">{u.usuario}</p>
                    {!agrupar && <p className="hidden lg:block w-40 shrink-0 truncate text-xs text-gray-500 dark:text-slate-400">{u.departamento}</p>}
                    <p className="w-16 shrink-0 text-xs">{estado}</p>
                    <div className="flex flex-1 min-w-0 flex-wrap gap-1">
                      {equiposConDevolucion.length ? equiposConDevolucion : <span className="text-xs text-gray-400 dark:text-slate-500">Sin equipos</span>}
                    </div>
                    <div className="shrink-0">{botonAsignar}</div>
                  </div>
                );
              }

              const desplegado = abierto === u.id;
              return (
                <div key={u.id} onClick={() => setAbierto(desplegado ? null : u.id)} title={desplegado ? undefined : 'Ver equipos y acciones'}
                  className={`rounded-lg border bg-white px-2.5 py-2 cursor-pointer dark:bg-slate-800 ${desplegado
                    ? 'border-blue-400 shadow-sm dark:border-sky-500'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-sky-500/60'}`}>
                  <div className="flex items-center gap-2.5">
                    <IconoUsuario activo={activo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-slate-100" title={nombre}>{nombre}</p>
                      <p className="truncate text-xs">
                        {estado}
                        <span className="text-gray-500 dark:text-slate-400"> · {susEquipos.length} equipo{susEquipos.length !== 1 ? 's' : ''}</span>
                      </p>
                      <p className="truncate text-xs text-gray-400 dark:text-slate-500">{u.usuario}{!agrupar && u.departamento ? ` · ${u.departamento}` : ''}</p>
                    </div>
                  </div>
                  {desplegado && (
                    <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                      {u.correo && <p className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-slate-400"><Mail size={11} /> {u.correo}</p>}
                      <div className="flex flex-wrap gap-1">
                        {equiposConDevolucion.length ? equiposConDevolucion : <span className="text-xs text-gray-400 dark:text-slate-500">Sin equipos asignados</span>}
                      </div>
                      {botonAsignar && <div className="flex justify-end">{botonAsignar}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {vista === 'tarjetas' && (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(u => {
          const susEquipos = equiposDe.get(u.id) ?? [];
          const persona: UsuarioMovimiento = {
            ref: u.id,
            nombre: `${u.nombre} ${u.apellido}`.trim() || u.usuario,
            area: u.departamento,
            correo: u.correo || undefined,
          };
          const activo = u.estado === 'activo';
          return (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(u.nombre.charAt(0) + u.apellido.charAt(0)).toUpperCase() || u.usuario.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{`${u.nombre} ${u.apellido}`.trim() || u.usuario}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1"><User size={10} /> {u.usuario}</p>
                  </div>
                </div>
                {activo ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                    <CheckCircle size={10} /> Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                    <XCircle size={10} /> Inactivo
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-4">
                {u.departamento && <p className="text-sm text-gray-600 flex items-center gap-2"><Building size={14} className="text-gray-400" /> {u.departamento}</p>}
                {u.correo && <p className="text-sm text-gray-600 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {u.correo}</p>}
              </div>
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                    <Monitor size={10} /> {susEquipos.length} equipo{susEquipos.length !== 1 ? 's' : ''}
                  </span>
                  {activo && (
                    <button onClick={() => setMovimiento({ tipo: 'asignacion', usuario: persona })}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                      <UserPlus size={12} /> Asignar equipo
                    </button>
                  )}
                </div>
                {susEquipos.map(eq => (
                  <div key={eq.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="truncate">{eq.name}</span>
                    <button onClick={() => setMovimiento({ tipo: 'devolucion', usuario: persona, equipo: eq })}
                      className="flex items-center gap-1 font-medium text-emerald-700 hover:underline shrink-0 ml-2">
                      <Undo2 size={12} /> Devolución
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {movimiento && (
        <RegistrarMovimientoModal tipo={movimiento.tipo} usuario={movimiento.usuario} equipo={movimiento.equipo}
          onClose={() => setMovimiento(null)}
          onRegistrado={() => setReloadKey(k => k + 1)} />
      )}

      {filtered.length === 0 && !loading && !loadError && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{TU.sinResultados}</p>
        </div>
      )}
    </div>
  );
}
