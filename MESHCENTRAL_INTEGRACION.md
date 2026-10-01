# 🔗 Integración MeshCentral - Guía Completa

## 📋 Resumen

Este sistema se integra con **MeshCentral** (mesh.donnet.com.ar) para:
- ✅ Embeber el panel de MeshCentral en el Dashboard
- ✅ Obtener datos de dispositivos en tiempo real vía WebSocket
- ✅ Mostrar estadísticas de equipos conectados/desconectados
- ✅ Alertas de equipos encendidos fuera de horario laboral
- ✅ Agrupar dispositivos por grupos de MeshCentral

---

## ⚙️ CONFIGURACIÓN DEL SERVIDOR MESHCENTRAL

### Paso 1: Editar `config.json` del servidor MeshCentral

Ubicación típica: `/opt/meshcentral/meshcentral-data/config.json`

```json
{
  "settings": {
    "Port": 443,
    "AllowLoginToken": true,
    "allowFraming": true,
    "Cert": "mesh.donnet.com.ar"
  }
}
```

**Parámetros importantes:**

| Parámetro | Descripción |
|-----------|-------------|
| `"allowFraming": true` | Permite embeber MeshCentral en iframes de otros dominios |
| `"AllowLoginToken": true` | Habilita autenticación por tokens para la API |

### Paso 2: Reiniciar el servicio MeshCentral

```bash
# Si usa systemd
sudo systemctl restart meshcentral

# Si usa directamente node
# Detener y volver a iniciar el proceso
```

### Paso 3: Verificar que funciona

Abre en el navegador: `https://mesh.donnet.com.ar`

Verifica que puedas iniciar sesión normalmente.

---

## 🔐 CONFIGURACIÓN EN EL DASHBOARD

### Opción 1: Desde la interfaz (Recomendado)

1. Abre el Dashboard
2. En la sección **Monitoreo Remoto**, haz click en el ícono ⚙️ (Configuración)
3. Ingresa las credenciales de MeshCentral:
   - **Usuario**: Tu usuario de MeshCentral
   - **Contraseña**: Tu contraseña de MeshCentral
4. Click en **"Probar Conexión"** para verificar
5. Click en **"Guardar y Conectar"**

Las credenciales se guardan en `localStorage` del navegador.

### Opción 2: Credenciales de prueba

Para probar, puedes usar:
- Usuario: `admin`
- Contraseña: (la contraseña del admin de MeshCentral)

---

## 🔌 CÓMO FUNCIONA LA INTEGRACIÓN

### Arquitectura

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Dashboard     │ ◄────────────────► │   MeshCentral    │
│   (React/Vite)  │     WSS://         │   (Servidor)     │
│                 │                    │                  │
│  - MeshMonitor  │                    │  - Nodos/Devices │
│  - MeshConfig   │                    │  - Grupos        │
│  - meshCentral  │                    │  - Estado        │
│    Service      │                    │                  │
└─────────────────┘                    └──────────────────┘
        │
        │ iframe (si allowFraming: true)
        ▼
┌──────────────────┐
│  MeshCentral UI  │
│  (Embebido)      │
└──────────────────┘
```

### Flujo de datos

1. **Autenticación**: El frontend se conecta vía WebSocket a `wss://mesh.donnet.com.ar/meshrelay.ashx`
2. **Obtención de nodos**: Envía `{ action: 'nodes' }` y recibe la lista de dispositivos
3. **Actualización en tiempo real**: MeshCentral envía eventos cuando cambia el estado de un nodo
4. **Iframe embebido**: Se muestra la UI completa de MeshCentral en un iframe

### Mensajes WebSocket

**Autenticación:**
```json
{
  "action": "auth",
  "username": "admin",
  "password": "password"
}
```

**Respuesta de autenticación:**
```json
{
  "action": "authComplete"
}
```

**Solicitar nodos:**
```json
{
  "action": "nodes"
}
```

**Respuesta con nodos:**
```json
{
  "action": "nodes",
  "nodes": [
    {
      "_id": "node123",
      "name": "PC-CONTABILIDAD",
      "hostname": "CONTAB01",
      "ip": "192.168.1.101",
      "os": "Windows 11 Pro",
      "conn": 1,
      "meshName": "Oficina Principal",
      "lastConnectTime": 1704067200
    }
  ]
}
```

**Cambio de estado en tiempo real:**
```json
{
  "action": "nodeConnectionChange",
  "nodeId": "node123",
  "connected": true
}
```

---

## 📊 DATOS QUE SE MUESTRAN EN EL DASHBOARD

### Estadísticas principales

| Dato | Descripción |
|------|-------------|
| Total Equipos | Cantidad total de dispositivos registrados |
| Conectados | Equipos con agente activo en este momento |
| Desconectados | Equipos sin conexión |
| % Conectividad | Porcentaje de equipos online |

### Por dispositivo

| Dato | Descripción |
|------|-------------|
| Nombre | Nombre asignado en MeshCentral |
| IP | Dirección IP del equipo |
| SO | Sistema operativo |
| RAM | Memoria disponible |
| Estado | Conectado/Desconectado |
| Última conexión | Hace cuánto se vio por última vez |
| Grupo | Grupo de dispositivos en MeshCentral |

### Alertas automáticas

- ⚠️ **After Hours**: Se genera alerta cuando hay equipos conectados fuera del horario laboral (antes de 8:00 o después de 18:00, o fines de semana)

---

## 🛠️ ARCHIVOS INVOLUCRADOS

| Archivo | Función |
|---------|---------|
| `src/services/meshCentral.ts` | Servicio WebSocket para conectar con MeshCentral |
| `src/components/MeshMonitor.tsx` | Componente principal del monitoreo |
| `src/components/MeshConfig.tsx` | Formulario de configuración de credenciales |
| `src/components/Dashboard.tsx` | Dashboard principal que incluye MeshMonitor |

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### El iframe no carga (X-Frame-Options)

**Error**: `Refused to display 'https://mesh.donnet.com.ar' in a frame because it set 'X-Frame-Options' to 'sameorigin'`

**Solución**: 
- Verificar que `config.json` del servidor MeshCentral tenga `"allowFraming": true`
- Reiniciar el servicio MeshCentral

### No se conectan los datos WebSocket

**Posibles causas:**
1. CORS: El servidor MeshCentral no permite conexiones desde tu dominio
2. Credenciales incorrectas
3. El servidor MeshCentral no tiene `AllowLoginToken: true`

**Solución:**
- Verificar credenciales en la configuración
- Verificar que el servidor MeshCentral tenga los permisos correctos
- Revisar la consola del navegador (F12) para ver errores específicos

### Los datos no se actualizan

- Verificar que la conexión WebSocket esté activa (ícono verde en el header)
- Click en "Actualizar" para forzar una actualización manual
- Verificar que las credenciales sean correctas

---

## 🔒 SEGURIDAD

### Consideraciones importantes

1. **Credenciales**: Se guardan en `localStorage` del navegador (no en el servidor)
2. **WebSocket**: La conexión es cifrada (WSS)
3. **iframe**: Usa `sandbox` para limitar permisos
4. **CORS**: MeshCentral debe estar configurado para permitir tu dominio

### Recomendaciones

- ✅ Usar un usuario específico para la integración (no admin)
- ✅ Limitar permisos del usuario solo a lectura de dispositivos
- ✅ Monitorear logs de acceso en MeshCentral
- ✅ Considerar usar Login Tokens en lugar de password directo

---

## 🚀 PRÓXIMAS MEJORAS POSIBLES

- [ ] Backend proxy para evitar exponer credenciales en el frontend
- [ ] Login Tokens en lugar de username/password
- [ ] Filtrado por grupos específicos
- [ ] Gráficos de historial de conectividad
- [ ] Notificaciones push cuando un equipo se desconecta
- [ ] Integración con el sistema de equipamientos (vincular nodos MeshCentral con equipos registrados)

---

## 📞 SOPORTE

Si necesitas ayuda con la configuración del servidor MeshCentral, contacta al administrador del servidor en `mesh.donnet.com.ar`.

Para problemas del dashboard, contacta a **Sistemas PEDSA**.
