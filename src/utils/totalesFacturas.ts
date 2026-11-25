import type { Voucher } from '../types';

/** Monto con signo: una nota de crédito resta (reduce lo que se le debe al proveedor). */
export function montoConSigno(v: Pick<Voucher, 'type' | 'amount'>): number {
  return v.type === 'return' ? -v.amount : v.amount;
}

export interface TotalesFacturas {
  totalARS: number;
  totalUSD: number;
  pendienteARS: number;
  pendienteUSD: number;
}

/**
 * Totales de la pantalla de facturas, por moneda:
 * - Total: todo menos lo rechazado; las notas de crédito restan.
 * - Pendiente: solo lo que está en estado "pendiente" (las notas de crédito pendientes también restan).
 */
export function totalesFacturas(vouchers: Pick<Voucher, 'type' | 'amount' | 'currency' | 'status'>[]): TotalesFacturas {
  const suma = (filtro: (v: (typeof vouchers)[number]) => boolean, moneda: Voucher['currency']) =>
    vouchers.filter(v => v.currency === moneda && filtro(v)).reduce((s, v) => s + montoConSigno(v), 0);
  const vigente = (v: (typeof vouchers)[number]) => v.status !== 'rejected';
  const pendiente = (v: (typeof vouchers)[number]) => v.status === 'pending';
  return {
    totalARS: suma(vigente, 'ARS'),
    totalUSD: suma(vigente, 'USD'),
    pendienteARS: suma(pendiente, 'ARS'),
    pendienteUSD: suma(pendiente, 'USD'),
  };
}
