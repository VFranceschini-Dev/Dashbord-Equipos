# Temas claro/oscuro

> Documento consolidado. Reemplaza a: `SISTEMA_TEMAS.md`, `SISTEMA_TEMAS_COMPLETO.md`,
> `TEMA_CLARO_OSCURO.md`, `IMPLEMENTACION_MODO_OSCURO.md`, `DASHBOARD_TEMAS.md`.
> Los diagnósticos/reviews históricos quedaron en `docs/DIAGNOSTICO_CORRECCION_TEMAS.md`,
> `docs/REVISION_CORRECCION_TEMAS.md` y `docs/GUIA_VISUAL_TEMAS.md`.

## Implementación actual

- **Contexto**: `src/context/ThemeContext.tsx` expone `useTheme()` con `{ theme, toggleTheme }`.
- **Persistencia**: clave en `localStorage`; se aplica antes del primer render para evitar parpadeo.
- **Mecanismo**: clase `dark` en `<html>` + variantes `dark:` de Tailwind (v4). Transiciones suaves en
  fondos y bordes.
- **Toggle**: un único selector, en el header principal (`Layout.tsx`). *Lección aprendida*: existía un
  segundo toggle duplicado en el Dashboard que fue eliminado (v2.9.5) — no volver a agregarlo.

## Reglas de diseño

- Contraste WCAG AA en ambos modos (texto sobre superficies translúcidas/glassmorphism verificarlo en
  modo oscuro también).
- Gráficos (Recharts) y badges de estado deben re-accionar al tema: usar tokens CSS, no colores fijos.
- Nuevos componentes: escribir primero la variante `dark:` y recién después la clara.

## Tokens principales

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo app | blanco/slate-50 | slate-900/slate-950 |
| Superficie card | white/80 | slate-800/60 |
| Texto primario | gray-900 | white |
| Texto secundario | gray-600 | slate-400 |
| Acento | azul (gradientes VLF) | azul más saturado |
