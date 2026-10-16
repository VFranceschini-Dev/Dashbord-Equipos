# Sistema de Temas: Claro/Oscuro

## 🎨 Descripción General

El sistema implementa un tema claro/oscuro completo con persistencia en localStorage, permitiendo a los usuarios elegir su preferencia visual.

## 🌓 Características

✅ **Toggle en Dashboard**: Botón de sol/luna en la esquina superior derecha  
✅ **Persistencia**: La preferencia se guarda en localStorage  
✅ **Transiciones suaves**: Cambios de tema con animaciones  
✅ **Componentes adaptados**: Todos los componentes soportan ambos temas  
✅ **Accesibilidad**: Contrastes optimizados para ambos modos  

## 🔧 Implementación Técnica

### 1. ThemeContext

Ubicación: `src/context/ThemeContext.tsx`

```typescript
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}
```

**Funcionalidades:**
- `theme`: Estado actual del tema
- `toggleTheme()`: Alterna entre claro y oscuro
- `setTheme(theme)`: Establece un tema específico
- Persistencia automática en localStorage

### 2. Uso en Componentes

```typescript
import { useTheme } from '../context/ThemeContext';

function MiComponente() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙 Oscuro' : '☀️ Claro'}
    </button>
  );
}
```

### 3. Estilos CSS

Ubicación: `src/index.css`

```css
/* Modo claro (por defecto) */
body {
  background-color: #ffffff;
  color: #000000;
}

/* Modo oscuro */
.dark body {
  background-color: #1a1a1a;
  color: #ffffff;
}

/* Ejemplos de componentes */
.dark .bg-white {
  background-color: #2d2d2d;
}

.dark .text-gray-900 {
  color: #f1f1f1;
}

.dark .border-gray-200 {
  border-color: #404040;
}
```

## 🎯 Clases de Tailwind para Modo Oscuro

Tailwind CSS proporciona el prefijo `dark:` para aplicar estilos condicionales:

```tsx
<div className="bg-white dark:bg-gray-800">
  <h1 className="text-gray-900 dark:text-gray-100">
    Título
  </h1>
  <p className="text-gray-600 dark:text-gray-400">
    Descripción
  </p>
</div>
```

### Patrones Comunes

**Fondos:**
- `bg-white dark:bg-gray-800`
- `bg-gray-50 dark:bg-gray-900`
- `bg-gray-100 dark:bg-gray-700`

**Textos:**
- `text-gray-900 dark:text-gray-100`
- `text-gray-700 dark:text-gray-300`
- `text-gray-500 dark:text-gray-400`

**Bordes:**
- `border-gray-200 dark:border-gray-700`
- `border-gray-300 dark:border-gray-600`

**Inputs:**
- `bg-white dark:bg-gray-800`
- `text-gray-900 dark:text-gray-100`
- `border-gray-300 dark:border-gray-600`

## 🔄 Toggle en Dashboard

Ubicación: `src/components/Dashboard.tsx`

```tsx
<button
  onClick={toggleTheme}
  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
  title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
>
  {theme === 'light' ? (
    <Moon size={20} className="text-gray-700 dark:text-gray-300" />
  ) : (
    <Sun size={20} className="text-yellow-500" />
  )}
</button>
```

## 💾 Persistencia

El tema se guarda automáticamente en localStorage:

```typescript
// Guardar
localStorage.setItem('theme', 'dark');

// Recuperar
const savedTheme = localStorage.getItem('theme') || 'light';
```

**Clave:** `theme`  
**Valores:** `'light'` o `'dark'`  
**Por defecto:** `'light'`

## 🎨 Paleta de Colores

### Modo Claro

| Elemento | Color |
|----------|-------|
| Fondo principal | `#ffffff` |
| Fondo secundario | `#f9fafb` |
| Texto principal | `#111827` |
| Texto secundario | `#6b7280` |
| Bordes | `#e5e7eb` |
| Acento | `#3b82f6` |

### Modo Oscuro

| Elemento | Color |
|----------|-------|
| Fondo principal | `#1a1a1a` |
| Fondo secundario | `#2d2d2d` |
| Texto principal | `#f1f1f1` |
| Texto secundario | `#9ca3af` |
| Bordes | `#404040` |
| Acento | `#60a5fa` |

## ✅ Checklist de Implementación

Al crear un nuevo componente, asegúrate de:

- [ ] Usar clases `dark:` para todos los fondos
- [ ] Usar clases `dark:` para todos los textos
- [ ] Usar clases `dark:` para todos los bordes
- [ ] Probar en ambos modos
- [ ] Verificar contraste accesible (WCAG AA)
- [ ] Mantener consistencia visual

## 🚀 Mejores Prácticas

### 1. Usa Variables CSS

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #111827;
}

.dark {
  --bg-primary: #1a1a1a;
  --text-primary: #f1f1f1;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### 2. Componentes Reutilizables

Crea componentes base con soporte de tema:

```tsx
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {children}
    </div>
  );
}
```

### 3. Transiciones Suaves

```css
* {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### 4. Accesibilidad

Asegúrate de que el contraste sea suficiente:

```tsx
// ✅ Bueno
<p className="text-gray-700 dark:text-gray-300">

// ❌ Malo (bajo contraste)
<p className="text-gray-300 dark:text-gray-700">
```

## 🔍 Depuración

### Ver tema actual

```typescript
const { theme } = useTheme();
console.log('Tema actual:', theme);
```

### Forzar tema

```typescript
const { setTheme } = useTheme();
setTheme('dark'); // Forzar modo oscuro
```

### Limpiar preferencia

```typescript
localStorage.removeItem('theme');
window.location.reload(); // Recargar para aplicar default
```

## 📱 Responsive Design

El tema funciona correctamente en todos los dispositivos:

- ✅ Desktop
- ✅ Tablet
- ✅ Mobile
- ✅ Touch devices

## 🎯 Ejemplos de Uso

### Ejemplo 1: Tarjeta con tema

```tsx
function Tarjeta({ titulo, contenido }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {titulo}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        {contenido}
      </p>
    </div>
  );
}
```

### Ejemplo 2: Input con tema

```tsx
function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        {...props}
        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
```

### Ejemplo 3: Tabla con tema

```tsx
function Tabla({ datos }) {
  return (
    <table className="w-full bg-white dark:bg-gray-800">
      <thead className="bg-gray-50 dark:bg-gray-900">
        <tr>
          <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
            Nombre
          </th>
        </tr>
      </thead>
      <tbody>
        {datos.map((item, i) => (
          <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
              {item.nombre}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## 📊 Comparación Visual

### Modo Claro
- Fondo blanco
- Texto oscuro
- Bordes claros
- Sombras sutiles
- Ideal para ambientes iluminados

### Modo Oscuro
- Fondo oscuro
- Texto claro
- Bordes oscuros
- Sombras profundas
- Ideal para ambientes oscuros
- Reduce fatiga visual
- Ahorra batería en OLED

## 🔗 Recursos Adicionales

- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Material Design Colors](https://material.io/design/color/)

## 📞 Soporte

Para problemas o sugerencias relacionadas con el sistema de temas, contacta al equipo de desarrollo.

---

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA  
**Versión:** 2.0.0  
**Última actualización:** 2024
