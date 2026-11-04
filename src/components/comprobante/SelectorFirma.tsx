import { FUENTES_FIRMA } from '../../constants/firmas';

/** Campos de la firma tipográfica: nombre, tipo de letra (con vista previa) y DNI. */
export default function SelectorFirma({ nombre, dni, fuente, onChange }: {
  nombre: string;
  dni: string;
  fuente: string;
  onChange: (cambios: Partial<{ nombre: string; dni: string; fuente: string }>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre y apellido *</label>
          <input type="text" value={nombre} onChange={e => onChange({ nombre: e.target.value })} autoComplete="name"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
          <input type="text" inputMode="numeric" value={dni} maxLength={10}
            onChange={e => onChange({ dni: e.target.value.replace(/\D/g, '') })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de letra de la firma *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FUENTES_FIRMA.map(f => (
            <button key={f.id} type="button" onClick={() => onChange({ fuente: f.id })}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                fuente === f.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span style={{ fontFamily: f.css, fontSize: '1.6rem', lineHeight: 1.2 }} className="block text-gray-900 truncate">
                {nombre.trim() || 'Tu firma'}
              </span>
              <span className="text-[11px] text-gray-500">{f.nombre}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
