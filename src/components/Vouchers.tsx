import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import ModuleSyncControls from './ModuleSyncControls';
import { Voucher } from '../types';
import { subirArchivoFactura, enlaceArchivoFactura, borrarArchivoFactura, problemaArchivo } from '../services/facturas';
import {
  Plus, Search, Edit2, Trash2, X, FileText, DollarSign, Calendar, Building, CheckCircle, Clock, XCircle, Loader2,
  Paperclip, Mail
} from 'lucide-react';

const LETRAS = ['A', 'B', 'C', 'M', 'E'];

/** "A 0002-00000123" a partir de letra, punto de venta y número. */
export function numeroFactura(v: Pick<Voucher, 'letra' | 'puntoVenta' | 'number'>): string {
  const pv = v.puntoVenta ? `${v.puntoVenta.padStart(4, '0')}-` : '';
  return [v.letra, `${pv}${v.number}`].filter(Boolean).join(' ');
}

const pesos = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

/** Facturas de proveedores (pestaña de Proveedores). */
export default function Vouchers() {
  const { vouchers, addVoucher, updateVoucher, deleteVoucher, suppliers, dataLoading} = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterOrigen, setFilterOrigen] = useState<string>('all');
  const { user } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm: Omit<Voucher, 'id'> = {
    number: '', type: 'invoice', supplierId: '', supplierName: '',
    date: new Date().toISOString().split('T')[0], amount: 0, currency: 'ARS',
    description: '', equipmentIds: [], status: 'pending', notes: '',
    letra: '', puntoVenta: '', cuitEmisor: '', cae: '', caeVencimiento: '',
    neto: null, iva: null, vencimientoPago: '',
  };
  const [form, setForm] = useState<Omit<Voucher, 'id'>>(emptyForm);

  const filtered = vouchers.filter(v => {
    const texto = [numeroFactura(v), v.supplierName, v.description, v.cuitEmisor, v.cae].filter(Boolean).join(' ').toLowerCase();
    const matchSearch = texto.includes(search.toLowerCase());
    const matchType = filterType === 'all' || v.type === filterType;
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchOrigen = filterOrigen === 'all' || (v.origen ?? 'manual') === filterOrigen;
    return matchSearch && matchType && matchStatus && matchOrigen;
  });

  const totalAmountARS = vouchers.filter(v => v.currency === 'ARS').reduce((sum, v) => sum + v.amount, 0);
  const totalAmountUSD = vouchers.filter(v => v.currency === 'USD').reduce((sum, v) => sum + v.amount, 0);
  const pendingAmountARS = vouchers.filter(v => v.status === 'pending' && v.currency === 'ARS').reduce((sum, v) => sum + v.amount, 0);
  const pendingAmountUSD = vouchers.filter(v => v.status === 'pending' && v.currency === 'USD').reduce((sum, v) => sum + v.amount, 0);

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.number.trim() || !form.supplierName) { setFormError('Completá el número y el proveedor.'); return; }
    const cuit = (form.cuitEmisor || '').replace(/\D/g, '');
    if (cuit && cuit.length !== 11) { setFormError('El CUIT del emisor tiene que tener 11 números.'); return; }
    if (archivo) {
      const problema = problemaArchivo(archivo);
      if (problema) { setFormError(problema); return; }
    }
    setGuardando(true);
    try {
      const anterior = editingId ? vouchers.find(v => v.id === editingId)?.archivoPath : undefined;
      let datos: Omit<Voucher, 'id'> = { ...form, cuitEmisor: cuit };
      if (archivo) {
        const subido = await subirArchivoFactura(archivo);
        datos = { ...datos, archivoPath: subido.path, archivoNombre: subido.nombre };
      } else if (quitarArchivo) {
        datos = { ...datos, archivoPath: '', archivoNombre: '' };
      }
      if (!editingId) datos = { ...datos, cargadaPor: user?.email || '' };
      const ok = editingId ? await updateVoucher(editingId, datos) : await addVoucher(datos);
      if (!ok) {
        // Si no se guardó, el archivo recién subido no queda huérfano
        if (archivo && datos.archivoPath) await borrarArchivoFactura(datos.archivoPath);
        setFormError('No se pudo guardar la factura. Si ya existe otra con el mismo CUIT, letra, punto de venta y número, no se puede repetir.');
        return;
      }
      if (anterior && (archivo || quitarArchivo)) await borrarArchivoFactura(anterior);
      resetForm();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
    setArchivo(null);
    setQuitarArchivo(false);
    setFormError(null);
  };

  const startEdit = (v: Voucher) => {
    const { id, ...rest } = v;
    setForm({ ...emptyForm, ...rest });
    setEditingId(id);
    setArchivo(null);
    setQuitarArchivo(false);
    setFormError(null);
    setShowForm(true);
  };

  const verArchivo = async (path: string) => {
    try { window.open(await enlaceArchivoFactura(path), '_blank', 'noopener'); } catch (err) { alert((err as Error).message); }
  };

  const eliminar = async (id: string) => {
    const path = vouchers.find(v => v.id === id)?.archivoPath;
    if (await deleteVoucher(id) && path) await borrarArchivoFactura(path);
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    // El CUIT del emisor se completa con el del proveedor (si no se cargó otro)
    setForm({ ...form, supplierId, supplierName: supplier?.name || '', cuitEmisor: form.cuitEmisor || supplier?.cuit || '' });
  };

  return (
    <div className="space-y-5">
      <ModuleSyncControls module="vouchers" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Total facturas</p>
          <p className="text-2xl font-bold">{vouchers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600">Monto Total (ARS / USD)</p>
          <p className="text-2xl font-bold text-emerald-700">${totalAmountARS.toLocaleString('es-AR')} / USD ${totalAmountUSD.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
          <p className="text-xs text-amber-600">Monto Pendiente (ARS / USD)</p>
          <p className="text-2xl font-bold text-amber-700">${pendingAmountARS.toLocaleString('es-AR')} / USD ${pendingAmountUSD.toLocaleString('es-AR')}</p>
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
            <input type="text" placeholder="Buscar factura, proveedor o CUIT..." value={search} onChange={e => setSearch(e.target.value)}
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
          <select value={filterOrigen} onChange={e => setFilterOrigen(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">Manual y automática</option>
            <option value="manual">Carga manual</option>
            <option value="zammad">Automática (email)</option>
          </select>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Nueva factura
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{editingId ? 'Editar factura' : 'Nueva factura'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                  <select value={form.supplierId} onChange={e => handleSupplierChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="">Seleccionar proveedor...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CUIT del emisor</label>
                  <input type="text" inputMode="numeric" value={form.cuitEmisor ?? ''} placeholder="11 números"
                    onChange={e => setForm({ ...form, cuitEmisor: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Voucher['type'] })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Letra</label>
                  <select value={form.letra ?? ''} onChange={e => setForm({ ...form, letra: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="">—</option>
                    {LETRAS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Punto de venta</label>
                  <input type="text" inputMode="numeric" value={form.puntoVenta ?? ''} placeholder="0001"
                    onChange={e => setForm({ ...form, puntoVenta: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input type="text" value={form.number} placeholder="00000123"
                    onChange={e => setForm({ ...form, number: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de emisión</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento del pago</label>
                  <input type="date" value={form.vencimientoPago ?? ''} onChange={e => setForm({ ...form, vencimientoPago: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neto</label>
                  <input type="number" step="0.01" value={form.neto ?? ''}
                    onChange={e => setForm({ ...form, neto: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IVA</label>
                  <input type="number" step="0.01" value={form.iva ?? ''}
                    onChange={e => setForm({ ...form, iva: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                  <input type="number" step="0.01" value={form.amount}
                    onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                  {(form.neto != null || form.iva != null) && Math.abs((form.neto ?? 0) + (form.iva ?? 0) - form.amount) > 0.01 && (
                    <button type="button" onClick={() => setForm({ ...form, amount: Math.round(((form.neto ?? 0) + (form.iva ?? 0)) * 100) / 100 })}
                      className="text-[11px] text-blue-600 hover:underline mt-0.5">Usar neto + IVA</button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as 'ARS' | 'USD' })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAE</label>
                  <input type="text" inputMode="numeric" value={form.cae ?? ''} onChange={e => setForm({ ...form, cae: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento CAE</label>
                  <input type="date" value={form.caeVencimiento ?? ''} onChange={e => setForm({ ...form, caeVencimiento: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Voucher['status'] })} className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
                  {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivo de la factura (PDF o imagen)</label>
                {form.archivoPath && !quitarArchivo && !archivo ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                    <button type="button" onClick={() => verArchivo(form.archivoPath!)} className="flex items-center gap-1.5 text-blue-600 hover:underline truncate">
                      <Paperclip size={14} /> {form.archivoNombre || 'Ver archivo'}
                    </button>
                    <button type="button" onClick={() => setQuitarArchivo(true)} className="text-xs text-red-600 hover:underline shrink-0">Quitar</button>
                  </div>
                ) : (
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={e => { setArchivo(e.target.files?.[0] ?? null); setFormError(null); }}
                    className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
                )}
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
              {formError && <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700">{formError}</div>}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={handleSubmit} disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium disabled:opacity-60">
                {guardando && <Loader2 size={14} className="animate-spin" />} {editingId ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">¿Eliminar factura?</h3>
            <p className="text-sm text-gray-500 mb-4">Se elimina también su archivo adjunto. Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancelar</button>
              <button onClick={() => { eliminar(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
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
                      <div>
                        <span className="text-sm font-medium text-gray-800">{numeroFactura(voucher)}</span>
                        {voucher.origen === 'zammad' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700" title="Cargada automáticamente desde el email">
                            <Mail size={10} /> Email
                          </span>
                        )}
                        {voucher.cuitEmisor && <p className="text-[11px] text-gray-400">CUIT {voucher.cuitEmisor}</p>}
                      </div>
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
                      <Calendar size={12} /> {voucher.date ? new Date(`${voucher.date}T12:00:00`).toLocaleDateString('es-AR') : '—'}
                    </span>
                    {voucher.vencimientoPago && (
                      <p className="text-[11px] text-gray-400">Vence {new Date(`${voucher.vencimientoPago}T12:00:00`).toLocaleDateString('es-AR')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
                      <DollarSign size={12} /> {pesos(voucher.amount)} {voucher.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[voucher.status].color}`}>
                      {statusConfig[voucher.status].icon} {statusConfig[voucher.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {voucher.archivoPath && (
                        <button onClick={() => verArchivo(voucher.archivoPath!)} title={voucher.archivoNombre || 'Ver archivo'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Paperclip size={16} /></button>
                      )}
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
        dataLoading.global || dataLoading.module === 'vouchers' ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="mx-auto animate-spin text-blue-500 mb-3" />
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        ) : (

          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron facturas</p>
          </div>
        )
      )}
      </div>
    </div>
  );
}