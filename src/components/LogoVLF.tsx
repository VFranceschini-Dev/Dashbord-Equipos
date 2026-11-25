import { useId } from 'react';

interface LogoVLFProps {
  /** Tamaño base: el logo se adapta al ancho de pantalla (crece en pantallas más grandes). */
  size?: 'sm' | 'md' | 'lg';
  /** Muestra el rótulo "Desarrollo por" sobre el logo. */
  showName?: boolean;
  /** 'auto' sigue el tema claro/oscuro; 'onDark' es para fondos siempre oscuros (por ejemplo el login). */
  tone?: 'auto' | 'onDark';
  className?: string;
}

// Ancho del logo según el tamaño y la pantalla (móvil -> escritorio).
const WIDTHS: Record<NonNullable<LogoVLFProps['size']>, string> = {
  sm: 'w-[112px] sm:w-[124px]',
  md: 'w-[136px] sm:w-[164px] lg:w-[184px]',
  lg: 'w-[164px] sm:w-[204px] lg:w-[244px]',
};

/**
 * Logo "</>VIF_ — Soluciones IT · Desarrollo · Innovación" en SVG: nítido a cualquier tamaño,
 * con colores de marca que se leen bien sobre fondo claro y oscuro. El rótulo "Desarrollo por"
 * es opcional. Mantiene el nombre de archivo/componente por compatibilidad con los usos existentes.
 */
export default function LogoVLF({ size = 'md', showName = false, tone = 'auto', className = '' }: LogoVLFProps) {
  const uid = useId().replace(/:/g, '');
  const purple = `vif-purple-${uid}`;
  const green = `vif-green-${uid}`;

  const onDark = tone === 'onDark';
  const taglineClass = onDark ? 'fill-blue-100' : 'fill-slate-500 dark:fill-slate-300';
  const labelClass = onDark ? 'text-blue-200' : 'text-gray-400 dark:text-slate-400';

  return (
    <div className={`inline-flex flex-col items-center gap-2 select-none ${className}`}>
      {showName && (
        <div className={`flex items-center justify-center gap-2 ${labelClass}`}>
          <span aria-hidden className="h-px w-6 sm:w-8 bg-gradient-to-r from-transparent to-current opacity-40" />
          <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.2em] whitespace-nowrap">
            Desarrollo por
          </span>
          <span aria-hidden className="h-px w-6 sm:w-8 bg-gradient-to-l from-transparent to-current opacity-40" />
        </div>
      )}

      <svg
        viewBox="-2 0 213 66"
        role="img"
        aria-label="VIF: Soluciones IT, Desarrollo, Innovación"
        className={`${WIDTHS[size]} h-auto max-w-full`}
      >
        <defs>
          {/* userSpaceOnUse: con coordenadas relativas, las líneas perfectamente rectas (I, travesaño de F, "_") no se pintan */}
          <linearGradient id={purple} gradientUnits="userSpaceOnUse" x1="0" y1="5" x2="0" y2="45">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id={green} gradientUnits="userSpaceOnUse" x1="0" y1="5" x2="0" y2="45">
            <stop offset="0" stopColor="#86efac" />
            <stop offset="1" stopColor="#16a34a" />
          </linearGradient>
        </defs>

        <g fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          {/* </> */}
          <polyline points="27,9 11,25.5 27,42" stroke={`url(#${purple})`} />
          <line x1="44" y1="7" x2="35" y2="44" stroke={`url(#${green})`} />
          <polyline points="52,9 68,25.5 52,42" stroke={`url(#${purple})`} />
          {/* V I F */}
          <polyline points="86,8 99,42 112,8" stroke={`url(#${purple})`} />
          <line x1="128" y1="8" x2="128" y2="42" stroke={`url(#${purple})`} />
          <polyline points="145,42 145,8 168,8" stroke={`url(#${purple})`} />
          <line x1="145" y1="25" x2="162" y2="25" stroke={`url(#${purple})`} />
          {/* _ (cursor) */}
          <line x1="180" y1="42" x2="204" y2="42" stroke={`url(#${green})`} className="animate-pulse motion-reduce:animate-none" />
        </g>

        {/* Soluciones IT · Desarrollo · Innovación (textLength fija el ancho sin depender de la tipografía) */}
        <g className={taglineClass} fontFamily="ui-sans-serif, system-ui, 'Segoe UI', Roboto, Arial, sans-serif" fontSize="7.4" fontWeight="600">
          <text x="0" y="62" textLength="62" lengthAdjust="spacing">SOLUCIONES IT</text>
          <rect x="70" y="56" width="4.5" height="4.5" rx="1" fill="#8b5cf6" />
          <text x="82" y="62" textLength="50" lengthAdjust="spacing">DESARROLLO</text>
          <rect x="140" y="56" width="4.5" height="4.5" rx="1" fill="#22c55e" />
          <text x="152" y="62" textLength="57" lengthAdjust="spacing">INNOVACIÓN</text>
        </g>
      </svg>
    </div>
  );
}
