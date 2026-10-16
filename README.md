# Dashboard Control de Equipamientos

Sistema integral de gestión de equipamientos, impresión y monitoreo remoto desarrollado por **VFL** para **VLF dev para Sistemas PEDSA**.

## 🚀 Características

### Módulos Principales

- **📊 Dashboard** - Panel de control con estadísticas en tiempo real y toggle de tema
- **🖥️ Equipamientos** - ABM completo de equipos con importación CSV/Excel
- **👥 Colaboradores** - Gestión de personal con asignación de equipos
- **🏢 Proveedores** - Control de proveedores con categorías
- **🧾 Comprobantes** - Gestión de facturas, recibos, órdenes de compra, remitos y notas de crédito
- **🖨️ Impresoras** - Administración de impresoras y su mantenimiento
- **📦 Inventario** - Control de stock de tóner con alertas de stock bajo
- **🔄 Movimientos** - Registro de entregas, reposiciones, devoluciones y desechos
- **📈 Reportes** - Análisis y exportación de datos
- **📥 Importar Datos** - Importación masiva desde CSV, Excel, Word y PDF
- **🔁 Asignaciones** - Búsqueda de usuarios en SAI_TEST (solo lectura) y registro de entrega/devolución de equipos en Supabase

### Funcionalidades Destacadas

✅ **Autenticación Segura** - Login real con Supabase Auth (email y contraseña)  
✅ **Diseño Responsive** - Interfaz adaptable a todos los dispositivos  
✅ **Tema Oscuro/Claro** - Toggle con persistencia en localStorage  
✅ **Estilo Figma** - UI moderna con gradientes, glassmorphism y animaciones  
✅ **Importación Multi-Formato** - CSV, Excel, Word y PDF con validación  
✅ **Componente Reutilizable** - ImportModal para cualquier módulo  
✅ **Alertas Automáticas** - Notificaciones de stock bajo y mantenimiento  
✅ **Exportación de Datos** - Reportes en formato JSON  
✅ **Búsqueda y Filtros** - Búsqueda avanzada en todos los módulos  
✅ **CRUD Completo** - Alta, baja y modificación en todos los módulos  

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## 🛠️ Stack

- **React 18 + TypeScript** - Framework de UI con tipado estático
- **Vite 6** - Build tool y dev server
- **Tailwind CSS 4** - Framework CSS (tema claro/oscuro)
- **Supabase** - Auth real (login por email/contraseña), Postgres con RLS y storage del ABM
- **Vercel** - Hosting del frontend + funciones serverless (`api/`) para leer la fuente externa
- **Metabase (SAI_TEST, solo lectura)** - Fuente de usuarios externos vía `ipa.donnet.com.ar`
- **Lucide React** - Iconos · **Recharts** - Gráficos · **date-fns** - Fechas
- **xlsx / mammoth / pdfjs-dist** - Importación desde Excel, Word y PDF

## 🏗️ Arquitectura

```
navegador (React SPA en Vercel)
   ├── HTTPS + anon key (RLS protege) ──► Supabase (Auth + Postgres: todo el ABM)
   └── fetch('/api/usuarios') + Bearer token ──► función serverless Vercel
                                                     │ x-api-key (solo ahí, sin prefijo VITE_)
                                                     ▼
                                        ipa.donnet.com.ar/api → Metabase SAI_TEST (SOLO LECTURA)
```

- La API key externa **nunca llega al navegador**; el backend interno (`server/`) fue eliminado.
- SAI_TEST es de solo lectura: las asignaciones se registran en Supabase.
- Patrón "primero Supabase, después estado": si la escritura falla, el estado de React no cambia.

Detalle completo: [`docs/arquitectura.md`](docs/arquitectura.md).

## 📁 Estructura del Proyecto

```
.
├── api/                    # Funciones serverless de Vercel (lectura de usuarios externos)
├── docs/                   # Documentación temática consolidada
├── scripts/                # Helpers (setup auth, deploy Vercel, test de conexión)
├── supabase/
│   ├── schema.sql          # Esquema de referencia
│   └── migrations/         # Migraciones idempotentes (AAAAMMDD_descripcion.sql)
├── src/                    # Código de la aplicación
│   ├── components/         # React: Login, Layout, Dashboard, Equipments, Collaborators,
│   │                       # Suppliers, Vouchers, Printers, Inventory, Movements, Reports,
│   │                       # ImportData, ImportModal, Asignaciones, monitoreo remoto
│   ├── context/            # AppContext (estado = copia de Supabase), AuthContext, ThemeContext
│   ├── services/           # supabase.ts, supabaseSync.ts (ABM), authService.ts,
│   │                       # metabaseProxy.ts (llama a /api/usuarios), Mesh Central, etc.
│   ├── utils/              # Importadores CSV/Excel/Word/PDF, compatibilidad de tóner
│   ├── types.ts            # Tipos TypeScript
│   ├── data.ts             # Constantes del sistema
│   ├── App.tsx / main.tsx  # Entry points
│   └── index.css           # Estilos globales + dark mode
└── CHANGELOG.md            # Historial de versiones
```

## 🏃 Correr en local

```bash
npm install
cp .env.example .env        # completar con TU proyecto Supabase (sin valores reales en el repo)
npm run dev                 # Vite en http://localhost:3000 (host 0.0.0.0, strictPort)
npx vercel dev              # si además necesitás las funciones api/* locales
npm run typecheck           # chequeo de tipos
npm run build               # producción → dist/
```

## ⚙️ Variables de entorno

Solo los nombres — los valores reales van en `.env` local y en
Vercel → Settings → Environment Variables (nunca se comitean):

| Variable | Dónde | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend | anon key (pública; RLS protege los datos) |
| `IPA_API_URL` | función serverless | Base de la API externa (Metabase SAI_TEST, solo lectura) |
| `IPA_API_KEY` | función serverless | x-api-key de un grupo con permisos de solo consulta |
| `IPA_DB_ID` | función serverless | ID numérico de la base destino (SAI_TEST) |
| `IPA_USUARIOS_TABLE_ID` | función serverless | source-table de UsuariosAccesos |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | función serverless | Validación de sesión (Bearer token) |

**Regla:** ninguna variable secreta puede llevar prefijo `VITE_` (se compila dentro del bundle).
Ver [`docs/seguridad.md`](docs/seguridad.md).

## 🎨 Diseño UI/UX

El sistema utiliza un diseño moderno estilo Figma con:

- **Gradientes sutiles** en headers y cards
- **Glassmorphism** en elementos flotantes
- **Animaciones suaves** en transiciones
- **Iconos consistentes** de Lucide React
- **Paleta de colores** profesional
- **Tipografía jerárquica** clara
- **Espaciado generoso** para mejor legibilidad
- **Microinteracciones** en hover y click
- **Tema claro/oscuro** con toggle y persistencia

## 📥 Importación de Datos

El sistema soporta importación masiva desde múltiples formatos:

### Formatos Soportados
- **CSV** (.csv) - Archivos de texto delimitados por comas
- **Excel** (.xlsx, .xls) - Hojas de cálculo de Microsoft Excel
- **Word** (.docx) - Documentos de Microsoft Word
- **PDF** (.pdf) - Documentos PDF con texto extraíble

### Características
- ✅ **Validación automática** de datos antes de importar
- ✅ **Mapeo inteligente** de columnas
- ✅ **Plantillas descargables** en CSV y Excel
- ✅ **Reporte de errores** detallado por fila
- ✅ **Componente reutilizable** (ImportModal) para cualquier módulo
- ✅ **Integrado en Equipamientos** como ejemplo

### Uso
1. Ve al módulo deseado (ej: Equipamientos)
2. Click en "Importar"
3. Descarga la plantilla o prepara tu archivo
4. Selecciona el archivo (CSV, Excel, Word o PDF)
5. El sistema valida y muestra errores si los hay
6. Los datos válidos se importan automáticamente

Ver [`docs/importacion.md`](docs/importacion.md) para más detalles sobre cómo integrar en otros módulos.

## 🌓 Tema Claro/Oscuro

El sistema incluye un sistema completo de temas:

### Características
- ✅ **Toggle en Dashboard** - Botón sol/luna en la esquina superior derecha
- ✅ **Persistencia** - La preferencia se guarda en localStorage
- ✅ **Transiciones suaves** - Cambios de tema sin parpadeo
- ✅ **Componentes adaptados** - Todos los componentes soportan ambos modos
- ✅ **Accesibilidad** - Contrastes optimizados para WCAG AA

### Uso
- Click en el icono de sol/luna en el Dashboard
- El tema se guarda automáticamente
- Se restaura al recargar la página

Ver [`docs/temas.md`](docs/temas.md) para más detalles técnicos.

## 📊 Módulos Detallados

### Equipamientos
- Tipos: PC Escritorio, Notebook, Servidor, Monitor, Periférico, Otro
- Categorías: Informática, Impresión, Redes, Almacenamiento, Periféricos, Mobiliario, Otros
- Estados: Asignado, Disponible, Mantenimiento, Retirado
- Campos: marca, modelo, N° serie, código activo, fechas, asignación a colaborador

### Colaboradores
- Departamentos predefinidos
- Contador de equipos asignados en tiempo real
- Avatares con iniciales
- Estado activo/inactivo

### Proveedores
- Categorías: Hardware, Software, Servicios, Insumos, Consultoría, Otros
- Datos: CUIT, contacto, email, teléfono, dirección
- Estado activo/inactivo

### Comprobantes
- Tipos: Factura, Recibo, Orden de Compra, Remito, Nota de Crédito
- Estados: Pendiente, Aprobado, Rechazado, Procesado
- Soporte multi-moneda (ARS/USD)
- Vinculación con proveedores

### Inventario
- Control de stock mínimo y máximo
- Alertas automáticas de stock bajo
- Barras de progreso visuales
- Reposición rápida

### Movimientos
- Tipos: Entrega, Reposición, Devolución, Desecho
- Actualización automática de stock
- Filtros por tipo y fecha
- Búsqueda avanzada

## 🔒 Seguridad

- ✅ Login real con Supabase Auth (sin usuarios ni contraseñas definidos en el código)
- ✅ API key de la fuente externa solo en funciones serverless de Vercel (nunca en el bundle)
- ✅ RLS por usuario (`auth.uid() = user_id`) en todas las tablas del ABM
- ✅ SAI_TEST es de solo lectura: nada se escribe en la base externa
- ✅ Mensajes de error genéricos en login; sesión gestionada por JWT de Supabase
- Detalle y checklist: [`docs/seguridad.md`](docs/seguridad.md).

## 📚 Documentación

Toda la documentación temática vive en [`docs/`](docs/):

| Documento | Tema |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Arquitectura actual, historia del backend eliminado, auth |
| [docs/supabase.md](docs/supabase.md) | Setup del proyecto, esquema, RLS, patrón ABM |
| [docs/importacion.md](docs/importacion.md) | Importación CSV/Excel/Word/PDF |
| [docs/temas.md](docs/temas.md) | Sistema de tema claro/oscuro |
| [docs/dispositivos.md](docs/dispositivos.md) | Mapeo y monitoreo de dispositivos (Mesh Central) |
| [docs/modulos.md](docs/modulos.md) | Módulos funcionales del sistema |
| [docs/seguridad.md](docs/seguridad.md) | Reglas de seguridad y checklist |
| [docs/identidad-visual.md](docs/identidad-visual.md) | Nombre, logo y créditos |
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones |

Los documentos históricos sueltos que quedaron en `docs/` conservan contexto de versiones
anteriores; los temas vigentes están consolidados en los ocho documentos de la tabla.

## 🗂️ Usuarios externos (SAI_TEST) e integración

Flujo: navegador → `/api/usuarios` (función serverless de Vercel, valida sesión Supabase) →
Metabase SAI_TEST vía HTTPS, con `x-api-key` guardada solo en la función. El backend interno
`server/` fue eliminado del repositorio.

- Tabla leída: `UsuariosAccesos` (proyección segura: id, login, nombre completo, perfil, ubicación, tipo, activo).
- Nunca se exponen `contrasenia`, `servicekey_path`, `identityrecord` ni vencimientos.
- Las asignaciones se registran en Supabase (`equipment_movements` + RPC atómica
  `registrar_equipment_movement`); ver `supabase/migrations/`.
- Si la función no responde, la app muestra un aviso y sigue operando con lo guardado en Supabase.
- Skill con el patrón completo: `.claude/skills/metabase-integracion/SKILL.md`.

### Scripts auxiliares
- `./scripts/setup-supabase-auth.sh` — alta de usuarios en Supabase Auth.
- `./scripts/deploy-vercel.sh [--preview]` — build + deploy a Vercel (requiere `VERCEL_TOKEN`).
- `./scripts/test-proxy-metabase.sh [url]` — prueba health/usuarios/búsqueda de la API externa.

## 📝 Créditos

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA
**Para:** Area Sistemas PEDSA
**Versión:** 2.9.5
**Año:** 2026

## 📄 Licencia

Todos los derechos reservados - VLF dev / Area Sistemas PEDSA

---

Para más información o soporte, contacta a VLF dev o al Area Sistemas PEDSA.
