# Sistema de Control de Tóner - Rama: feature/mesh-integration

## 🚀 Cambios en esta Rama

### 1. Integración con MeshCentral
- ✅ Nuevo componente `MeshMonitor` para visualizar computadoras monitoreadas remotamente
- ✅ Conexión con `mesh.donnet.com.ar`
- ✅ Actualización automática cada 30 segundos
- ✅ Estados en tiempo real (online/offline)
- ✅ Información detallada de dispositivos (IP, SO, grupo, última conexión)

### 2. Limpieza de Datos
- ✅ Eliminados todos los datos mockeados
- ✅ Arrays iniciales vacíos (listos para backend real)
- ✅ Sistema preparado para integración con API

### 3. Créditos
- ✅ Footer del dashboard con créditos a **Sistemas PEDSA**
- ✅ Diseño profesional con gradiente azul
- ✅ Información de versión e integración

---

## 📊 Nuevo Dashboard

El dashboard ahora incluye:

1. **Estadísticas Generales** - Impresoras activas, inventario, alertas, movimientos
2. **Gráficos de Actividad** - Actividad mensual, tipos de movimiento, niveles de stock
3. **Actividad Reciente** - Últimos movimientos registrados
4. **Alertas Pendientes** - Notificaciones de stock bajo y mantenimiento
5. **Monitoreo Remoto (NUEVO)** - Dispositivos gestionados desde MeshCentral
6. **Créditos (NUEVO)** - Desarrollado por Sistemas PEDSA

---

## 🔌 Integración con MeshCentral

### Configuración
```typescript
// src/data.ts
export const MESH_CONFIG = {
  baseUrl: 'https://mesh.donnet.com.ar',
  apiEndpoint: '/api',
  refreshInterval: 30000, // 30 segundos
};
```

### Implementación de API Real
Para conectar con la API real de MeshCentral, edita `src/components/MeshMonitor.tsx`:

```typescript
const fetchMeshDevices = async () => {
  try {
    setLoading(true);
    
    // Descomentar y configurar para producción:
    const response = await fetch(`${MESH_CONFIG.baseUrl}${MESH_CONFIG.apiEndpoint}/devices`, {
      headers: {
        'Authorization': `Bearer ${YOUR_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    setDevices(data);
    setLastUpdate(new Date());
  } catch (error) {
    console.error('Error al obtener dispositivos:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 📝 Estructura de Datos Esperada

### Dispositivo MeshCentral
```typescript
interface MeshDevice {
  id: string;
  name: string;
  status: 'online' | 'offline';
  ip?: string;
  os?: string;
  lastSeen?: string;
  group?: string;
}
```

---

## 🎯 Próximos Pasos

1. **Backend API** - Implementar endpoints REST para:
   - CRUD de impresoras
   - CRUD de tóners
   - Registro de movimientos
   - Gestión de alertas

2. **Autenticación MeshCentral** - Integrar OAuth o API key para acceso seguro

3. **Base de Datos** - Configurar PostgreSQL/MySQL para persistencia

4. **Notificaciones** - Sistema de alertas por email/Slack

---

## 👨‍💻 Desarrollado por

**Sistemas PEDSA**  
Soluciones tecnológicas para tu empresa

---

## 📋 Comandos

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build

# Verificar tipos TypeScript
npm run typecheck
```

---

## 🔐 Credenciales de Acceso

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | soporte@donnet.com.ar | 6mn78az39* |
| Usuario | usuario@donnet.com.ar | user123 |

---

## 📄 Licencia

© 2024 Sistemas PEDSA. Todos los derechos reservados.
