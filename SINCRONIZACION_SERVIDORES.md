# 🔄 Sistema de Sincronización con Servidores Externos

## 📋 Resumen de Implementación

Se han implementado tres mejoras fundamentales en el sistema:

1. ✅ **Eliminación del menú "Importar Datos"** - Simplificación de la interfaz
2. ✅ **Configuración modular de servidores externos** - Panel dedicado para gestionar conexiones
3. ✅ **Sincronización con base de datos propia** - Persistencia local de datos sincronizados

---

## 🎯 Arquitectura del Sistema

### Componentes Principales

```
src/
├── services/
│   └── localDatabase.ts          # Base de datos local (localStorage)
├── components/
│   ├── ServerConfig.tsx          # Configuración de servidores
│   └── DataSync.tsx              # Panel de sincronización
├── types.ts                      # Tipos: ExternalServer, SyncRecord, SyncedDevice
└── App.tsx                       # Rutas actualizadas
```

### Flujo de Datos

```
┌─────────────────┐
│  Servidor       │
│  Externo        │
│  (MeshCentral)  │
└────────┬────────┘
         │
         │ WebSocket/API
         │
         ▼
┌─────────────────┐
│  Componente     │
│  DataSync       │
│  (Sincroniza)   │
└────────┬────────┘
         │
         │ Guarda en
         │ localStorage
         │
         ▼
┌─────────────────┐
│  Base de Datos  │
│  Local          │
│  (persistent)   │
└─────────────────┘
```

---

## 🗄️ Base de Datos Local

### Estructura de Almacenamiento

La base de datos local utiliza `localStorage` con las siguientes claves:

| Clave | Descripción | Tipo |
|-------|-------------|------|
| `external_servers` | Servidores configurados | `ExternalServer[]` |
| `sync_records` | Historial de sincronizaciones | `SyncRecord[]` |
| `synced_devices` | Dispositivos sincronizados | `SyncedDevice[]` |

### Tipos de Datos

#### ExternalServer
```typescript
interface ExternalServer {
  id: string;
  name: string;
  type: 'meshcentral' | 'custom';
  url: string;
  username: string;
  password: string;
  autoSync: boolean;
  syncInterval: number;
  lastSync?: string;
  status: 'active' | 'inactive' | 'error';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### SyncRecord
```typescript
interface SyncRecord {
  id: string;
  serverId: string;
  serverName: string;
  timestamp: string;
  status: 'success' | 'error' | 'partial';
  recordsImported: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errors: string[];
  duration: number;
}
```

#### SyncedDevice
```typescript
interface SyncedDevice {
  id: string;
  serverId: string;
  externalId: string;
  name: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'connected' | 'disconnected';
  lastSeen: string;
  group?: string;
  cpu?: string;
  ram?: string;
  syncedAt: string;
  localEquipmentId?: string;
}
```

---

## ⚙️ Configuración de Servidores

### Acceso
- **Menú lateral:** "Servidores" (icono de servidor)
- **Ruta:** `/server-config`

### Funcionalidades

#### 1. Agregar Servidor
- Nombre del servidor
- Tipo (MeshCentral o Personalizado)
- URL del servidor
- Credenciales (usuario/contraseña)
- Configuración de sincronización automática
- Intervalo de sincronización
- Notas adicionales

#### 2. Editar Servidor
- Modificar cualquier parámetro de configuración
- Actualizar credenciales
- Cambiar estado (activo/inactivo/error)

#### 3. Probar Conexión
- Verifica la conectividad con el servidor
- Actualiza el estado del servidor
- Muestra resultado de la prueba

#### 4. Eliminar Servidor
- Elimina el servidor y todos sus datos sincronizados
- Confirmación antes de eliminar

### Estadísticas
- Total de servidores configurados
- Servidores activos
- Servidores con error

---

## 🔄 Sincronización de Datos

### Acceso
- **Menú lateral:** "Sincronización" (icono de refresh)
- **Ruta:** `/data-sync`

### Funcionalidades

#### 1. Sincronización Manual
- Botón "Sincronizar" en cada servidor
- Proceso de sincronización en tiempo real
- Indicador visual de progreso

#### 2. Sincronización Automática
- Configurada por servidor
- Intervalo personalizable (minutos)
- Ejecución en segundo plano

#### 3. Historial de Sincronización
- Registro de todas las sincronizaciones
- Estado (éxito/error/parcial)
- Cantidad de registros importados/actualizados/eliminados
- Duración de la sincronización
- Errores detallados

#### 4. Gestión de Datos
- **Exportar:** Descarga toda la base de datos en formato JSON
- **Importar:** Carga una base de datos desde archivo JSON
- **Limpiar:** Elimina todos los datos sincronizados

### Estadísticas en Tiempo Real
- Total de servidores
- Total de dispositivos sincronizados
- Dispositivos conectados/desconectados
- Total de sincronizaciones
- Porcentaje de éxito

---

## 📊 Dashboard - Estado de Sincronización

### Nueva Sección
El Dashboard ahora muestra una sección de "Estado de Sincronización" cuando hay servidores configurados:

- **Servidores:** Total de servidores configurados
- **Dispositivos:** Total de dispositivos sincronizados
- **Conectados:** Dispositivos actualmente conectados
- **Sincronizaciones:** Total de sincronizaciones realizadas

### Acceso Rápido
- Botón "Ver detalles" que navega al panel de sincronización

---

## 🎨 Interfaz de Usuario

### Diseño Responsive
- Adaptable a todos los tamaños de pantalla
- Grid layouts para estadísticas
- Cards con hover effects

### Modo Oscuro
- Soporte completo para tema oscuro
- Colores optimizados para ambos modos
- Transiciones suaves

### Iconografía
- Iconos de Lucide React
- Consistencia visual en toda la aplicación
- Indicadores de estado con colores

---

## 🔒 Seguridad

### Almacenamiento de Credenciales
- Las credenciales se guardan en `localStorage`
- **Recomendación:** Para producción, usar un backend seguro
- **Alternativa:** Implementar encriptación de credenciales

### Validaciones
- Campos obligatorios validados
- URLs verificadas
- Credenciales requeridas antes de guardar

---

## 📝 Guía de Uso

### Primer Uso

1. **Configurar un Servidor**
   - Ir a "Servidores" en el menú lateral
   - Click en "Nuevo Servidor"
   - Completar los datos del servidor
   - Click en "Agregar Servidor"

2. **Probar la Conexión**
   - En la lista de servidores, click en el icono de refresh
   - Esperar el resultado de la prueba
   - Verificar que el estado sea "Activo"

3. **Sincronizar Datos**
   - Ir a "Sincronización" en el menú lateral
   - En el servidor deseado, click en "Sincronizar"
   - Esperar a que se complete la sincronización
   - Ver los dispositivos sincronizados

4. **Ver en Dashboard**
   - Volver al Dashboard
   - Ver la sección "Estado de Sincronización"
   - Click en "Ver detalles" para más información

### Sincronización Automática

1. **Configurar**
   - Editar el servidor
   - Activar "Sincronización automática"
   - Establecer el intervalo (ej: 5 minutos)
   - Guardar cambios

2. **Monitorear**
   - Ir a "Sincronización"
   - Ver el historial de sincronizaciones
   - Verificar que las sincronizaciones automáticas se ejecuten

### Exportar/Importar Datos

**Exportar:**
1. Ir a "Sincronización"
2. Click en "Exportar"
3. Se descargará un archivo JSON con toda la base de datos

**Importar:**
1. Ir a "Sincronización"
2. Click en "Importar"
3. Seleccionar el archivo JSON
4. Los datos se cargarán automáticamente

**Limpiar:**
1. Ir a "Sincronización"
2. Click en "Limpiar"
3. Confirmar la acción
4. Todos los datos sincronizados se eliminarán

---

## 🔧 Integración con MeshCentral

### Implementación Actual
El sistema incluye una implementación de prueba que simula la sincronización con MeshCentral. Para producción, se debe:

1. **Implementar el servicio real de MeshCentral**
   - Conectar via WebSocket
   - Autenticar con credenciales
   - Obtener lista de dispositivos

2. **Mapear dispositivos a equipos locales**
   - Crear relación entre `SyncedDevice` y `Equipment`
   - Sincronizar estados
   - Actualizar inventario automáticamente

3. **Manejar errores de conexión**
   - Reintentos automáticos
   - Notificaciones al usuario
   - Logs detallados

### Ejemplo de Integración Futura

```typescript
// En DataSync.tsx
const handleSyncServer = async (server: ExternalServer) => {
  if (server.type === 'meshcentral') {
    // Conectar a MeshCentral
    const client = new MeshCentralClient(server.url, server.username, server.password);
    await client.connect();
    
    // Obtener dispositivos
    const devices = await client.getDevices();
    
    // Mapear a SyncedDevice
    const syncedDevices = devices.map(device => ({
      id: uuidv4(),
      serverId: server.id,
      externalId: device.id,
      name: device.name,
      hostname: device.hostname,
      ip: device.ip,
      os: device.os,
      status: device.connected ? 'connected' : 'disconnected',
      lastSeen: device.lastSeen,
      group: device.group,
      cpu: device.cpu,
      ram: device.ram,
      syncedAt: new Date().toISOString(),
    }));
    
    // Guardar en base de datos local
    db.upsertSyncedDevices(syncedDevices);
    
    // Registrar sincronización
    db.addSyncRecord({
      id: uuidv4(),
      serverId: server.id,
      serverName: server.name,
      timestamp: new Date().toISOString(),
      status: 'success',
      recordsImported: syncedDevices.length,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      duration: Date.now() - startTime,
    });
  }
};
```

---

## 📈 Estadísticas y Métricas

### Métricas Disponibles

**Servidores:**
- Total de servidores
- Servidores activos
- Servidores con error

**Dispositivos:**
- Total de dispositivos sincronizados
- Dispositivos conectados
- Dispositivos desconectados
- Dispositivos por servidor

**Sincronizaciones:**
- Total de sincronizaciones
- Sincronizaciones exitosas
- Sincronizaciones fallidas
- Porcentaje de éxito
- Duración promedio

**Datos:**
- Registros importados
- Registros actualizados
- Registros eliminados
- Errores totales

---

## 🚀 Próximas Mejoras

### Corto Plazo
- [ ] Implementar conexión real con MeshCentral
- [ ] Agregar soporte para otros tipos de servidores
- [ ] Mejorar el manejo de errores
- [ ] Agregar notificaciones push

### Mediano Plazo
- [ ] Implementar backend para almacenamiento seguro
- [ ] Agregar encriptación de credenciales
- [ ] Implementar sincronización bidireccional
- [ ] Agregar dashboard de métricas avanzadas

### Largo Plazo
- [ ] Soporte para múltiples usuarios
- [ ] Roles y permisos
- [ ] API REST para integración con otros sistemas
- [ ] Aplicación móvil para monitoreo remoto

---

## 🐛 Solución de Problemas

### Error: "No se pudo conectar"
**Causa:** Servidor inaccesible o credenciales incorrectas  
**Solución:**
1. Verificar la URL del servidor
2. Verificar usuario y contraseña
3. Verificar conectividad de red
4. Revisar logs del servidor

### Error: "Sincronización fallida"
**Causa:** Error durante la sincronización  
**Solución:**
1. Revisar el historial de sincronización
2. Ver los errores específicos
3. Verificar el estado del servidor
4. Reintentar la sincronización

### Error: "Datos no se guardan"
**Causa:** Problema con localStorage  
**Solución:**
1. Verificar que el navegador soporte localStorage
2. Limpiar caché del navegador
3. Verificar espacio disponible
4. Reiniciar el navegador

---

## 📞 Soporte

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA  
**Versión:** 2.1.0  
**Última actualización:** 2024

Para soporte técnico o consultas, contactar al equipo de desarrollo.

---

## 📄 Licencia

Todos los derechos reservados - Area Sistemas PEDSA
