import type { Movement, Printer, TonerItem } from '../types';

/** Período de un reporte: fechas "YYYY-MM-DD" inclusive. Vacío = sin límite de ese lado. */
export interface Periodo {
  desde: string;
  hasta: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Fecha local como YYYY-MM-DD (no UTC, para que "hoy" sea el día del usuario). */
export const aIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Del día 1 del mes de `hoy` hasta `hoy`. Es el período por defecto de los reportes. */
export function periodoMesActual(hoy: Date = new Date()): Periodo {
  return { desde: aIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aIso(hoy) };
}

/** ¿La fecha del movimiento cae en el período? Tolera fechas con hora (se usan los primeros 10 caracteres). */
export function enPeriodo(fecha: string, p: Periodo): boolean {
  const f = (fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  if (p.desde && f < p.desde) return false;
  if (p.hasta && f > p.hasta) return false;
  return true;
}

/** Texto legible: "01/11/2026 al 26/11/2026". */
export function etiquetaPeriodo(p: Periodo): string {
  const f = (s: string) => (s ? s.split('-').reverse().join('/') : '');
  if (p.desde && p.hasta) return `${f(p.desde)} al ${f(p.hasta)}`;
  if (p.desde) return `desde ${f(p.desde)}`;
  if (p.hasta) return `hasta ${f(p.hasta)}`;
  return 'todo el historial';
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Precio unitario actual del tóner de un movimiento (por id; si el tóner ya no existe, por modelo). */
export function precioDelMovimiento(m: Movement, toners: TonerItem[]): number {
  const porId = toners.find(t => t.id === m.tonerId);
  if (porId) return porId.unitPrice;
  const modelo = norm(m.tonerModel);
  return toners.find(t => norm(t.model) === modelo)?.unitPrice ?? 0;
}

export interface ConsumoDepartamento {
  name: string;
  impresoras: number;
  toners: number;      // unidades entregadas menos devueltas en el período (nunca negativo)
  costo: number;       // unidades × precio unitario actual
  paginas: number;     // contador acumulado de sus impresoras (no es del período)
}

export const SIN_DEPARTAMENTO = 'Sin departamento';
export const SIN_IMPRESORA = 'Sin impresora asignada';

/**
 * Tóner consumido y su costo por departamento en el período.
 * Consumo = entregas a una impresora − devoluciones de esa impresora. Se asigna al departamento de la impresora
 * (por id; si el id ya no existe, por nombre). Las entregas sin impresora reconocible van a "Sin impresora asignada".
 */
export function consumoPorDepartamento(
  movements: Movement[], printers: Printer[], toners: TonerItem[], periodo: Periodo,
): ConsumoDepartamento[] {
  const filas = new Map<string, ConsumoDepartamento>();
  const fila = (name: string) => {
    let f = filas.get(name);
    if (!f) { f = { name, impresoras: 0, toners: 0, costo: 0, paginas: 0 }; filas.set(name, f); }
    return f;
  };

  for (const p of printers) {
    const f = fila(p.department.trim() || SIN_DEPARTAMENTO);
    f.impresoras += 1;
    f.paginas += p.totalPages;
  }

  for (const m of movements) {
    if ((m.type !== 'delivery' && m.type !== 'return') || !enPeriodo(m.date, periodo)) continue;
    const impresora = printers.find(p => p.id === m.printerId)
      ?? (m.printerName ? printers.find(p => norm(p.name) === norm(m.printerName)) : undefined);
    const f = fila(impresora ? (impresora.department.trim() || SIN_DEPARTAMENTO) : SIN_IMPRESORA);
    const signo = m.type === 'delivery' ? 1 : -1;
    f.toners += signo * m.quantity;
    f.costo += signo * m.quantity * precioDelMovimiento(m, toners);
  }

  return [...filas.values()]
    .map(f => ({ ...f, toners: Math.max(0, f.toners), costo: Math.max(0, f.costo) }))
    .filter(f => f.impresoras > 0 || f.toners > 0)
    .sort((a, b) => b.costo - a.costo || b.paginas - a.paginas || a.name.localeCompare(b.name, 'es'));
}

export interface GastoMes {
  mes: string;         // "2026-11"
  etiqueta: string;    // "Nov 26"
  gasto: number;       // compras (reposiciones) × precio unitario actual
  unidades: number;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Compras de tóner (reposiciones) por mes dentro del período, con los meses sin compras en cero.
 * Si el período no tiene límite de un lado, se usa el primer/último movimiento del período.
 */
export function gastoMensual(movements: Movement[], toners: TonerItem[], periodo: Periodo): GastoMes[] {
  const compras = movements.filter(m => m.type === 'restock' && enPeriodo(m.date, periodo));
  const fechas = compras.map(m => m.date.slice(0, 10)).sort();
  const desde = periodo.desde || fechas[0];
  const hasta = periodo.hasta || fechas[fechas.length - 1];
  if (!desde || !hasta || desde > hasta) return [];

  const meses = new Map<string, GastoMes>();
  let [y, mo] = desde.split('-').map(Number);
  const [yf, mf] = hasta.split('-').map(Number);
  while (y < yf || (y === yf && mo <= mf)) {
    const clave = `${y}-${pad(mo)}`;
    meses.set(clave, { mes: clave, etiqueta: `${MESES[mo - 1]} ${String(y).slice(2)}`, gasto: 0, unidades: 0 });
    mo += 1; if (mo > 12) { mo = 1; y += 1; }
    if (meses.size > 120) break; // límite de seguridad (10 años)
  }
  for (const m of compras) {
    const g = meses.get(m.date.slice(0, 7));
    if (!g) continue;
    g.unidades += m.quantity;
    g.gasto += m.quantity * precioDelMovimiento(m, toners);
  }
  return [...meses.values()];
}

/** Unidades entregadas por modelo de tóner en el período (para el ranking de más utilizados). */
export function entregasPorToner(movements: Movement[], toners: TonerItem[], periodo: Periodo) {
  const entregas = movements.filter(m => m.type === 'delivery' && enPeriodo(m.date, periodo));
  return toners
    .map(t => ({ toner: t, entregas: entregas.filter(m => m.tonerModel === t.model).reduce((s, m) => s + m.quantity, 0) }))
    .sort((a, b) => b.entregas - a.entregas);
}

export const formatoPesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
