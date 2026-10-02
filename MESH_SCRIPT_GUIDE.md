# Script para Conectar con MeshCentral y Mostrar PCs en Dashboard

## 📋 Descripción

Este script permite conectar con un servidor MeshCentral, obtener la lista de PCs/nodos y mostrar sus nombres y estados en el dashboard del sistema.

## 🚀 Instalación y Configuración

### 1. Configurar la Conexión

Ve a **Administración** en el menú lateral del sistema y configura:

- **URL del Servidor**: `https://mesh.donnet.com.ar` (o tu servidor)
- **Usuario**: Tu usuario de MeshCentral
- **Contraseña**: Tu contraseña
- **Sincronización Automática**: Activar si deseas actualización automática
- **Intervalo**: Cada cuántos minutos sincronizar (ej: 5 minutos)

### 2. Probar la Conexión

1. Click en **"Probar Conexión"**
2. Si es exitosa, verás un mensaje verde
3. Click en **"Guardar Configuración"**

### 3. Ver PCs en el Dashboard

Las PCs se mostrarán automáticamente en el dashboard en el widget **"PCs en MeshCentral"**

## 📊 Información Mostrada

El widget muestra:

- **Total de PCs**: Cantidad total de equipos
- **PCs Conectadas**: Equipos online (verde)
- **PCs Desconectadas**: Equipos offline (rojo)
- **Lista de PCs**: Con nombre, IP, sistema operativo y estado

## 🔄 Actualización Automática

- El widget se actualiza cada **30 segundos** automáticamente
- Si configuraste sincronización automática en Administración, los datos se sincronizan según el intervalo configurado
- Puedes hacer click en el botón **🔄 Actualizar** para forzar una actualización manual

## 📝 Script de Ejemplo

El archivo `src/scripts/meshCentralExample.ts` contiene funciones de ejemplo:

### Funciones Disponibles

```typescript
// Obtener todas las PCs
const pcs = await meshCentralService.getNodes();

// Obtener solo PCs conectadas
const conectadas = await getConnectedPCs();

// Obtener solo PCs desconectadas
const desconectadas = await getDisconnectedPCs();

// Obtener PCs por grupo
const pcsGrupo = await getPCsByGroup('Oficina Principal');

// Verificar estado de una PC específica
const estado = await checkPCStatus('PC-01');

// Convertir nodos de MeshCentral a formato Equipment
const equipments = meshNodesToEquipment(nodes);
```

### Ejemplo de Uso

```typescript
import { meshCentralService } from '../services/meshCentral';
import { getConnectedPCs, checkPCStatus } from '../scripts/meshCentralExample';

// Configurar conexión
meshCentralService.setConfig({
  serverUrl: 'https://mesh.donnet.com.ar',
  username: 'admin',
  password: 'tu_password',
  autoSync: true,
  syncInterval: 5,
});

// Conectar
await meshCentralService.connect();

// Obtener PCs conectadas
const pcsConectadas = await getConnectedPCs();
console.log('PCs conectadas:', pcsConectadas);

// Verificar estado de una PC
const estado = await checkPCStatus('PC-01');
console.log('Estado de PC-01:', estado);
```

## 🎯 Características

✅ **Conexión WebSocket** en tiempo real  
✅ **Actualización automática** cada 30 segundos  
✅ **Estadísticas en tiempo real** (total, conectadas, desconectadas)  
✅ **Lista detallada** con nombre, IP, SO y estado  
✅ **Indicadores visuales** de estado (verde/rojo)  
✅ **Soporte para modo oscuro**  
✅ **Manejo de errores** con mensajes claros  
✅ **Sincronización configurable** desde Administración  

## 🔧 Solución de Problemas

### No se conectan las PCs

1. Verifica que la URL del servidor sea correcta
2. Verifica usuario y contraseña
3. Asegúrate de que el servidor MeshCentral tenga `allowFraming: true` en config.json
4. Revisa la consola del navegador (F12) para ver errores

### Las PCs no se actualizan

1. Verifica que la sincronización automática esté activada
2. Revisa la conexión a Internet
3. Click en el botón **🔄 Actualizar** manualmente

### Error de conexión

1. Verifica que el servidor MeshCentral esté accesible
2. Verifica las credenciales
3. Revisa los logs del servidor MeshCentral

## 📦 Archivos Relacionados

- `src/components/MeshPCWidget.tsx` - Widget del dashboard
- `src/services/meshCentral.ts` - Servicio de conexión
- `src/scripts/meshCentralExample.ts` - Script de ejemplo
- `src/components/AdminPanel.tsx` - Panel de configuración

## 🔐 Seguridad

- Las credenciales se guardan en localStorage del navegador
- La conexión usa WebSocket seguro (WSS)
- Se recomienda usar un usuario con permisos limitados en MeshCentral

## 📞 Soporte

Si necesitas ayuda:
1. Revisa la configuración en Administración
2. Verifica los logs del servidor MeshCentral
3. Revisa la consola del navegador (F12)

---

**Desarrollado por:** Area Sistemas PEDSA  
**Versión:** 2.0.0
