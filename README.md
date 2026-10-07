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

### Funcionalidades Destacadas

✅ **Autenticación Segura** - Login con email y contraseña  
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

## 🛠️ Tecnologías

- **React 18** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework CSS
- **Lucide React** - Iconos
- **Recharts** - Gráficos y visualizaciones
- **date-fns** - Manipulación de fechas
- **uuid** - Generación de IDs únicos
- **xlsx** - Importación/exportación de archivos Excel
- **mammoth** - Extracción de texto de archivos Word
- **pdfjs-dist** - Extracción de texto de archivos PDF

## 📁 Estructura del Proyecto

```
src/
├── components/              # Componentes React
│   ├── Login.tsx           # Pantalla de login
│   ├── Layout.tsx          # Layout principal con sidebar
│   ├── Dashboard.tsx       # Panel de control con toggle de tema
│   ├── Equipments.tsx      # Gestión de equipamientos con importación
│   ├── Collaborators.tsx   # Gestión de colaboradores
│   ├── Suppliers.tsx       # Gestión de proveedores
│   ├── Vouchers.tsx        # Gestión de comprobantes
│   ├── Printers.tsx        # Gestión de impresoras
│   ├── Inventory.tsx       # Control de inventario
│   ├── Movements.tsx       # Registro de movimientos
│   ├── Reports.tsx         # Reportes y análisis
│   ├── ImportData.tsx      # Componente de importación general
│   └── ImportModal.tsx     # Modal reutilizable de importación
├── context/                # Contextos React
│   ├── AppContext.tsx      # Estado global de la aplicación
│   ├── AuthContext.tsx     # Estado de autenticación
│   └── ThemeContext.tsx    # Estado del tema (oscuro/claro)
├── utils/                  # Utilidades de importación
│   ├── csvImporter.ts      # Importación CSV
│   ├── excelImporter.ts    # Importación Excel
│   ├── docxImporter.ts     # Importación Word
│   └── pdfImporter.ts      # Importación PDF
├── types.ts               # Tipos TypeScript
├── data.ts               # Datos iniciales y constantes
├── App.tsx               # Componente principal
├── main.tsx              # Punto de entrada
└── index.css             # Estilos globales con soporte dark mode
```

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

Ver `IMPORTACION_GUIA.md` para más detalles sobre cómo integrar en otros módulos.

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

Ver `TEMA_CLARO_OSCURO.md` para más detalles técnicos.

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

- ✅ Credenciales no visibles en la pantalla de login
- ✅ Mensajes de error genéricos
- ✅ Sesión persistente con localStorage
- ✅ Atributos autoComplete para mejor UX
- ✅ Botón de cerrar sesión visible

## 📚 Documentación Adicional

El proyecto incluye documentación completa:

- **README.md** - Este archivo (documentación principal)
- **SKILL_DOCUMENT.md** - Habilidades y capacidades del sistema
- **IMPORTACION_GUIA.md** - Guía completa de integración de importación
- **TEMA_CLARO_OSCURO.md** - Guía técnica del sistema de temas
- **MEJORAS_IMPLEMENTADAS.md** - Resumen de todas las mejoras

## 📝 Créditos

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA  
**Para:** Area Sistemas PEDSA  
**Versión:** 2.9.0  
**Año:** 2024

## 📄 Licencia

Todos los derechos reservados - VFL / Area Sistemas PEDSA

---

Para más información o soporte, contacta a VFL o al Area Sistemas PEDSA.
