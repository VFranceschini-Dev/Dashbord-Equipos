import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data';
import { TEXTOS_USUARIOS } from '../constants/textos';
import { listarUsuarios, darDeAltaUsuario, ProxyError, type ListadoUsuarios, type AltaUsuarioInput } from '../services/usuarios';
import { syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import { asignacionesActuales, equiposPorUsuario } from '../utils/asignaciones';
import {
  Plus, Search, X, Users, Mail, Building, User, CheckCircle, XCircle, Monitor, Loader2, RefreshCw, AlertTriangle
} from 'lucide-react';

const TU = TEXTOS_USUARIOS.usuarios;
const TA = TEXTOS_USUARIOS.asignaciones;

const LIMITE = 500;

/** Sugerencia de login: nombre + apellido en minúsculas, sin tildes ni espacios. */
function sugerirLogin(nombre: string, apellido: string): string {
  return `${nombre}${apellido}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
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

  const [equiposDe, setEquiposDe] = useState<Map<string, number>>(new Map());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AltaUsuarioInput>(emptyForm);
  const [loginEditado, setLoginEditado] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      .then(movs => setEquiposDe(equiposPorUsuario(asignacionesActuales(movs))))
      .catch(() => setEquiposDe(new Map()));
  }, [reloadKey]);

  const recargar = (refresh: boolean) => {
    refreshNext.current = refresh;
    setReloadKey(k => k + 1);
  };

  const departamentos = useMemo(
    () => [...new Set(listado.data.map(u => u.departamento.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [listado.data],
  );

  const filtered = filterDepartment === 'all'
    ? listado.data
    : listado.data.filter(u => u.departamento.trim() === filterDepartment);

  const updateNombre = (campo: 'nombre' | 'apellido', valor: string) => {
    const next = { ...form, [campo]: valor };
    if (!loginEditado) next.usuario = sugerirLogin(next.nombre, next.apellido);
    setForm(next);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.usuario.trim()) {
      setFormMsg({ ok: false, text: 'Completá nombre, apellido y usuario.' });
      return;
    }
    setSavingUser(true);
    setFormMsg(null);
    const resultado = await darDeAltaUsuario({
      ...form,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      usuario: form.usuario.trim(),
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(u => {
          const eqCount = equiposDe.get(u.id) ?? 0;
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
              <div className="pt-3 border-t border-gray-100">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                  <Monitor size={10} /> {eqCount} equipo{eqCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && !loadError && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{TU.sinResultados}</p>
        </div>
      )}
    </div>
  );
}
