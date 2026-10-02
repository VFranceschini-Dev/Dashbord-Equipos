# Sistema de Control de Tóner - Rama Principal

Sistema integral de gestión de impresión, equipamientos, colaboradores, proveedores y comprobantes desarrollado por **Sistemas PEDSA**.

## 🚀 Características

### Módulos Principales

- **📊 Dashboard** - Panel de control con estadísticas en tiempo real
- **🖥️ Equipamientos** - ABM completo de equipos con clasificación por tipo y categoría
- **👥 Colaboradores** - Gestión de personal con asignación de equipos
- **🏢 Proveedores** - Control de proveedores con categorías
- **🧾 Comprobantes** - Gestión de facturas, recibos, órdenes de compra, remitos y notas de crédito
- **🖨️ Impresoras** - Administración de impresoras y su mantenimiento
- **📦 Inventario** - Control de stock de tóner con alertas de stock bajo
- **🔄 Movimientos** - Registro de entregas, reposiciones, devoluciones y desechos
- **📈 Reportes** - Análisis y exportación de datos

### Funcionalidades Destacadas

✅ **Autenticación Segura** - Login con email y contraseña  
✅ **Diseño Responsive** - Interfaz adaptable a todos los dispositivos  
✅ **Estilo Figma** - UI moderna con gradientes, glassmorphism y animaciones  
✅ **Alertas Automáticas** - Notificaciones de stock bajo y mantenimiento  
✅ **Exportación de Datos** - Reportes en formato JSON  
✅ **Búsqueda y Filtros** - Búsqueda avanzada en todos los módulos  
✅ **CRUD Completo** - Alta, baja y modificación en todos los módulos  

## 🔐 Credenciales de Acceso

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Administrador** | soporte@donnet.com.ar | 6mn78az39* |
| **Usuario** | usuario@donnet.com.ar | user123 |

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
- **Tailwind CSS 4** - Framework CSS
- **Lucide React** - Iconos
- **Recharts** - Gráficos y visualizaciones
- **date-fns** - Manipulación de fechas
- **uuid** - Generación de IDs únicos

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── Login.tsx       # Pantalla de login
│   ├── Layout.tsx      # Layout principal con sidebar
│   ├── Dashboard.tsx   # Panel de control
│   ├── Equipments.tsx  # Gestión de equipamientos
│   ├── Collaborators.tsx # Gestión de colaboradores
│   ├── Suppliers.tsx   # Gestión de proveedores
│   ├── Vouchers.tsx    # Gestión de comprobantes
│   ├── Printers.tsx    # Gestión de impresoras
│   ├── Inventory.tsx   # Control de inventario
│   ├── Movements.tsx   # Registro de movimientos
│   └── Reports.tsx     # Reportes y análisis
├── context/            # Contextos React
│   ├── AppContext.tsx  # Estado global de la aplicación
│   └── AuthContext.tsx # Estado de autenticación
├── types.ts           # Tipos TypeScript
├── data.ts           # Datos iniciales y constantes
├── App.tsx           # Componente principal
├── main.tsx          # Punto de entrada
└── index.css         # Estilos globales
```

## 🎨 Diseño UI/UX

El sistema utiliza un diseño moderno inspirado en Figma con:

- **Gradientes sutiles** en headers y cards
- **Glassmorphism** en elementos flotantes
- **Animaciones suaves** en transiciones
- **Iconos consistentes** de Lucide React
- **Paleta de colores** profesional
- **Tipografía jerárquica** clara
- **Espaciado generoso** para mejor legibilidad
- **Microinteracciones** en hover y click

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

## 📝 Créditos

**Desarrollado por:** Sistemas PEDSA  
**Versión:** 2.0.0  
**Año:** 2024

## 📄 Licencia

Todos los derechos reservados - VFranceschini-Dev

---

Para más información o soporte
