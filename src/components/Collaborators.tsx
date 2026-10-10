import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Collaborator } from '../types';
import { DEPARTMENTS } from '../data';
import {
  Plus, Search, Edit2, Trash2, X, Users, Mail, Phone, Building, Briefcase, Calendar, CheckCircle, XCircle, Monitor, Upload
} from 'lucide-react';
import ImportModal from './ImportModal';
import { v4 as uuidv4 } from 'uuid';

export default function Collaborators() {
  const { collaborators, addCollaborator, updateCollaborator, deleteCollaborator, equipments } = useApp();
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const emptyForm: Omit<Collaborator, 'id'> = {
    name: '', lastName: '', dni: '', email: '', phone: '',
    department: 'IT', position: '', active: true, equipmentCount: 0,
    joinDate: '', notes: '',
  };
  const [form, setForm] = useState<Omit<Collaborator, 'id'>>(emptyForm);

  const filtered = collaborators.filter(c => {
    const matchSearch = `${c.name} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.dni.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDepartment === 'all' || c.department === filterDepartment;
    return matchSearch && matchDept;
  });

  const getEquipmentCount = (collabId: string) => equipments.filter(e => e.collaboratorId === collabId).length;

  const handleImport = (importedData: any[]) => {
    importedData.forEach(item => {
      addCollaborator({
        ...item,
        id: uuidv4(),
        active: item.active !== false,
        equipmentCount: 0,
        joinDate: item.joinDate || new Date().toISOString().split('T')[0],
        notes: item.notes || '',
      } as Collaborator);
    });
    setShowImport(false);
  };

  const handleSubmit = () => {
    if (!form.name || !form.lastName) return;
    if (editingId) updateCollaborator(editingId, form);
    else addCollaborator(form);
    resetForm();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (c: Collaborator) => {
    const { id, ...rest } = c;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 outline-none text-sm w-64" />
          </div>
          <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los departamentos</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Upload size={16} /> Importar
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> Nuevo Colaborador
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Total Colaboradores</p>
          <p className="text-2xl font-bold">{collaborators.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600">Activos</p>
          <p className="text-2xl font-bold text-emerald-700">{collaborators.filter(c => c.active).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600">Equipos Asignados</p>
          <p className="text-2xl font-bold text-blue-700">{equipments.filter(e => e.status === 'assigned').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Departamentos</p>
          <p className="text-2xl font-bold">{new Set(collaborators.map(c => c.department)).size}</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Colaborador' : 'Nuevo Colaborador'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input type="text" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input type="text" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                  <input type="date" value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300" />
                <label htmlFor="active" className="text-sm text-gray-700">Colaborador activo</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium">
                {editingId ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">¿Eliminar colaborador?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={() => { deleteCollaborator(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(collab => {
          const eqCount = getEquipmentCount(collab.id);
          return (
            <div key={collab.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {collab.name.charAt(0)}{collab.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{collab.name} {collab.lastName}</h3>
                    <p className="text-xs text-gray-400">{collab.position || 'Sin cargo'}</p>
                  </div>
                </div>
                {collab.active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                    <CheckCircle size={10} /> Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    <XCircle size={10} /> Inactivo
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600 flex items-center gap-2"><Building size={14} className="text-gray-400" /> {collab.department}</p>
                {collab.email && <p className="text-sm text-gray-600 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {collab.email}</p>}
                {collab.phone && <p className="text-sm text-gray-600 flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {collab.phone}</p>}
                {collab.dni && <p className="text-sm text-gray-600 flex items-center gap-2"><Briefcase size={14} className="text-gray-400" /> DNI: {collab.dni}</p>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                    <Monitor size={10} /> {eqCount} equipo{eqCount !== 1 ? 's' : ''}
                  </span>
                  {collab.joinDate && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> {new Date(collab.joinDate).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(collab)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteConfirm(collab.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No se encontraron colaboradores</p>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        title="Colaboradores"
        entityType="collaborators"
        templateHeaders={['nombre', 'apellido', 'dni', 'email', 'telefono', 'departamento', 'cargo']}
        mapping={{
          'nombre': 'name', 'name': 'name',
          'apellido': 'lastName', 'lastName': 'lastName',
          'dni': 'dni',
          'email': 'email',
          'telefono': 'phone', 'phone': 'phone',
          'departamento': 'department', 'department': 'department',
          'cargo': 'position', 'position': 'position',
        }}
        validator={(row) => {
          if (!row.name) return 'Nombre es obligatorio';
          if (!row.lastName) return 'Apellido es obligatorio';
          return null;
        }}
      />
    </div>
  );
}
