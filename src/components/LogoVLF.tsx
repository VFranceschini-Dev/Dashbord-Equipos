interface LogoVLFProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export default function LogoVLF({ size = 'md', showName = false, className = '' }: LogoVLFProps) {
  const sizes = {
    sm: { width: 80, height: 24, fontSize: 14 },
    md: { width: 120, height: 36, fontSize: 20 },
    lg: { width: 180, height: 54, fontSize: 30 },
  };

  const { width, height, fontSize } = sizes[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 180 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>

        {/* >vlf_ Text - Terminal style */}
        <text
          x="5"
          y="38"
          fontFamily="monospace, 'Courier New', Courier"
          fontSize="36"
          fontWeight="bold"
          fill="url(#textGradient)"
        >
          {'>vlf_'}
        </text>

        {/* Decorative line */}
        <rect x="5" y="46" width="170" height="2" rx="1" fill="url(#logoGradient)" opacity="0.6" />
      </svg>

      {showName && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Pablo Eloy Donnet
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            Desarrollador
          </span>
        </div>
      )}
    </div>
  );
}
