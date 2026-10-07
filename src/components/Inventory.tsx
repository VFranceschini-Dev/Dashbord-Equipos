import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TonerItem } from '../types';
import { groupTonersByCompatibility, getCompatibilityKey, getLowStockGroups } from '../utils/tonerCompatibility';
import {
  Plus, Search, Edit2, Trash2, X, AlertTriangle, Package, ArrowDownCircle, Upload
} from 'lucide-react';
import ImportModal from './ImportModal';
import { v4 as uuidv4 } from 'uuid';

const colorMap = {
  black: { bg: 'bg-gray-800', label: 'Negro', dot: 'bg-gray-800' },
  cyan: { bg: 'bg-cyan-500', label: 'Cian', dot: 'bg-cyan-500' },
  magenta: { bg: 'bg-pink-500', label: 'Magenta', dot: 'bg-pink-500' },
  yellow: { bg: 'bg-yellow-400', label: 'Amarillo', dot: 'bg-yellow-400' },
};

export default function Inventory() {
  const { toners, addToner, updateToner, deleteToner, addMovement } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showRestock, setShowRestock] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [showImport, setShowImport] = useState(false);

  const [form, setForm] = useState<Omit<TonerItem, 'id'>>({
    model: '', brand: '', color: 'black', stock: 0, minStock: 2, maxStock: 10,
    unitPrice: 0, supplier: '', lastRestock: '',
  });

  // Agrupar tóneres por compatibilidad
  const compatibilityGroups = groupTonersByCompatibility(toners);
  const lowStockGroups = getLowStockGroups(toners);
  
  // Crear un mapa de stock total por grupo de compatibilidad
  const stockByGroup = new Map<string, number>();
  compatibilityGroups.forEach(group => {
    const key = getCompatibilityKey(group.toners[0]);
    stockByGroup.set(key, group.totalStock);
  });

  const filtered = toners.filter(t =>
    t.model.toLowerCase().includes(search.toLowerCase()) ||
    t.brand.toLowerCase().includes(search.toLowerCase()) ||
    t.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.model || !form.brand) return;
    if (editingId) {
      updateToner(editingId, form);
    } else {
      addToner(form);
    }
    resetForm();
  };

  const resetForm = () => {
    setForm({ model: '', brand: '', color: 'black', stock: 0, minStock: 2, maxStock: 10, unitPrice: 0, supplier: '', lastRestock: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (t: TonerItem) => {
    setForm({ model: t.model, brand: t.brand, color: t.color, stock: t.stock, minStock: t.minStock, maxStock: t.maxStock, unitPrice: t.unitPrice, supplier: t.supplier, lastRestock: t.lastRestock });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleRestock = (tonerId: string) => {
    const toner = toners.find(t => t.id === tonerId);
    if (!toner) return;
    updateToner(tonerId, {
      stock: toner.stock + restockQty,
      lastRestock: new Date().toISOString().split('T')[0],
    });
    addMovement({
      type: 'restock',
      tonerId,
      tonerModel: toner.model,
      quantity: restockQty,
      date: new Date().toISOString().split('T')[0],
      user: 'Carlos Méndez',
      notes: 'Reposición de stock',
    });
    setShowRestock(null);
    setRestockQty(1);
  };

  const handleImport = (importedData: any[]) => {
    importedData.forEach(item => {
      addToner({
        ...item,
        id: uuidv4(),
        color: item.color || 'black',
        stock: parseInt(item.stock) || 0,
        minStock: parseInt(item.minStock) || 2,
        maxStock: parseInt(item.maxStock) || 10,
        unitPrice: parseFloat(item.unitPrice) || 0,
        lastRestock: item.lastRestock || new Date().toISOString().split('T')[0],
      } as TonerItem);
    });
    setShowImport(false);
  };

  const getStockStatus = (t: TonerItem) => {
    // Obtener el stock total del grupo de compatibilidad
    const key = getCompatibilityKey(t);
    const totalStock = stockByGroup.get(key) || t.stock;
    
    if (totalStock <= 0) return { label: 'Sin stock', color: 'bg-red-100 text-red-700' };
    if (totalStock <= t.minStock) return { label: 'Stock bajo', color: 'bg-amber-100 text-amber-700' };
    if (totalStock >= t.maxStock) return { label: 'Stock completo', color: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Normal', color: 'bg-blue-100 text-blue-700' };
  };

  const getStockPercentage = (t: TonerItem) => {
    // Usar el stock total del grupo de compatibilidad
    const key = getCompatibilityKey(t);
    const totalStock = stockByGroup.get(key) || t.stock;
    return Math.min((totalStock / t.maxStock) * 100, 100);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tóner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
          />
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
            Nuevo Tóner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Modelos Únicos</p>
          <p className="text-xl font-bold text-gray-800">{compatibilityGroups.length}</p>
          <p className="text-xs text-gray-400 mt-1">{toners.length} registros</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Unidades Totales</p>
          <p className="text-xl font-bold text-gray-800">{toners.reduce((s, t) => s + t.stock, 0)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Valor Inventario</p>
          <p className="text-xl font-bold text-gray-800">${toners.reduce((s, t) => s + t.stock * t.unitPrice, 0).toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
          <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
            <AlertTriangle size={12} /> Stock Bajo
          </p>
          <p className="text-xl font-bold text-amber-700">{lowStockGroups.length}</p>
          <p className="text-xs text-amber-600 mt-1">modelos compatibles</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Tóner' : 'Nuevo Tóner'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    placeholder="Ej: CF258A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    placeholder="Ej: HP"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <select
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value as TonerItem['color'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  >
                    <option value="black">Negro</option>
                    <option value="cyan">Cian</option>
                    <option value="magenta">Magenta</option>
                    <option value="yellow">Amarillo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Máximo</label>
                  <input
                    type="number"
                    value={form.maxStock}
                    onChange={e => setForm({ ...form, maxStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unitario ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={form.supplier}
                    onChange={e => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    placeholder="Nombre del proveedor"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Última Reposición</label>
                <input
                  type="date"
                  value={form.lastRestock}
                  onChange={e => setForm({ ...form, lastRestock: e.target.value })}
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

      {showRestock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">Reponer Stock</h3>
            <p className="text-sm text-gray-500 mb-4">
              Tóner: {toners.find(t => t.id === showRestock)?.model}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a agregar</label>
              <input
                type="number"
                min={1}
                value={restockQty}
                onChange={e => setRestockQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRestock(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleRestock(showRestock)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 font-medium">Reponer</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">¿Eliminar tóner?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => { deleteToner(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Modelo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Color</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(toner => {
                const status = getStockStatus(toner);
                const pct = getStockPercentage(toner);
                return (
                  <tr key={toner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{toner.model}</p>
                        <p className="text-xs text-gray-400">{toner.brand}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${colorMap[toner.color].dot}`} />
                        <span className="text-sm text-gray-600">{colorMap[toner.color].label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">
                            {stockByGroup.get(getCompatibilityKey(toner)) || toner.stock}
                          </span>
                          <span className="text-xs text-gray-400">/ {toner.maxStock}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Total compatible ({toner.brand} {toner.model})
                        </div>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                          <div
                            className={`h-full rounded-full ${
                              pct <= 25 ? 'bg-red-500' : pct <= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">${toner.unitPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{toner.supplier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setShowRestock(toner.id); setRestockQty(1); }}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                          title="Reponer stock"
                        >
                          <ArrowDownCircle size={16} />
                        </button>
                        <button onClick={() => startEdit(toner)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm(toner.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron tóner</p>
          </div>
        )}
      </div>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        title="Tóner"
        entityType="toners"
        templateHeaders={['modelo', 'marca', 'color', 'stock', 'minStock', 'maxStock', 'precio', 'proveedor']}
        mapping={{
          'modelo': 'model', 'model': 'model',
          'marca': 'brand', 'brand': 'brand',
          'color': 'color',
          'stock': 'stock',
          'minStock': 'minStock',
          'maxStock': 'maxStock',
          'precio': 'unitPrice', 'unitPrice': 'unitPrice',
          'proveedor': 'supplier', 'supplier': 'supplier',
        }}
        validator={(row) => {
          if (!row.model) return 'Modelo es obligatorio';
          if (!row.brand) return 'Marca es obligatoria';
          if (!row.color) return 'Color es obligatorio';
          return null;
        }}
      />
    </div>
  );
}
