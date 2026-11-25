interface LogoVLFProps {
  /** Tamaño base: el logo es compacto y crece un poco en pantallas más grandes. */
  size?: 'sm' | 'md' | 'lg';
  /** Muestra el rótulo "Desarrollado por" sobre la marca. */
  showName?: boolean;
  /** 'auto' sigue el tema claro/oscuro; 'onDark' es para fondos siempre oscuros (por ejemplo el login). */
  tone?: 'auto' | 'onDark';
  className?: string;
}

// Tamaño de la marca "</>vlf_" según el tamaño y la pantalla (móvil -> escritorio).
const BRAND_SIZES: Record<NonNullable<LogoVLFProps['size']>, string> = {
  sm: 'text-[13px] sm:text-sm',
  md: 'text-sm sm:text-base',
  lg: 'text-base sm:text-lg',
};

const LABEL_SIZES: Record<NonNullable<LogoVLFProps['size']>, string> = {
  sm: 'text-[9px] sm:text-[10px]',
  md: 'text-[10px] sm:text-[11px]',
  lg: 'text-[11px] sm:text-xs',
};

/**
 * Firma compacta: "Desarrollado por </>vlf_ Soluciones IT".
 * Es texto (no imagen): se ve nítida a cualquier tamaño, se adapta al tema claro/oscuro
 * y no se sale del contenedor (en pantallas muy angostas "Soluciones IT" pasa a la línea siguiente).
 * Mantiene el nombre de archivo/componente por compatibilidad con los usos existentes.
 */
export default function LogoVLF({ size = 'md', showName = false, tone = 'auto', className = '' }: LogoVLFProps) {
  const onDark = tone === 'onDark';

  const purple = onDark ? 'text-violet-300' : 'text-violet-600 dark:text-violet-300';
  const green = onDark ? 'text-green-400' : 'text-green-600 dark:text-green-400';
  const muted = onDark ? 'text-blue-200' : 'text-gray-500 dark:text-slate-400';

  return (
    <div
      className={`inline-flex max-w-full flex-col items-center gap-0.5 select-none text-center ${className}`}
      role="img"
      aria-label="Desarrollado por vlf, Soluciones IT"
    >
      {showName && (
        <span className={`${LABEL_SIZES[size]} font-medium uppercase tracking-[0.18em] ${muted}`}>
          Desarrollado por
        </span>
      )}

      <span className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
        <span aria-hidden className={`${BRAND_SIZES[size]} font-mono font-bold tracking-tight whitespace-nowrap`}>
          <span className={purple}>&lt;</span>
          <span className={green}>/</span>
          <span className={purple}>&gt;vlf</span>
          <span className={`${green} animate-pulse motion-reduce:animate-none`}>_</span>
        </span>
        <span aria-hidden className={`${LABEL_SIZES[size]} font-semibold uppercase tracking-[0.14em] ${muted} whitespace-nowrap`}>
          Soluciones IT
        </span>
      </span>
    </div>
  );
}
