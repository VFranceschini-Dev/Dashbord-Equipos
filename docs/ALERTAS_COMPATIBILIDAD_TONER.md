# 📦 Sistema de Alertas por Compatibilidad de Tóner

## 🎯 Descripción

El sistema de alertas por stock mínimo ha sido mejorado para considerar la **compatibilidad de tóneres**. Ahora, cuando un mismo modelo de tóner puede ser comprado a diferentes proveedores, el sistema agrupa todos los registros compatibles y calcula el stock total antes de generar alertas.

---

## 🔍 ¿Qué es Compatibilidad de Tóner?

Dos o más registros de tóner se consideran **compatibles** cuando tienen:
- ✅ Misma **marca** (brand)
- ✅ Mismo **modelo** (model)
- ✅ Mismo **color** (color)

### Ejemplo Práctico

Supongamos que tienes los siguientes registros de tóner en el inventario:

| ID | Marca | Modelo | Color | Stock | Proveedor | Precio |
|----|-------|--------|-------|-------|-----------|--------|
| 1  | HP    | 26A    | Negro | 3     | Proveedor A | $50 |
| 2  | HP    | 26A    | Negro | 2     | Proveedor B | $48 |
| 3  | HP    | 26A    | Negro | 1     | Proveedor C | $52 |

**Antes:** El sistema generaba 3 alertas separadas (una por cada registro)

**Ahora:** El sistema agrupa los 3 registros como compatibles y calcula:
- **Stock total:** 3 + 2 + 1 = **6 unidades**
- **Proveedores:** Proveedor A, Proveedor B, Proveedor C
- **Precio promedio:** $50

Si el stock mínimo es 5, **NO se genera alerta** porque 6 > 5 ✅

---

## 📊 Cómo Funciona el Sistema

### 1. Agrupación por Compatibilidad

```typescript
// Clave de compatibilidad: marca + modelo + color
const compatibilityKey = `${brand}|${model}|${color}`;

// Ejemplo: "HP|26A|black"
```

### 2. Cálculo de Stock Total

```typescript
// Agrupa todos los tóneres con la misma clave
const groups = groupTonersByCompatibility(toners);

// Cada grupo contiene:
{
  key: { brand: 'HP', model: '26A', color: 'black' },
  toners: [/* todos los registros compatibles */],
  totalStock: 6,  // Suma de todos los stocks
  minStock: 5,    // Stock mínimo configurado
  maxStock: 20,   // Stock máximo configurado
  avgPrice: 50,   // Precio promedio ponderado
  suppliers: ['Proveedor A', 'Proveedor B', 'Proveedor C']
}
```

### 3. Generación de Alertas

```typescript
// Solo genera alerta si el stock TOTAL del grupo es bajo
const lowStockGroups = getLowStockGroups(toners);

// Filtra grupos donde totalStock <= minStock
```

---

## 🎨 Visualización en la Interfaz

### Dashboard

El Dashboard ahora muestra:
- ✅ **Número de modelos únicos** con stock bajo (no registros individuales)
- ✅ **Componente LowStockAlerts** que muestra alertas agrupadas

### Inventario

La tabla de inventario muestra:
- ✅ **Stock total compatible** (suma de todos los proveedores)
- ✅ **Indicador visual** "Total compatible (Marca Modelo)"
- ✅ **Barra de progreso** basada en el stock total del grupo

### Componente LowStockAlerts

Muestra alertas detalladas con:
- ✅ Marca y modelo del tóner
- ✅ Color
- ✅ **Stock total** (suma de todos los proveedores)
- ✅ Stock mínimo y máximo
- ✅ **Lista de proveedores** que tienen ese tóner
- ✅ **Número de registros** compatibles
- ✅ Precio promedio ponderado

---

## 📁 Archivos Modificados

### Nuevos
- ✅ `src/utils/tonerCompatibility.ts` - Lógica de agrupación
- ✅ `src/components/LowStockAlerts.tsx` - Componente de alertas

### Modificados
- ✅ `src/components/Dashboard.tsx` - Usa grupos de compatibilidad
- ✅ `src/components/Inventory.tsx` - Muestra stock total compatible
- ✅ `src/services/notifications.ts` - Nueva categoría 'inventory'

---

## 🔧 Funciones Principales

### `groupTonersByCompatibility(toners: TonerItem[])`

Agrupa tóneres por compatibilidad y calcula estadísticas del grupo.

**Retorna:** `TonerCompatibilityGroup[]`

```typescript
interface TonerCompatibilityGroup {
  key: { brand: string; model: string; color: string };
  toners: TonerItem[];
  totalStock: number;
  minStock: number;
  maxStock: number;
  avgPrice: number;
  suppliers: string[];
}
```

### `getLowStockGroups(toners: TonerItem[])`

Obtiene los grupos de compatibilidad con stock bajo.

**Retorna:** `TonerCompatibilityGroup[]`

### `getCompatibilityKey(toner: TonerItem)`

Genera una clave única para identificar compatibilidad.

**Retorna:** `string` (formato: "marca|modelo|color")

### `getCompatibleToners(toner: TonerItem, allToners: TonerItem[])`

Obtiene todos los tóneres compatibles con uno específico.

**Retorna:** `TonerItem[]`

### `generateLowStockAlertMessage(group: TonerCompatibilityGroup)`

Genera un mensaje descriptivo para una alerta de stock bajo.

**Retorna:** `string`

---

## 💡 Beneficios

### 1. **Alertas Más Precisas**
- ❌ Antes: Alertas falsas cuando el stock total era suficiente
- ✅ Ahora: Solo alerta cuando el stock TOTAL es realmente bajo

### 2. **Mejor Toma de Decisiones**
- ✅ Ves cuántos proveedores tienen el tóner
- ✅ Conoces el precio promedio
- ✅ Sabes cuántas unidades tienes en total

### 3. **Optimización de Compras**
- ✅ Puedes comparar precios entre proveedores
- ✅ Identificas qué proveedores tienen stock
- ✅ Tomas decisiones informadas sobre dónde comprar

### 4. **Reducción de Ruido**
- ✅ Menos alertas innecesarias
- ✅ Información más relevante y accionable

---

## 🧪 Ejemplos de Uso

### Escenario 1: Stock Suficiente en Múltiples Proveedores

**Registros:**
- HP 26A Negro - Proveedor A: 2 unidades
- HP 26A Negro - Proveedor B: 3 unidades
- HP 26A Negro - Proveedor C: 2 unidades

**Stock mínimo:** 5 unidades

**Resultado:**
- Stock total: 7 unidades ✅
- **NO se genera alerta** (7 > 5)

### Escenario 2: Stock Bajo en Todos los Proveedores

**Registros:**
- HP 26A Negro - Proveedor A: 1 unidad
- HP 26A Negro - Proveedor B: 1 unidad

**Stock mínimo:** 5 unidades

**Resultado:**
- Stock total: 2 unidades ❌
- **Se genera alerta** (2 ≤ 5)
- Mensaje: "HP 26A (Negro) - Stock total: 2 (mínimo: 5) - Proveedores: Proveedor A, Proveedor B"

### Escenario 3: Un Solo Proveedor con Stock Bajo

**Registros:**
- HP 26A Negro - Proveedor A: 3 unidades

**Stock mínimo:** 5 unidades

**Resultado:**
- Stock total: 3 unidades ❌
- **Se genera alerta** (3 ≤ 5)

---

## 🎯 Casos de Uso Reales

### Caso 1: Tóner Genérico vs Original

Puedes tener:
- HP 26A Original - Proveedor Oficial: 2 unidades
- HP 26A Genérico - Proveedor Alternativo: 5 unidades

**Nota:** Estos NO son compatibles porque tienen diferente marca/modelo.
Cada uno genera sus propias alertas.

### Caso 2: Mismo Tóner de Diferentes Proveedores

Puedes tener:
- HP 26A - Proveedor A: 3 unidades @ $50
- HP 26A - Proveedor B: 2 unidades @ $48
- HP 26A - Proveedor C: 1 unidad @ $52

**Todos son compatibles** (misma marca, modelo y color).
- Stock total: 6 unidades
- Precio promedio: $50
- Se genera UNA sola alerta si el total es bajo

### Caso 3: Diferentes Colores del Mismo Modelo

Puedes tener:
- HP 26A Negro: 5 unidades
- HP 26A Cian: 3 unidades
- HP 26A Magenta: 2 unidades
- HP 26A Amarillo: 4 unidades

**NO son compatibles entre sí** (diferente color).
Cada color genera sus propias alertas.

---

## 📈 Métricas y Estadísticas

### En el Dashboard
- **Modelos Únicos:** Número de grupos de compatibilidad
- **Registros Totales:** Número de registros individuales
- **Stock Bajo:** Número de grupos con stock bajo

### En el Inventario
- **Total Modelos:** Grupos de compatibilidad únicos
- **Unidades Totales:** Suma de todos los stocks
- **Valor Inventario:** Valor total en dinero
- **Stock Bajo:** Grupos con stock bajo

---

## 🔔 Sistema de Notificaciones

### Nueva Categoría: 'inventory'

Se ha agregado una nueva categoría de notificaciones para alertas de inventario:

```typescript
notifyLowStockGroup(
  brand: string,
  model: string,
  color: string,
  totalStock: number,
  minStock: number,
  suppliers: string[]
)
```

### Ejemplo de Notificación

```
🔔 Stock Bajo
HP 26A (Negro) - Stock total: 2 (mínimo: 5) - 
Proveedores: Proveedor A, Proveedor B
```

---

## 🚀 Próximas Mejoras

### Planificadas
- [ ] Sugerencias automáticas de compra basadas en precios
- [ ] Historial de stock por proveedor
- [ ] Gráficos de tendencia de stock
- [ ] Alertas predictivas (cuando el stock llegará al mínimo)
- [ ] Integración con sistema de pedidos automáticos

### Sugeridas
- [ ] Exportar reportes de compatibilidad
- [ ] Importar tóneres compatibles en bulk
- [ ] Validación de compatibilidad al agregar nuevos tóneres

---

## 📝 Notas Técnicas

### Rendimiento
- La agrupación se realiza en tiempo real
- Complejidad: O(n) donde n es el número de tóneres
- No hay impacto significativo en el rendimiento

### Almacenamiento
- No se almacenan datos adicionales
- Los grupos se calculan dinámicamente
- Solo se guardan los tóneres individuales

### Compatibilidad
- Totalmente compatible con datos existentes
- No requiere migración de datos
- Funciona con cualquier número de proveedores

---

## ✅ Resumen

El sistema de alertas por compatibilidad de tóner:

1. ✅ Agrupa tóneres por marca + modelo + color
2. ✅ Calcula el stock total de cada grupo
3. ✅ Genera alertas basadas en el stock total
4. ✅ Muestra información detallada de proveedores
5. ✅ Reduce alertas falsas
6. ✅ Mejora la toma de decisiones

**Estado:** ✅ **IMPLEMENTADO Y FUNCIONAL**

---

**Desarrollado por:** VFL  
**Para:** VLF dev para Sistemas PEDSA  
**Versión:** 2.9.0  
**Fecha:** 2024
