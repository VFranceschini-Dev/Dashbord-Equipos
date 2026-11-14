import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import ModuleSyncControls from './ModuleSyncControls';
import { Equipment } from '../types';
import { EQUIPMENT_CATEGORIES } from '../data';
import { syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import { asignacionesActuales, type AsignacionActual } from '../utils/asignaciones';
import {
  Plus, Search, Edit2, Trash2, X, Monitor, Laptop, Server,
  HardDrive, Mouse, Package, User, Upload, RefreshCw, Loader2,
  LayoutGrid, List
} from 'lucide-react';
import { sincronizarConMesh } from '../services/mesh';
import ImportModal from './ImportModal';
import EquipoDetalle from './EquipoDetalle';
import { v4 as uuidv4 } from 'uuid';

const typeIcons = {
  desktop: <Monitor size={16} />,
  laptop: <Laptop size={16} />,
  server: <Server size={16} />,
  monitor: <Monitor size={16} />,
  peripheral: <Mouse size={16} />,
  other: <Package size={16} />,
};

const typeLabels = {
  desktop: 'PC Escritorio',
  laptop: 'Notebook',
  server: 'Servidor',
  monitor: 'Monitor',
  peripheral: 'Periférico',
  other: 'Otro',
};

const statusConfig = {
  assigned: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
  available: { label: 'Disponible', color: 'bg-emerald-100 text-emerald-700' },
  maintenance: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-700' },
  retired: { label: 'Retirado', color: 'bg-gray-100 text-gray-700' },
};

type Vista = 'columnas' | 'lista';
const VISTAS: { id: Vista; label: string; icon: JSX.Element }[] = [
  { id: 'columnas', label: 'Columnas', icon: <LayoutGrid size={16} /> },
  { id: 'lista', label: 'Lista', icon: <List size={16} /> },
];
const CLAVE_VISTA = 'equipos.vista';
const CLAVE_AGRUPAR = 'equipos.agrupar';
function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function guardar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}

const encendido = (eq: Equipment) => Boolean(eq.meshNodeId && eq.meshEnLinea);

/** Ícono del equipo, como en Mesh: color si está encendido, gris si está apagado. */
function IconoEquipo({ eq, size = 28 }: { eq: Equipment; size?: number }) {
  const on = encendido(eq);
  const Icono = eq.type === 'laptop' ? Laptop : eq.type === 'server' ? Server : eq.type === 'peripheral' ? Mouse
    : eq.type === 'other' ? Package : Monitor;
  return (
    <div className={`relative shrink-0 rounded-lg p-1.5 ${on
      ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300'
      : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'}`}>
      <Icono size={size} strokeWidth={1.6} />
      {eq.meshNodeId && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-500'}`} />
      )}
    </div>
  );
}

/** "Encendido" / "Apagado" para equipos de Mesh; el estado de inventario para los cargados a mano. */
function EstadoEquipo({ eq }: { eq: Equipment }) {
  if (!eq.meshNodeId) return <span className="text-gray-500 dark:text-slate-400">{statusConfig[eq.status].label}</span>;
  const titulo = eq.meshUltimaConexion ? `Última conexión: ${new Date(eq.meshUltimaConexion).toLocaleString('es-AR')}` : undefined;
  return encendido(eq)
    ? <span className="text-emerald-600 dark:text-emerald-400" title={titulo}>Encendido</span>
    : <span className="text-gray-400 dark:text-slate-500" title={titulo}>Apagado</span>;
}

const ESTADOS_EDITABLES: Equipment['status'][] = ['available', 'maintenance'];

export default function Equipments() {
  const { equipments, addEquipment, updateEquipment, deleteEquipment, refreshModule } = useApp();
  const [sincronizando, setSincronizando] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const equipoDetalle = detalleId ? equipments.find(e => e.id === detalleId) : undefined;
  const [asignaciones, setAsignaciones] = useState<Map<string, AsignacionActual>>(new Map());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [vista, setVista] = useState<Vista>(() => (leer(CLAVE_VISTA) === 'lista' ? 'lista' : 'columnas'));
  const [agrupar, setAgrupar] = useState(() => leer(CLAVE_AGRUPAR) !== 'no');
  const [filterEncendido, setFilterEncendido] = useState<'all' | 'on' | 'off'>('all');
  const cambiarVista = (v: Vista) => { setVista(v); guardar(CLAVE_VISTA, v); };
  const cambiarAgrupar = (a: boolean) => { setAgrupar(a); guardar(CLAVE_AGRUPAR, a ? 'si' : 'no'); };

  const emptyForm: Omit<Equipment, 'id'> = {
    name: '', type: 'desktop', brand: '', model: '', serialNumber: '',
    assetTag: '', category: 'Informática', status: 'available',
    collaboratorId: '', purchaseDate: '', warrantyEnd: '', notes: '',
  };
  const [form, setForm] = useState<Omit<Equipment, 'id'>>(emptyForm);

  const filtered = equipments.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.brand.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase()) ||
      e.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.assetTag.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || e.type === filterType;
    const matchCategory = filterCategory === 'all' || e.category === filterCategory;
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchEncendido = filterEncendido === 'all' || (filterEncendido === 'on' ? encendido(e) : !encendido(e));
    return matchSearch && matchType && matchCategory && matchStatus && matchEncendido;
  }).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }));

  // Grupos de Mesh (como en Mesh); los cargados a mano van aparte
  const grupos: [string, Equipment[]][] = (() => {
    if (!agrupar) return [['', filtered]];
    const mapa = new Map<string, Equipment[]>();
    for (const e of filtered) {
      const g = e.meshGrupo || (e.meshNodeId ? 'Mesh' : 'Cargados a mano');
      mapa.set(g, [...(mapa.get(g) ?? []), e]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  })();
  const encendidos = filtered.filter(encendido).length;

  const handleSubmit = () => {
    if (!form.name || !form.brand) return;
    if (editingId) {
      updateEquipment(editingId, form);
    } else {
      addEquipment(form);
    }
    resetForm();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (e: Equipment) => {
    const { id, ...rest } = e;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  };

  // "Asignado a" sale del último movimiento de cada equipo.
  const cargarAsignaciones = () => {
    syncEquipmentMovementsFromSupabase()
      .then(movs => setAsignaciones(asignacionesActuales(movs)))
      .catch(() => setAsignaciones(new Map()));
  };
  useEffect(cargarAsignaciones, []);


  // Trae PC y notebooks del servidor de monitoreo y los guarda (nuevos + actualizados).
  const handleSincronizarMesh = async () => {
    setSincronizando(true);
    setSyncMsg(null);
    try {
      const r = await sincronizarConMesh();
      await refreshModule('equipments');
      setSyncMsg({
        ok: r.errores === 0,
        text: `Sincronización: ${r.nuevos} nuevos, ${r.actualizados} actualizados, ${r.ignorados} ignorados (no son PC ni notebook)`
          + (r.errores ? `, ${r.errores} con error.` : '.'),
      });
    } catch (err) {
      setSyncMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSincronizando(false);
    }
  };

  const handleImport = (importedData: any[]) => {
    importedData.forEach(item => {
      addEquipment({
        ...item,
        id: uuidv4(),
        type: item.type || 'desktop',
        status: item.status || 'available',
        category: item.category || 'Informática',
        purchaseDate: item.purchaseDate || new Date().toISOString().split('T')[0],
        warrantyEnd: item.warrantyEnd || '',
        notes: item.notes || '',
      } as Equipment);
    });
    setShowImport(false);
  };

  const stats = {
    total: equipments.length,
    assigned: equipments.filter(e => e.status === 'assigned').length,
    available: equipments.filter(e => e.status === 'available').length,
    maintenance: equipments.filter(e => e.status === 'maintenance').length,
  };

  return (
    <div className="space-y-5">
      <ModuleSyncControls module="equipments" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Total Equipos</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Asignados</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.assigned}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.available}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 shadow-sm">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mantenimiento</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.maintenance}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[16rem]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca, modelo, serial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los tipos</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todas las categorías</option>
            {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los estados</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterEncendido} onChange={e => setFilterEncendido(e.target.value as typeof filterEncendido)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="all">Encendidos y apagados</option>
            <option value="on">Solo encendidos</option>
            <option value="off">Solo apagados</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSincronizarMesh} disabled={sincronizando}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-60">
            {sincronizando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sincronizar con Mesh
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Upload size={16} /> Importar
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> Nuevo Equipo
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${syncMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {syncMsg.text}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: PC Contabilidad 01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Equipment['type'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                  <input type="text" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: Dell" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° Serie</label>
                  <input type="text" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Activo</label>
                  <input type="text" value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: ACT-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  {/* "Asignado" y "Retirado" solo cambian al registrar movimientos en Asignación de Equipos */}
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Equipment['status'] })}
                    disabled={!ESTADOS_EDITABLES.includes(form.status)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm disabled:bg-gray-50 disabled:text-gray-500">
                    {Object.entries(statusConfig)
                      .filter(([k]) => ESTADOS_EDITABLES.includes(k as Equipment['status']) || k === form.status)
                      .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {!ESTADOS_EDITABLES.includes(form.status) && (
                    <p className="text-xs text-gray-500 mt-1">Se cambia desde Asignación de Equipos.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                  <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin de Garantía</label>
                  <input type="date" value={form.warrantyEnd} onChange={e => setForm({ ...form, warrantyEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium">
                {editingId ? 'Guardar Cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">¿Eliminar equipo?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={() => { deleteEquipment(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'equipo' : 'equipos'}
          {' · '}<span className="text-emerald-600 dark:text-emerald-400">{encendidos} encendido{encendidos !== 1 ? 's' : ''}</span>
          {' · '}{filtered.length - encendidos} apagado{filtered.length - encendidos !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={agrupar} onChange={e => cambiarAgrupar(e.target.checked)} className="rounded" />
            Agrupar por grupo
          </label>
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

      {grupos.map(([grupo, lista]) => (
        <section key={grupo || 'todos'} className="space-y-2">
          {grupo && (
            <h3 className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-1 text-sm font-semibold text-gray-700 dark:text-slate-200">
              {grupo}
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500">{lista.length} {lista.length === 1 ? 'equipo' : 'equipos'}</span>
            </h3>
          )}
          <div className={vista === 'columnas' ? 'grid items-start gap-2' : 'divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800'}
            style={vista === 'columnas' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' } : undefined}>
            {lista.map(eq => {
              const asignado = asignaciones.get(eq.id)?.usuarioNombre;
              const acciones = (
                <div className="flex shrink-0 gap-0.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => startEdit(eq)} title="Editar" className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-slate-700"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteConfirm(eq.id)} title="Eliminar" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700"><Trash2 size={14} /></button>
                </div>
              );

              if (vista === 'lista') {
                return (
                  <div key={eq.id} onClick={() => setDetalleId(eq.id)} title="Ver detalle"
                    className="flex items-center gap-3 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/60">
                    <IconoEquipo eq={eq} size={16} />
                    <p className="w-56 shrink-0 truncate text-sm font-medium text-gray-800 dark:text-slate-100" title={eq.name}>{eq.name}</p>
                    <p className="w-20 shrink-0 text-xs"><EstadoEquipo eq={eq} /></p>
                    <p className="hidden md:block w-52 shrink-0 truncate text-xs text-gray-500 dark:text-slate-400">
                      {eq.meshNodeId ? [eq.meshIp, eq.meshSo].filter(Boolean).join(' · ') : [typeLabels[eq.type], eq.brand, eq.model].filter(Boolean).join(' · ')}
                    </p>
                    <p className="hidden lg:block w-32 shrink-0 truncate font-mono text-xs text-gray-500 dark:text-slate-400">{eq.serialNumber || '—'}</p>
                    <p className="flex-1 min-w-0 truncate text-xs text-gray-600 dark:text-slate-300">
                      <User size={11} className="inline mr-1" />{asignado || 'Sin asignar'}
                    </p>
                    <span className={`hidden sm:inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[eq.status].color}`}>
                      {statusConfig[eq.status].label}
                    </span>
                    {acciones}
                  </div>
                );
              }

              return (
                <div key={eq.id} onClick={() => setDetalleId(eq.id)} title="Ver detalle"
                  className="group relative flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 cursor-pointer hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500/60">
                  <IconoEquipo eq={eq} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-slate-100" title={eq.name}>{eq.name}</p>
                    <p className="truncate text-xs"><EstadoEquipo eq={eq} /></p>
                    <p className="truncate text-xs text-gray-400 dark:text-slate-500" title={asignado}>{asignado || 'Sin asignar'}</p>
                  </div>
                  <div className="absolute right-1 top-1 hidden group-hover:flex">{acciones}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Monitor size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No se encontraron equipos</p>
        </div>
      )}

      {equipoDetalle && (
        <EquipoDetalle equipment={equipoDetalle} asignacion={asignaciones.get(equipoDetalle.id)}
          onMovimiento={cargarAsignaciones} onClose={() => setDetalleId(null)} />
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        title="Equipos"
        entityType="equipments"
        templateHeaders={['nombre', 'tipo', 'marca', 'modelo', 'serial', 'codigo', 'categoria']}
        mapping={{
          'nombre': 'name', 'name': 'name',
          'tipo': 'type', 'type': 'type',
          'marca': 'brand', 'brand': 'brand',
          'modelo': 'model', 'model': 'model',
          'serial': 'serialNumber', 'serialNumber': 'serialNumber',
          'codigo': 'assetTag', 'assetTag': 'assetTag',
          'categoria': 'category', 'category': 'category',
        }}
        validator={(row) => {
          if (!row.name) return 'Nombre es obligatorio';
          if (!row.brand) return 'Marca es obligatoria';
          return null;
        }}
      />
    </div>
  );
}
