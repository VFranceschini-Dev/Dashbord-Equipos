# Guía de Integración de Importación CSV/Excel

## 📋 Componente Reutilizable: `ImportModal`

Se ha creado un componente modular y reutilizable para importar datos desde archivos CSV y Excel en cualquier módulo del sistema.

## 🎯 Características

✅ **Soporte multi-formato**: CSV y Excel (.xlsx, .xls)  
✅ **Validación de datos**: Valida cada fila antes de importar  
✅ **Mapeo de columnas**: Mapea automáticamente las columnas del archivo a los campos del sistema  
✅ **Plantillas descargables**: Genera plantillas CSV/Excel con los headers correctos  
✅ **Reporte de errores**: Muestra errores detallados por fila  
✅ **Diseño responsive**: Funciona en todos los dispositivos  
✅ **Modo oscuro**: Compatible con el tema claro/oscuro  

## 🔧 Cómo Integrar en un Módulo

### Paso 1: Importar el componente

```typescript
import ImportModal from './ImportModal';
import { Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
```

### Paso 2: Agregar estado para controlar el modal

```typescript
const [showImport, setShowImport] = useState(false);
```

### Paso 3: Crear función de manejo de importación

```typescript
const handleImport = (importedData: any[]) => {
  importedData.forEach(item => {
    addCollaborator({
      ...item,
      id: uuidv4(),
      active: true,
      equipmentCount: 0,
      joinDate: item.joinDate || new Date().toISOString().split('T')[0],
      notes: item.notes || '',
    } as Collaborator);
  });
  setShowImport(false);
};
```

### Paso 4: Agregar botón de importar

```typescript
<button onClick={() => setShowImport(true)}
  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
  <Upload size={16} /> Importar
</button>
```

### Paso 5: Agregar el modal al final del componente

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Colaboradores"
  templateHeaders={['nombre', 'apellido', 'dni', 'email', 'telefono', 'departamento', 'cargo']}
  mapping={{
    'nombre': 'name', 'name': 'name',
    'apellido': 'lastName', 'lastName': 'lastName',
    'dni': 'dni',
    'email': 'email',
    'telefono': 'phone', 'phone': 'phone',
    'departamento': 'department', 'department': 'department',
    'cargo': 'position', 'position': 'position',
  }}
  validator={(row) => {
    if (!row.name) return 'Nombre es obligatorio';
    if (!row.lastName) return 'Apellido es obligatorio';
    return null;
  }}
/>
```

## 📝 Ejemplos de Configuración por Módulo

### 1. Colaboradores

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Colaboradores"
  templateHeaders={['nombre', 'apellido', 'dni', 'email', 'telefono', 'departamento', 'cargo']}
  mapping={{
    'nombre': 'name', 'name': 'name',
    'apellido': 'lastName', 'lastName': 'lastName',
    'dni': 'dni',
    'email': 'email',
    'telefono': 'phone', 'phone': 'phone',
    'departamento': 'department', 'department': 'department',
    'cargo': 'position', 'position': 'position',
  }}
  validator={(row) => {
    if (!row.name) return 'Nombre es obligatorio';
    if (!row.lastName) return 'Apellido es obligatorio';
    return null;
  }}
/>
```

### 2. Proveedores

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Proveedores"
  templateHeaders={['nombre', 'cuit', 'contacto', 'email', 'telefono', 'direccion', 'categoria']}
  mapping={{
    'nombre': 'name', 'name': 'name',
    'cuit': 'cuit',
    'contacto': 'contact', 'contact': 'contact',
    'email': 'email',
    'telefono': 'phone', 'phone': 'phone',
    'direccion': 'address', 'address': 'address',
    'categoria': 'category', 'category': 'category',
  }}
  validator={(row) => {
    if (!row.name) return 'Nombre es obligatorio';
    return null;
  }}
/>
```

### 3. Impresoras

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Impresoras"
  templateHeaders={['nombre', 'modelo', 'ubicacion', 'departamento', 'toner', 'estado']}
  mapping={{
    'nombre': 'name', 'name': 'name',
    'modelo': 'model', 'model': 'model',
    'ubicacion': 'location', 'location': 'location',
    'departamento': 'department', 'department': 'department',
    'toner': 'tonerModel', 'tonerModel': 'tonerModel',
    'estado': 'status', 'status': 'status',
  }}
  validator={(row) => {
    if (!row.name) return 'Nombre es obligatorio';
    if (!row.model) return 'Modelo es obligatorio';
    return null;
  }}
/>
```

### 4. Inventario de Tóner

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Tóner"
  templateHeaders={['modelo', 'marca', 'color', 'stock', 'minStock', 'maxStock', 'precio', 'proveedor']}
  mapping={{
    'modelo': 'model', 'model': 'model',
    'marca': 'brand', 'brand': 'brand',
    'color': 'color',
    'stock': 'stock',
    'minStock': 'minStock',
    'maxStock': 'maxStock',
    'precio': 'unitPrice', 'unitPrice': 'unitPrice',
    'proveedor': 'supplier', 'supplier': 'supplier',
  }}
  validator={(row) => {
    if (!row.model) return 'Modelo es obligatorio';
    if (!row.brand) return 'Marca es obligatoria';
    if (!row.color) return 'Color es obligatorio';
    return null;
  }}
/>
```

### 5. Comprobantes

```typescript
<ImportModal
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onImport={handleImport}
  title="Comprobantes"
  templateHeaders={['numero', 'tipo', 'proveedor', 'fecha', 'monto', 'moneda', 'descripcion', 'estado']}
  mapping={{
    'numero': 'number', 'number': 'number',
    'tipo': 'type', 'type': 'type',
    'proveedor': 'supplierName', 'supplierName': 'supplierName',
    'fecha': 'date', 'date': 'date',
    'monto': 'amount', 'amount': 'amount',
    'moneda': 'currency', 'currency': 'currency',
    'descripcion': 'description', 'description': 'description',
    'estado': 'status', 'status': 'status',
  }}
  validator={(row) => {
    if (!row.number) return 'Número es obligatorio';
    if (!row.supplierName) return 'Proveedor es obligatorio';
    return null;
  }}
/>
```

## 🎨 Formato de Archivos

### CSV
```csv
nombre,apellido,dni,email,telefono,departamento,cargo
Juan,Pérez,12345678,juan@empresa.com,1234567890,IT,Desarrollador
María,González,87654321,maria@empresa.com,0987654321,RRHH,Analista
```

### Excel
| nombre | apellido | dni | email | telefono | departamento | cargo |
|--------|----------|-----|-------|----------|--------------|-------|
| Juan | Pérez | 12345678 | juan@empresa.com | 1234567890 | IT | Desarrollador |
| María | González | 87654321 | maria@empresa.com | 0987654321 | RRHH | Analista |

## ✅ Validación

El validator recibe cada fila y debe retornar:
- `null` si la fila es válida
- Un string con el mensaje de error si la fila es inválida

Ejemplo:
```typescript
validator={(row) => {
  if (!row.name) return 'Nombre es obligatorio';
  if (!row.email) return 'Email es obligatorio';
  if (row.email && !row.email.includes('@')) return 'Email inválido';
  return null;
}}
```

## 🔄 Flujo de Importación

1. Usuario hace clic en "Importar"
2. Se abre el modal con opciones de descarga de plantilla
3. Usuario selecciona un archivo CSV o Excel
4. Sistema lee y valida el archivo
5. Sistema mapea las columnas a los campos del sistema
6. Sistema valida cada fila con el validator
7. Sistema agrega los datos válidos al contexto
8. Sistema muestra reporte de importación (éxitos y errores)
9. Modal se cierra automáticamente si fue exitoso

## 🎯 Mejores Prácticas

1. **Siempre define un validator**: Evita importar datos incompletos o inválidos
2. **Usa nombres de columnas en español**: Más intuitivo para el usuario final
3. **Proporciona plantillas descargables**: Facilita la importación correcta
4. **Maneja errores gracefully**: Muestra mensajes claros y útiles
5. **Permite importación parcial**: Si algunas filas son válidas, impórtalas y reporta los errores

## 📦 Dependencias

El componente usa:
- `xlsx`: Para leer archivos Excel
- `lucide-react`: Para iconos
- `uuid`: Para generar IDs únicos
- React hooks: `useState`, `useRef`

## 🚀 Próximos Pasos

Para integrar este componente en otros módulos:

1. Copia el patrón de integración mostrado arriba
2. Ajusta los `templateHeaders` según los campos del módulo
3. Define el `mapping` correcto para cada campo
4. Implementa un `validator` apropiado
5. Prueba con archivos CSV y Excel de prueba

## 📞 Soporte

Si necesitas ayuda con la integración o tienes preguntas, consulta la documentación del proyecto o contacta al equipo de desarrollo.

---

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA  
**Versión:** 2.0.0  
**Última actualización:** 2024
