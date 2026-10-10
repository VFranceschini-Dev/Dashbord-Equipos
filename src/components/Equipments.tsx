import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Equipment } from '../types';
import { EQUIPMENT_CATEGORIES } from '../data';
import {
  Plus, Search, Edit2, Trash2, X, Monitor, Laptop, Server,
  HardDrive, Mouse, Package, Tag, User, Upload
} from 'lucide-react';
import ImportModal from './ImportModal';
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

export default function Equipments() {
  const { equipments, addEquipment, updateEquipment, deleteEquipment, collaborators } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

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
    return matchSearch && matchType && matchCategory && matchStatus;
  });

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

  const getCollaboratorName = (id?: string) => {
    if (!id) return '-';
    const c = collaborators.find(c => c.id === id);
    return c ? `${c.name} ${c.lastName}` : 'Sin asignar';
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

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
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
        </div>
        <div className="flex gap-2">
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
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Equipment['status'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a Colaborador</label>
                  <select value={form.collaboratorId || ''} onChange={e => setForm({ ...form, collaboratorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="">Sin asignar</option>
                    {collaborators.map(c => <option key={c.id} value={c.id}>{c.name} {c.lastName}</option>)}
                  </select>
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Equipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Serial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Asignado a</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(eq => (
                <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 rounded text-blue-600">{typeIcons[eq.type]}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{eq.name}</p>
                        <p className="text-xs text-gray-400">{eq.brand} {eq.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{typeLabels[eq.type]}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      <Tag size={10} /> {eq.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{eq.serialNumber || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <User size={12} /> {getCollaboratorName(eq.collaboratorId)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[eq.status].color}`}>
                      {statusConfig[eq.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(eq)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteConfirm(eq.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Monitor size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron equipos</p>
          </div>
        )}
      </div>

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
