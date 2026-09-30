# Sistema de Control de Tóner - Rama MeshCentral

## 🎯 Actualización Dashboard

Esta rama incluye la integración del Dashboard con el sistema de monitoreo remoto **MeshCentral** desde `mesh.donnet.com.ar`.

## 📋 Cambios Realizados

### 1. Limpieza de Datos Mockeados
- ✅ Eliminados todos los datos de ejemplo del sistema
- ✅ El sistema ahora comienza completamente vacío
- ✅ Los datos se agregan únicamente a través de la interfaz de usuario

### 2. Integración MeshCentral
- ✅ Nuevo componente `MeshMonitor` para visualizar computadoras monitoreadas
- ✅ Servicio `meshCentral.ts` para conectar con la API de MeshCentral
- ✅ Actualización automática cada 30 segundos
- ✅ Enlace directo a `mesh.donnet.com.ar`
- ✅ Visualización de estado: conectados/desconectados
- ✅ Información detallada: IP, sistema operativo, grupo

### 3. Créditos
- ✅ Footer del Dashboard con créditos: **"Desarrollado por Sistemas PEDSA"**
- ✅ Mención de integración con MeshCentral

## 🔧 Configuración MeshCentral

Para conectar con MeshCentral, necesitas configurar la API key:

```typescript
// En src/services/meshCentral.ts
const MESH_CENTRAL_URL = 'https://mesh.donnet.com.ar';

// Configurar API Key
meshCentralService.setApiKey('TU_API_KEY_AQUI');
```

### Endpoints de MeshCentral API

La implementación actual incluye métodos preparados para:
- `getNodes()` - Obtener todos los nodos/equipos
- `getGroups()` - Obtener grupos de dispositivos
- `getNodeDetails(nodeId)` - Obtener detalles de un nodo específico

### Documentación MeshCentral
- [MeshCentral GitHub](https://github.com/Ylianst/MeshCentral)
- [MeshCentral API Documentation](https://github.com/Ylianst/MeshCentral/blob/master/meshcentral.js)

## 📊 Estructura del Dashboard

```
Dashboard
├── Tarjetas de Estadísticas
│   ├── Impresoras Registradas
│   ├── Tóner en Inventario
│   ├── Alertas de Stock
│   └── Movimientos
├── Monitor MeshCentral
│   ├── Total de equipos
│   ├── Equipos conectados
│   ├── Equipos desconectados
│   └── Lista detallada de dispositivos
└── Footer con Créditos
    └── "Desarrollado por Sistemas PEDSA"
```

## 🚀 Próximos Pasos

1. **Configurar API Key de MeshCentral**
   - Obtener credenciales del administrador de MeshCentral
   - Configurar en el sistema

2. **Implementar llamadas API reales**
   - Reemplazar los métodos TODO en `meshCentral.ts`
   - Conectar con endpoints reales de MeshCentral

3. **Autenticación con MeshCentral**
   - Implementar login con credenciales de MeshCentral
   - Manejar tokens de sesión

4. **Funcionalidades adicionales**
   - Remote Desktop desde el Dashboard
   - Ejecución de comandos remotos
   - Transferencia de archivos
   - Alertas de desconexión

## 🔐 Credenciales de Acceso

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | soporte@donnet.com.ar | 6mn78az39* |
| Usuario | usuario@donnet.com.ar | user123 |

## 📝 Notas Técnicas

- **Framework**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS 4
- **Iconos**: Lucide React
- **Gráficos**: Recharts
- **Estado**: Context API
- **Persistencia**: localStorage

## 👨‍💻 Desarrollo

**Desarrollado por**: Sistemas PEDSA  
**Integración**: MeshCentral (mesh.donnet.com.ar)  
**Versión**: 2.0 - Rama MeshCentral

---

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## 🌐 URLs

- **Sistema**: http://localhost:3000
- **MeshCentral**: https://mesh.donnet.com.ar
