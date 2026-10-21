// src/components/NewMovementForm.tsx
// Formulario "Nuevo Movimiento".
// - Usuarios: fetch al proxy serverless del mismo dominio (/api/usuarios). El
//   backend combina las fuentes y devuelve solo { id, nombre, usuario }; el
//   navegador no conoce el origen de los datos ni credenciales.
// - Tóners e Impresoras: tablas propias (RLS aplica por user_id).
// - Alta: insert en toner_movimientos vía movementsService + ajuste de stock.

import { useState, useEffect, useCallback } from 'react';
import { supabase, tonersService, printersService, movementsService } from '../services/supabase';

interface UsuarioLite {
  id: string;
  nombre: string;
  usuario: string;
}
interface TonerOption { id: string; model: string; brand: string; color: string; stock: number; }
interface PrinterOption { id: string; name: string; location: string; }

const TIPOS = [
  { value: 'delivery', label: 'Entrega' },
  { value: 'return', label: 'Devolución' },
  { value: 'restock', label: 'Reposición' },
  { value: 'disposal', label: 'Desecho' },
] as const;

type TipoMovimiento = (typeof TIPOS)[number]['value'];

export default function NewMovementForm({ onRegistered }: { onRegistered?: () => void }) {
  // ===== Estados del formulario =====
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('delivery');
  const [tonerId, setTonerId] = useState('');
  const [impresoraId, setImpresoraId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [usuarioId, setUsuarioId] = useState('');
  const [notas, setNotas] = useState('');

  // ===== Datos cargados =====
  const [usuarios, setUsuarios] = useState<UsuarioLite[]>([]);
  const [toners, setToners] = useState<TonerOption[]>([]);
  const [impresoras, setImpresoras] = useState<PrinterOption[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ===== UI states =====
  const [loadingListas, setLoadingListas] = useState(true);
  const [loading, setLoading] = useState(false);       // deshabilita el botón durante el insert
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Sesión de Supabase (user_id para RLS)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  // Carga inicial: usuarios (proxy serverless) + tóners + impresoras (tablas propias)
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoadingListas(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 1) Usuarios desde la función serverless (mismo dominio, solo lectura).
      //    Respuesta: { success, total, count, data: [{ id, nombre, usuario }] }
      try {
        const res = await fetch('/api/usuarios?soloActivos=true&soloPersonas=true&limit=500', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setUsuarios(json.data ?? []);
      } catch {
        if (!cancelled) setError('No se pudo cargar la lista de usuarios.');
      }

      // 2) Tóners y 3) Impresoras desde Supabase (requiere sesión)
      if (userId && !cancelled) {
        const [{ data: t }, { data: p }] = await Promise.all([
          tonersService.getAll(userId),
          printersService.getAll(userId),
        ]);
        if (!cancelled) {
          setToners((t as TonerOption[]) ?? []);
          setImpresoras((p as PrinterOption[]) ?? []);
        }
      }
      if (!cancelled) setLoadingListas(false);
    }
    if (userId !== null) loadAll();
    return () => { cancelled = true; };
  }, [userId]);

  const selectedToner = toners.find((t) => t.id === tonerId);
  const selectedPrinter = impresoras.find((p) => p.id === impresoraId);
  const selectedUser = usuarios.find((u) => u.id === usuarioId);

  const updateField = useCallback(<T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setOk(null);
  }, []);

  // ===== Submit: validar e insertar en Supabase =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!userId) { setError('Tu sesión expiró. Volvé a iniciar sesión.'); return; }
    if (!tonerId) { setError('Seleccioná un tóner.'); return; }
    if (!usuarioId) { setError('Seleccioná un usuario.'); return; }
    if (!Number.isInteger(cantidad) || cantidad <= 0) { setError('La cantidad debe ser un entero mayor que 0.'); return; }
    if (!fecha) { setError('Indicá una fecha válida.'); return; }
    const aumentaStock = tipoMovimiento === 'return' || tipoMovimiento === 'restock';
    if (!aumentaStock && selectedToner && cantidad > selectedToner.stock) {
      setError(`Stock insuficiente: hay ${selectedToner.stock} unidad(es).`);
      return;
    }

    setLoading(true);
    try {
      const { error: insErr } = await movementsService.create({
        user_id: userId,
        type: tipoMovimiento,
        toner_id: tonerId,
        toner_model: selectedToner ? `${selectedToner.brand} ${selectedToner.model}` : '',
        printer_id: impresoraId || undefined,
        printer_name: selectedPrinter?.name,
        quantity: cantidad,
        date: fecha,
        user: selectedUser ? `${selectedUser.nombre} (${selectedUser.usuario})` : usuarioId,
        notes: notas.trim(),
      });
      if (insErr) throw insErr;

      // Ajuste de stock coherente con el movimiento
      if (selectedToner) {
        const nuevoStock = aumentaStock
          ? selectedToner.stock + cantidad
          : Math.max(0, selectedToner.stock - cantidad);
        await tonersService.update(selectedToner.id, { stock: nuevoStock });
      }

      setOk('Movimiento registrado correctamente.');
      // Reset parcial
      setTonerId(''); setImpresoraId(''); setUsuarioId(''); setCantidad(1); setNotas('');
      setToners((prev) => prev.map((t) =>
        t.id === selectedToner?.id
          ? { ...t, stock: aumentaStock ? t.stock + cantidad : Math.max(0, t.stock - cantidad) }
          : t));
      onRegistered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el movimiento.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-100';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl">
      <h2 className="text-lg font-bold text-gray-800">Nuevo Movimiento</h2>
      {loadingListas && <p className="text-sm text-gray-500">Cargando datos…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo de movimiento</label>
          <select className={inputCls} value={tipoMovimiento}
            onChange={(e) => updateField(setTipoMovimiento)(e.target.value as TipoMovimiento)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input type="date" className={inputCls} value={fecha}
            onChange={(e) => updateField(setFecha)(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Tóner *</label>
          <select className={inputCls} value={tonerId}
            onChange={(e) => updateField(setTonerId)(e.target.value)} disabled={loadingListas}>
            <option value="">— Seleccionar —</option>
            {toners.map((t) => (
              <option key={t.id} value={t.id}>{t.brand} {t.model} ({t.color}) — stock: {t.stock}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Impresora</label>
          <select className={inputCls} value={impresoraId}
            onChange={(e) => updateField(setImpresoraId)(e.target.value)} disabled={loadingListas}>
            <option value="">— Sin impresora —</option>
            {impresoras.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.location}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cantidad *</label>
          <input type="number" min={1} className={inputCls} value={cantidad}
            onChange={(e) => updateField(setCantidad)(parseInt(e.target.value || '0', 10))} />
        </div>
        <div>
          <label className={labelCls}>Usuario *</label>
          <select className={inputCls} value={usuarioId}
            onChange={(e) => updateField(setUsuarioId)(e.target.value)} disabled={loadingListas}>
            <option value="">— Buscar/seleccionar —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.usuario})</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas</label>
        <textarea className={inputCls} rows={3} value={notas} maxLength={500}
          placeholder="Observaciones del movimiento…"
          onChange={(e) => updateField(setNotas)(e.target.value)} />
      </div>

      {error && <div role="alert" className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">{error}</div>}
      {ok && <div role="status" className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md px-3 py-2">{ok}</div>}

      <button type="submit" disabled={loading || loadingListas}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-5 py-2.5 rounded-md text-sm transition-colors">
        {loading ? 'Registrando…' : 'Registrar Movimiento'}
      </button>
    </form>
  );
}
