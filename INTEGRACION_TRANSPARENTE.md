# Integración Transparente con MeshCentral

## ✅ Cambios Implementados

### 1. Experiencia de Usuario Transparente
- **Eliminado** el formulario de configuración visible (`MeshConfig`)
- **Auto-login** automático usando credenciales en la URL del iframe
- **Conexión automática** al cargar el dashboard
- **Sin interacción requerida** por parte del usuario

### 2. Cómo Funciona

#### Flujo Automático:
```
1. Usuario abre el Dashboard
2. MeshMonitor se carga automáticamente
3. Se establecen credenciales por defecto (admin/admin)
4. Se genera URL con auto-login: mesh.donnet.com.ar/?login=admin:admin&hide=31
5. El iframe carga MeshCentral YA AUTENTICADO
6. Los datos se sincronizan cada 30 segundos
7. El usuario NUNCA ve la pantalla de login de MeshCentral
```

#### URL del Iframe:
```
https://mesh.donnet.com.ar/?login=admin:admin&hide=31
```

**Parámetros:**
- `login=admin:admin` → Autenticación automática
- `hide=31` → Oculta elementos de UI de MeshCentral:
  - 1 = Header
  - 2 = Tabs
  - 4 = Footer
  - 8 = User menu
  - 16 = Help
  - Total = 1+2+4+8+16 = 31

### 3. Configuración del Servidor MeshCentral

El administrador del servidor debe configurar `config.json`:

```json
{
  "settings": {
    "AllowLoginToken": true,
    "allowFraming": true
  }
}
```

**Importante:**
- `allowFraming: true` → Permite embeber en iframes
- `AllowLoginToken: true` → Permite autenticación via URL

### 4. Seguridad

#### Consideraciones:
- Las credenciales están codificadas en la URL del iframe
- El iframe usa `sandbox` para limitar permisos
- La conexión WebSocket es cifrada (WSS)

#### Recomendaciones:
1. **Cambiar credenciales por defecto** en producción
2. **Usar HTTPS** en el servidor MeshCentral
3. **Configurar CORS** apropiadamente
4. **Monitorear logs** de acceso

### 5. Credenciales Personalizadas

Si necesitas usar credenciales diferentes a `admin/admin`:

#### Opción A: Modificar el código
En `src/components/MeshMonitor.tsx`, línea ~50:

```typescript
const defaultUser = 'tu_usuario';
const defaultPass = 'tu_contraseña';
```

#### Opción B: Usar variables de entorno
Crear archivo `.env`:

```env
VITE_MESH_USER=tu_usuario
VITE_MESH_PASS=tu_contraseña
```

Luego en el código:

```typescript
const defaultUser = import.meta.env.VITE_MESH_USER || 'admin';
const defaultPass = import.meta.env.VITE_MESH_PASS || 'admin';
```

### 6. Características del Dashboard

#### Estadísticas en Tiempo Real:
- **Total de equipos** conectados a MeshCentral
- **Equipos online** (conectados)
- **Equipos offline** (desconectados)
- **Porcentaje de conectividad**

#### Alertas Automáticas:
- ⚠️ **Equipos fuera de horario laboral** (antes de 8:00 o después de 18:00)
- ⚠️ **Equipos conectados en fin de semana**

#### Lista de Dispositivos:
- Agrupados por **grupos de MeshCentral**
- Muestra: Nombre, IP, Sistema Operativo, RAM
- Estado: Conectado/Desconectado
- Última conexión

#### Panel MeshCentral Embebido:
- Iframe con auto-login transparente
- Barra de título estilo macOS
- Botones para ocultar/mostrar
- Enlace para abrir en nueva pestaña

### 7. Sincronización

- **Intervalo:** Cada 30 segundos
- **Método:** WebSocket + polling
- **Eventos en tiempo real:** Cambios de estado se reflejan inmediatamente

### 8. Solución de Problemas

#### El iframe no carga:
1. Verificar que el servidor MeshCentral tenga `allowFraming: true`
2. Verificar que las credenciales sean correctas
3. Revisar consola del navegador (F12) para errores

#### Los datos no se actualizan:
1. Verificar conexión a Internet
2. Verificar que el servidor MeshCentral esté accesible
3. Revisar consola del navegador para errores de WebSocket

#### Error de CORS:
El servidor MeshCentral debe permitir requests desde tu dominio. Configurar en `config.json`:

```json
{
  "settings": {
    "trustedProxy": true,
    "allowFraming": true
  }
}
```

### 9. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/MeshMonitor.tsx` | Eliminado MeshConfig, implementado auto-login |
| `src/services/meshCentral.ts` | Sin cambios (ya soportaba auto-login) |

### 10. Próximos Pasos Recomendados

1. **Producción:**
   - Cambiar credenciales por defecto
   - Implementar backend proxy para mayor seguridad
   - Configurar HTTPS en todos los servicios

2. **Mejoras:**
   - Agregar autenticación con tokens en lugar de password
   - Implementar refresh tokens para sesiones largas
   - Agregar logs de auditoría

3. **Monitoreo:**
   - Configurar alertas por email cuando haya equipos fuera de horario
   - Implementar dashboard de métricas históricas
   - Agregar reportes de disponibilidad

## 📞 Soporte

Si necesitas ayuda con la configuración:
1. Verificar que el servidor MeshCentral esté accesible
2. Revisar los logs del servidor MeshCentral
3. Verificar la consola del navegador (F12) para errores
4. Contactar al administrador del servidor MeshCentral

---

**Desarrollado por:** Sistemas PEDSA  
**Versión:** 2.0.0  
**Última actualización:** 2024
