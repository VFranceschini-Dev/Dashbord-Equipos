import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { syncEquipmentMovementToSupabase, syncEquipmentMovementsFromSupabase } from '../services/supabaseSync';
import { getUsuarios, type MetabaseUsuario } from '../services/metabaseProxy';
import { Equipment, EquipmentMovement } from '../types';
import { Monitor, Search, ArrowLeftRight, Loader2, AlertTriangle, CheckCircle, RefreshCw, History } from 'lucide-react';

const TIPOS: { value: EquipmentMovement['tipo']; label: string; color: string }[] = [
  { value: 'asignacion', label: 'Asignación', color: 'bg-blue-100 text-blue-700' },
  { value: 'devolucion', label: 'Devolución', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'traslado', label: 'Traslado', color: 'bg-amber-100 text-amber-700' },
  { value: 'baja', label: 'Baja', color: 'bg-red-100 text-red-700' },
];

export default function EquipmentAssignments() {
  const { equipments, setEquipments } = useApp();
  const { user } = useAuth();
  const [movements, setMovements] = useState<EquipmentMovement[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  // Buscador de usuarios: consume el proxy local /api/usuarios (función serverless
  // de Vercel, mismo dominio). La combinación de fuentes ocurre solo en el backend;
  // la UI recibe { id, nombre, usuario } sin información del origen de los datos.
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState<MetabaseUsuario[]>([]);
  const [selectedUser, setSelectedUser] = useState<MetabaseUsuario | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  // Formulario de movimiento
  const [equipmentId, setEquipmentId] = useState('');
  const [tipo, setTipo] = useState<EquipmentMovement['tipo']>('asignacion');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Historial: carga desde Supabase al montar
  useEffect(() => {
    syncEquipmentMovementsFromSupabase()
      .then(setMovements)
      .catch(err => setFormMsg({ ok: false, text: `No se pudo cargar el historial: ${err.message}` }))
      .finally(() => setLoadingHist(false));
  }, []);

  // Búsqueda incremental con debounce (nunca arma SQL con el texto: filtra en la caché del proxy)
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    if (!query.trim()) { setUsuarios([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getUsuarios(query.trim());
        setUsuarios(res);
        setProxyError(null);
      } catch {
        setUsuarios([]);
        setProxyError('No se pudo cargar la lista de usuarios. El historial guardado sigue disponible.');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  const handleSubmit = async () => {
    setFormMsg(null);
    if (!equipmentId || !selectedUser) {
      setFormMsg({ ok: false, text: 'Seleccioná un equipamiento y un usuario antes de registrar.' });
      return;
    }
    setSaving(true);
    const result = await syncEquipmentMovementToSupabase({
      equipmentId,
      usuarioRef: selectedUser.id,
      usuarioNombre: selectedUser.nombre,
      usuarioArea: selectedUser.area,
      tipo,
      observaciones: observaciones.trim() || undefined,
      registradoPor: user?.email || undefined,
    });
    setSaving(false);

    if (result.success) {
      // Refrescar historial y status local del equipo (la RPC ya actualizó Supabase)
      const data = await syncEquipmentMovementsFromSupabase().catch(() => null);
      if (data) setMovements(data);
      setEquipments(prev => prev.map(e => e.id === equipmentId ? {
        ...e,
        status: (tipo === 'asignacion' || tipo === 'traslado' ? 'assigned' : tipo === 'devolucion' ? 'available' : 'retired') as Equipment['status'],
      } : e));
      setFormMsg({ ok: true, text: 'Movimiento registrado y estado del equipo actualizado.' });
      setObservaciones('');
    } else {
      setFormMsg({ ok: false, text: result.error || 'No se pudo registrar el movimiento.' });
    }
  };

  const nombreEquipo = (id: string) => {
    const eq = equipments.find(e => e.id === id);
    return eq ? `${eq.name}${eq.brand ? ` (${eq.brand} ${eq.model || ''})` : ''}` : 'Equipo eliminado';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg"><Monitor size={22} className="text-blue-600" /></div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Asignación de Equipos</h2>
          <p className="text-xs text-gray-500">Búsqueda de usuarios en directorio corporativo · Historial compartido</p>
        </div>
      </div>

      {proxyError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{proxyError}</span>
        </div>
      )}

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ArrowLeftRight size={16} /> Registrar movimiento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, área o código..."
                value={selectedUser ? `${selectedUser.nombre} — ${selectedUser.area}` : query}
                onChange={e => { setSelectedUser(null); setQuery(e.target.value); }}
                disabled={Boolean(selectedUser)}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 outline-none text-sm disabled:bg-gray-50"
              />
              {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
              {selectedUser && (
                <button onClick={() => { setSelectedUser(null); setQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline">cambiar</button>
              )}
            </div>
            {!selectedUser && query.trim() && usuarios.length > 0 && (
              <ul className="mt-1 border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto shadow-sm">
                {usuarios.map(u => (
                  <li key={u.id}>
                    <button
                      onClick={() => { setSelectedUser(u); setQuery(''); setUsuarios([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                    >
                      <span><span className="font-medium">{u.nombre}</span> <span className="text-gray-400">· {u.area}</span></span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${u.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{u.estado}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!selectedUser && query.trim().length >= 2 && !searching && usuarios.length === 0 && !proxyError && (
              <p className="text-xs text-gray-400 mt-1">Sin resultados para “{query}”.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipamiento *</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
              <option value="">Seleccionar equipo...</option>
              {equipments.map(e => (
                <option key={e.id} value={e.id}>{e.name}{e.serialNumber ? ` · ${e.serialNumber}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de movimiento *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as EquipmentMovement['tipo'])}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" placeholder="Opcional" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            {saving ? 'Guardando...' : 'Registrar movimiento'}
          </button>
          {formMsg && (
            <span className={`text-sm ${formMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{formMsg.text}</span>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><History size={16} /> Historial de movimientos de equipos</h3>
          <button onClick={async () => { const d = await syncEquipmentMovementsFromSupabase().catch(() => null); if (d) setMovements(d); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50">
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
        {loadingHist ? (
          <div className="text-center py-10">
            <Loader2 size={28} className="mx-auto animate-spin text-blue-500 mb-2" />
            <p className="text-gray-500 text-sm">Cargando historial...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-10">
            <Monitor size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">Todavía no hay movimientos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Equipo</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Área</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map(m => {
                  const t = TIPOS.find(x => x.value === m.tipo)!;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 text-sm">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(m.fecha).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-gray-800">{nombreEquipo(m.equipmentId)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{m.usuarioNombre} <span className="text-gray-400">#{m.usuarioRef}</span></td>
                      <td className="px-4 py-2.5 text-gray-600">{m.usuarioArea}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span></td>
                      <td className="px-4 py-2.5 text-gray-500">{m.observaciones || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
