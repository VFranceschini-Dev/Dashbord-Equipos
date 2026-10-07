import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Printer as PrinterType } from '../types';
import {
  Plus, Search, Edit2, Trash2, X, CheckCircle, AlertCircle, Wrench, MapPin, Building, FileText, Printer as PrinterIcon, Upload
} from 'lucide-react';
import ImportModal from './ImportModal';
import { v4 as uuidv4 } from 'uuid';

export default function Printers() {
  const { printers, addPrinter, updatePrinter, deletePrinter } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'maintenance'>('all');
  const [showImport, setShowImport] = useState(false);

  const [form, setForm] = useState<Omit<PrinterType, 'id'>>({
    name: '', location: '', department: '', model: '', status: 'active',
    tonerModel: '', lastMaintenance: '', totalPages: 0,
  });

  const filtered = printers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleImport = (importedData: any[]) => {
    importedData.forEach(item => {
      // Normalizar el estado
      let status: 'active' | 'inactive' | 'maintenance' = 'active';
      const statusValue = (item.status || '').toString().toLowerCase().trim();
      
      if (statusValue === 'inactive' || statusValue === 'inactiva' || statusValue === 'inactivo') {
        status = 'inactive';
      } else if (statusValue === 'maintenance' || statusValue === 'mantenimiento') {
        status = 'maintenance';
      } else {
        status = 'active';
      }
      
      addPrinter({
        ...item,
        id: uuidv4(),
        name: item.name || '',
        model: item.model || '',
        location: item.location || '',
        department: item.department || '',
        tonerModel: item.tonerModel || '',
        status: status,
        lastMaintenance: item.lastMaintenance || new Date().toISOString().split('T')[0],
        totalPages: parseInt(item.totalPages) || 0,
      } as PrinterType);
    });
    setShowImport(false);
  };

  const handleSubmit = () => {
    if (!form.name || !form.model) return;
    if (editingId) {
      updatePrinter(editingId, form);
    } else {
      addPrinter(form);
    }
    resetForm();
  };

  const resetForm = () => {
    setForm({ name: '', location: '', department: '', model: '', status: 'active', tonerModel: '', lastMaintenance: '', totalPages: 0 });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (p: PrinterType) => {
    setForm({ name: p.name, location: p.location, department: p.department, model: p.model, status: p.status, tonerModel: p.tonerModel, lastMaintenance: p.lastMaintenance, totalPages: p.totalPages });
    setEditingId(p.id);
    setShowForm(true);
  };

  const statusConfig = {
    active: { icon: <CheckCircle size={16} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Activa' },
    inactive: { icon: <AlertCircle size={16} />, color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Inactiva' },
    maintenance: { icon: <Wrench size={16} />, color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Mantenimiento' },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'active', 'inactive', 'maintenance'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : f === 'inactive' ? 'Inactivas' : 'Mantenimiento'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Upload size={16} />
            Importar
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nueva Impresora
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, modelo o departamento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Impresora' : 'Nueva Impresora'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  placeholder="Ej: HP LaserJet Pro M404"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de Tóner</label>
                  <input
                    type="text"
                    value={form.tonerModel}
                    onChange={e => setForm({ ...form, tonerModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    placeholder="Ej: CF258A"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as PrinterType['status'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                    <option value="maintenance">En Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Páginas Totales</label>
                  <input
                    type="number"
                    value={form.totalPages}
                    onChange={e => setForm({ ...form, totalPages: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Último Mantenimiento</label>
                <input
                  type="date"
                  value={form.lastMaintenance}
                  onChange={e => setForm({ ...form, lastMaintenance: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
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
            <h3 className="font-semibold text-lg mb-2">¿Eliminar impresora?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => { deletePrinter(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(printer => (
          <div key={printer.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{printer.name}</h3>
                <p className="text-xs text-gray-400">{printer.model}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[printer.status].color}`}>
                {statusConfig[printer.status].icon}
                {statusConfig[printer.status].label}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400" />
                <span className="truncate">{printer.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building size={14} className="text-gray-400" />
                <span>{printer.department}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText size={14} className="text-gray-400" />
                <span>Tóner: {printer.tonerModel}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-600">{printer.totalPages.toLocaleString()}</span> páginas
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(printer)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => setDeleteConfirm(printer.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <PrinterIcon size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No se encontraron impresoras</p>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        title="Impresoras"
        templateHeaders={['nombre', 'modelo', 'ubicacion', 'departamento', 'toner', 'estado', 'paginas']}
        mapping={{
          // Nombre
          'nombre': 'name',
          'name': 'name',
          'nombre impresora': 'name',
          'printer name': 'name',
          'impresora': 'name',
          
          // Modelo
          'modelo': 'model',
          'model': 'model',
          'modelo impresora': 'model',
          'printer model': 'model',
          'marca modelo': 'model',
          
          // Ubicación
          'ubicacion': 'location',
          'ubicación': 'location',
          'location': 'location',
          'ubicación impresora': 'location',
          'lugar': 'location',
          'posicion': 'location',
          'posición': 'location',
          
          // Departamento
          'departamento': 'department',
          'department': 'department',
          'area': 'department',
          'área': 'department',
          'sector': 'department',
          
          // Modelo de Tóner
          'toner': 'tonerModel',
          'toner model': 'tonerModel',
          'modelo toner': 'tonerModel',
          'modelo de toner': 'tonerModel',
          'tonerModel': 'tonerModel',
          'cartucho': 'tonerModel',
          'tipo toner': 'tonerModel',
          
          // Estado
          'estado': 'status',
          'status': 'status',
          'state': 'status',
          'activo': 'status',
          'active': 'status',
          
          // Páginas
          'paginas': 'totalPages',
          'páginas': 'totalPages',
          'total pages': 'totalPages',
          'total paginas': 'totalPages',
          'total páginas': 'totalPages',
          'pages': 'totalPages',
        }}
        validator={(row) => {
          if (!row.name || row.name.trim() === '') return 'Nombre es obligatorio';
          if (!row.model || row.model.trim() === '') return 'Modelo es obligatorio';
          return null;
        }}
      />
    </div>
  );
}
