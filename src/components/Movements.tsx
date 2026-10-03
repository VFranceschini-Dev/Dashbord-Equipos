import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Movement } from '../types';
import {
  Plus, Search, X, CheckCircle, Package, ArrowLeftRight, Trash2, Filter, Calendar
} from 'lucide-react';

const typeConfig = {
  delivery: { icon: <CheckCircle size={16} />, label: 'Entrega', color: 'bg-blue-100 text-blue-700' },
  restock: { icon: <Package size={16} />, label: 'Reposición', color: 'bg-emerald-100 text-emerald-700' },
  return: { icon: <ArrowLeftRight size={16} />, label: 'Devolución', color: 'bg-amber-100 text-amber-700' },
  disposal: { icon: <Trash2 size={16} />, label: 'Desecho', color: 'bg-red-100 text-red-700' },
};

export default function Movements() {
  const { movements, addMovement, toners, printers, updateToner } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | Movement['type']>('all');
  const [showForm, setShowForm] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const [form, setForm] = useState<Omit<Movement, 'id'>>({
    type: 'delivery',
    tonerId: '',
    tonerModel: '',
    printerId: '',
    printerName: '',
    quantity: 1,
    date: new Date().toISOString().split('T')[0],
    user: 'Carlos Méndez',
    notes: '',
  });

  const filtered = movements.filter(m => {
    const matchesSearch = m.tonerModel.toLowerCase().includes(search.toLowerCase()) ||
      m.user.toLowerCase().includes(search.toLowerCase()) ||
      m.notes.toLowerCase().includes(search.toLowerCase()) ||
      (m.printerName && m.printerName.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'all' || m.type === filterType;
    const matchesDate = !dateFilter || m.date === dateFilter;
    return matchesSearch && matchesType && matchesDate;
  });

  const handleSubmit = () => {
    if (!form.tonerModel || form.quantity <= 0) return;
    addMovement(form);

    if (form.tonerId) {
      const toner = toners.find(t => t.id === form.tonerId);
      if (toner) {
        const newStock = form.type === 'restock' || form.type === 'return'
          ? toner.stock + form.quantity
          : toner.stock - form.quantity;
        updateToner(form.tonerId, { stock: Math.max(0, newStock) });
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setForm({
      type: 'delivery',
      tonerId: '',
      tonerModel: '',
      printerId: '',
      printerName: '',
      quantity: 1,
      date: new Date().toISOString().split('T')[0],
      user: 'Carlos Méndez',
      notes: '',
    });
    setShowForm(false);
  };

  const handleTonerSelect = (tonerId: string) => {
    const toner = toners.find(t => t.id === tonerId);
    if (toner) {
      setForm({ ...form, tonerId, tonerModel: toner.model });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          {(['all', 'delivery', 'restock', 'return', 'disposal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Todos' : typeConfig[f].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={16} />
          Nuevo Movimiento
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por modelo, usuario, impresora..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
          />
        </div>
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Nuevo Movimiento</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimiento</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as Movement['type'] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                >
                  <option value="delivery">Entrega a impresora</option>
                  <option value="restock">Reposición de stock</option>
                  <option value="return">Devolución</option>
                  <option value="disposal">Desecho</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tóner</label>
                <select
                  value={form.tonerId}
                  onChange={e => handleTonerSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                >
                  <option value="">Seleccionar tóner...</option>
                  {toners.map(t => (
                    <option key={t.id} value={t.id}>{t.model} ({t.brand}) - Stock: {t.stock}</option>
                  ))}
                </select>
              </div>
              {(form.type === 'delivery') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Impresora destino</label>
                  <select
                    value={form.printerId}
                    onChange={e => {
                      const printer = printers.find(p => p.id === e.target.value);
                      setForm({ ...form, printerId: e.target.value, printerName: printer?.name || '' });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  >
                    <option value="">Seleccionar impresora...</option>
                    {printers.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.department}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={form.user}
                  onChange={e => setForm({ ...form, user: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium">Registrar Movimiento</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(movement => (
          <div key={movement.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                ${typeConfig[movement.type].color}
              `}>
                {typeConfig[movement.type].icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-800">
                        {movement.tonerModel} × {movement.quantity}
                      </h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig[movement.type].color}`}>
                        {typeConfig[movement.type].label}
                      </span>
                    </div>
                    {movement.printerName && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        → {movement.printerName}
                      </p>
                    )}
                    {movement.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{movement.notes}"</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{movement.date}</p>
                    <p className="text-xs text-gray-400">{movement.user}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <ArrowLeftRight size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No se encontraron movimientos</p>
        </div>
      )}
    </div>
  );
}
