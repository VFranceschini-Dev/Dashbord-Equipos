import type { Printer } from '../types';
import { impresorasCompatibles } from '../utils/impresorasCompatibles';

interface Props {
  modeloToner: string;
  printers: Printer[];
  /** Cuántos modelos se listan antes de resumir el resto en "+N más". */
  max?: number;
  className?: string;
}

/** Línea "Compatible con: HP LaserJet Pro M404dn (2), Brother ..." a partir de las impresoras cargadas. */
export default function ImpresorasCompatibles({ modeloToner, printers, max = 2, className = '' }: Props) {
  const lista = impresorasCompatibles(modeloToner, printers);
  if (lista.length === 0) {
    return <p className={`text-xs italic text-gray-400 dark:text-slate-500 ${className}`}>Sin impresoras asociadas</p>;
  }
  const visibles = lista.slice(0, max);
  const resto = lista.length - visibles.length;
  const detalle = lista.map(l => `${l.modelo}: ${l.nombres.join(', ')}`).join('\n');
  return (
    <p className={`text-xs text-gray-500 dark:text-slate-400 ${className}`} title={detalle}>
      <span className="font-medium">Compatible con:</span>{' '}
      {visibles.map(l => (l.cantidad > 1 ? `${l.modelo} (×${l.cantidad})` : l.modelo)).join(' · ')}
      {resto > 0 && <span className="text-gray-400 dark:text-slate-500"> · +{resto} más</span>}
    </p>
  );
}
