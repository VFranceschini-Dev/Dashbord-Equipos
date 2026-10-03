import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Voucher } from '../types';
import {
  Plus, Search, Edit2, Trash2, X, FileText, DollarSign, Calendar, Building, CheckCircle, Clock, XCircle
} from 'lucide-react';

const typeConfig = {
  invoice: { label: 'Factura', color: 'bg-blue-100 text-blue-700' },
  receipt: { label: 'Recibo', color: 'bg-emerald-100 text-emerald-700' },
  order: { label: 'Orden de Compra', color: 'bg-purple-100 text-purple-700' },
  delivery: { label: 'Remito', color: 'bg-amber-100 text-amber-700' },
  return: { label: 'Nota de Crédito', color: 'bg-red-100 text-red-700' },
};

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> },
  approved: { label: 'Aprobado', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle size={12} /> },
  rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  processed: { label: 'Procesado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> },
};

export default function Vouchers() {
  const { vouchers, addVoucher, updateVoucher, deleteVoucher, suppliers } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyForm: Omit<Voucher, 'id'> = {
    number: '', type: 'invoice', supplierId: '', supplierName: '',
    date: new Date().toISOString().split('T')[0], amount: 0, currency: 'ARS',
    description: '', equipmentIds: [], status: 'pending', notes: '',
  };
  const [form, setForm] = useState<Omit<Voucher, 'id'>>(emptyForm);

  const filtered = vouchers.filter(v => {
    const matchSearch = v.number.toLowerCase().includes(search.toLowerCase()) ||
      v.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || v.type === filterType;
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);
  const pendingAmount = vouchers.filter(v => v.status === 'pending').reduce((sum, v) => sum + v.amount, 0);

  const handleSubmit = () => {
    if (!form.number || !form.supplierName) return;
    if (editingId) updateVoucher(editingId, form);
    else addVoucher(form);
    resetForm();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (v: Voucher) => {
    const { id, ...rest } = v;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setForm({ ...form, supplierId, supplierName: supplier?.name || '' });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Total Comprobantes</p>
          <p className="text-2xl font-bold">{vouchers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600">Monto Total</p>
          <p className="text-2xl font-bold text-emerald-700">${totalAmount.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
          <p className="text-xs text-amber-600">Monto Pendiente</p>
          <p className="text-2xl font-bold text-amber-700">${pendingAmount.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600">Procesados</p>
          <p className="text-2xl font-bold text-blue-700">{vouchers.filter(v => v.status === 'processed').length}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar comprobante..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 outline-none text-sm w-64" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los tipos</option>
            {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Todos los estados</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Nuevo Comprobante
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar Comprobante' : 'Nuevo Comprobante'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input type="text" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Ej: 0001-00000001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Voucher['type'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                  <select value={form.supplierId} onChange={e => handleSupplierChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="">Seleccionar proveedor...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as 'ARS' | 'USD' })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="ARS">ARS - Peso Argentino</option>
                    <option value="USD">USD - Dólar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Voucher['status'] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                  {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm resize-none" />
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
            <h3 className="font-semibold text-lg mb-2">¿Eliminar comprobante?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={() => { deleteVoucher(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(voucher => (
                <tr key={voucher.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-800">{voucher.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig[voucher.type].color}`}>
                      {typeConfig[voucher.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Building size={12} /> {voucher.supplierName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Calendar size={12} /> {new Date(voucher.date).toLocaleDateString('es-AR')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
                      <DollarSign size={12} /> {voucher.amount.toLocaleString('es-AR')} {voucher.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[voucher.status].color}`}>
                      {statusConfig[voucher.status].icon} {statusConfig[voucher.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(voucher)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteConfirm(voucher.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron comprobantes</p>
          </div>
        )}
      </div>
    </div>
  );
}
