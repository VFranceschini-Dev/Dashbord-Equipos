# Importación de datos

> Documento consolidado. Reemplaza a: `IMPORTACION_GUIA.md`, `CORRECCION_IMPORTACION_EXCEL.md`,
> `CAMBIOS_IMPORTACION_MENSAJES.md`. El flujo con Supabase está en `docs/supabase.md` y
> `docs/FLUJO_IMPORTACION_SUPABASE.md` / `docs/IMPORTACION_SUPABASE.md` (originales conservados como historial).

## Formatos soportados

| Formato | Librería | Notas |
|---|---|---|
| CSV | parseo propio | separador `,` o `;` detectado |
| Excel (.xlsx/.xls) | `xlsx` (SheetJS) | ver aviso de seguridad más abajo |
| Word (.docx) | `mammoth` | extracción de texto/tablas |
| PDF | `pdfjs-dist` | extracción de texto |

## Componente `ImportModal`

Reutilizable en todos los módulos (`src/components/ImportModal.tsx`):

1. Selección de archivo → detección de formato.
2. Mapeo de columnas del archivo a campos del módulo (autodetección por nombre de cabecera).
3. Vista previa + validación fila por fila (errores inline, filas inválidas marcadas).
4. Confirmación → importación por lotes al estado y a Supabase (patrón *primero Supabase, después estado*).

### Correcciones históricas relevantes

- **Excel**: las hojas con encabezados en múltiples filas / celdas combinadas se aplanan antes del
  mapeo; si el archivo está protegido con contraseña, se informa al usuario (no se puede leer).
- **Mensajes**: los resultados de importación distinguen creados / actualizados / con errores y no
  cierran el modal hasta confirmación explícita.

## Módulos con importación integrada

Equipamientos (completa), Colaboradores, Proveedores, Impresoras, Inventario de tóner, Comprobantes.

## Seguridad de `xlsx`

La versión publicada en npm (`xlsx@0.18.5`) tiene advisories conocidos (prototype pollution / ReDoS).
La distribución segura es la de SheetJS CDN (`https://cdn.sheetjs.com`). Pendiente de migración — ver
`README.md > Riesgos pendientes`.
