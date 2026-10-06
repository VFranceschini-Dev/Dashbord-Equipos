import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative w-16 h-8 rounded-full transition-all duration-300 ease-in-out
        ${theme === 'light' 
          ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-lg shadow-orange-400/30' 
          : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-purple-600/30'
        }
        hover:scale-105 active:scale-95
      `}
      title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
    >
      <div
        className={`
          absolute top-1 w-6 h-6 rounded-full bg-white shadow-md
          transition-all duration-300 ease-in-out flex items-center justify-center
          ${theme === 'light' ? 'left-1' : 'left-9'}
        `}
      >
        {theme === 'light' ? (
          <Sun size={14} className="text-yellow-500" />
        ) : (
          <Moon size={14} className="text-indigo-600" />
        )}
      </div>
    </button>
  );
}
