import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ModuleSyncControls from './ModuleSyncControls';
import { TonerItem, Printer } from '../types';
import { TONER_COLORS, INVENTORY_CATEGORIES } from '../data';
import { getLowStockGroups, isTonerCompatibleWithPrinter } from '../utils/tonerCompatibility';
import {
  Plus, Search, Edit2, Trash2, X, Package, AlertTriangle, CheckCircle, DollarSign, TrendingUp, Filter, Loader2
} from 'lucide-react';
import ImportModal from './ImportModal';
import { v4 as uuidv4 } from 'uuid';

const colorMap: Record<string, string> = {
  black: 'bg-gray-900', cyan: 'bg-cyan-400', magenta: 'bg-pink-500', yellow: 'bg-yellow-400',
};

export default function Inventory() {
  const { toners, addToner, updateToner, deleteToner, addMovement, printers, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const emptyForm: Omit<TonerItem, 'id'> = {
    model: '', brand: '', color: 'black', stock: 0, minStock: 5, maxStock: 50,
    unitPrice: 0, supplier: '', lastRestock: new Date().toISOString().split('T')[0],
    compatiblePrinters: [], category: 'Cartucho',
  };
  const [form, setForm] = useState<Omit<TonerItem, 'id'>>(emptyForm);

  // --- Compatibilidad por código del tóner ---
  // Normaliza un texto para comparar códigos/modelos sin distinguir mayúsculas,
  // con espacios o tildes (ej. "CF210X" = "cf210 x", "Hermanos" = "hermanos").
  const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');

  // Devuelve las impresoras compatibles con un tóner: las listadas en su campo
  // compatiblePrinters (por nombre o id) más las detectadas automáticamente por
  // el código del cartucho vs el modelo/tonerModel de cada impresora.
  const getCompatiblePrinters = (toner: TonerItem): Printer[] => {
    const byCode = printers.filter(p => isTonerCompatibleWithPrinter(toner, p));
    const manualNames = new Set((toner.compatiblePrinters || []).map(normalize));
    const byManual = printers.filter(p => manualNames.has(normalize(p.name)) || manualNames.has(normalize(p.id)));
    const seen = new Set<string>();
    return [...byCode, ...byManual].filter(p => !seen.has(p.id) && seen.add(p.id) !== undefined);
  };

  const filtered = toners.filter(t => {
    const matchSearch = t.model.toLowerCase().includes(search.toLowerCase()) ||
      t.brand.toLowerCase().includes(search.toLowerCase()) ||
      t.supplier.toLowerCase().includes(search.toLowerCase());
    const matchColor = filterColor === 'all' || t.color === filterColor;
    const matchCategory = filterCategory === 'all' || t.category === filterCategory;
    const isLow = t.stock <= t.minStock;
    const matchStock = filterStock === 'all' || (filterStock === 'low' ? isLow : !isLow);
    return matchSearch && matchColor && matchCategory && matchStock;
  });

  const lowStockGroups = getLowStockGroups(toners);
  const totalStock = toners.reduce((sum, t) => sum + t.stock, 0);
  const totalValue = toners.reduce((sum, t) => sum + t.stock * t.unitPrice, 0);
  const uniqueModels = new Set(toners.map(t => t.model)).size;

  const handleSubmit = () => {
    if (!form.model || !form.brand) return;
    if (editingId) updateToner(editingId, form);
    else addToner(form);
    resetForm();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (toner: TonerItem) => {
    const { id, ...rest } = toner;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  };

  const handleQuickDelivery = (toner: TonerItem) => {
    const qty = prompt(`¿Cantidad de "${toner.model}" a entregar?`);
    if (qty && parseInt(qty) > 0) {
      const quantity = parseInt(qty);
      if (quantity > toner.stock) {
        alert('No hay suficiente stock disponible.');
        return;
      }
      updateToner(toner.id, { stock: toner.stock - quantity });
      addMovement({
        type: 'delivery', tonerId: toner.id, tonerModel: toner.model,
        quantity, date: new Date().toISOString(), user: 'admin', notes: 'Entrega rápida',
      });
    }
  };

  const handleQuickRestock = (toner: TonerItem) => {
    const qty = prompt(`¿Cantidad de "${toner.model}" a reponer?`);
    if (qty && parseInt(qty) > 0) {
      const quantity = parseInt(qty);
      updateToner(toner.id, { stock: toner.stock + quantity, lastRestock: new Date().toISOString().split('T')[0] });
      addMovement({
        type: 'restock', tonerId: toner.id, tonerModel: toner.model,
        quantity, date: new Date().toISOString(), user: 'admin', notes: 'Reposición rápida',
      });
    }
  };

  const togglePrinterCompatibility = (printerName: string) => {
    setForm(prev => ({
      ...prev,
      compatiblePrinters: prev.compatiblePrinters?.includes(printerName)
        ? prev.compatiblePrinters.filter(name => name !== printerName)
        : [...(prev.compatiblePrinters || []), printerName],
    }));
  };

  return (
    <div className="space-y-5">
      <ModuleSyncControls module="toners" />
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar tóner..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 outline-none text-sm w-64" />
          </div>
          <select value={filterColor} onChange={e => setFilterColor(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los colores</option>
            {TONER_COLORS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todas las categorías</option>
            {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todo el stock</option>
            <option value="low">Stock bajo</option>
            <option value="ok">Stock normal</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> Importar
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> Nuevo Tóner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Modelos Únicos</p>
          <p className="text-2xl font-bold">{uniqueModels}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600">Unidades Totales</p>
          <p className="text-2xl font-bold text-emerald-700">{totalStock}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600">Valor Inventario</p>
          <p className="text-2xl font-bold text-blue-700">${totalValue.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
          <p className="text-xs text-red-600">Stock Bajo</p>
          <p className="text-2xl font-bold text-red-700">{lowStockGroups.length}</p>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Tóner' : 'Nuevo Tóner'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código / Modelo *</label>
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: CF210X" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                  <input type="text" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: HP" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value as TonerItem['color'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {TONER_COLORS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as TonerItem['category'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mínimo</label>
                  <input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Máximo</label>
                  <input type="number" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unitario</label>
                  <input type="number" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>

              {/* Selección de impresoras compatibles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Impresoras Compatibles</label>
                {printers.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay impresoras registradas.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {printers.map(printer => (
                      <label key={printer.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.compatiblePrinters?.includes(printer.name) || false}
                          onChange={() => togglePrinterCompatibility(printer.name)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{printer.name}</span>
                        <span className="text-xs text-gray-400">({printer.model})</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Se detectan automáticamente por código; acá podés ajustar la lista manualmente.
                </p>
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

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">¿Eliminar tóner?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={() => { deleteToner(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Color</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Compatibles</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(toner => {
                const isLow = toner.stock <= toner.minStock;
                const compat = getCompatiblePrinters(toner);
                return (
                  <tr key={toner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${colorMap[toner.color]}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{toner.model}</p>
                          <p className="text-xs text-gray-400">{toner.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {toner.color}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                          {toner.stock} u.
                        </span>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <AlertTriangle size={10} /> Bajo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min((toner.stock / toner.maxStock) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {compat.length > 0 ? (
                        <div className="space-y-1">
                          {compat.map(p => (
                            <span key={p.id} title={`${p.location}${p.department ? ' · ' + p.department : ''}`}
                              className="inline-flex items-center gap-1 mr-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sin coincidencias</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800">${toner.unitPrice.toLocaleString('es-AR')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{toner.supplier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleQuickDelivery(toner)} title="Entregar"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><TrendingUp size={16} /></button>
                        <button onClick={() => handleQuickRestock(toner)} title="Reponer"
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><Package size={16} /></button>
                        <button onClick={() => startEdit(toner)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={16} /></button>
                        <button onClick={() => setDeleteConfirm(toner.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
        dataLoading.global || dataLoading.module === 'toners' ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="mx-auto animate-spin text-blue-500 mb-3" />
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron tóners</p>
          </div>
        )
      )}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={(data) => {
          data.forEach(item => addToner({ ...item, id: uuidv4() }));
          setShowImport(false);
        }}
        title="Tóners"
        entityType="toners"
        templateHeaders={['codigo', 'marca', 'color', 'stock', 'minimo', 'maximo', 'precio']}
        mapping={{
          'codigo': 'model', 'model': 'model', 'modelo': 'model',
          'marca': 'brand', 'brand': 'brand',
          'color': 'color',
          'stock': 'stock',
          'minimo': 'minStock', 'min_stock': 'minStock',
          'maximo': 'maxStock', 'max_stock': 'maxStock',
          'precio': 'unitPrice', 'price': 'unitPrice',
          'proveedor': 'supplier', 'supplier': 'supplier',
        }}
        validator={(row) => {
          if (!row.model) return 'El código es obligatorio';
          if (!row.brand) return 'La marca es obligatoria';
          return null;
        }}
      />
    </div>
  );
}