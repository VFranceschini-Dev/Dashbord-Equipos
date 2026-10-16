# Changelog — Dashboard Control de Equipamientos

Historial de versiones del sistema. Formato ordenado por versión (más reciente primero).

Fuentes consolidadas en este archivo: `CAMBIOS_V2.9.5.md`, `MEJORAS_IMPLEMENTADAS.md` y
`CORRECCIONES_IDENTIDAD.md` (los documentos originales de una sola entrada se eliminaron de la raíz).

---

## [2.9.5]

Cambios puntuales de UX solicitados por el cliente (detalle completo en `docs/REPOSITORIO_RESUMEN.md`):

- **Login**: crédito de desarrollo actualizado a ">vlf_ VLFranceschini Dev" en `src/components/Login.tsx`.
- **Toggle duplicado eliminado**: el selector de tema claro/oscuro aparecía en `Layout.tsx` y en
  `Dashboard.tsx`; se conservó únicamente el del header principal (`Layout.tsx`).
- **Nombre unificado**: el título pasó a ser **"Dashboard de Equipamiento"** en Hero Header y en el
  estado de bienvenida (antes convivían "Dashboard Control" y "Dashboard Control de Equipamientos").

## [2.9.0] — Correcciones de identidad

- Nombre del sistema: de "Sistema de Control de Tóner" a **"Dashboard Control de Equipamientos"**
  (alcance: `index.html`, `package.json`, `src/components/Layout.tsx`).
- Créditos de desarrollo normalizados: "Desarrollado por VLF dev para Sistemas PEDSA".
- Versión del proyecto llevada a 2.9.0 (unifica las 2.0.0 / 2.8.0 que convivían en distintos archivos).

## [2.8.0] — Mejoras principales (temas + importación)

### Sistema de temas claro/oscuro
- Contexto global `src/context/ThemeContext.tsx` con persistencia en `localStorage`.
- Toggle en el Dashboard, transiciones suaves, todos los componentes adaptados, accesibilidad WCAG AA.
- Documentación de diseño y variantes: `docs/temas.md`.

### Importación CSV/Excel multi-módulo
- Componente modular `ImportModal` reutilizable en todos los módulos.
- Integración completa en Equipamientos; mapeo de columnas flexible y validación previa a la carga.
- Dependencias: `xlsx` (lectura de planillas), `mammoth` (Word), `pdfjs-dist` (PDF).
- Documentación del flujo: `docs/importacion.md`.

## [≤2.7.x] — Historial temprano

Versiones iniciales del sistema de control de tóner (ABM de impresoras, inventario, movimientos y
reportes). El detalle quedó en el historial de git (`git log`) y en los documentos consolidados de `docs/`.
