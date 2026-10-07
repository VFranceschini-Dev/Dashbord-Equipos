# 🧪 Sistema de Testeo de Conexión y Sincronización Avanzada

## 📋 Resumen de Implementación

Se han implementado funcionalidades avanzadas para la gestión de servidores externos:

1. ✅ **Módulo de Testeo de Conexión** - Componente dedicado para probar conectividad
2. ✅ **Servicio Real de Conexión WebSocket** - Implementación completa para MeshCentral
3. ✅ **Mapeo de Dispositivos a Equipos Locales** - Relación automática y manual
4. ✅ **Sincronización Bidireccional** - Datos fluyen en ambas direcciones
5. ✅ **Sistema de Notificaciones** - Alertas en tiempo real
6. ✅ **Soporte Multi-Servidor** - Arquitectura extensible para diferentes tipos

---

## 🏗️ Arquitectura del Sistema

### Servicios Implementados

```
src/services/
├── meshCentralWebSocket.ts       # Conexión WebSocket real con MeshCentral
├── deviceMapping.ts              # Mapeo entre dispositivos y equipos
├── notifications.ts              # Sistema de notificaciones
├── serverServiceRegistry.ts      # Registro extensible de servicios
└── localDatabase.ts              # Base de datos local (localStorage)
```

### Componentes Implementados

```
src/components/
├── ConnectionTester.tsx          # Componente de testeo de conexión
├── ServerConfig.tsx              # Configuración de servidores (actualizado)
└── DataSync.tsx                  # Sincronización de datos (actualizado)
```

---

## 🧪 Módulo de Testeo de Conexión

### Componente: `ConnectionTester.tsx`

**Ubicación:** Accesible desde la configuración de servidores

**Funcionalidades:**
- ✅ Prueba de conexión en tiempo real
- ✅ Medición de latencia
- ✅ Validación de credenciales
- ✅ Mensajes de error detallados
- ✅ Notificaciones automáticas

**Uso:**
```tsx
import ConnectionTester from './ConnectionTester';

<ConnectionTester
  server={server}
  onTestComplete={(success) => {
    if (success) {
      // Conexión exitosa
    }
  }}
/>
```

**Características:**
- Interfaz intuitiva con feedback visual
- Información del servidor (URL, usuario, tipo)
- Resultados con latencia y estado
- Consejos para solucionar problemas
- Notificaciones automáticas al sistema

---

## 🔌 Servicio WebSocket para MeshCentral

### Archivo: `meshCentralWebSocket.ts`

**Funcionalidades:**
- ✅ Conexión WebSocket real
- ✅ Autenticación automática
- ✅ Reconexión automática
- ✅ Manejo de mensajes en tiempo real
- ✅ Conversión de nodos a dispositivos sincronizados

**Uso:**
```typescript
import { meshCentralWebSocket } from './services/meshCentralWebSocket';

// Conectar
const connected = await meshCentralWebSocket.connect(server);

// Obtener estado
const status = meshCentralWebSocket.getConnectionStatus();

// Agregar handler de mensajes
const unsubscribe = meshCentralWebSocket.addMessageHandler((message) => {
  console.log('Mensaje recibido:', message);
});

// Desconectar
meshCentralWebSocket.disconnect();
```

**Estados de Conexión:**
- `disconnected` - No conectado
- `connecting` - Intentando conectar
- `connected` - Conectado exitosamente
- `error` - Error de conexión

---

## 🔗 Mapeo de Dispositivos a Equipos Locales

### Archivo: `deviceMapping.ts`

**Funcionalidades:**
- ✅ Mapeo automático por nombre/IP
- ✅ Mapeo manual
- ✅ Sincronización bidireccional
- ✅ Historial de mapeos
- ✅ Estadísticas de mapeo

**Tipos de Sincronización:**
- `bidirectional` - Cambios en ambas direcciones
- `server-to-local` - Solo del servidor al local
- `local-to-server` - Solo del local al servidor

**Uso:**
```typescript
import * as deviceMapping from './services/deviceMapping';

// Auto-mapear dispositivos
const mappings = deviceMapping.autoMapDevices(devices, equipments);

// Mapear manualmente
const mapping = deviceMapping.syncDeviceWithEquipment(
  device,
  equipment,
  'bidirectional'
);

// Actualizar equipo desde dispositivo
const updatedEquipment = deviceMapping.updateEquipmentFromDevice(
  equipment,
  device
);

// Obtener estadísticas
const stats = deviceMapping.getMappingStats();
```

**Funciones Principales:**
- `autoMapDevices()` - Mapeo automático inteligente
- `syncDeviceWithEquipment()` - Crear/actualizar mapeo
- `updateEquipmentFromDevice()` - Actualizar equipo desde dispositivo
- `updateDeviceFromEquipment()` - Actualizar dispositivo desde equipo
- `getMappingStats()` - Estadísticas de mapeo

---

## 🔄 Sincronización Bidireccional

### Implementación en `DataSync.tsx`

**Flujo de Sincronización:**

```
1. Conectar al servidor
   ↓
2. Obtener dispositivos del servidor
   ↓
3. Auto-mapear con equipos locales
   ↓
4. Para cada dispositivo:
   ├─ Si tiene mapeo → Actualizar equipo local
   └─ Si no tiene mapeo → Crear nuevo equipo
   ↓
5. Guardar en base de datos local
   ↓
6. Registrar sincronización
   ↓
7. Notificar al usuario
```

**Características:**
- ✅ Sincronización automática de nombres
- ✅ Sincronización de estados
- ✅ Sincronización de información técnica
- ✅ Creación automática de equipos nuevos
- ✅ Actualización de equipos existentes
- ✅ Respeto de dirección de sincronización

---

## 🔔 Sistema de Notificaciones

### Archivo: `notifications.ts`

**Tipos de Notificaciones:**
- `info` - Información general
- `success` - Operación exitosa
- `warning` - Advertencia
- `error` - Error crítico

**Categorías:**
- `sync` - Relacionadas con sincronización
- `connection` - Relacionadas con conexión
- `mapping` - Relacionadas con mapeo
- `system` - Notificaciones del sistema

**Notificaciones Predefinidas:**

**Sincronización:**
- `notifySyncStart()` - Inicio de sincronización
- `notifySyncSuccess()` - Sincronización exitosa
- `notifySyncError()` - Error de sincronización
- `notifySyncPartial()` - Sincronización parcial

**Conexión:**
- `notifyConnectionSuccess()` - Conexión exitosa
- `notifyConnectionError()` - Error de conexión
- `notifyConnectionLost()` - Conexión perdida

**Mapeo:**
- `notifyDeviceMapped()` - Dispositivo mapeado
- `notifyAutoMappingCompleted()` - Mapeo automático completado

**Sistema:**
- `notifySystemInfo()` - Información del sistema
- `notifySystemSuccess()` - Éxito del sistema
- `notifySystemWarning()` - Advertencia del sistema
- `notifySystemError()` - Error del sistema

**Uso:**
```typescript
import { notifySyncSuccess } from './services/notifications';

notifySyncSuccess('MeshCentral Principal', 15);
```

**Características:**
- ✅ Almacenamiento en localStorage
- ✅ Máximo 100 notificaciones
- ✅ Marcado como leídas
- ✅ Filtros por tipo y categoría
- ✅ Estadísticas de notificaciones
- ✅ Eventos personalizados para componentes

---

## 🌐 Soporte Multi-Servidor

### Archivo: `serverServiceRegistry.ts`

**Servicios Implementados:**

#### 1. MeshCentral (`MeshCentralService`)
- ✅ Conexión WebSocket
- ✅ Autenticación
- ✅ Obtención de nodos
- ✅ Prueba de conexión

#### 2. Custom REST (`CustomRestService`)
- ✅ Conexión HTTP/HTTPS
- ✅ Autenticación Basic
- ✅ API REST genérica
- ✅ Prueba de conexión

#### 3. MQTT (`MQTTService`)
- 🔄 Implementación futura
- ⏳ Para dispositivos IoT

**Registro de Servicios:**
```typescript
import { serverServiceRegistry } from './services/serverServiceRegistry';

// Obtener servicio
const service = serverServiceRegistry.getService('meshcentral');

// Probar conexión
const result = await serverServiceRegistry.testConnection(server);

// Obtener dispositivos
const devices = await serverServiceRegistry.getDevices(server);
```

**Agregar Nuevo Tipo de Servidor:**
```typescript
class MyCustomService implements ServerService {
  type = 'my-custom';
  
  async connect(server: ExternalServer): Promise<boolean> {
    // Implementación
  }
  
  async getDevices(server: ExternalServer): Promise<SyncedDevice[]> {
    // Implementación
  }
  
  async testConnection(server: ExternalServer) {
    // Implementación
  }
  
  // ... otros métodos
}

// Registrar
serverServiceRegistry.register(new MyCustomService());
```

---

## 📊 Estadísticas y Métricas

### Estadísticas de Sincronización
- Total de servidores
- Total de dispositivos sincronizados
- Dispositivos conectados/desconectados
- Total de sincronizaciones
- Porcentaje de éxito
- Duración promedio

### Estadísticas de Mapeo
- Total de mapeos
- Mapeos bidireccionales
- Mapeos servidor → local
- Mapeos local → servidor
- Sincronizaciones recientes

### Estadísticas de Notificaciones
- Total de notificaciones
- Notificaciones no leídas
- Por tipo (info, success, warning, error)
- Por categoría (sync, connection, mapping, system)

---

## 🎯 Flujo de Trabajo Completo

### 1. Configurar Servidor
```
Ir a "Servidores" → "Nuevo Servidor" → Completar datos → Guardar
```

### 2. Probar Conexión
```
En la lista de servidores → Click en "Probar conexión" → Ver resultado
```

### 3. Sincronizar Datos
```
Ir a "Sincronización" → Click en "Sincronizar" → Esperar resultado
```

### 4. Verificar Mapeos
```
En "Sincronización" → Ver estadísticas de mapeo → Revisar dispositivos
```

### 5. Gestionar Notificaciones
```
Ver notificaciones en el header → Marcar como leídas → Filtrar por tipo
```

---

## 🔒 Seguridad

### Almacenamiento de Credenciales
- ⚠️ **Actual:** localStorage (solo para desarrollo)
- ✅ **Recomendación:** Implementar backend seguro
- 🔐 **Alternativa:** Encriptar credenciales antes de guardar

### Validaciones
- ✅ URLs validadas
- ✅ Credenciales requeridas
- ✅ Campos obligatorios
- ✅ Formato de datos verificado

### Permisos
- 🔄 **Futuro:** Sistema de roles y permisos
- 🔄 **Futuro:** Auditoría de acciones
- 🔄 **Futuro:** Logs de seguridad

---

## 🚀 Próximas Mejoras

### Corto Plazo
- [ ] Implementar conexión real con MeshCentral (producción)
- [ ] Agregar más tipos de servidores (SNMP, SSH, etc.)
- [ ] Mejorar el auto-mapeo con IA
- [ ] Agregar filtros avanzados en notificaciones

### Mediano Plazo
- [ ] Implementar backend para almacenamiento seguro
- [ ] Agregar sincronización programada (cron)
- [ ] Implementar webhooks para eventos
- [ ] Agregar dashboard de métricas avanzadas

### Largo Plazo
- [ ] Soporte para múltiples usuarios
- [ ] Sistema de roles y permisos
- [ ] API REST completa
- [ ] Aplicación móvil
- [ ] Integración con sistemas externos

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Probar Conexión
```typescript
import { testServerConnection } from './services/serverServiceRegistry';

const server = {
  id: 'server-1',
  name: 'MeshCentral Principal',
  type: 'meshcentral',
  url: 'https://mesh.donnet.com.ar',
  username: 'admin',
  password: 'password',
  // ... otros campos
};

const result = await testServerConnection(server);

if (result.success) {
  console.log('Conexión exitosa');
  console.log('Latencia:', result.latency, 'ms');
} else {
  console.error('Error:', result.message);
}
```

### Ejemplo 2: Sincronizar Dispositivos
```typescript
import { getServerDevices } from './services/serverServiceRegistry';
import * as deviceMapping from './services/deviceMapping';

// Obtener dispositivos del servidor
const devices = await getServerDevices(server);

// Auto-mapear con equipos locales
const mappings = deviceMapping.autoMapDevices(devices, equipments);

console.log('Mapeos creados:', mappings.length);
```

### Ejemplo 3: Escuchar Notificaciones
```typescript
import { onNotificationAdded } from './services/notifications';

const unsubscribe = onNotificationAdded((notification) => {
  console.log('Nueva notificación:', notification.title);
  
  if (notification.type === 'error') {
    // Mostrar alerta al usuario
  }
});

// Limpiar listener
unsubscribe();
```

---

## 🐛 Solución de Problemas

### Error: "No se pudo conectar"
**Causas posibles:**
- URL incorrecta
- Servidor inaccesible
- Credenciales inválidas
- Firewall bloqueando conexión

**Soluciones:**
1. Verificar URL del servidor
2. Probar conexión desde el navegador
3. Verificar credenciales
4. Revisar configuración de firewall

### Error: "Sincronización fallida"
**Causas posibles:**
- Servidor no responde
- Error de autenticación
- Timeout de conexión
- Datos inválidos

**Soluciones:**
1. Verificar estado del servidor
2. Reintentar conexión
3. Revisar logs de error
4. Verificar formato de datos

### Error: "Mapeo automático falló"
**Causas posibles:**
- Nombres muy diferentes
- Equipos duplicados
- Datos incompletos

**Soluciones:**
1. Usar mapeo manual
2. Normalizar nombres
3. Eliminar duplicados
4. Completar datos faltantes

---

## 📞 Soporte

**Desarrollado por:** VLF dev para Sistemas PEDSA  
**Versión:** 2.2.0  
**Última actualización:** 2024

Para soporte técnico o consultas, contactar al equipo de desarrollo.

---

## 📄 Licencia

Todos los derechos reservados - Area Sistemas PEDSA
