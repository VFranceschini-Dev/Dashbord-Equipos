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
      {showName && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Desarrollado por {">vlf_"}
          </span>
        </div>
      )}
    </div>
  );
}
